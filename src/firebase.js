import { initializeApp } from "firebase/app"
import { getFirestore } from "firebase/firestore"

// Configuración Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBZX2IoQDD-iWNzZ5XydL68aE1dZHyfsm4",
  authDomain: "inventario-yesica-db01c.firebaseapp.com",
  projectId: "inventario-yesica-db01c",
  storageBucket: "inventario-yesica-db01c.appspot.com",
  messagingSenderId: "461672703245",
  appId: "1:461672703245:web:0c4e577c1fa21f75577c44"
}

// Inicializar Firebase
const app = initializeApp(firebaseConfig)

// Firestore DB
export const db = getFirestore(app)