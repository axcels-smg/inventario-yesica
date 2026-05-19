
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import {
  getFirestore,
} from "firebase/firestore"
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBZX2IoQDD-iWNzZ5XydL68aE1dZHyfsm4",
  authDomain: "inventario-yesica-db01c.firebaseapp.com",
  projectId: "inventario-yesica-db01c",
  storageBucket: "inventario-yesica-db01c.firebasestorage.app",
  messagingSenderId: "461672703245",
  appId: "1:461672703245:web:0c4e577c1fa21f75577c44"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const db = getFirestore(app)