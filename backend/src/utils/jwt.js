const jwt = require('jsonwebtoken');
const AppError = require('./AppError');

// HS256 with a high-entropy secret. Pinning a single algorithm on BOTH sign and verify
// is what makes `alg: none` and algorithm-confusion attacks impossible — an attacker
// cannot talk us into accepting an unsigned or differently-signed token.
const ALGORITHM = 'HS256';
const ISSUER = 'teamflow-api';
const AUDIENCE = 'teamflow-client';

// Short-lived by design: the refresh cookie is what provides session longevity, so a
// stolen access token is only useful for minutes.
const ACCESS_TOKEN_TTL = process.env.JWT_EXPIRES_IN || '15m';

const MIN_SECRET_LENGTH = 32;
const WEAK_SECRETS = new Set([
  'secret',
  'changeme',
  'jwtsecret',
  'your-secret-key',
  'teamflow',
  'supersecret'
]);

/**
 * Rejects secrets that are short or obviously placeholder. Called at boot so a
 * misconfigured deploy fails loudly instead of silently issuing forgeable tokens.
 */
const assertSecretStrength = (name, secret) => {
  const value = String(secret || '');

  if (!value) {
    throw new Error(`${name} is required`);
  }

  const problems = [];

  if (value.length < MIN_SECRET_LENGTH) {
    problems.push(`must be at least ${MIN_SECRET_LENGTH} characters (got ${value.length})`);
  }

  if (WEAK_SECRETS.has(value.toLowerCase())) {
    problems.push('is a well-known placeholder value');
  }

  if (/^(.)\1+$/.test(value)) {
    problems.push('is a single repeated character');
  }

  if (problems.length > 0) {
    const message = `${name} ${problems.join(' and ')}. Generate one with: openssl rand -base64 48`;

    if (process.env.NODE_ENV === 'production') {
      throw new Error(message);
    }

    console.warn(`[jwt] WEAK SECRET: ${message}`);
  }
};

const getAccessSecret = () => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is required');
  }

  return secret;
};

const signAccessToken = (userId) =>
  jwt.sign(
    { sub: userId.toString(), type: 'access' },
    getAccessSecret(),
    {
      algorithm: ALGORITHM,
      expiresIn: ACCESS_TOKEN_TTL,
      issuer: ISSUER,
      audience: AUDIENCE
    }
  );

/**
 * Verifies an access token. Throws an operational AppError on any failure so callers
 * never leak jsonwebtoken internals to the client.
 */
const verifyAccessToken = (token) => {
  let decoded;

  try {
    decoded = jwt.verify(token, getAccessSecret(), {
      // Whitelisting the algorithm here is the control that rejects `alg: none`.
      algorithms: [ALGORITHM],
      issuer: ISSUER,
      audience: AUDIENCE
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AppError('Access token has expired', 401, undefined, 'TOKEN_EXPIRED');
    }

    throw new AppError('Invalid or expired token', 401);
  }

  if (decoded.type !== 'access') {
    throw new AppError('Invalid access token', 401);
  }

  return decoded;
};

module.exports = {
  signAccessToken,
  verifyAccessToken,
  assertSecretStrength,
  ACCESS_TOKEN_TTL,
  ALGORITHM
};
