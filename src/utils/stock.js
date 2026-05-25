import { STOCK_BAJO_UMBRAL } from "../constants/inventario"

export function esStockBajo(stock) {
  return Number(stock) <= STOCK_BAJO_UMBRAL
}

export function filtrarProductosStockBajo(productos) {
  return productos
    .filter((p) => esStockBajo(p.stock))
    .sort((a, b) => Number(a.stock) - Number(b.stock))
}
