import { useCallback, useEffect, useState } from "react"
import { listarPorTienda } from "../utils/consultasTienda"
import { filtrarProductosStockBajo } from "../utils/stock"

export function useStockBajo(tiendaId) {
  const [cantidad, setCantidad] = useState(0)
  const [productos, setProductos] = useState([])
  const [cargando, setCargando] = useState(true)

  const recargar = useCallback(async () => {
    if (!tiendaId) {
      setProductos([])
      setCantidad(0)
      setCargando(false)
      return
    }

    try {
      setCargando(true)
      const deEstaTienda = await listarPorTienda("productos", tiendaId)
      const lista = filtrarProductosStockBajo(deEstaTienda)

      setProductos(lista)
      setCantidad(lista.length)
    } catch (error) {
      console.error("Error cargando productos con stock bajo:", error.message, error)
      setProductos([])
      setCantidad(0)
    } finally {
      setCargando(false)
    }
  }, [tiendaId])

  useEffect(() => {
    recargar()
  }, [recargar])

  return { cantidad, productos, cargando, recargar }
}
