import { createContext, useContext, useState, useEffect } from "react"
import { auth } from "../firebase"
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import { db } from "../firebase"

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

  // Cargar tienda por UID del usuario
  async function cargarTiendaPorUID(uid) {
    try {
      const tiendasRef = doc(db, "Tienda", uid)
      const tiendaSnap = await getDoc(tiendasRef)
      
      if (tiendaSnap.exists()) {
        const tiendaData = tiendaSnap.data()
        setTienda({
          id: tiendaSnap.id,
          ...tiendaData
        })
        return tiendaData
      } else {
        // Buscar tienda por campo authUid (si usamos ese campo)
        // Por ahora asumimos que el ID de la tienda es el UID del usuario
        setTienda(null)
        return null
      }
    } catch (error) {
      console.error("Error cargando tienda:", error)
      setTienda(null)
      return null
    }
  }

  // Escuchar cambios de autenticación
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

  // Login
  async function login(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      const user = userCredential.user
      
      // Cargar tienda del usuario
      await cargarTiendaPorUID(user.uid)
      
      return { success: true, user }
    } catch (error) {
      console.error("Error en login:", error)
      let mensaje = "Error al iniciar sesión"

      switch (error.code) {
        case "auth/invalid-email":
          mensaje = "Email inválido"
          break
        case "auth/user-not-found":
          mensaje = "Usuario no encontrado"
          break
        case "auth/wrong-password":
          mensaje = "Contraseña incorrecta"
          break
        case "auth/too-many-requests":
          mensaje = "Demasiados intentos. Intente más tarde"
          break
        default:
          return { success: false, error: error.message }
      }

      return { success: false, error: mensaje }
    }
  }

  // Logout
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

  // Recuperar contraseña
  async function recuperarPassword(email) {
    try {
      await sendPasswordResetEmail(auth, email)
      return { success: true }
    } catch (error) {
      console.error("Error al recuperar contraseña:", error)

      switch (error.code) {
        case "auth/invalid-email":
          return { success: false, error: "Email inválido" }
        case "auth/user-not-found":
          return { success: false, error: "Usuario no encontrado" }
        default:
          return { success: false, error: error.message }
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
    cargarTiendaPorUID
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
