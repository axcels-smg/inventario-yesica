import { useCallback, useEffect, useState } from "react"
import { esErrorCuota } from "../utils/cuotaFirebase"
import {
  sincronizarCicloDescuentos,
  obtenerHistorialDescuentos,
} from "../utils/reportePantallas"

export function useDescuentosPantallas(tiendaId, nombreTienda = "") {
  const [dias, setDias] = useState([])
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    if (!tiendaId) {
      setDias([])
      setCargando(false)
      return
    }
    try {
      setCargando(true)
      const historial = await sincronizarCicloDescuentos(tiendaId, nombreTienda)
      setDias(historial)
    } catch (error) {
      if (!esErrorCuota(error)) {
        console.error("Error ciclo pantallas:", error)
        try {
          setDias(await obtenerHistorialDescuentos(tiendaId))
        } catch {
          setDias([])
        }
      }
    } finally {
      setCargando(false)
    }
  }, [tiendaId, nombreTienda])

  useEffect(() => {
    cargar()
  }, [cargar])

  return { dias, cargando, recargar: cargar }
}
