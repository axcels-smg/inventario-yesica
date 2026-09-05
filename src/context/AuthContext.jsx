import { createContext, useContext, useState, useEffect } from "react"
import { auth } from "../firebase"
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import { db } from "../firebase"
import { esErrorCuota } from "../utils/cuotaFirebase"

const AuthContext = createContext()

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth debe usarse dentro de AuthProvider")
  }
  return context
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [tienda, setTienda] = useState(null)
  const [cargando, setCargando] = useState(true)

  async function cargarTiendaPorUID(uid) {
    try {
      const tiendaSnap = await getDoc(doc(db, "Tienda", uid))

      if (tiendaSnap.exists()) {
        const tiendaData = tiendaSnap.data()
        const datos = { id: tiendaSnap.id, ...tiendaData }
        setTienda(datos)
        return tiendaData
      }

      setTienda(null)
      return null
    } catch (error) {
      if (!esErrorCuota(error)) {
        setTienda(null)
      }
      return null
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUsuario(user)

      if (user) {
        await cargarTiendaPorUID(user.uid)
      } else {
        setTienda(null)
      }

      setCargando(false)
    })

    return unsubscribe
  }, [])

  async function login(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      const user = userCredential.user
      const tiendaData = await cargarTiendaPorUID(user.uid)
      return { success: true, user, tienda: tiendaData }
    } catch (error) {
      console.error("Error en login:", error)

      const mensajes = {
        "auth/invalid-email": "Email inválido",
        "auth/user-not-found": "Usuario no encontrado",
        "auth/wrong-password": "Contraseña incorrecta",
        "auth/too-many-requests": "Demasiados intentos. Intente más tarde",
        "auth/invalid-credential": "Email o contraseña incorrectos",
      }

      return {
        success: false,
        error: mensajes[error.code] || "Error al iniciar sesión. Intente nuevamente.",
      }
    }
  }

  async function logout() {
    try {
      await signOut(auth)
      setUsuario(null)
      setTienda(null)
      return { success: true }
    } catch (error) {
      console.error("Error en logout:", error)
      return { success: false, error: error.message }
    }
  }

  async function recuperarPassword(email) {
    try {
      await sendPasswordResetEmail(auth, email)
      return { success: true }
    } catch (error) {
      console.error("Error al recuperar contraseña:", error)

      const mensajes = {
        "auth/invalid-email": "Email inválido",
        "auth/user-not-found": "Usuario no encontrado",
      }

      return {
        success: false,
        error: mensajes[error.code] || "Error al enviar el correo. Intente nuevamente.",
      }
    }
  }

  async function cambiarPassword(passwordActual, passwordNueva) {
    try {
      const user = auth.currentUser
      if (!user?.email) {
        return { success: false, error: "No hay sesión activa. Entra primero a la tienda." }
      }

      try {
        await updatePassword(user, passwordNueva)
        return { success: true }
      } catch (errorInterno) {
        if (errorInterno.code !== "auth/requires-recent-login") {
          throw errorInterno
        }
        if (!passwordActual) {
          return {
            success: false,
            error: "Tu sesión es antigua. Escribe la contraseña actual. Si no la recuerdas, usa un Gmail real en Firebase para restablecerla.",
          }
        }
        const credencial = EmailAuthProvider.credential(user.email, passwordActual)
        await reauthenticateWithCredential(user, credencial)
        await updatePassword(user, passwordNueva)
        return { success: true }
      }
    } catch (error) {
      console.error("Error al cambiar contraseña:", error)

      const mensajes = {
        "auth/wrong-password": "La contraseña actual es incorrecta",
        "auth/invalid-credential": "La contraseña actual es incorrecta",
        "auth/weak-password": "La nueva contraseña debe tener al menos 6 caracteres",
        "auth/requires-recent-login": "Vuelve a iniciar sesión e inténtalo de nuevo",
      }

      return {
        success: false,
        error: mensajes[error.code] || "No se pudo cambiar la contraseña",
      }
    }
  }

  const value = {
    usuario,
    tienda,
    cargando,
    login,
    logout,
    recuperarPassword,
    cambiarPassword,
    cargarTiendaPorUID,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
