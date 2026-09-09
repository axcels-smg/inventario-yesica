import { STOCK_BAJO_UMBRAL } from "../constants/inventario"

export function stockNumero(stock) {
  const n = Number(stock)
  return Number.isFinite(n) ? n : 0
}

export function esStockAgotado(stock) {
  return stockNumero(stock) <= 0
}

export function esStockBajo(stock) {
  return stockNumero(stock) <= STOCK_BAJO_UMBRAL
}

export function etiquetaEstadoStock(stock) {
  if (esStockAgotado(stock)) return "No hay"
  if (esStockBajo(stock)) return "Poco stock"
  return "OK"
}

export function esCategoriaPantalla(producto) {
  const texto = String(producto?.categoria || "").toLowerCase()
  return /pantalla|lcd|oled|display/.test(texto)
}

export function filtrarProductosPorEstadoStock(productos, estado = "") {
  if (estado === "agotado" || estado === "no_hay") {
    return productos.filter((p) => esStockAgotado(p.stock))
  }
  if (estado === "poco") {
    return productos.filter((p) => esStockBajo(p.stock) && !esStockAgotado(p.stock))
  }
  if (estado === "bajo") {
    return productos.filter((p) => esStockBajo(p.stock))
  }
  if (estado === "ok") {
    return productos.filter((p) => !esStockBajo(p.stock))
  }
  return productos
}

export function ordenarPorStock(productos) {
  return [...productos].sort((a, b) => {
    const diff = stockNumero(a.stock) - stockNumero(b.stock)
    if (diff !== 0) return diff
    return nombreProductoStock(a).localeCompare(nombreProductoStock(b), "es")
  })
}

export function filtrarProductosStockBajo(productos) {
  return ordenarPorStock(productos.filter((p) => esStockBajo(p.stock)))
}

export function filtrarProductosSinStock(productos) {
  return ordenarPorStock(productos.filter((p) => esStockAgotado(p.stock)))
}

export function resumenStockBajo(productos) {
  const lista = filtrarProductosStockBajo(productos)
  const agotadosLista = lista.filter((p) => esStockAgotado(p.stock))
  const pocoLista = lista.filter((p) => !esStockAgotado(p.stock))
  const pantallasSinStock = agotadosLista.filter(esCategoriaPantalla).length

  return {
    lista,
    agotadosLista,
    pocoLista,
    total: lista.length,
    agotados: agotadosLista.length,
    poco: pocoLista.length,
    pantallasSinStock,
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
  return `${codigo}${nombreProductoStock(producto)}${categoria}: ${stockNumero(producto.stock)} u. (${etiquetaEstadoStock(producto.stock)})`
}
