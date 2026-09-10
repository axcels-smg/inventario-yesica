import { createContext, useContext, useEffect, useState } from "react"
import { collection, query, where } from "firebase/firestore"
import { db } from "../firebase"
import { useTienda } from "./TiendaContext"
import { obtenerTiempoFecha } from "../utils/fechas"
import { invalidarCacheTienda } from "../utils/consultasTienda"
import { esErrorCuota } from "../utils/cuotaFirebase"
import { escucharQuery } from "../utils/firestoreLive"

const OperacionesLiveContext = createContext(null)

export function useOperacionesLive() {
  const ctx = useContext(OperacionesLiveContext)
  if (!ctx) {
    throw new Error("useOperacionesLive debe usarse dentro de OperacionesLiveProvider")
  }
  return ctx
}

function ordenarClientes(lista) {
  return [...lista].sort((a, b) =>
    String(a.nombre || "").localeCompare(String(b.nombre || ""), "es")
  )
}

function ordenarVentas(lista) {
  return [...lista].sort(
    (a, b) =>
      obtenerTiempoFecha(b.fecha || b.fechaTexto) -
      obtenerTiempoFecha(a.fecha || a.fechaTexto)
  )
}

export function OperacionesLiveProvider({ children }) {
  const { tiendaActual } = useTienda()
  const [clientes, setClientes] = useState([])
  const [ventas, setVentas] = useState([])
  const [cargandoClientes, setCargandoClientes] = useState(true)
  const [cargandoVentas, setCargandoVentas] = useState(true)

  const tiendaId = tiendaActual?.id || ""

  useEffect(() => {
    if (!tiendaId) {
      setClientes([])
      setVentas([])
      setCargandoClientes(false)
      setCargandoVentas(false)
      return undefined
    }

    setCargandoClientes(true)
    setCargandoVentas(true)

    const unsubClientes = escucharQuery(
      query(collection(db, "clientes"), where("tiendaId", "==", tiendaId)),
      (snap) => {
        setClientes(ordenarClientes(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
        invalidarCacheTienda("clientes", tiendaId)
        setCargandoClientes(false)
      },
      (error) => {
        if (!esErrorCuota(error)) console.error(error)
        setCargandoClientes(false)
      }
    )

    const unsubVentas = escucharQuery(
      query(collection(db, "ventas"), where("tiendaId", "==", tiendaId)),
      (snap) => {
        setVentas(ordenarVentas(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
        invalidarCacheTienda("ventas", tiendaId)
        setCargandoVentas(false)
      },
      (error) => {
        if (!esErrorCuota(error)) console.error(error)
        setCargandoVentas(false)
      }
    )

    return () => {
      unsubClientes()
      unsubVentas()
    }
  }, [tiendaId])

  return (
    <OperacionesLiveContext.Provider
      value={{
        clientes,
        setClientes,
        ventas,
        setVentas,
        cargandoClientes,
        cargandoVentas,
      }}
    >
      {children}
    </OperacionesLiveContext.Provider>
  )
}
