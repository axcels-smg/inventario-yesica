import { formatearNumeroBoleta } from "./boleta"
import { formatearFecha } from "./fechas"

export function nombreProductoVenta(p) {
  return `${p.marca || p.nombre || ""} ${p.modelo || ""}`.trim() || "Producto"
}

export function numeroWhatsAppPeru(telefono) {
  const n = String(telefono || "").replace(/\D/g, "")
  if (!n) return ""
  if (n.startsWith("51") && n.length >= 11) return n
  if (n.length === 9) return `51${n}`
  return n
}

export function formatoMoneda(valor) {
  return `S/ ${Number(valor || 0).toFixed(2)}`
}

export function textoReciboVenta(venta, tienda = null) {
  const tiendaNombre = tienda?.nombre || "Inventario G.R.L."
  const numero =
    venta.numeroBoleta != null ? formatearNumeroBoleta(venta.numeroBoleta) : venta.id?.slice(0, 6) || "—"
  const lineas = (venta.productos || []).map(
    (p) =>
      `• ${nombreProductoVenta(p)} × ${p.cantidad} = ${formatoMoneda(Number(p.precio) * Number(p.cantidad))}`
  )

  return [
    `*Recibo de venta* — ${tiendaNombre}`,
    `Boleta N° ${numero}`,
    `Fecha: ${formatearFecha(venta.fecha || venta.fechaTexto)}`,
    `Cliente: ${venta.cliente || "Consumidor Final"}`,
    "",
    "Detalle:",
    lineas.length ? lineas.join("\n") : "• Sin productos",
    "",
    `*TOTAL: ${formatoMoneda(venta.total)}*`,
    "",
    "Gracias por su compra.",
  ].join("\n")
}

export function textoReciboPeriodo({
  ventas = [],
  cliente,
  fechaDesde,
  fechaHasta,
  tienda = null,
}) {
  const tiendaNombre = tienda?.nombre || "Inventario G.R.L."
  const nombreCliente = cliente?.nombre || ventas[0]?.cliente || "Cliente"
  const periodo =
    fechaDesde && fechaHasta
      ? `${fechaDesde} al ${fechaHasta}`
      : fechaDesde
        ? `desde ${fechaDesde}`
        : fechaHasta
          ? `hasta ${fechaHasta}`
          : "todas las fechas"

  const bloques = ventas.map((venta) => {
    const numero =
      venta.numeroBoleta != null ? formatearNumeroBoleta(venta.numeroBoleta) : "—"
    const productos = (venta.productos || [])
      .map((p) => `   - ${nombreProductoVenta(p)} × ${p.cantidad} (${formatoMoneda(Number(p.precio) * Number(p.cantidad))})`)
      .join("\n")
    return [
      `Boleta ${numero} — ${formatearFecha(venta.fecha || venta.fechaTexto)}`,
      productos || "   - Sin detalle",
      `   Subtotal: ${formatoMoneda(venta.total)}`,
    ].join("\n")
  })

  const total = ventas.reduce((acc, v) => acc + Number(v.total || 0), 0)

  return [
    `*Reporte de compras* — ${tiendaNombre}`,
    `Cliente: ${nombreCliente}`,
    `Período: ${periodo}`,
    `Ventas: ${ventas.length}`,
    "",
    bloques.join("\n\n") || "Sin ventas en este período.",
    "",
    `*TOTAL DEL PERÍODO: ${formatoMoneda(total)}*`,
    "",
    "Este es el resumen de sus compras. Gracias.",
  ].join("\n")
}

export function enlaceWhatsAppTexto(texto, telefono) {
  const numero = numeroWhatsAppPeru(telefono)
  const encoded = encodeURIComponent(texto)
  if (!numero) return `https://wa.me/?text=${encoded}`
  return `https://wa.me/${numero}?text=${encoded}`
}

export function enlaceEmailTexto(texto, correo = "", asunto = "Recibo de venta") {
  return `mailto:${correo || ""}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(texto)}`
}

export async function descargarPdfReciboPeriodo({
  ventas = [],
  cliente,
  fechaDesde,
  fechaHasta,
  tienda = null,
}) {
  const { default: jsPDF } = await import("jspdf")
  const pdf = new jsPDF()
  const pageWidth = pdf.internal.pageSize.getWidth()
  const margin = 16
  let y = margin

  function saltoSiHaceFalta(extra = 12) {
    if (y + extra > 280) {
      pdf.addPage()
      y = margin
    }
  }

  pdf.setFontSize(16)
  pdf.setFont("helvetica", "bold")
  pdf.text(tienda?.nombre || "Inventario G.R.L.", pageWidth / 2, y, { align: "center" })
  y += 8
  pdf.setFontSize(12)
  pdf.text("REPORTE / RECIBO DE COMPRAS", pageWidth / 2, y, { align: "center" })
  y += 10

  pdf.setFontSize(10)
  pdf.setFont("helvetica", "normal")
  pdf.text(`Cliente: ${cliente?.nombre || ventas[0]?.cliente || "—"}`, margin, y)
  y += 6
  if (cliente?.telefono) {
    pdf.text(`Tel: ${cliente.telefono}`, margin, y)
    y += 6
  }
  pdf.text(
    `Período: ${fechaDesde || "—"}  al  ${fechaHasta || "—"}`,
    margin,
    y
  )
  y += 10

  ventas.forEach((venta) => {
    saltoSiHaceFalta(28)
    const numero =
      venta.numeroBoleta != null ? formatearNumeroBoleta(venta.numeroBoleta) : "—"
    pdf.setFont("helvetica", "bold")
    pdf.text(
      `Boleta ${numero}  ·  ${formatearFecha(venta.fecha || venta.fechaTexto)}`,
      margin,
      y
    )
    y += 6
    pdf.setFont("helvetica", "normal")
    ;(venta.productos || []).forEach((p) => {
      saltoSiHaceFalta(8)
      const linea = `${nombreProductoVenta(p)}  x${p.cantidad}   ${formatoMoneda(Number(p.precio) * Number(p.cantidad))}`
      pdf.text(linea.substring(0, 90), margin + 4, y)
      y += 5
    })
    pdf.setFont("helvetica", "bold")
    pdf.text(`Subtotal: ${formatoMoneda(venta.total)}`, pageWidth - margin, y, { align: "right" })
    y += 8
  })

  const total = ventas.reduce((acc, v) => acc + Number(v.total || 0), 0)
  saltoSiHaceFalta(16)
  pdf.setFontSize(13)
  pdf.text(`TOTAL: ${formatoMoneda(total)}`, pageWidth - margin, y, { align: "right" })

  const nombreArchivo = `recibo-${(cliente?.nombre || "cliente").replace(/\s+/g, "-")}-${fechaDesde || "periodo"}.pdf`
  pdf.save(nombreArchivo)
}
