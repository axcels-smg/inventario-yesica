import { createContext, useContext, useState, useEffect } from "react"
import { collection, getDocs, doc, getDoc } from "firebase/firestore"
import { db } from "../firebase"

const TiendaContext = createContext()

export function useTienda() {
  const context = useContext(TiendaContext)
  if (!context) {
    throw new Error("useTienda debe usarse dentro de TiendaProvider")
  }
  return context
}

export function TiendaProvider({ children }) {
  const [tiendaActual, setTiendaActual] = useState(null)
  const [tiendas, setTiendas] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    cargarTiendas()
  }, [])

  useEffect(() => {
    const tiendaGuardada = localStorage.getItem("tiendaActual")
    if (tiendaGuardada && tiendas.length > 0) {
      const tienda = tiendas.find((t) => t.id === tiendaGuardada)
      if (tienda) {
        setTiendaActual(tienda)
      }
    }
  }, [tiendas])

  async function cargarTiendas() {
    try {
      setCargando(true)
      const querySnapshot = await getDocs(collection(db, "tiendas"))
      const lista = []
      querySnapshot.forEach((docu) => {
        lista.push({ id: docu.id, ...docu.data() })
      })
      setTiendas(lista)
    } catch (error) {
      console.error("Error cargando tiendas:", error)
    } finally {
      setCargando(false)
    }
  }

  function seleccionarTienda(tienda) {
    setTiendaActual(tienda)
    localStorage.setItem("tiendaActual", tienda.id)
  }

  async function obtenerTiendaPorId(tiendaId) {
    try {
      const docRef = doc(db, "tiendas", tiendaId)
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
    tiendas,
    cargando,
    seleccionarTienda,
    cargarTiendas,
    obtenerTiendaPorId,
  }

  return (
    <TiendaContext.Provider value={value}>
      {children}
    </TiendaContext.Provider>
  )
}
