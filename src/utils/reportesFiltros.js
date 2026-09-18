import { claveDiaLocal, formatoFechaInput, obtenerTiempoFecha } from "./fechas"
import { esVentaActiva, filtrarVentasActivas } from "./ventas"

export const DIAS_HISTORIAL_VENTAS = 30

export function fechaCorteHistorial(dias = DIAS_HISTORIAL_VENTAS) {
  const corte = new Date()
  corte.setHours(0, 0, 0, 0)
  corte.setDate(corte.getDate() - (dias - 1))
  return corte
}

export function filtrarVentasUltimoMes(ventas, dias = DIAS_HISTORIAL_VENTAS) {
  const t = fechaCorteHistorial(dias).getTime()
  return ventas.filter((venta) => {
    const tiempo = obtenerTiempoFecha(venta.fecha || venta.fechaTexto)
    return tiempo >= t
  })
}

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

export function agruparVentasPorDiaDetalle(ventas) {
  const mapa = {}

  ventas.forEach((venta) => {
    const tiempo = obtenerTiempoFecha(venta.fecha || venta.fechaTexto)
    const clave = claveDiaLocal(venta.fecha || venta.fechaTexto) || "sin-fecha"

    if (!mapa[clave]) {
      mapa[clave] = {
        clave,
        tiempo,
        ventas: [],
        totalActivas: 0,
        cantidadActivas: 0,
        cantidadAnuladas: 0,
      }
    }

    mapa[clave].ventas.push(venta)
    if (esVentaActiva(venta)) {
      mapa[clave].totalActivas += Number(venta.total) || 0
      mapa[clave].cantidadActivas += 1
    } else {
      mapa[clave].cantidadAnuladas += 1
    }
  })

  return Object.values(mapa)
    .map((dia) => ({
      ...dia,
      ventas: [...dia.ventas].sort(
        (a, b) =>
          obtenerTiempoFecha(a.fecha || a.fechaTexto) -
          obtenerTiempoFecha(b.fecha || b.fechaTexto)
      ),
    }))
    .sort((a, b) => (b.tiempo || 0) - (a.tiempo || 0))
}

export function resumenCuentaVentas(ventas) {
  let activas = 0
  let anuladas = 0
  let unidades = 0
  let total = 0

  ventas.forEach((venta) => {
    if (!esVentaActiva(venta)) {
      anuladas += 1
      return
    }
    activas += 1
    total += Number(venta.total) || 0
    ;(venta.productos || []).forEach((p) => {
      unidades += Number(p.cantidad) || 0
    })
  })

  return {
    activas,
    anuladas,
    unidades,
    total,
    totalRegistros: ventas.length,
  }
}

export function obtenerRangoPreset(preset) {
  const hoy = new Date()
  const formato = (d) => formatoFechaInput(d)

  if (preset === "hoy") {
    return { fechaDesde: formato(hoy), fechaHasta: formato(hoy) }
  }

  if (preset === "ayer") {
    const ayer = new Date(hoy)
    ayer.setDate(hoy.getDate() - 1)
    return { fechaDesde: formato(ayer), fechaHasta: formato(ayer) }
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

  if (preset === "30dias") {
    return {
      fechaDesde: formato(fechaCorteHistorial(DIAS_HISTORIAL_VENTAS)),
      fechaHasta: formato(hoy),
    }
  }

  return { fechaDesde: "", fechaHasta: "" }
}
