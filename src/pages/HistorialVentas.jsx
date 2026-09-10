import { useEffect, useState } from "react"

import {
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore"

import { db } from "../firebase"

import jsPDF from "jspdf"
import Swal from "sweetalert2"

import { FileDown, Receipt, Ban, Trash2, Printer, MessageCircle } from "lucide-react"
import { formatearFecha } from "../utils/fechas"
import { formatearNumeroBoleta } from "../utils/boleta"
import { registrarMovimiento } from "../utils/movimientos"
import { TIPOS_MOVIMIENTO, DATOS_NEGOCIO } from "../constants/inventario"
import { imprimirBoleta } from "../utils/impresion"
import { enlaceWhatsAppTexto, textoReciboVenta } from "../utils/reciboCliente"
import { useTienda } from "../context/TiendaContext"
import { useRol } from "../context/RolContext"
import { useProductosLive } from "../context/ProductosLiveContext"
import { useOperacionesLive } from "../context/OperacionesLiveContext"
import { invalidarCacheTienda } from "../utils/consultasTienda"
import { errorOperacion } from "../utils/erroresUi"
import { sincronizarCicloDescuentos } from "../utils/reportePantallas"
import AvisoOtraTienda from "../components/AvisoOtraTienda"

function HistorialVentas() {
  const { tiendaActual, esTiendaPropia } = useTienda()
  const { puedeAnularVentas, puedeEliminarVentas } = useRol()
  const { aplicarCambiosStock } = useProductosLive()
  const { ventas } = useOperacionesLive()
  const negocioActual = tiendaActual
    ? {
        nombre: tiendaActual.nombre,
        ruc: tiendaActual.ruc || DATOS_NEGOCIO.ruc,
        direccion: tiendaActual.direccion || DATOS_NEGOCIO.direccion,
        telefono: tiendaActual.telefono || DATOS_NEGOCIO.telefono,
        email: tiendaActual.email || DATOS_NEGOCIO.email,
      }
    : DATOS_NEGOCIO
  const [procesandoId, setProcesandoId] = useState(null)
  const [paginaActual, setPaginaActual] = useState(1)
  const VENTAS_POR_PAGINA = 20

  useEffect(() => {
    setPaginaActual(1)
  }, [tiendaActual?.id])

  async function anularVenta(venta) {
    if (!esTiendaPropia || !puedeAnularVentas()) return
    if (venta.anulada) {
      Swal.fire({
        icon: "info",
        title: "Venta ya anulada",
      })
      return
    }

    if (!venta.productos?.length) {
      Swal.fire({
        icon: "warning",
        title: "No se puede anular",
        text: "Esta venta no tiene productos registrados",
      })
      return
    }

    const confirmacion = await Swal.fire({
      title: "¿Anular esta venta?",
      html: `
        <p>Se devolverá el stock. La venta seguirá en el historial como anulada.</p>
        <p class="mt-2 font-bold">Total: S/ ${venta.total}</p>
      `,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Anular",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ea580c",
    })

    if (!confirmacion.isConfirmed) return

    try {
      setProcesandoId(venta.id)

      const registrosMovimiento = []
      let metaAnulacion = { cliente: "", numeroBoleta: "" }

      await runTransaction(db, async (transaction) => {
        registrosMovimiento.length = 0
        const ventaRef = doc(db, "ventas", venta.id)
        const ventaSnap = await transaction.get(ventaRef)

        if (!ventaSnap.exists()) {
          throw new Error("La venta ya no existe")
        }

        const ventaActual = ventaSnap.data()

        if (ventaActual.anulada) {
          throw new Error("Esta venta ya fue anulada")
        }

        const productosVenta = ventaActual.productos || []

        if (productosVenta.length === 0) {
          throw new Error("La venta no tiene productos")
        }

        metaAnulacion = {
          cliente: ventaActual.cliente || "",
          numeroBoleta: ventaActual.numeroBoleta
            ? formatearNumeroBoleta(ventaActual.numeroBoleta)
            : "",
        }

        const porProducto = new Map()

        for (const item of productosVenta) {
          if (!item.id) {
            throw new Error("Un producto de la venta no tiene identificador")
          }

          const cantidad = Number(item.cantidad)
          if (!Number.isFinite(cantidad) || cantidad <= 0) {
            throw new Error(`Cantidad inválida en ${item.marca || item.id}`)
          }

          if (porProducto.has(item.id)) {
            const prev = porProducto.get(item.id)
            prev.cantidad += cantidad
            prev.stockDespues = prev.stockAntes + prev.cantidad
            continue
          }

          const productoRef = doc(db, "productos", item.id)
          const productoSnap = await transaction.get(productoRef)

          if (!productoSnap.exists()) {
            throw new Error(`El producto ${item.marca || item.id} ya no existe`)
          }

          const stockActual = Number(productoSnap.data().stock)
          if (!Number.isFinite(stockActual)) {
            throw new Error(`Stock inválido para ${item.marca || item.id}`)
          }

          porProducto.set(item.id, {
            ref: productoRef,
            productoId: item.id,
            productoNombre: `${item.marca || ""} ${item.modelo || ""}`.trim(),
            cantidad,
            stockAntes: stockActual,
            stockDespues: stockActual + cantidad,
          })
        }

        registrosMovimiento.push(...porProducto.values())

        registrosMovimiento.forEach((mov) => {
          transaction.update(mov.ref, {
            stock: mov.stockDespues,
            actualizado: serverTimestamp(),
          })
        })

        transaction.update(ventaRef, {
          anulada: true,
          fechaAnulacion: serverTimestamp(),
          fechaAnulacionTexto: new Date().toLocaleString("es-PE"),
        })
      })

      for (const mov of registrosMovimiento) {
        await registrarMovimiento({
          tipo: TIPOS_MOVIMIENTO.ANULACION,
          productoId: mov.productoId,
          productoNombre: mov.productoNombre,
          cantidad: mov.cantidad,
          stockAntes: mov.stockAntes,
          stockDespues: mov.stockDespues,
          ventaId: venta.id,
          numeroBoleta: metaAnulacion.numeroBoleta,
          cliente: metaAnulacion.cliente,
          detalle: `Anulación boleta #${metaAnulacion.numeroBoleta || venta.id.slice(0, 6)}`,
          tiendaId: tiendaActual.id,
        })
      }

      invalidarCacheTienda("ventas", tiendaActual.id)
      aplicarCambiosStock(
        registrosMovimiento.map((mov) => ({
          id: mov.productoId,
          stock: mov.stockDespues,
        }))
      )
      sincronizarCicloDescuentos(tiendaActual.id, tiendaActual.nombre).catch(() => {})

      Swal.fire({
        icon: "success",
        title: "Venta anulada",
        text: "El stock fue devuelto al inventario",
        timer: 2000,
        showConfirmButton: false,
      })

    } catch (error) {
      errorOperacion(error, "Error al anular")
    } finally {
      setProcesandoId(null)
    }
  }

  async function eliminarVenta(venta) {
    if (!esTiendaPropia || !puedeEliminarVentas()) return
    if (!venta.anulada) {
      Swal.fire({
        icon: "warning",
        title: "Anula primero",
        text: "No se puede borrar una venta activa. Anúlala para devolver el stock y después, si quieres, elimínala.",
      })
      return
    }
    const confirmacion = await Swal.fire({
      title: "¿Eliminar esta venta?",
      html: `
        <p>Se borrará de forma permanente y ya no se verá en el historial.</p>
        <p class="mt-2 text-red-600 font-bold">No devuelve stock. No se puede deshacer.</p>
        <p class="mt-2">Total: S/ ${venta.total}</p>
      `,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ef4444",
    })

    if (!confirmacion.isConfirmed) return

    try {
      setProcesandoId(venta.id)

      await runTransaction(db, async (transaction) => {
        const ventaRef = doc(db, "ventas", venta.id)
        const ventaSnap = await transaction.get(ventaRef)
        if (!ventaSnap.exists()) {
          throw new Error("La venta ya no existe")
        }
        if (!ventaSnap.data().anulada) {
          throw new Error("Anula la venta antes de borrarla, para devolver el stock")
        }
        transaction.delete(ventaRef)
      })
      invalidarCacheTienda("ventas", tiendaActual.id)

      Swal.fire({
        icon: "success",
        title: "Venta eliminada",
        timer: 1500,
        showConfirmButton: false,
      })

    } catch (error) {
      errorOperacion(error, "Error al eliminar")
    } finally {
      setProcesandoId(null)
    }
  }

  function descargarPDF(venta) {
    if (!venta.productos?.length) {
      Swal.fire({
        icon: "warning",
        title: "Sin productos",
        text: "Esta venta no tiene productos para el PDF",
      })
      return
    }

    const pdf = new jsPDF()
    const pageWidth = pdf.internal.pageSize.getWidth()
    const margin = 20
    let y = margin

    const numeroBoleta =
      venta.numeroBoleta != null
        ? formatearNumeroBoleta(venta.numeroBoleta)
        : ""

    // Encabezado del negocio
    pdf.setFontSize(22)
    pdf.setFont("helvetica", "bold")
    pdf.text(negocioActual.nombre, pageWidth / 2, y, { align: "center" })
    y += 10

    pdf.setFontSize(10)
    pdf.setFont("helvetica", "normal")
    pdf.text(negocioActual.direccion, pageWidth / 2, y, { align: "center" })
    y += 6

    pdf.text(`Tel: ${negocioActual.telefono}`, pageWidth / 2, y, { align: "center" })
    y += 6

    pdf.setFont("helvetica", "bold")
    pdf.text(`RUC: ${negocioActual.ruc}`, pageWidth / 2, y, { align: "center" })
    y += 12

    // Línea separadora
    pdf.setDrawColor(0)
    pdf.setLineWidth(0.5)
    pdf.line(margin, y, pageWidth - margin, y)
    y += 12

    // Título de boleta
    pdf.setFontSize(18)
    pdf.setFont("helvetica", "bold")
    pdf.text(venta.anulada ? "BOLETA ANULADA" : "BOLETA DE VENTA", pageWidth / 2, y, { align: "center" })
    y += 10

    if (numeroBoleta) {
      pdf.setFontSize(14)
      pdf.text(`N° ${numeroBoleta}`, pageWidth / 2, y, { align: "center" })
      y += 8
    }

    pdf.setFontSize(11)
    pdf.setFont("helvetica", "normal")
    pdf.text(`Fecha: ${formatearFecha(venta.fecha || venta.fechaTexto)}`, pageWidth / 2, y, { align: "center" })
    y += 12

    // Información del cliente
    pdf.setDrawColor(200)
    pdf.setLineWidth(0.3)
    pdf.roundedRect(margin, y, pageWidth - 2 * margin, 25, 3, 3, "S")
    y += 8

    pdf.setFontSize(11)
    pdf.setFont("helvetica", "bold")
    pdf.text("CLIENTE:", margin + 5, y)
    y += 6

    pdf.setFont("helvetica", "normal")
    pdf.text(venta.cliente || "Consumidor Final", margin + 5, y)
    y += 6

    if (venta.telefono) {
      pdf.text(`Teléfono: ${venta.telefono}`, margin + 5, y)
      y += 6
    }

    if (venta.anulada) {
      pdf.setFont("helvetica", "bold")
      pdf.setTextColor(255, 0, 0)
      pdf.text(`ANULADA: ${formatearFecha(venta.fechaAnulacion || venta.fechaAnulacionTexto)}`, margin + 5, y)
      pdf.setTextColor(0, 0, 0)
      y += 8
    }

    y += 8

    // Tabla de productos
    pdf.setFontSize(14)
    pdf.setFont("helvetica", "bold")
    pdf.text("DETALLE DE PRODUCTOS", margin, y)
    y += 10

    // Encabezado de tabla
    pdf.setFillColor(240, 240, 240)
    pdf.rect(margin, y, pageWidth - 2 * margin, 8, "F")
    y += 6

    pdf.setFontSize(10)
    pdf.setFont("helvetica", "bold")
    pdf.text("PRODUCTO", margin + 5, y)
    pdf.text("CANT.", margin + 100, y)
    pdf.text("SUBTOTAL", margin + 140, y)
    y += 8

    // Filas de productos
    pdf.setFont("helvetica", "normal")
    venta.productos.forEach((producto) => {
      const subtotal = Number(producto.precio) * producto.cantidad
      const nombreProducto = `${producto.marca || producto.nombre} ${producto.modelo || ""}`.trim()

      pdf.text(nombreProducto.substring(0, 35), margin + 5, y)
      pdf.text(String(producto.cantidad), margin + 105, y)
      pdf.text(`S/ ${subtotal.toFixed(2)}`, margin + 140, y)
      y += 8
    })

    y += 10

    // Total
    pdf.setDrawColor(0)
    pdf.setLineWidth(0.5)
    pdf.line(margin, y, pageWidth - margin, y)
    y += 10

    pdf.setFontSize(20)
    pdf.setFont("helvetica", "bold")
    pdf.text(`TOTAL: S/ ${Number(venta.total).toFixed(2)}`, pageWidth - margin, y, { align: "right" })
    y += 15

    // Pie de página
    pdf.setFontSize(9)
    pdf.setFont("helvetica", "normal")
    pdf.text(negocioActual.nombre, pageWidth / 2, y, { align: "center" })
    y += 5

    pdf.text(negocioActual.direccion, pageWidth / 2, y, { align: "center" })
    y += 5

    pdf.text(`RUC: ${negocioActual.ruc}`, pageWidth / 2, y, { align: "center" })
    y += 5

    pdf.text(`Tel: ${negocioActual.telefono}`, pageWidth / 2, y, { align: "center" })
    y += 5

    pdf.text(negocioActual.email, pageWidth / 2, y, { align: "center" })
    y += 8

    pdf.setFont("helvetica", "bold")
    pdf.text("¡Gracias por su compra!", pageWidth / 2, y, { align: "center" })
    y += 5

    pdf.setFont("helvetica", "normal")
    pdf.text(DATOS_NEGOCIO.sitioWeb, pageWidth / 2, y, { align: "center" })

    pdf.save(`boleta-${numeroBoleta || venta.id.slice(0, 6)}.pdf`)
  }

  if (!esTiendaPropia) {
    return <AvisoOtraTienda modo="bloqueo" />
  }

  return (
    <div className="space-y-8">

      <div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-800 dark:text-white break-words">
          Historial de Ventas
        </h1>

        <p className="text-slate-500 dark:text-slate-400 mt-3 text-lg">
          <strong>Anular</strong> devuelve el stock y deja la venta marcada.
          <strong> Eliminar</strong> la borra para siempre.
        </p>
      </div>

      {ventas.length === 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border dark:border-slate-800 p-10 text-center text-slate-500 dark:text-slate-400">
          No hay ventas registradas
        </div>
      )}

      <div className="flex flex-col gap-6">

        {ventas.slice((paginaActual - 1) * VENTAS_POR_PAGINA, paginaActual * VENTAS_POR_PAGINA).map((venta) => (
          <div
            key={venta.id}
            className={`bg-white dark:bg-slate-900 rounded-3xl shadow-sm border p-6 ${
              venta.anulada
                ? "border-red-300 dark:border-red-900/50 opacity-80"
                : "dark:border-slate-800"
            }`}
          >

            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-6 border-b border-slate-200 dark:border-slate-800 pb-6">

              <div className="space-y-1">

                <div className="flex flex-wrap items-center gap-2 text-slate-700 dark:text-white">
                  <Receipt size={20} />
                  <h2 className="text-2xl font-bold dark:text-white">
                    {venta.numeroBoleta != null
                      ? `Boleta #${formatearNumeroBoleta(venta.numeroBoleta)}`
                      : `Venta #${venta.id.slice(0, 6)}`}
                  </h2>
                  {venta.anulada && (
                    <span className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 px-3 py-1 rounded-full text-sm font-bold">
                      ANULADA
                    </span>
                  )}
                </div>

                <p className="text-slate-500 dark:text-slate-400">
                  {formatearFecha(venta.fecha || venta.fechaTexto)}
                </p>

                {venta.anulada && (
                  <p className="text-red-500 dark:text-red-400 text-sm">
                    Anulada: {formatearFecha(venta.fechaAnulacion || venta.fechaAnulacionTexto)}
                  </p>
                )}

                <p className="font-medium dark:text-white">
                  Cliente: {venta.cliente}
                </p>

                <p className="text-slate-500 dark:text-slate-400">
                  Tel: {venta.telefono}
                </p>

              </div>

              <div className="text-left sm:text-right flex flex-col items-stretch sm:items-end gap-3 w-full lg:w-auto">

                <h3
                  className={`text-3xl sm:text-4xl font-black ${
                    venta.anulada ? "text-slate-400 line-through" : "text-green-600"
                  }`}
                >
                  S/ {venta.total}
                </h3>

                <div className="flex flex-wrap gap-2 justify-start sm:justify-end">
                  <button
                    onClick={() => imprimirBoleta(venta, negocioActual)}
                    className="flex items-center gap-2 bg-slate-700 text-white px-5 py-3 rounded-2xl hover:bg-slate-800 transition"
                  >
                    <Printer size={18} />
                    Ticket
                  </button>

                  <button
                    onClick={() => descargarPDF(venta)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-5 py-3 rounded-2xl hover:bg-blue-700 transition"
                  >
                    <FileDown size={18} />
                    PDF
                  </button>

                  {!venta.anulada && (
                    <button
                      onClick={() => {
                        const texto = textoReciboVenta(venta, negocioActual)
                        if (!venta.telefono) {
                          Swal.fire({
                            icon: "warning",
                            title: "Sin teléfono",
                            text: "Esta venta no tiene teléfono. Se abrirá WhatsApp para elegir el contacto.",
                          })
                        }
                        window.open(enlaceWhatsAppTexto(texto, venta.telefono), "_blank")
                      }}
                      className="flex items-center gap-2 bg-green-600 text-white px-5 py-3 rounded-2xl hover:bg-green-700 transition"
                    >
                      <MessageCircle size={18} />
                      WhatsApp
                    </button>
                  )}

                  {!venta.anulada && esTiendaPropia && puedeAnularVentas() && (
                    <button
                      onClick={() => anularVenta(venta)}
                      disabled={procesandoId === venta.id}
                      className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-white transition ${
                        procesandoId === venta.id
                          ? "bg-slate-400"
                          : "bg-orange-600 hover:bg-orange-700"
                      }`}
                    >
                      <Ban size={18} />
                      Anular
                    </button>
                  )}

                  {venta.anulada && esTiendaPropia && puedeEliminarVentas() && (
                    <button
                      onClick={() => eliminarVenta(venta)}
                      disabled={procesandoId === venta.id}
                      className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-white transition ${
                        procesandoId === venta.id
                          ? "bg-slate-400"
                          : "bg-red-600 hover:bg-red-700"
                      }`}
                    >
                      <Trash2 size={18} />
                      Eliminar
                    </button>
                  )}
                </div>

              </div>

            </div>

            <div className="mt-6 flex flex-col gap-4">

              {venta.productos?.map((producto, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center border dark:border-slate-800 rounded-2xl p-4"
                >
                  <div>
                    <h4 className="font-semibold dark:text-white">
                      {producto.marca || producto.nombre}
                    </h4>

                    <p className="text-slate-500 dark:text-slate-400 text-sm">
                      Cantidad: {producto.cantidad}
                    </p>
                  </div>

                  <p className="font-bold text-slate-800 dark:text-white">
                    S/ {Number(producto.precio) * producto.cantidad}
                  </p>
                </div>
              ))}

            </div>

          </div>
        ))}

      </div>

      {/* Controles de Paginación */}
      {ventas.length > VENTAS_POR_PAGINA && (
        <div className="flex justify-center items-center gap-4 mt-6">
          <button
            onClick={() => setPaginaActual(paginaActual - 1)}
            disabled={paginaActual === 1}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white disabled:bg-slate-300 disabled:cursor-not-allowed hover:bg-blue-700 transition"
          >
            Anterior
          </button>
          <span className="text-slate-600 dark:text-slate-400">
            Página {paginaActual} de {Math.ceil(ventas.length / VENTAS_POR_PAGINA)}
          </span>
          <button
            onClick={() => setPaginaActual(paginaActual + 1)}
            disabled={paginaActual === Math.ceil(ventas.length / VENTAS_POR_PAGINA)}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white disabled:bg-slate-300 disabled:cursor-not-allowed hover:bg-blue-700 transition"
          >
            Siguiente
          </button>
        </div>
      )}

    </div>
  )
}

export default HistorialVentas
