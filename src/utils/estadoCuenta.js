import Swal from "sweetalert2"
import jsPDF from "jspdf"

import { DATOS_NEGOCIO } from "../constants/inventario"
import { formatearNumeroBoleta } from "./boleta"
import { etiquetaDiaEs } from "./fechas"
import { nombreProductoVenta, formatoMoneda } from "./reciboCliente"
import {
  agruparVentasPorDiaDetalle,
  resumenCuentaVentas,
} from "./reportesFiltros"
import { esVentaActiva } from "./ventas"

function datosNegocio(tienda) {
  return {
    nombre: tienda?.nombre || DATOS_NEGOCIO.nombre,
    ruc: tienda?.ruc || DATOS_NEGOCIO.ruc,
    direccion: tienda?.direccion || DATOS_NEGOCIO.direccion,
    telefono: tienda?.telefono || DATOS_NEGOCIO.telefono,
    email: tienda?.email || DATOS_NEGOCIO.email,
    sitioWeb: DATOS_NEGOCIO.sitioWeb,
  }
}

function escaparHtml(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function etiquetaPeriodo(fechaDesde, fechaHasta) {
  if (fechaDesde && fechaHasta && fechaDesde === fechaHasta) {
    return etiquetaDiaEs(fechaDesde)
  }
  if (fechaDesde && fechaHasta) {
    return `${fechaDesde} al ${fechaHasta}`
  }
  if (fechaDesde) return `desde ${fechaDesde}`
  if (fechaHasta) return `hasta ${fechaHasta}`
  return "período seleccionado"
}

function numeroBoleta(venta) {
  return venta.numeroBoleta != null ? formatearNumeroBoleta(venta.numeroBoleta) : "—"
}

export function construirEstadoCuenta({
  ventas = [],
  clienteNombre = "",
  fechaDesde = "",
  fechaHasta = "",
  incluirAnuladas = false,
} = {}) {
  const lista = incluirAnuladas ? ventas : ventas.filter(esVentaActiva)
  const dias = agruparVentasPorDiaDetalle(lista)
  const resumen = resumenCuentaVentas(lista)
  return {
    lista,
    dias,
    resumen,
    clienteNombre: clienteNombre || "Todos los clientes",
    periodo: etiquetaPeriodo(fechaDesde, fechaHasta),
    fechaDesde,
    fechaHasta,
    incluirAnuladas,
  }
}

export function imprimirEstadoCuenta({
  ventas = [],
  clienteNombre = "",
  fechaDesde = "",
  fechaHasta = "",
  tienda = null,
  incluirAnuladas = false,
} = {}) {
  const cuenta = construirEstadoCuenta({
    ventas,
    clienteNombre,
    fechaDesde,
    fechaHasta,
    incluirAnuladas,
  })

  if (!cuenta.lista.length) {
    Swal.fire({
      icon: "info",
      title: "Nada para imprimir",
      text: "No hay ventas en el filtro elegido.",
    })
    return
  }

  const negocio = datosNegocio(tienda)
  const emitido = new Date().toLocaleString("es-PE")

  const bloquesDia = cuenta.dias
    .map((dia) => {
      const filas = dia.ventas
        .map((venta) => {
          const productos = (venta.productos || [])
            .map(
              (p) =>
                `${escaparHtml(nombreProductoVenta(p))} × ${escaparHtml(p.cantidad)}`
            )
            .join("<br>")
          const anulada = !esVentaActiva(venta)
          return `
            <tr class="${anulada ? "anulada" : ""}">
              <td>${escaparHtml(numeroBoleta(venta))}</td>
              <td>${productos || "—"}</td>
              <td class="num">${
                anulada ? "ANULADA" : escaparHtml(formatoMoneda(venta.total))
              }</td>
            </tr>
          `
        })
        .join("")

      const ventasTxt =
        dia.cantidadActivas === 1
          ? "1 venta"
          : `${dia.cantidadActivas} ventas`

      return `
        <section class="dia">
          <h3>
            ${escaparHtml(etiquetaDiaEs(dia.clave))}
            <span>${ventasTxt}${
              dia.cantidadAnuladas
                ? ` · ${dia.cantidadAnuladas} anulada${dia.cantidadAnuladas === 1 ? "" : "s"}`
                : ""
            }</span>
          </h3>
          <table>
            <thead>
              <tr>
                <th>Boleta</th>
                <th>Detalle</th>
                <th class="num">Importe</th>
              </tr>
            </thead>
            <tbody>${filas}</tbody>
          </table>
          <p class="subtotal">Subtotal del día: ${escaparHtml(formatoMoneda(dia.totalActivas))}</p>
        </section>
      `
    })
    .join("")

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Estado de cuenta</title>
      <style>
        * { box-sizing: border-box; }
        body {
          font-family: Arial, Helvetica, sans-serif;
          color: #111;
          padding: 18mm;
          font-size: 12px;
        }
        .header { text-align: center; margin-bottom: 16px; }
        .header h1 { font-size: 18px; margin: 0 0 4px; text-transform: uppercase; }
        .header p { margin: 2px 0; font-size: 11px; }
        .titulo {
          text-align: center;
          font-size: 16px;
          font-weight: bold;
          margin: 14px 0 8px;
          letter-spacing: 0.5px;
        }
        .meta { margin: 12px 0 18px; }
        .meta div { margin: 3px 0; }
        .dia { margin-bottom: 18px; page-break-inside: avoid; }
        .dia h3 {
          margin: 0 0 8px;
          font-size: 13px;
          border-bottom: 1px solid #111;
          padding-bottom: 4px;
          display: flex;
          justify-content: space-between;
          text-transform: capitalize;
        }
        .dia h3 span { font-weight: normal; font-size: 11px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { text-align: left; padding: 5px 4px; vertical-align: top; border-bottom: 1px solid #ddd; }
        th { font-size: 10px; text-transform: uppercase; color: #444; }
        .num { text-align: right; white-space: nowrap; }
        .anulada td { color: #888; text-decoration: line-through; }
        .subtotal { text-align: right; font-weight: bold; margin: 6px 0 0; }
        .totales {
          margin-top: 20px;
          border-top: 2px solid #111;
          padding-top: 10px;
        }
        .totales .grande { font-size: 18px; font-weight: bold; text-align: right; }
        .aviso { margin-top: 22px; font-size: 9px; color: #555; }
        .pie { margin-top: 10px; font-size: 9px; text-align: center; color: #666; }
        @media print { body { padding: 10mm; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${escaparHtml(negocio.nombre)}</h1>
        <p>${escaparHtml(negocio.direccion)}</p>
        <p>RUC ${escaparHtml(negocio.ruc)} · Tel ${escaparHtml(negocio.telefono)}</p>
      </div>
      <div class="titulo">ESTADO DE CUENTA</div>
      <div class="meta">
        <div><strong>Cliente:</strong> ${escaparHtml(cuenta.clienteNombre)}</div>
        <div><strong>Período:</strong> ${escaparHtml(cuenta.periodo)}</div>
        <div><strong>Emitido:</strong> ${escaparHtml(emitido)}</div>
      </div>
      ${bloquesDia}
      <div class="totales">
        <div>Ventas válidas: ${cuenta.resumen.activas} · Unidades: ${cuenta.resumen.unidades}${
          cuenta.resumen.anuladas
            ? ` · Anuladas (no suman): ${cuenta.resumen.anuladas}`
            : ""
        }</div>
        <div class="grande">TOTAL DEL PERÍODO: ${escaparHtml(formatoMoneda(cuenta.resumen.total))}</div>
      </div>
      <p class="aviso">Documento interno de rendición de cuentas. No es comprobante electrónico SUNAT.</p>
      <p class="pie">${escaparHtml(negocio.nombre)} · ${escaparHtml(negocio.sitioWeb)}</p>
      <script>
        window.onload = () => {
          window.print();
          window.onafterprint = () => window.close();
        };
      </script>
    </body>
    </html>
  `

  const ventana = window.open("", "_blank", "width=900,height=700")
  if (!ventana) {
    Swal.fire({
      icon: "warning",
      title: "Ventanas bloqueadas",
      text: "Permite ventanas emergentes para imprimir el estado de cuenta.",
    })
    return
  }
  ventana.document.write(html)
  ventana.document.close()
}

export function descargarPdfEstadoCuenta({
  ventas = [],
  clienteNombre = "",
  fechaDesde = "",
  fechaHasta = "",
  tienda = null,
  incluirAnuladas = false,
} = {}) {
  const cuenta = construirEstadoCuenta({
    ventas,
    clienteNombre,
    fechaDesde,
    fechaHasta,
    incluirAnuladas,
  })

  if (!cuenta.lista.length) {
    Swal.fire({
      icon: "info",
      title: "Nada para descargar",
      text: "No hay ventas en el filtro elegido.",
    })
    return
  }

  const negocio = datosNegocio(tienda)
  const pdf = new jsPDF()
  const pageWidth = pdf.internal.pageSize.getWidth()
  const margin = 16
  let y = margin

  function salto(extra = 12) {
    if (y + extra > 280) {
      pdf.addPage()
      y = margin
    }
  }

  pdf.setFontSize(16)
  pdf.setFont("helvetica", "bold")
  pdf.text(negocio.nombre, pageWidth / 2, y, { align: "center" })
  y += 6
  pdf.setFontSize(9)
  pdf.setFont("helvetica", "normal")
  pdf.text(negocio.direccion, pageWidth / 2, y, { align: "center" })
  y += 5
  pdf.text(`RUC ${negocio.ruc}  ·  Tel ${negocio.telefono}`, pageWidth / 2, y, { align: "center" })
  y += 10
  pdf.setFontSize(13)
  pdf.setFont("helvetica", "bold")
  pdf.text("ESTADO DE CUENTA", pageWidth / 2, y, { align: "center" })
  y += 10
  pdf.setFontSize(10)
  pdf.setFont("helvetica", "normal")
  pdf.text(`Cliente: ${cuenta.clienteNombre}`, margin, y)
  y += 5
  pdf.text(`Período: ${cuenta.periodo}`, margin, y)
  y += 5
  pdf.text(`Emitido: ${new Date().toLocaleString("es-PE")}`, margin, y)
  y += 10

  cuenta.dias.forEach((dia) => {
    salto(22)
    pdf.setFont("helvetica", "bold")
    const ventasTxt =
      dia.cantidadActivas === 1 ? "1 venta" : `${dia.cantidadActivas} ventas`
    pdf.text(
      `${etiquetaDiaEs(dia.clave)}  (${ventasTxt})`,
      margin,
      y
    )
    y += 6
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(9)

    dia.ventas.forEach((venta) => {
      const productos = (venta.productos || [])
        .map((p) => `${nombreProductoVenta(p)} x${p.cantidad}`)
        .join(" · ")
      const anulada = !esVentaActiva(venta)
      const linea = `#${numeroBoleta(venta)}  ${productos || "Sin detalle"}`
      salto(8)
      pdf.text(linea.substring(0, 85), margin, y)
      pdf.text(
        anulada ? "ANULADA" : formatoMoneda(venta.total),
        pageWidth - margin,
        y,
        { align: "right" }
      )
      y += 5
    })

    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(10)
    pdf.text(
      `Subtotal del día: ${formatoMoneda(dia.totalActivas)}`,
      pageWidth - margin,
      y,
      { align: "right" }
    )
    y += 8
  })

  salto(20)
  pdf.setDrawColor(0)
  pdf.line(margin, y, pageWidth - margin, y)
  y += 8
  pdf.setFontSize(11)
  pdf.text(
    `Ventas válidas: ${cuenta.resumen.activas}   Unidades: ${cuenta.resumen.unidades}`,
    margin,
    y
  )
  y += 8
  pdf.setFontSize(14)
  pdf.text(
    `TOTAL: ${formatoMoneda(cuenta.resumen.total)}`,
    pageWidth - margin,
    y,
    { align: "right" }
  )
  y += 12
  pdf.setFontSize(8)
  pdf.setFont("helvetica", "normal")
  pdf.text(
    "Documento interno de rendición de cuentas. No es comprobante electrónico SUNAT.",
    margin,
    y
  )

  const slug = (cuenta.clienteNombre || "cuenta").replace(/\s+/g, "-")
  const rango = fechaDesde && fechaHasta ? `${fechaDesde}_a_${fechaHasta}` : "periodo"
  pdf.save(`estado-cuenta-${slug}-${rango}.pdf`)
}
