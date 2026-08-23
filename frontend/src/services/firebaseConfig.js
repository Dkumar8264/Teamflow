import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyB6e6ML51_h9CgLdYO9xgOCStlmLHZX70c",
  authDomain: "teamflow-11c9e.firebaseapp.com",
  projectId: "teamflow-11c9e",
  storageBucket: "teamflow-11c9e.firebasestorage.app",
  messagingSenderId: "433033819465",
  appId: "1:433033819465:web:117e5f0c9bb00345f61698",
  measurementId: "G-CK9S88NM8H"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const analytics = getAnalytics(app);

export { app, auth, db, analytics };