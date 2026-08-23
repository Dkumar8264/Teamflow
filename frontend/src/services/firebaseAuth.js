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
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
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
  return signInWithPopup(auth, provider);
};

export const doPhoneSignIn = async (phoneNumber) => {
  const appVerifier = window.recaptchaVerifier;
  return signInWithPhoneNumber(auth, phoneNumber, appVerifier);
};

export const doVerifyPhoneNumber = async (phoneNumber) => {
  window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('sign-in-button');
  return signInWithPhoneNumber(auth, phoneNumber, window.recaptchaVerifier);
};

export const onAuthStateChangedListener = (callback) => {
  return onAuthStateChanged(auth, callback);
};

export const isUserSignedIn = () => {
  return auth.currentUser !== null;
};