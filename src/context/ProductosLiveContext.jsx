import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { collection, onSnapshot, query, where } from "firebase/firestore"
import { db } from "../firebase"
import { useTienda } from "./TiendaContext"
import { filtrarProductosStockBajo } from "../utils/stock"
import { iniciarReintentoAjustes } from "../utils/ajusteStock"
import { esErrorCuota } from "../utils/cuotaFirebase"

const ProductosLiveContext = createContext(null)

export function useProductosLive() {
  const ctx = useContext(ProductosLiveContext)
  if (!ctx) {
    throw new Error("useProductosLive debe usarse dentro de ProductosLiveProvider")
  }
  return ctx
}

function claveStorage(tiendaId) {
  return `inventario_productos_${tiendaId}`
}

function leerLocal(tiendaId) {
  try {
    const raw = sessionStorage.getItem(claveStorage(tiendaId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function guardarLocal(tiendaId, productos) {
  try {
    sessionStorage.setItem(claveStorage(tiendaId), JSON.stringify(productos))
  } catch {
    /* ignore quota on storage */
  }
}

export function ProductosLiveProvider({ children }) {
  const { tiendaActual } = useTienda()
  const [productos, setProductos] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    iniciarReintentoAjustes()
  }, [])

  useEffect(() => {
    if (!tiendaActual?.id) {
      setProductos([])
      setCargando(false)
      return
    }

    const locales = leerLocal(tiendaActual.id)
    if (locales.length) {
      setProductos(locales)
      setCargando(false)
    } else {
      setCargando(true)
    }

    const q = query(
      collection(db, "productos"),
      where("tiendaId", "==", tiendaActual.id)
    )

    const unsub = onSnapshot(
      q,
      (snap) => {
        const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        setProductos(lista)
        guardarLocal(tiendaActual.id, lista)
        setCargando(false)
      },
      (error) => {
        if (!esErrorCuota(error)) {
          console.error(error)
        }
        setCargando(false)
      }
    )

    return unsub
  }, [tiendaActual?.id])

  const stockBajo = useMemo(
    () => filtrarProductosStockBajo(productos),
    [productos]
  )

  const value = {
    productos,
    setProductos,
    cargando,
    cantidadStockBajo: stockBajo.length,
    productosStockBajo: stockBajo,
  }

  return (
    <ProductosLiveContext.Provider value={value}>
      {children}
    </ProductosLiveContext.Provider>
  )
}
