import { initializeApp } from "firebase/app"
import { getFirestore, initializeFirestore } from "firebase/firestore"
import { getAuth } from "firebase/auth"

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  throw new Error(
    "Faltan variables VITE_FIREBASE_* . Copia .env.example a .env en local, y en Vercel agrégalas en Settings → Environment Variables."
  )
}

// Inicializar Firebase
const app = initializeApp(firebaseConfig)

let db
try {
  db = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
  })
} catch {
  db = getFirestore(app)
}
export { db }

// Firebase Authentication
export const auth = getAuth(app)