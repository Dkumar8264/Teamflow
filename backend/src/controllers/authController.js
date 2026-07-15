const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;
const MIN_PASSWORD_LENGTH = 8;

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

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

  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    errors.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

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

const signJwt = (payload, secret, expiresIn) => {
  if (!secret) {
    throw new Error('JWT secret is required');
  }

  return jwt.sign(payload, secret, { expiresIn });
};

const createTokenPair = (userId) => {
  const id = userId.toString();

  return {
    token: signJwt(
      { sub: id, type: 'access' },
      process.env.JWT_SECRET,
      process.env.JWT_EXPIRES_IN || '7d'
    ),
    refreshToken: signJwt(
      { sub: id, type: 'refresh' },
      process.env.JWT_REFRESH_SECRET,
      process.env.JWT_REFRESH_EXPIRES_IN || '7d'
    )
  };
};

const sendAuthResponse = (res, statusCode, user) => {
  const tokens = createTokenPair(user._id);

  return res.status(statusCode).json({
    success: true,
    user,
    ...tokens
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

    const user = await User.create(value);

    console.info('[auth] User signed up', { userId: user._id.toString() });
    return sendAuthResponse(res, 201, user);
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
      throw new AppError('Invalid email or password', 401);
    }

    user.password = undefined;

    console.info('[auth] User logged in', { userId: user._id.toString() });
    return sendAuthResponse(res, 200, user);
  } catch (error) {
    return next(error);
  }
};

const refreshToken = async (req, res, next) => {
  try {
    const token = req.body.refreshToken;

    if (!token || typeof token !== 'string') {
      throw new AppError('Refresh token is required', 400);
    }

    // Phase 1 uses stateless refresh tokens. Persisted rotation can be added later.
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);

    if (decoded.type !== 'refresh') {
      throw new AppError('Invalid refresh token', 401);
    }

    const user = await User.findById(decoded.sub);

    if (!user) {
      throw new AppError('Invalid refresh token', 401);
    }

    console.info('[auth] Token refreshed', { userId: user._id.toString() });
    return sendAuthResponse(res, 200, user);
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return next(new AppError('Invalid or expired refresh token', 401));
    }

    return next(error);
  }
};

const getMe = async (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
};

module.exports = {
  signup,
  login,
  refreshToken,
  getMe
};
