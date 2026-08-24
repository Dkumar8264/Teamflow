const AppError = require('../utils/AppError');

/**
 * Minimal in-process sliding-window rate limiter.
 *
 * Deliberately dependency-free. Two consequences worth knowing:
 *  - State is per-process, so with more than one API instance the effective limit is
 *    (limit x instance count). Move to a shared Redis store if this scales out.
 *  - State is lost on restart, so a redeploy resets all counters.
 * For a single free-tier instance this is adequate protection against credential
 * stuffing and reset-email flooding.
 */

const buckets = new Map();

// Drop stale buckets periodically so the map cannot grow unbounded from unique IPs.
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

const sweep = () => {
  const now = Date.now();

  buckets.forEach((hits, key) => {
    const live = hits.filter((timestamp) => timestamp > now - SWEEP_INTERVAL_MS);

    if (live.length === 0) {
      buckets.delete(key);
    } else {
      buckets.set(key, live);
    }
  });
};

const sweepTimer = setInterval(sweep, SWEEP_INTERVAL_MS);
// Do not hold the event loop open on shutdown.
if (typeof sweepTimer.unref === 'function') {
  sweepTimer.unref();
}

const getClientIp = (req) => {
  // Render and Vercel terminate TLS upstream, so the direct socket address is the proxy.
  // `trust proxy` is enabled in server.js, which makes req.ip honour X-Forwarded-For.
  return req.ip || req.socket?.remoteAddress || 'unknown';
};

/**
 * @param {object} options
 * @param {number} options.limit    max requests allowed per window
 * @param {number} options.windowMs window length in milliseconds
 * @param {string} options.name     label used in the bucket key and logs
 * @param {boolean} [options.byEmail] also partition by req.body.email, so one attacker
 *                                    cannot exhaust a victim's per-account budget from
 *                                    a different IP, and vice versa
 */
const rateLimit = ({ limit, windowMs, name, byEmail = false }) => (req, res, next) => {
  const parts = [name, getClientIp(req)];

  if (byEmail) {
    parts.push(String(req.body?.email || '').trim().toLowerCase());
  }

  const key = parts.join('|');
  const now = Date.now();
  const windowStart = now - windowMs;
  const hits = (buckets.get(key) || []).filter((timestamp) => timestamp > windowStart);

  if (hits.length >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((hits[0] + windowMs - now) / 1000));

    res.set('Retry-After', String(retryAfterSeconds));
    console.warn('[ratelimit] Blocked request', { name, ip: getClientIp(req) });

    return next(
      new AppError(`Too many attempts. Try again in ${retryAfterSeconds} seconds.`, 429)
    );
  }

  hits.push(now);
  buckets.set(key, hits);

  return next();
};

/**
 * Clears a bucket after a successful attempt so a legitimate user who mistyped their
 * password a few times is not left throttled.
 */
const resetRateLimit = ({ name, req, byEmail = false }) => {
  const parts = [name, getClientIp(req)];

  if (byEmail) {
    parts.push(String(req.body?.email || '').trim().toLowerCase());
  }

  buckets.delete(parts.join('|'));
};

// Credential endpoints: tight, partitioned by both IP and target account.
const loginLimiter = rateLimit({ name: 'login', limit: 5, windowMs: 15 * 60 * 1000, byEmail: true });
const signupLimiter = rateLimit({ name: 'signup', limit: 5, windowMs: 60 * 60 * 1000 });
const googleLimiter = rateLimit({ name: 'google', limit: 10, windowMs: 15 * 60 * 1000 });

// Email-sending endpoints: tighter still, since abuse costs money and reputation.
const forgotPasswordLimiter = rateLimit({
  name: 'forgot-password',
  limit: 3,
  windowMs: 15 * 60 * 1000,
  byEmail: true
});
const resetPasswordLimiter = rateLimit({
  name: 'reset-password',
  limit: 5,
  windowMs: 15 * 60 * 1000
});
const resendVerificationLimiter = rateLimit({
  name: 'resend-verification',
  limit: 3,
  windowMs: 15 * 60 * 1000,
  byEmail: true
});

// Refresh is called routinely by every client, so this only catches abuse.
const refreshLimiter = rateLimit({ name: 'refresh', limit: 30, windowMs: 15 * 60 * 1000 });

module.exports = {
  rateLimit,
  resetRateLimit,
  loginLimiter,
  signupLimiter,
  googleLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
  resendVerificationLimiter,
  refreshLimiter
};
