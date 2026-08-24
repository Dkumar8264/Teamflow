import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

/**
 * Firebase web config.
 *
 * None of these values are secrets — a web API key is a public project identifier that
 * ships in every client bundle by design, and access is controlled by Firebase Security
 * Rules and the authorized-domains list, not by hiding it. They live in env vars so the
 * project can be pointed at a staging or production Firebase project without a code
 * change, with the current values as the fallback.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyB6e6ML51_h9CgLdYO9xgOCStlmLHZX70c',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'teamflow-11c9e.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'teamflow-11c9e',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'teamflow-11c9e.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '433033819465',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:433033819465:web:117e5f0c9bb00345f61698'
};

// Single initialization for the whole app. Firebase throws `app/duplicate-app` if a
// second initializeApp runs with different config, so nothing else should call it.
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
