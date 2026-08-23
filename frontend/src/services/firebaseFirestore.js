import { db } from "./firebaseConfig";
import { collection, addDoc, getDocs, query, orderBy, onSnapshot, doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";

export const addCollectionData = async (collectionName, data) => {
  const colRef = collection(db, collectionName);
  return await addDoc(colRef, data);
};

export const getCollectionData = async (collectionName) => {
  const colRef = collection(db, collectionName);
  const snapshot = await getDocs(colRef);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

export const getCollectionDataRealtime = (collectionName, callback) => {
  const colRef = collection(db, collectionName);
  return onSnapshot(colRef, (snapshot) => {
    const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    callback(data);
  });
};

export const getDocumentData = async (collectionName, docId) => {
  const docRef = doc(db, collectionName, docId);
  const snap = await getDoc(docRef);
  return { id: snap.id, ...snap.data() };
};

export const updateDocumentData = async (collectionName, docId, data) => {
  const docRef = doc(db, collectionName, docId);
  return await updateDoc(docRef, data);
};

export const deleteDocumentData = async (collectionName, docId) => {
  const docRef = doc(db, collectionName, docId);
  return await deleteDoc(docRef);
};