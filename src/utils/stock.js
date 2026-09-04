import { STOCK_BAJO_UMBRAL } from "../constants/inventario"

export function esStockAgotado(stock) {
  return Number(stock) <= 0
}

export function esStockBajo(stock) {
  return Number(stock) <= STOCK_BAJO_UMBRAL
}

export function etiquetaEstadoStock(stock) {
  if (esStockAgotado(stock)) return "Agotado"
  if (esStockBajo(stock)) return "Poco stock"
  return "OK"
}

export function filtrarProductosStockBajo(productos) {
  return productos
    .filter((p) => esStockBajo(p.stock))
    .sort((a, b) => Number(a.stock) - Number(b.stock))
}

export function resumenStockBajo(productos) {
  const lista = filtrarProductosStockBajo(productos)
  const agotados = lista.filter((p) => esStockAgotado(p.stock)).length

  return {
    lista,
    total: lista.length,
    agotados,
    poco: lista.length - agotados,
  }
}

export function nombreProductoStock(producto) {
  return (
    `${producto?.marca || ""} ${producto?.modelo || ""}`.trim() ||
    producto?.nombre ||
    "Producto"
  )
}

export function lineaDetalleStock(producto) {
  const codigo = producto.codigo ? `[${producto.codigo}] ` : ""
  const categoria = producto.categoria ? ` · ${producto.categoria}` : ""
  return `${codigo}${nombreProductoStock(producto)}${categoria}: ${Number(producto.stock)} u. (${etiquetaEstadoStock(producto.stock)})`
}
