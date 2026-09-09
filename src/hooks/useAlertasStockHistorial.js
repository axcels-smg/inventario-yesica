import { useEffect, useRef, useState } from "react"
import {
  obtenerHistorialAlertas,
  generarListaAcumulativa,
  filtrarAlertasDelCiclo,
  registrarCicloDiarioTienda,
} from "../utils/alertasStock"
import { esErrorCuota } from "../utils/cuotaFirebase"

export function useAlertasStockHistorial(tiendaId, productos = [], productosListos = true) {
  const [alertas, setAlertas] = useState([])
  const [listaAcumulativa, setListaAcumulativa] = useState([])
  const [cargando, setCargando] = useState(true)
  const productosRef = useRef(productos)
  productosRef.current = productos
  const cicloGuardadoRef = useRef("")

  async function cargarAlertas() {
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
      const acumulativa = generarListaAcumulativa(historial)

      setAlertas(historial)
      setListaAcumulativa(acumulativa)
    } catch (error) {
      if (!esErrorCuota(error)) {
        console.error("Error al cargar alertas:", error)
        setAlertas([])
        setListaAcumulativa([])
      }
    } finally {
      setCargando(false)
    }
  }

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
        setListaAcumulativa(generarListaAcumulativa(historial))
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

  return {
    alertas,
    listaAcumulativa,
    cargando,
    recargar: cargarAlertas,
  }
}
