import { initializeApp } from "firebase/app"
import { getFirestore } from "firebase/firestore"
import { getAuth } from "firebase/auth"

// Configuración Firebase desde variables de entorno
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBZX2IoQDD-iWNzZ5XydL68aE1dZHyfsm4",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "inventario-yesica-db01c.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "inventario-yesica-db01c",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "inventario-yesica-db01c.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "461672703245",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:461672703245:web:0c4e577c1fa21f75577c44"
}

// Inicializar Firebase
const app = initializeApp(firebaseConfig)

// Firestore DB
export const db = getFirestore(app)

// Firebase Authentication
export const auth = getAuth(app)