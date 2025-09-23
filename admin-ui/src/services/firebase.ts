import { initializeApp } from "firebase/app";
import { getFunctions } from "firebase/functions";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

export const firebaseConfig = {
  apiKey: "AIzaSyB8ZL2jGATHOaW_SlnM_BsUzkl8iNncAxY",
  authDomain: "planplant-database.firebaseapp.com",
  projectId: "planplant-database",
  storageBucket: "planplant-database.firebasestorage.app",
  messagingSenderId: "1099168071504",
  appId: "1:1099168071504:web:4566f620437936ddcbb655",
  measurementId: "G-M21JKY300S",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, "customer-database");
export const functions = getFunctions(app, "asia-northeast3");
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
