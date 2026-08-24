import { auth } from "./firebaseConfig";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
} from "firebase/auth";

export { auth };

export const provider = new GoogleAuthProvider();

export const doCreateUserWithEmailAndPassword = async (email, password) => {
  return createUserWithEmailAndPassword(auth, email, password);
};

export const doSignInWithEmailAndPassword = async (email, password) => {
  return signInWithEmailAndPassword(auth, email, password);
};

export const doSignOut = async () => {
  return signOut(auth);
};

export const doSendPasswordResetEmail = async (email) => {
  return sendPasswordResetEmail(auth, email);
};

export const doSendEmailVerification = async () => {
  return sendEmailVerification(auth.currentUser);
};

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

export const onAuthStateChangedListener = (callback) => {
  return onAuthStateChanged(auth, callback);
};

export const isUserSignedIn = () => {
  return auth.currentUser !== null;
};