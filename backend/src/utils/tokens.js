const crypto = require('crypto');

const TOKEN_BYTES = 32;

/**
 * Generates a 256-bit cryptographically random token, returned as hex.
 * The raw value is emailed to the user and never persisted; only its hash is stored.
 */
const generateSecureToken = () => crypto.randomBytes(TOKEN_BYTES).toString('hex');

/**
 * Hashes a token for storage. SHA-256 (not bcrypt) is correct here: these tokens are
 * already full-entropy random values, so they are not brute-forceable and do not need
 * a slow KDF. Hashing means a database read alone cannot be replayed as a valid token.
 */
const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

/**
 * Constant-time comparison of two hex digests of equal length.
 */
const safeCompare = (a, b) => {
  const bufferA = Buffer.from(String(a), 'utf8');
  const bufferB = Buffer.from(String(b), 'utf8');

  if (bufferA.length !== bufferB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufferA, bufferB);
};

const minutesFromNow = (minutes) => new Date(Date.now() + minutes * 60 * 1000);

module.exports = {
  generateSecureToken,
  hashToken,
  safeCompare,
  minutesFromNow
};
