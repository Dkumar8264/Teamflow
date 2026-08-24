const User = require('../models/User');
const AppError = require('../utils/AppError');
const { verifyAccessToken } = require('../utils/jwt');

const getBearerToken = (authorizationHeader = '') => {
  const [scheme, token] = authorizationHeader.split(' ');
  return scheme === 'Bearer' && token ? token : null;
};

const protect = async (req, res, next) => {
  try {
    const token = getBearerToken(req.headers.authorization);

    if (!token) {
      throw new AppError('Authorization token is required', 401);
    }

    // Pins algorithms/issuer/audience and enforces expiry. Throws AppError on failure.
    const decoded = verifyAccessToken(token);

    const user = await User.findById(decoded.sub);

    if (!user) {
      throw new AppError('User no longer exists', 401);
    }

    // A password change or reset invalidates every access token minted before it,
    // so a stolen token cannot outlive the credential it was issued against.
    if (user.isTokenStale(decoded.iat)) {
      throw new AppError('Session ended because the password changed', 401, undefined, 'TOKEN_STALE');
    }

    // Enforced here rather than in the UI so an unverified account cannot reach the
    // API by skipping the frontend. Provider accounts arrive pre-verified.
    if (user.provider === 'local' && !user.emailVerified) {
      throw new AppError(
        'Verify your email address to continue',
        403,
        undefined,
        'EMAIL_NOT_VERIFIED'
      );
    }

    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  protect,
  getBearerToken
};
