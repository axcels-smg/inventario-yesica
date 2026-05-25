import { formatearFecha } from "./fechas"
import { formatearNumeroBoleta } from "./boleta"
import { DATOS_NEGOCIO } from "../constants/inventario"

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
          <td colspan="3" style="padding: 6px 0; border-bottom: 1px dashed #000;">
            <div style="font-weight: bold;">${p.marca || p.nombre}</div>
            <div style="font-size: 10px; color: #666;">${p.modelo || ""}</div>
            <div style="display: flex; justify-content: space-between; margin-top: 2px;">
              <span>x${p.cantidad}</span>
              <span>S/ ${sub.toFixed(2)}</span>
            </div>
          </td>
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
          padding: 5mm;
          font-size: 11px;
          color: #000;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #000;
          padding-bottom: 8px;
          margin-bottom: 10px;
        }
        .header h1 {
          font-size: 14px;
          font-weight: bold;
          margin-bottom: 4px;
          text-transform: uppercase;
        }
        .header p {
          font-size: 9px;
          margin: 2px 0;
        }
        .ruc {
          font-size: 10px;
          font-weight: bold;
          margin-top: 4px;
        }
        .boleta-info {
          text-align: center;
          background: #f0f0f0;
          padding: 6px;
          margin: 8px 0;
          border-radius: 4px;
        }
        .boleta-info h2 {
          font-size: 12px;
          font-weight: bold;
          margin-bottom: 2px;
        }
        .cliente-info {
          margin: 8px 0;
          padding: 6px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }
        .cliente-info div {
          margin: 3px 0;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 10px 0;
        }
        .total-section {
          border-top: 2px solid #000;
          padding-top: 8px;
          margin-top: 12px;
        }
        .total {
          font-size: 16px;
          font-weight: bold;
          text-align: right;
          margin: 8px 0;
        }
        .pie {
          text-align: center;
          margin-top: 16px;
          padding-top: 8px;
          border-top: 1px dashed #000;
          font-size: 9px;
        }
        .pie p {
          margin: 3px 0;
        }
        .anulado {
          color: #ff0000;
          font-weight: bold;
          text-align: center;
          font-size: 14px;
          margin: 8px 0;
          border: 2px solid #ff0000;
          padding: 8px;
          transform: rotate(-5deg);
        }
        @media print {
          body { width: 80mm; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${DATOS_NEGOCIO.nombre}</h1>
        <p>${DATOS_NEGOCIO.direccion}</p>
        <p>Tel: ${DATOS_NEGOCIO.telefono}</p>
        <p class="ruc">RUC: ${DATOS_NEGOCIO.ruc}</p>
      </div>

      <div class="boleta-info">
        <h2>BOLETA DE VENTA</h2>
        <p>N° ${numero}</p>
        <p>${formatearFecha(venta.fecha || venta.fechaTexto)}</p>
      </div>

      ${venta.anulada ? '<div class="anulado">*** ANULADA ***</div>' : ''}

      <div class="cliente-info">
        <div><strong>Cliente:</strong> ${venta.cliente || "Consumidor Final"}</div>
        ${venta.telefono ? `<div><strong>Tel:</strong> ${venta.telefono}</div>` : ''}
      </div>

      <table>
        <thead>
          <tr>
            <th colspan="3" style="text-align: center; padding: 6px 0; border-bottom: 2px solid #000; font-size: 10px;">
              DETALLE DE PRODUCTOS
            </th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>

      <div class="total-section">
        <div class="total">TOTAL: S/ ${Number(venta.total).toFixed(2)}</div>
      </div>

      <div class="pie">
        <p><strong>${DATOS_NEGOCIO.nombre}</strong></p>
        <p>${DATOS_NEGOCIO.direccion}</p>
        <p>RUC: ${DATOS_NEGOCIO.ruc}</p>
        <p>Tel: ${DATOS_NEGOCIO.telefono}</p>
        <p>${DATOS_NEGOCIO.email}</p>
        <p style="margin-top: 8px;">¡Gracias por su compra!</p>
        <p>${DATOS_NEGOCIO.sitioWeb}</p>
      </div>

      <script>
        window.onload = () => {
          window.print();
          window.onafterprint = () => window.close();
        };
      </script>
    </body>
    </html>
  `

  const ventana = window.open("", "_blank", "width=320,height=700")

  if (!ventana) {
    alert("Permite ventanas emergentes para imprimir el ticket")
    return
  }

  ventana.document.write(html)
  ventana.document.close()
}
