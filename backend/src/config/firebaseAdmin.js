const admin = require('firebase-admin');
const AppError = require('../utils/AppError');

let cachedApp = null;

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

const isFirebaseConfigured = () => Boolean(
  process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS
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
    return await admin.auth(app).verifyIdToken(idToken);
  } catch (error) {
    console.warn('[firebase] ID token verification failed', { code: error.code });
    throw new AppError('Invalid or expired Google sign-in token', 401);
  }
};

module.exports = {
  verifyFirebaseIdToken,
  isFirebaseConfigured
};
