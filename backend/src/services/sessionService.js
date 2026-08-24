const crypto = require('crypto');
const RefreshToken = require('../models/RefreshToken');
const { signAccessToken } = require('../utils/jwt');
const { generateSecureToken, hashToken } = require('../utils/tokens');

const REFRESH_COOKIE_NAME = 'tf_refresh';
const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 7);
const REFRESH_TTL_MS = REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000;

// The refresh cookie is only ever sent to the refresh and logout endpoints, so scoping
// the path keeps it off every other request — including any XSS-triggered fetch to a
// different route.
const REFRESH_COOKIE_PATH = '/api/auth';

const isProduction = () => process.env.NODE_ENV === 'production';

/**
 * Cookie attributes.
 *
 * SameSite: in production the SPA (vercel.app) and API (onrender.com) are different
 * registrable domains, so the request is cross-site and the cookie MUST be
 * `SameSite=None; Secure` or the browser will not send it at all. That removes SameSite
 * as a CSRF control, which is acceptable here because the only cookie-authenticated
 * endpoints are refresh and logout: CORS is a strict origin allowlist so a forged
 * cross-origin request cannot read the rotated token out of the response, and the worst
 * a blind CSRF achieves is rotating a token the victim still holds.
 *
 * In development both ends are on `localhost` (different ports are still same-site),
 * so `Lax` works and is the safer default.
 */
const getRefreshCookieOptions = () => ({
  httpOnly: true,
  secure: isProduction(),
  sameSite: isProduction() ? 'none' : 'lax',
  path: REFRESH_COOKIE_PATH,
  maxAge: REFRESH_TTL_MS
});

const setRefreshCookie = (res, token) => {
  res.cookie(REFRESH_COOKIE_NAME, token, getRefreshCookieOptions());
};

const clearRefreshCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    ...getRefreshCookieOptions(),
    maxAge: undefined
  });
};

const readRefreshCookie = (req) => req.cookies?.[REFRESH_COOKIE_NAME] || null;

/**
 * Issues a refresh token. Pass an existing `family` when rotating so reuse detection
 * can revoke the whole chain; omit it to start a new session.
 */
const issueRefreshToken = async (user, req, family = null) => {
  const token = generateSecureToken();

  await RefreshToken.create({
    user: user._id,
    tokenHash: hashToken(token),
    family: family || crypto.randomUUID(),
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    userAgent: String(req.headers['user-agent'] || '').slice(0, 200),
    ip: req.ip || ''
  });

  return token;
};

/**
 * Starts a session: new refresh family in an httpOnly cookie, short-lived access token
 * in the response body. The access token is never written to a cookie or to storage —
 * the client holds it in memory only.
 */
const startSession = async (res, req, user) => {
  const refreshToken = await issueRefreshToken(user, req);
  setRefreshCookie(res, refreshToken);

  return signAccessToken(user._id);
};

/**
 * Revokes every active refresh token for a user. Used on logout-everywhere and on
 * password reset, so a reset genuinely ends existing sessions.
 */
const revokeAllUserSessions = async (userId, reason) => {
  await RefreshToken.updateMany(
    { user: userId, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: reason } }
  );
};

const revokeFamily = async (family, reason) => {
  await RefreshToken.updateMany(
    { family, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: reason } }
  );
};

module.exports = {
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_PATH,
  REFRESH_TTL_DAYS,
  setRefreshCookie,
  clearRefreshCookie,
  readRefreshCookie,
  issueRefreshToken,
  startSession,
  revokeAllUserSessions,
  revokeFamily
};
