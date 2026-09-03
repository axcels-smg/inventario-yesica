import { obtenerTiempoFecha } from "./fechas"
import { filtrarVentasActivas } from "./ventas"

export function filtrarVentasPorFecha(ventas, fechaDesde, fechaHasta) {
  const desde = fechaDesde
    ? new Date(`${fechaDesde}T00:00:00`).getTime()
    : 0

  const hasta = fechaHasta
    ? new Date(`${fechaHasta}T23:59:59`).getTime()
    : Infinity

  return ventas.filter((venta) => {
    const tiempo = obtenerTiempoFecha(venta.fecha || venta.fechaTexto)
    return tiempo >= desde && tiempo <= hasta
  })
}

export function filtrarVentasPorCliente(ventas, clienteId, clienteNombre) {
  if (!clienteId && !clienteNombre) return ventas

  return ventas.filter((venta) => {
    if (clienteId && venta.clienteId === clienteId) return true
    if (clienteNombre && venta.cliente === clienteNombre) return true
    return false
  })
}

export function aplicarFiltrosReporte(
  ventas,
  { fechaDesde = "", fechaHasta = "", clienteId = "", clienteNombre = "" } = {}
) {
  let lista = filtrarVentasActivas(ventas)
  lista = filtrarVentasPorFecha(lista, fechaDesde, fechaHasta)
  lista = filtrarVentasPorCliente(lista, clienteId, clienteNombre)
  return lista
}

export function agruparVentasPorDia(ventas) {
  const mapa = {}

  ventas.forEach((venta) => {
    const tiempo = obtenerTiempoFecha(venta.fecha || venta.fechaTexto)
    const etiqueta = tiempo
      ? new Date(tiempo).toLocaleDateString("es-PE", {
          day: "2-digit",
          month: "short",
        })
      : "Sin fecha"

    if (!mapa[etiqueta]) {
      mapa[etiqueta] = { fecha: etiqueta, total: 0, cantidad: 0, tiempo }
    }

    mapa[etiqueta].total += Number(venta.total) || 0
    mapa[etiqueta].cantidad += 1
  })

  return Object.values(mapa).sort((a, b) => (b.tiempo || 0) - (a.tiempo || 0))
}

export function obtenerRangoPreset(preset) {
  const hoy = new Date()

  // Usar hora local en lugar de UTC para evitar desfase de día
  const formato = (d) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
  }

  if (preset === "hoy") {
    return { fechaDesde: formato(hoy), fechaHasta: formato(hoy) }
  }

  if (preset === "semana") {
    const inicio = new Date(hoy)
    inicio.setDate(hoy.getDate() - 6)
    return { fechaDesde: formato(inicio), fechaHasta: formato(hoy) }
  }

  if (preset === "mes") {
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    return { fechaDesde: formato(inicio), fechaHasta: formato(hoy) }
  }

  return { fechaDesde: "", fechaHasta: "" }
}
