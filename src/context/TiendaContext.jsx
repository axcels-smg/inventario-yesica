import { createContext, useContext, useState, useEffect } from "react"
import { collection, getDocs, doc, getDoc } from "firebase/firestore"
import { db } from "../firebase"
import { useAuth } from "./AuthContext"
import { esErrorCuota } from "../utils/cuotaFirebase"

const TiendaContext = createContext()

export function useTienda() {
  const context = useContext(TiendaContext)
  if (!context) {
    throw new Error("useTienda debe usarse dentro de TiendaProvider")
  }
  return context
}

export function TiendaProvider({ children }) {
  const { tienda: tiendaAuth, cargando: cargandoAuth } = useAuth()
  const [tiendaActual, setTiendaActual] = useState(null)
  const [tiendas, setTiendas] = useState([])
  const [cargando, setCargando] = useState(true)

  const tiendaPropia = tiendaAuth
  const esTiendaPropia = !tiendaActual?.id || !tiendaPropia?.id || tiendaActual.id === tiendaPropia.id

  useEffect(() => {
    if (!cargandoAuth && tiendaAuth) {
      setTiendaActual(tiendaAuth)
    }
  }, [cargandoAuth, tiendaAuth])

  useEffect(() => {
    if (cargandoAuth) return
    if (tiendaAuth) {
      cargarTodasLasTiendas()
    } else {
      setTiendas([])
      setCargando(false)
    }
  }, [cargandoAuth, tiendaAuth])

  async function cargarTodasLasTiendas() {
    try {
      setCargando(true)
      const querySnapshot = await getDocs(collection(db, "Tienda"))
      const lista = []
      querySnapshot.forEach((docu) => {
        lista.push({ id: docu.id, ...docu.data() })
      })
      setTiendas(lista)
    } catch (error) {
      if (!esErrorCuota(error)) {
        console.error("Error cargando tiendas:", error)
      }
    } finally {
      setCargando(false)
    }
  }

  function seleccionarTienda(tienda) {
    setTiendaActual(tienda)
  }

  function volverAMiTienda() {
    if (tiendaPropia) setTiendaActual(tiendaPropia)
  }

  async function obtenerTiendaPorId(tiendaId) {
    try {
      const docRef = doc(db, "Tienda", tiendaId)
      const docSnap = await getDoc(docRef)
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() }
      }
      return null
    } catch (error) {
      console.error("Error obteniendo tienda:", error)
      return null
    }
  }

  const value = {
    tiendaActual,
    tiendaPropia,
    esTiendaPropia,
    tiendas,
    cargando: cargando || cargandoAuth,
    seleccionarTienda,
    volverAMiTienda,
    cargarTiendas: cargarTodasLasTiendas,
    obtenerTiendaPorId,
  }

  return (
    <TiendaContext.Provider value={value}>
      {children}
    </TiendaContext.Provider>
  )
}
