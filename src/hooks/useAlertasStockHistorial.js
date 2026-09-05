import { useEffect, useState } from "react"
import { obtenerHistorialAlertas, generarListaAcumulativa } from "../utils/alertasStock"
import { esErrorCuota } from "../utils/cuotaFirebase"

export function useAlertasStockHistorial(tiendaId) {
  const [alertas, setAlertas] = useState([])
  const [listaAcumulativa, setListaAcumulativa] = useState([])
  const [cargando, setCargando] = useState(true)

  async function cargarAlertas() {
    if (!tiendaId) {
      setAlertas([])
      setListaAcumulativa([])
      setCargando(false)
      return
    }

    try {
      setCargando(true)
      const historial = await obtenerHistorialAlertas(tiendaId)
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
    cargarAlertas()
  }, [tiendaId])

  return {
    alertas,
    listaAcumulativa,
    cargando,
    recargar: cargarAlertas,
  }
}
