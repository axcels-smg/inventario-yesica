import { formatearFecha } from "./fechas"
import { formatearNumeroBoleta } from "./boleta"

export function imprimirBoleta(venta) {
  const numero =
    venta.numeroBoleta != null
      ? formatearNumeroBoleta(venta.numeroBoleta)
      : "—"

  const filas = (venta.productos || [])
    .map((p) => {
      const sub = Number(p.precio) * Number(p.cantidad)
      return `
        <tr>
          <td>${p.marca || p.nombre}<br><small>${p.modelo || ""}</small></td>
          <td style="text-align:center">${p.cantidad}</td>
          <td style="text-align:right">S/ ${sub.toFixed(2)}</td>
        </tr>
      `
    })
    .join("")

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Boleta ${numero}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Courier New', monospace;
          width: 80mm;
          padding: 8mm;
          font-size: 12px;
        }
        h1 { font-size: 16px; text-align: center; margin-bottom: 8px; }
        .info { margin-bottom: 12px; line-height: 1.5; }
        table { width: 100%; border-collapse: collapse; margin: 12px 0; }
        th, td { padding: 4px 0; border-bottom: 1px dashed #ccc; }
        th { text-align: left; font-size: 10px; }
        .total { font-size: 16px; font-weight: bold; text-align: right; margin-top: 12px; }
        .pie { text-align: center; margin-top: 16px; font-size: 10px; }
        @media print { body { width: 80mm; } }
      </style>
    </head>
    <body>
      <h1>INVENTARIO YESICA</h1>
      <p style="text-align:center;margin-bottom:8px">Boleta N° ${numero}</p>
      <div class="info">
        <div>Cliente: ${venta.cliente || "—"}</div>
        <div>Tel: ${venta.telefono || "—"}</div>
        <div>Fecha: ${formatearFecha(venta.fecha || venta.fechaTexto)}</div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Producto</th>
            <th style="text-align:center">Cant</th>
            <th style="text-align:right">Subt</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
      <div class="total">TOTAL: S/ ${Number(venta.total).toFixed(2)}</div>
      <p class="pie">Gracias por su compra</p>
      <script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); }</script>
    </body>
    </html>
  `

  const ventana = window.open("", "_blank", "width=320,height=600")

  if (!ventana) {
    alert("Permite ventanas emergentes para imprimir el ticket")
    return
  }

  ventana.document.write(html)
  ventana.document.close()
}
