import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { collection, getDocs, query, where } from "firebase/firestore"
import { db } from "../firebase"
import { useTienda } from "./TiendaContext"
import { filtrarProductosStockBajo } from "../utils/stock"
import { iniciarReintentoAjustes } from "../utils/ajusteStock"
import { esErrorCuota } from "../utils/cuotaFirebase"
import { escucharQuery } from "../utils/firestoreLive"

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

function fusionarTienda(prev, tiendaId, lista) {
  const ids = new Set(lista.map((p) => p.id))
  return [
    ...prev.filter((p) => p.tiendaId !== tiendaId && !ids.has(p.id)),
    ...lista,
  ]
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
  const ultimaCargaTodas = useRef(0)
  const todosRef = useRef(todos)
  todosRef.current = todos

  const tiendaVistaId = tiendaActual?.id || ""
  const tiendaPropiaId = tiendaPropia?.id || ""

  useEffect(() => {
    iniciarReintentoAjustes()
  }, [])

  useEffect(() => {
    const ids = [...new Set([tiendaPropiaId, tiendaVistaId].filter(Boolean))]
    if (ids.length === 0) {
      setCargando(false)
      return undefined
    }

    setCargando(true)
    const cortes = ids.map((tiendaId) =>
      escucharQuery(
        query(collection(db, "productos"), where("tiendaId", "==", tiendaId)),
        (snap) => {
          const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
          setTodos((prev) => {
            const next = fusionarTienda(prev, tiendaId, lista)
            guardarTodosLocal(next)
            return next
          })
          setCargando(false)
        },
        (error) => {
          if (!esErrorCuota(error)) console.error(error)
          setCargando(false)
        }
      )
    )

    return () => cortes.forEach((fn) => fn())
  }, [tiendaPropiaId, tiendaVistaId])

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
        const next = [...resto, ...unicos]
        guardarTodosLocal(next)
        return next
      })
    },
    [tiendaVistaId, tiendaPropiaId]
  )

  const aplicarCambiosStock = useCallback((cambios) => {
    if (!cambios?.length) return
    const mapa = new Map(cambios.filter((c) => c?.id).map((c) => [c.id, c]))
    setTodos((prev) => {
      const next = prev.map((p) => {
        const c = mapa.get(p.id)
        if (!c) return p
        const stock =
          c.stock != null
            ? Number(c.stock)
            : Number(p.stock || 0) + Number(c.delta || 0)
        return { ...p, stock }
      })
      guardarTodosLocal(next)
      return next
    })
  }, [])

  const cargarTodasLasTiendas = useCallback(async ({ force = false } = {}) => {
    const ahora = Date.now()
    if (!force && ahora - ultimaCargaTodas.current < 90_000 && todosRef.current.length > 0) {
      return todosRef.current
    }
    try {
      const snap = await getDocs(collection(db, "productos"))
      const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      ultimaCargaTodas.current = ahora
      setTodos(lista)
      guardarTodosLocal(lista)
      return lista
    } catch (error) {
      if (!esErrorCuota(error)) console.error(error)
      return todosRef.current
    }
  }, [])

  const stockBajo = useMemo(
    () => filtrarProductosStockBajo(productos),
    [productos]
  )

  const value = {
    productos,
    productosPropios,
    todosLosProductos: todos,
    setProductos,
    aplicarCambiosStock,
    cargarTodasLasTiendas,
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
