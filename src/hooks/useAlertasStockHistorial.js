import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  obtenerHistorialAlertas,
  generarListaAcumulativa,
  filtrarAlertasDelCiclo,
  registrarCicloDiarioTienda,
  registrarAlertaDiaria,
} from "../utils/alertasStock"
import { esErrorCuota } from "../utils/cuotaFirebase"
import { STOCK_BAJO_UMBRAL } from "../constants/inventario"

export function useAlertasStockHistorial(tiendaId, productos = [], productosListos = true) {
  const [alertas, setAlertas] = useState([])
  const [listaAcumulativa, setListaAcumulativa] = useState([])
  const [cargando, setCargando] = useState(true)
  const productosRef = useRef(productos)
  const cicloGuardadoRef = useRef("")

  useEffect(() => {
    productosRef.current = productos
  }, [productos])

  const firmaStock = useMemo(
    () =>
      productos
        .filter((p) => Number(p.stock) <= STOCK_BAJO_UMBRAL)
        .map((p) => `${p.id}:${p.stock}`)
        .sort()
        .join("|"),
    [productos]
  )

  const cargarAlertas = useCallback(async () => {
    if (!tiendaId) {
      setAlertas([])
      setListaAcumulativa([])
      setCargando(false)
      return
    }

    try {
      setCargando(true)
      const historial = filtrarAlertasDelCiclo(
        await obtenerHistorialAlertas(tiendaId)
      ).sort((a, b) => String(b.fechaKey).localeCompare(String(a.fechaKey)))

      setAlertas(historial)
      setListaAcumulativa(generarListaAcumulativa(historial, productosRef.current))
    } catch (error) {
      if (!esErrorCuota(error)) {
        console.error("Error al cargar alertas:", error)
        setAlertas([])
        setListaAcumulativa([])
      }
    } finally {
      setCargando(false)
    }
  }, [tiendaId])

  useEffect(() => {
    if (!tiendaId) {
      cicloGuardadoRef.current = ""
      setAlertas([])
      setListaAcumulativa([])
      setCargando(false)
      return
    }
    if (!productosListos) return

    let cancelado = false

    async function iniciarCicloYCargar() {
      setCargando(true)
      try {
        if (cicloGuardadoRef.current !== tiendaId) {
          await registrarCicloDiarioTienda(productosRef.current, tiendaId)
          if (cancelado) return
          cicloGuardadoRef.current = tiendaId
        }
        const historial = filtrarAlertasDelCiclo(
          await obtenerHistorialAlertas(tiendaId)
        ).sort((a, b) => String(b.fechaKey).localeCompare(String(a.fechaKey)))
        if (cancelado) return
        setAlertas(historial)
        setListaAcumulativa(generarListaAcumulativa(historial, productosRef.current))
      } catch (error) {
        if (!esErrorCuota(error)) {
          console.error("Error al cargar alertas:", error)
          if (!cancelado) {
            cicloGuardadoRef.current = ""
            setAlertas([])
            setListaAcumulativa([])
          }
        }
      } finally {
        if (!cancelado) setCargando(false)
      }
    }

    iniciarCicloYCargar()
    return () => {
      cancelado = true
    }
  }, [tiendaId, productosListos])

  useEffect(() => {
    if (!tiendaId || !productosListos || !cicloGuardadoRef.current) return undefined

    const t = window.setTimeout(() => {
      registrarAlertaDiaria(productosRef.current, tiendaId)
        .then(() => cargarAlertas())
        .catch((error) => {
          if (!esErrorCuota(error)) console.error(error)
        })
    }, 2000)

    return () => window.clearTimeout(t)
  }, [tiendaId, productosListos, firmaStock, cargarAlertas])

  return {
    alertas,
    listaAcumulativa,
    cargando,
    recargar: cargarAlertas,
  }
}
