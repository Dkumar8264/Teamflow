const AppError = require('../utils/AppError');

let cachedApp = null;
let cachedAdmin;

/**
 * Loaded on first use rather than at require time.
 *
 * firebase-admin is only needed to verify Google sign-in tokens. A top-level require
 * would take the entire API down if the package were missing — a partially-failed
 * install, or a deploy that never enabled Google sign-in. Resolving it lazily keeps that
 * failure scoped to POST /api/auth/google, which already degrades to a 503.
 */
const loadAdmin = () => {
  if (cachedAdmin === undefined) {
    try {
      // eslint-disable-next-line global-require
      cachedAdmin = require('firebase-admin');
    } catch (error) {
      console.error('[firebase] firebase-admin is not installed', { message: error.message });
      cachedAdmin = null;
    }
  }

  return cachedAdmin;
};

// Accepts either raw JSON or base64-encoded JSON so the credential survives
// hosts that mangle multi-line env values (Render, Vercel).
const parseServiceAccount = (raw) => {
  const trimmed = raw.trim();
  const json = trimmed.startsWith('{')
    ? trimmed
    : Buffer.from(trimmed, 'base64').toString('utf8');

  try {
    return JSON.parse(json);
  } catch (error) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON or base64-encoded JSON');
  }
};

const getFirebaseApp = () => {
  if (cachedApp) {
    return cachedApp;
  }

  const admin = loadAdmin();

  if (!admin) {
    return null;
  }

  if (admin.apps.length > 0) {
    cachedApp = admin.apps[0];
    return cachedApp;
  }

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (serviceAccount) {
    cachedApp = admin.initializeApp({
      credential: admin.credential.cert(parseServiceAccount(serviceAccount))
    });
    console.info('[firebase] Admin SDK initialized from FIREBASE_SERVICE_ACCOUNT');
    return cachedApp;
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    cachedApp = admin.initializeApp({
      credential: admin.credential.applicationDefault()
    });
    console.info('[firebase] Admin SDK initialized from GOOGLE_APPLICATION_CREDENTIALS');
    return cachedApp;
  }

  return null;
};

/**
 * Whether Google sign-in can actually work: a credential is configured AND the SDK is
 * installed. Checking both means the boot-time warning reflects reality rather than just
 * whether an env var happens to be set.
 */
const isFirebaseConfigured = () =>
  Boolean(
    (process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS) &&
      loadAdmin()
  );

/**
 * Verifies a Firebase ID token and returns its decoded claims.
 * Throws an operational AppError so route handlers can surface a clean 401/503.
 */
const verifyFirebaseIdToken = async (idToken) => {
  if (!idToken || typeof idToken !== 'string') {
    throw new AppError('Firebase ID token is required', 400);
  }

  let app;

  try {
    app = getFirebaseApp();
  } catch (error) {
    console.error('[firebase] Admin SDK initialization failed', { message: error.message });
    throw new AppError('Google sign-in is misconfigured on the server', 503);
  }

  if (!app) {
    throw new AppError(
      'Google sign-in is not enabled. Set FIREBASE_SERVICE_ACCOUNT on the API server.',
      503
    );
  }

  try {
    return await loadAdmin().auth(app).verifyIdToken(idToken);
  } catch (error) {
    console.warn('[firebase] ID token verification failed', { code: error.code });
    throw new AppError('Invalid or expired Google sign-in token', 401);
  }
};

module.exports = {
  verifyFirebaseIdToken,
  isFirebaseConfigured
};
