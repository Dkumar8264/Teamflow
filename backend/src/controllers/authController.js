const User = require('../models/User');
const AppError = require('../utils/AppError');
const { verifyFirebaseIdToken } = require('../config/firebaseAdmin');
const { signAccessToken } = require('../utils/jwt');
const { generateSecureToken, hashToken, minutesFromNow } = require('../utils/tokens');
const {
  startSession,
  readRefreshCookie,
  setRefreshCookie,
  clearRefreshCookie,
  issueRefreshToken,
  revokeFamily,
  revokeAllUserSessions
} = require('../services/sessionService');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/emailService');
const RefreshToken = require('../models/RefreshToken');
const { resetRateLimit } = require('../middleware/rateLimit');

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;
const MIN_PASSWORD_LENGTH = 8;
const VERIFICATION_TTL_MINUTES = 24 * 60;
const RESET_TTL_MINUTES = 15;

// Blocked outright regardless of length — these dominate credential-stuffing lists.
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', 'qwerty123',
  'letmein1', 'welcome1', 'iloveyou', 'admin123', 'football', 'baseball',
  'teamflow', 'changeme', 'passw0rd'
]);

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

/**
 * Rejects a client-supplied id that is not a plain string. Guards against a JSON body
 * value like {"$ne": null} reaching a Mongoose query and matching an arbitrary document.
 */
const asObjectIdString = (value, fieldName) => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value)) {
    throw new AppError(`${fieldName} must be a valid id`, 400);
  }

  return value;
};

const validatePassword = (password) => {
  const errors = [];

  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    errors.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    return errors;
  }

  if (password.length > 200) {
    // bcrypt silently truncates past 72 bytes; reject long inputs rather than accept a
    // password whose tail is ignored.
    errors.push('Password cannot exceed 200 characters');
  }

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push('That password is too common. Choose something less predictable.');
  }

  return errors;
};

const validateSignupInput = ({ name, email, password }) => {
  const errors = [];
  const cleanName = String(name || '').trim();
  const cleanEmail = normalizeEmail(email);

  if (cleanName.length < 2 || cleanName.length > 80) {
    errors.push('Name must be between 2 and 80 characters');
  }

  if (!EMAIL_REGEX.test(cleanEmail)) {
    errors.push('A valid email address is required');
  }

  errors.push(...validatePassword(password));

  return {
    errors,
    value: {
      name: cleanName,
      email: cleanEmail,
      password
    }
  };
};

const validateLoginInput = ({ email, password }) => {
  const errors = [];
  const cleanEmail = normalizeEmail(email);

  if (!EMAIL_REGEX.test(cleanEmail)) {
    errors.push('A valid email address is required');
  }

  if (typeof password !== 'string' || password.length === 0) {
    errors.push('Password is required');
  }

  return {
    errors,
    value: {
      email: cleanEmail,
      password
    }
  };
};

/**
 * Issues a verification token, persists only its hash, and emails the raw value.
 */
const issueVerificationEmail = async (user) => {
  const token = generateSecureToken();

  user.verificationTokenHash = hashToken(token);
  user.verificationTokenExpiresAt = minutesFromNow(VERIFICATION_TTL_MINUTES);
  await user.save({ validateModifiedOnly: true });

  await sendVerificationEmail({ email: user.email, name: user.name, token });
};

const sendSessionResponse = async (res, req, user, statusCode = 200) => {
  const accessToken = await startSession(res, req, user);

  return res.status(statusCode).json({
    success: true,
    user,
    // Held in memory by the client only. The refresh token is in an httpOnly cookie
    // and is deliberately absent from this body.
    token: accessToken
  });
};

const signup = async (req, res, next) => {
  try {
    const { errors, value } = validateSignupInput(req.body);

    if (errors.length > 0) {
      throw new AppError('Invalid signup input', 400, errors);
    }

    const existingUser = await User.findOne({ email: value.email });

    if (existingUser) {
      throw new AppError('Email is already registered', 409);
    }

    const user = await User.create({ ...value, provider: 'local', emailVerified: false });

    await issueVerificationEmail(user);

    console.info('[auth] User signed up, verification email sent', {
      userId: user._id.toString()
    });

    // No session is started: `protect` rejects unverified local accounts, so handing
    // out tokens here would only produce a client holding unusable credentials.
    return res.status(201).json({
      success: true,
      needsVerification: true,
      email: user.email,
      message: 'Check your email for a verification link to finish signing up.'
    });
  } catch (error) {
    return next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { errors, value } = validateLoginInput(req.body);

    if (errors.length > 0) {
      throw new AppError('Invalid login input', 400, errors);
    }

    const user = await User.findOne({ email: value.email }).select('+password');
    const passwordMatches = user ? await user.comparePassword(value.password) : false;

    if (!user || !passwordMatches) {
      // Identical response for unknown email and wrong password, so login cannot be
      // used to enumerate registered addresses.
      throw new AppError('Invalid email or password', 401);
    }

    if (user.provider === 'local' && !user.emailVerified) {
      throw new AppError(
        'Verify your email address before signing in',
        403,
        undefined,
        'EMAIL_NOT_VERIFIED'
      );
    }

    user.password = undefined;

    // Successful login clears the throttle so a user who mistyped is not left locked out.
    resetRateLimit({ name: 'login', req, byEmail: true });

    console.info('[auth] User logged in', { userId: user._id.toString() });
    return sendSessionResponse(res, req, user, 200);
  } catch (error) {
    return next(error);
  }
};

/**
 * Rotating refresh with reuse detection.
 *
 * Each refresh consumes the presented token and issues a successor in the same family.
 * Presenting an already-consumed token means the value leaked (or a stale client
 * replayed it), so the entire family is revoked and the session must be re-established.
 */
const refreshSession = async (req, res, next) => {
  try {
    const presented = readRefreshCookie(req);

    if (!presented) {
      throw new AppError('Refresh token is required', 401, undefined, 'NO_REFRESH_TOKEN');
    }

    const record = await RefreshToken.findOne({ tokenHash: hashToken(presented) });

    if (!record) {
      clearRefreshCookie(res);
      throw new AppError('Invalid refresh token', 401, undefined, 'INVALID_REFRESH_TOKEN');
    }

    if (record.revokedAt) {
      await revokeFamily(record.family, 'reuse_detected');
      clearRefreshCookie(res);
      console.warn('[auth] Refresh token reuse detected; family revoked', {
        userId: record.user.toString(),
        family: record.family
      });
      throw new AppError(
        'Session was ended for security reasons. Please sign in again.',
        401,
        undefined,
        'REFRESH_REUSE_DETECTED'
      );
    }

    if (record.expiresAt.getTime() <= Date.now()) {
      clearRefreshCookie(res);
      throw new AppError('Session expired. Please sign in again.', 401, undefined, 'SESSION_EXPIRED');
    }

    const user = await User.findById(record.user);

    if (!user) {
      await revokeFamily(record.family, 'logout');
      clearRefreshCookie(res);
      throw new AppError('User no longer exists', 401);
    }

    if (user.provider === 'local' && !user.emailVerified) {
      throw new AppError(
        'Verify your email address to continue',
        403,
        undefined,
        'EMAIL_NOT_VERIFIED'
      );
    }

    record.revokedAt = new Date();
    record.revokedReason = 'rotated';
    await record.save();

    const nextToken = await issueRefreshToken(user, req, record.family);
    setRefreshCookie(res, nextToken);

    return res.json({
      success: true,
      user,
      token: signAccessToken(user._id)
    });
  } catch (error) {
    return next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    const presented = readRefreshCookie(req);

    if (presented) {
      const record = await RefreshToken.findOne({ tokenHash: hashToken(presented) });

      if (record) {
        // Revoke the whole family, not just this token, so logout ends the session
        // rather than leaving a usable successor behind.
        await revokeFamily(record.family, 'logout');
      }
    }

    clearRefreshCookie(res);

    return res.json({ success: true, message: 'Logged out' });
  } catch (error) {
    return next(error);
  }
};

const verifyEmail = async (req, res, next) => {
  try {
    const token = req.body.token;

    if (!token || typeof token !== 'string') {
      throw new AppError('Verification token is required', 400);
    }

    const user = await User.findOne({
      verificationTokenHash: hashToken(token),
      verificationTokenExpiresAt: { $gt: new Date() }
    }).select('+verificationTokenHash +verificationTokenExpiresAt');

    if (!user) {
      throw new AppError(
        'This verification link is invalid or has expired. Request a new one.',
        400,
        undefined,
        'INVALID_VERIFICATION_TOKEN'
      );
    }

    user.emailVerified = true;
    // Single use: clear the token so the link cannot be replayed.
    user.verificationTokenHash = null;
    user.verificationTokenExpiresAt = null;
    await user.save({ validateModifiedOnly: true });

    console.info('[auth] Email verified', { userId: user._id.toString() });

    // The user just proved control of the address, so signing them in here is safe
    // and avoids an extra login step.
    return sendSessionResponse(res, req, user, 200);
  } catch (error) {
    return next(error);
  }
};

const resendVerification = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);

    if (!EMAIL_REGEX.test(email)) {
      throw new AppError('A valid email address is required', 400);
    }

    const user = await User.findOne({ email }).select(
      '+verificationTokenHash +verificationTokenExpiresAt'
    );

    if (user && user.provider === 'local' && !user.emailVerified) {
      await issueVerificationEmail(user);
    }

    // Always the same response, so this endpoint cannot be used to discover which
    // addresses are registered or already verified.
    return res.json({
      success: true,
      message: 'If that address needs verification, a new link is on its way.'
    });
  } catch (error) {
    return next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);

    if (!EMAIL_REGEX.test(email)) {
      throw new AppError('A valid email address is required', 400);
    }

    const user = await User.findOne({ email });

    // Provider accounts have no password to reset; silently skip them rather than
    // revealing which sign-in method an address uses.
    if (user && user.provider === 'local') {
      const token = generateSecureToken();

      user.passwordResetTokenHash = hashToken(token);
      user.passwordResetTokenExpiresAt = minutesFromNow(RESET_TTL_MINUTES);
      await user.save({ validateModifiedOnly: true });

      await sendPasswordResetEmail({
        email: user.email,
        name: user.name,
        token,
        expiresInMinutes: RESET_TTL_MINUTES
      });

      console.info('[auth] Password reset requested', { userId: user._id.toString() });
    }

    return res.json({
      success: true,
      message: 'If an account exists for that address, a reset link is on its way.'
    });
  } catch (error) {
    return next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    if (!token || typeof token !== 'string') {
      throw new AppError('Reset token is required', 400);
    }

    const passwordErrors = validatePassword(password);

    if (passwordErrors.length > 0) {
      throw new AppError('Invalid password', 400, passwordErrors);
    }

    const user = await User.findOne({
      passwordResetTokenHash: hashToken(token),
      passwordResetTokenExpiresAt: { $gt: new Date() }
    }).select('+password +passwordResetTokenHash +passwordResetTokenExpiresAt');

    if (!user) {
      throw new AppError(
        'This reset link is invalid or has expired. Request a new one.',
        400,
        undefined,
        'INVALID_RESET_TOKEN'
      );
    }

    // Assigning triggers the pre-save hook: bcrypt rehash plus a passwordChangedAt
    // stamp, which makes every previously-issued access token stale.
    user.password = password;
    // Single use.
    user.passwordResetTokenHash = null;
    user.passwordResetTokenExpiresAt = null;

    // Completing a reset also proves control of the mailbox.
    if (!user.emailVerified) {
      user.emailVerified = true;
    }

    await user.save();

    // Access tokens die via passwordChangedAt; refresh tokens must be revoked explicitly.
    await revokeAllUserSessions(user._id, 'password_changed');
    clearRefreshCookie(res);

    console.info('[auth] Password reset completed; all sessions revoked', {
      userId: user._id.toString()
    });

    user.password = undefined;

    return res.json({
      success: true,
      message: 'Password updated. Sign in with your new password.'
    });
  } catch (error) {
    return next(error);
  }
};

const getMe = async (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
};

const googleSignIn = async (req, res, next) => {
  try {
    const decoded = await verifyFirebaseIdToken(req.body.idToken);
    const email = normalizeEmail(decoded.email);

    if (!EMAIL_REGEX.test(email)) {
      throw new AppError('Google account did not provide a usable email address', 400);
    }

    // Must be strictly true. An absent claim is NOT proof of ownership, and this
    // endpoint links federated identities into existing local accounts by email —
    // so accepting `undefined` here would be an account-takeover path.
    if (decoded.email_verified !== true) {
      throw new AppError('Google account email is not verified', 403);
    }

    // Only accept tokens minted for this Firebase project.
    const expectedProject = process.env.FIREBASE_PROJECT_ID;

    if (expectedProject && decoded.aud !== expectedProject) {
      throw new AppError('Google sign-in token was issued for a different project', 401);
    }

    const name = String(decoded.name || '').trim() || email.split('@')[0];
    let user = await User.findOne({ email });

    if (user) {
      if (!user.firebaseUid) {
        user.firebaseUid = decoded.uid;
      }

      if (!user.avatarUrl && decoded.picture) {
        user.avatarUrl = decoded.picture;
      }

      // Google has attested the address, so a previously-unverified local account
      // becomes verified.
      if (!user.emailVerified) {
        user.emailVerified = true;
      }

      if (user.isModified()) {
        await user.save({ validateModifiedOnly: true });
      }

      console.info('[auth] Google sign-in for existing user', {
        userId: user._id.toString(),
        provider: user.provider
      });
    } else {
      user = await User.create({
        name: name.slice(0, 80),
        email,
        provider: 'google',
        firebaseUid: decoded.uid,
        avatarUrl: decoded.picture || '',
        emailVerified: true
      });

      console.info('[auth] Google sign-in provisioned new user', {
        userId: user._id.toString()
      });
    }

    return sendSessionResponse(res, req, user, 200);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  signup,
  login,
  refreshSession,
  logout,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  getMe,
  googleSignIn,
  asObjectIdString
};
