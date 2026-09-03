export function esVentaActiva(venta) {
  return venta?.anulada !== true
}

export function filtrarVentasActivas(ventas) {
  return ventas.filter(esVentaActiva)
}
