import { useEffect, useState } from "react"
import { obtenerHistorialAlertas, generarListaAcumulativa } from "../utils/alertasStock"

export function useAlertasStockHistorial() {
  const [alertas, setAlertas] = useState([])
  const [listaAcumulativa, setListaAcumulativa] = useState([])
  const [cargando, setCargando] = useState(true)

  async function cargarAlertas() {
    try {
      setCargando(true)
      const historial = await obtenerHistorialAlertas()
      const acumulativa = generarListaAcumulativa(historial)
      
      setAlertas(historial)
      setListaAcumulativa(acumulativa)
    } catch (error) {
      console.error("Error al cargar alertas:", error)
      setAlertas([])
      setListaAcumulativa([])
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargarAlertas()
  }, [])

  return {
    alertas,
    listaAcumulativa,
    cargando,
    recargar: cargarAlertas,
  }
}
