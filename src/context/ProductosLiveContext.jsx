import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { collection, onSnapshot } from "firebase/firestore"
import { db } from "../firebase"
import { useTienda } from "./TiendaContext"
import { filtrarProductosStockBajo } from "../utils/stock"
import { iniciarReintentoAjustes } from "../utils/ajusteStock"
import { esErrorCuota } from "../utils/cuotaFirebase"

const ProductosLiveContext = createContext(null)
const STORAGE_TODOS = "inventario_productos_todas"

export function useProductosLive() {
  const ctx = useContext(ProductosLiveContext)
  if (!ctx) {
    throw new Error("useProductosLive debe usarse dentro de ProductosLiveProvider")
  }
  return ctx
}

function leerTodosLocal() {
  try {
    const raw = sessionStorage.getItem(STORAGE_TODOS)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function guardarTodosLocal(productos) {
  try {
    sessionStorage.setItem(STORAGE_TODOS, JSON.stringify(productos))
  } catch {
    /* ignore */
  }
}

function agruparPorTienda(lista) {
  const mapa = {}
  lista.forEach((p) => {
    const id = p.tiendaId || ""
    if (!mapa[id]) mapa[id] = []
    mapa[id].push(p)
  })
  return mapa
}

export function ProductosLiveProvider({ children }) {
  const { tiendaActual, tiendaPropia } = useTienda()
  const [todos, setTodos] = useState(() => leerTodosLocal())
  const [cargando, setCargando] = useState(() => leerTodosLocal().length === 0)

  const tiendaVistaId = tiendaActual?.id || ""
  const tiendaPropiaId = tiendaPropia?.id || ""

  useEffect(() => {
    iniciarReintentoAjustes()
  }, [])

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "productos"),
      (snap) => {
        const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        setTodos(lista)
        guardarTodosLocal(lista)
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
  }, [])

  const porTienda = useMemo(() => agruparPorTienda(todos), [todos])

  const productos = useMemo(() => {
    const productosBase = porTienda[tiendaVistaId] || []
    const sin = porTienda[""] || []
    if (tiendaVistaId && tiendaVistaId === tiendaPropiaId) {
      return [
        ...productosBase,
        ...sin.filter((p) => !productosBase.some((x) => x.id === p.id)),
      ]
    }
    return productosBase
  }, [porTienda, tiendaVistaId, tiendaPropiaId])

  const productosPropios = useMemo(() => {
    const dePropia = porTienda[tiendaPropiaId] || []
    const sin = porTienda[""] || []
    if (!tiendaPropiaId) return productos
    return [
      ...dePropia,
      ...sin.filter((p) => !dePropia.some((x) => x.id === p.id)),
    ]
  }, [porTienda, tiendaPropiaId, productos])

  const setProductos = useCallback(
    (updater) => {
      if (!tiendaVistaId) return
      setTodos((prev) => {
        const pertenece = (p) =>
          p.tiendaId === tiendaVistaId ||
          (!p.tiendaId && tiendaVistaId === tiendaPropiaId)
        const deEsta = prev.filter(pertenece)
        const resto = prev.filter((p) => !pertenece(p))
        const nextEsta = typeof updater === "function" ? updater(deEsta) : updater
        const vistos = new Set()
        const unicos = []
        for (const p of nextEsta) {
          if (p?.id) {
            if (vistos.has(p.id)) continue
            vistos.add(p.id)
          }
          unicos.push(p)
        }
        return [...resto, ...unicos]
      })
    },
    [tiendaVistaId, tiendaPropiaId]
  )

  const stockBajo = useMemo(
    () => filtrarProductosStockBajo(productos),
    [productos]
  )

  const value = {
    productos,
    productosPropios,
    todosLosProductos: todos,
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
