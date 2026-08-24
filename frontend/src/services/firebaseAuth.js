import { auth } from './firebaseConfig';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';

export { auth };

/**
 * Firebase's only remaining job in this app is brokering the Google identity.
 *
 * Email/password accounts, email verification, and password resets are all owned by the
 * backend, which holds the single source of truth for users and issues the session the
 * app actually runs on. The Firebase email/password and email-sending helpers were
 * deliberately removed: calling them would create a second, parallel account store the
 * backend knows nothing about, and would send Firebase-branded emails whose links do
 * not go through our verification or reset endpoints.
 */
export const provider = new GoogleAuthProvider();

export const doGoogleSignIn = async () => {
  try {
    return await signInWithPopup(auth, provider);
  } catch (error) {
    // Preserve the Firebase error code so callers can map it to readable copy.
    const wrapped = new Error(error.message);
    wrapped.code = error.code;
    throw wrapped;
  }
};

export const doSignOut = async () => signOut(auth);
