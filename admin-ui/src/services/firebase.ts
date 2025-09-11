import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB8ZL2jGATHOaW_SlnM_BsUzkl8iNncAxY",
  authDomain: "planplant-database.firebaseapp.com",
  projectId: "planplant-database",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
// 보조 DB(customer-database)
export const db = getFirestore(app, "customer-database");
