import { filtrarProductosStockBajo } from "../utils/stock"
import { useProductosLive } from "../context/ProductosLiveContext"

export function useStockBajo() {
  const { productos, cargando } = useProductosLive()
  const lista = filtrarProductosStockBajo(productos)

  return {
    cantidad: lista.length,
    productos: lista,
    cargando,
    recargar: () => {},
  }
}
