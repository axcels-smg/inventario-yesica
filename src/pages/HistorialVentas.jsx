import { useEffect, useMemo, useState } from "react"

import {
  doc,
  runTransaction,
} from "firebase/firestore"

import { db } from "../firebase"

import jsPDF from "jspdf"
import Swal from "sweetalert2"

import { FileDown, Receipt, Ban, Trash2, Printer, MessageCircle, Download } from "lucide-react"
import { etiquetaDiaEs, formatearFecha } from "../utils/fechas"
import { formatearNumeroBoleta } from "../utils/boleta"
import { DATOS_NEGOCIO } from "../constants/inventario"
import { imprimirBoleta } from "../utils/impresion"
import {
  enlaceWhatsAppTexto,
  formatoMoneda,
  nombreProductoVenta,
  textoReciboVenta,
} from "../utils/reciboCliente"
import { exportarReporteContable } from "../utils/excel"
import { descargarPdfEstadoCuenta, imprimirEstadoCuenta } from "../utils/estadoCuenta"
import {
  agruparVentasPorDiaDetalle,
  DIAS_HISTORIAL_VENTAS,
  filtrarVentasPorCliente,
  filtrarVentasPorFecha,
  filtrarVentasUltimoMes,
  obtenerRangoPreset,
  resumenCuentaVentas,
} from "../utils/reportesFiltros"
import { useTienda } from "../context/TiendaContext"
import { useRol } from "../context/RolContext"
import { useProductosLive } from "../context/ProductosLiveContext"
import { useOperacionesLive } from "../context/OperacionesLiveContext"
import { invalidarCacheTienda } from "../utils/consultasTienda"
import { errorOperacion } from "../utils/erroresUi"
import { anularVentaYDevolverStock } from "../utils/anularVenta"
import AvisoOtraTienda from "../components/AvisoOtraTienda"

function HistorialVentas() {
  const { tiendaActual, esTiendaPropia } = useTienda()
  const { puedeAnularVentas, puedeEliminarVentas } = useRol()
  const { aplicarCambiosStock } = useProductosLive()
  const { ventas, clientes } = useOperacionesLive()
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
  const [fechaDesde, setFechaDesde] = useState("")
  const [fechaHasta, setFechaHasta] = useState("")
  const [clienteId, setClienteId] = useState("")
  const [incluirAnuladasDoc, setIncluirAnuladasDoc] = useState(false)
  const rangoMes = obtenerRangoPreset("30dias")

  useEffect(() => {
    const rango = obtenerRangoPreset("30dias")
    setFechaDesde(rango.fechaDesde)
    setFechaHasta(rango.fechaHasta)
    setClienteId("")
  }, [tiendaActual?.id])

  const clienteSeleccionado = clientes.find((c) => c.id === clienteId)

  const ventasDelMes = useMemo(() => filtrarVentasUltimoMes(ventas), [ventas])

  const ventasFiltradas = useMemo(() => {
    let lista = filtrarVentasPorFecha(ventasDelMes, fechaDesde, fechaHasta)
    lista = filtrarVentasPorCliente(
      lista,
      clienteId,
      clienteSeleccionado?.nombre || ""
    )
    return lista
  }, [ventasDelMes, fechaDesde, fechaHasta, clienteId, clienteSeleccionado])

  const diasFiltrados = useMemo(
    () => agruparVentasPorDiaDetalle(ventasFiltradas),
    [ventasFiltradas]
  )

  const resumen = useMemo(
    () => resumenCuentaVentas(ventasFiltradas),
    [ventasFiltradas]
  )

  function aplicarPreset(clave) {
    const rango = obtenerRangoPreset(clave)
    setFechaDesde(rango.fechaDesde)
    setFechaHasta(rango.fechaHasta)
  }

  function datosCuenta() {
    return {
      ventas: ventasFiltradas,
      clienteNombre: clienteSeleccionado?.nombre || "",
      fechaDesde,
      fechaHasta,
      tienda: negocioActual,
      incluirAnuladas: incluirAnuladasDoc,
    }
  }

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
      await anularVentaYDevolverStock({
        venta,
        tiendaActual,
        aplicarCambiosStock,
      })

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
          Se muestran los últimos {DIAS_HISTORIAL_VENTAS} días. Elige un día, un rango o un cliente para rendir cuentas.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border dark:border-slate-800 p-6 space-y-5">
        <div className="flex flex-wrap gap-2">
          {[
            ["hoy", "Hoy"],
            ["ayer", "Ayer"],
            ["semana", "Esta semana"],
            ["mes", "Este mes"],
            ["30dias", "Últimos 30 días"],
          ].map(([clave, etiqueta]) => (
            <button
              key={clave}
              type="button"
              onClick={() => aplicarPreset(clave)}
              className="px-4 py-2 rounded-xl bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200 text-sm font-medium"
            >
              {etiqueta}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm text-slate-500 dark:text-slate-400 block mb-1">Desde</label>
            <input
              type="date"
              min={rangoMes.fechaDesde}
              max={rangoMes.fechaHasta}
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="w-full p-3 rounded-2xl border dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <div>
            <label className="text-sm text-slate-500 dark:text-slate-400 block mb-1">Hasta</label>
            <input
              type="date"
              min={rangoMes.fechaDesde}
              max={rangoMes.fechaHasta}
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="w-full p-3 rounded-2xl border dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <div>
            <label className="text-sm text-slate-500 dark:text-slate-400 block mb-1">Cliente</label>
            <select
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className="w-full p-3 rounded-2xl border dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="">Todos los clientes</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-800 p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">Ventas válidas</p>
            <p className="text-2xl font-black dark:text-white">{resumen.activas}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-800 p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">Unidades</p>
            <p className="text-2xl font-black dark:text-white">{resumen.unidades}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-800 p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">Anuladas (no suman)</p>
            <p className="text-2xl font-black dark:text-white">{resumen.anuladas}</p>
          </div>
          <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 p-4">
            <p className="text-xs text-emerald-700 dark:text-emerald-300">Total del filtro</p>
            <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
              {formatoMoneda(resumen.total)}
            </p>
          </div>
        </div>

        <p className="text-sm text-slate-500 dark:text-slate-400">
          {clienteSeleccionado
            ? `${clienteSeleccionado.nombre} · `
            : "Todos los clientes · "}
          {fechaDesde && fechaHasta && fechaDesde === fechaHasta
            ? etiquetaDiaEs(fechaDesde)
            : `${fechaDesde || "—"} al ${fechaHasta || "—"}`}
          {diasFiltrados.length === 1
            ? ` · ${diasFiltrados[0].cantidadActivas} venta${diasFiltrados[0].cantidadActivas === 1 ? "" : "s"} ese día`
            : ` · ${diasFiltrados.length} días`}
        </p>

        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={incluirAnuladasDoc}
            onChange={(e) => setIncluirAnuladasDoc(e.target.checked)}
          />
          Incluir anuladas en la impresión / PDF (uso interno)
        </label>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => imprimirEstadoCuenta(datosCuenta())}
            className="flex items-center gap-2 bg-slate-800 text-white px-5 py-3 rounded-2xl hover:bg-slate-900 transition"
          >
            <Printer size={18} />
            Imprimir período
          </button>
          <button
            type="button"
            onClick={() => descargarPdfEstadoCuenta(datosCuenta())}
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-3 rounded-2xl hover:bg-blue-700 transition"
          >
            <FileDown size={18} />
            PDF estado de cuenta
          </button>
          <button
            type="button"
            onClick={() => exportarReporteContable(ventasFiltradas)}
            className="flex items-center gap-2 bg-green-600 text-white px-5 py-3 rounded-2xl hover:bg-green-700 transition"
          >
            <Download size={18} />
            Excel del filtro
          </button>
        </div>
      </div>

      {ventasDelMes.length === 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border dark:border-slate-800 p-10 text-center text-slate-500 dark:text-slate-400">
          No hay ventas en los últimos {DIAS_HISTORIAL_VENTAS} días
        </div>
      )}

      {ventasDelMes.length > 0 && ventasFiltradas.length === 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border dark:border-slate-800 p-10 text-center text-slate-500 dark:text-slate-400">
          No hay ventas con ese cliente y esas fechas
        </div>
      )}

      <div className="flex flex-col gap-8">

        {diasFiltrados.map((dia) => (
          <section key={dia.clave} className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-2 px-1">
              <div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white capitalize">
                  {etiquetaDiaEs(dia.clave)}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {dia.cantidadActivas} venta{dia.cantidadActivas === 1 ? "" : "s"}
                  {dia.cantidadAnuladas
                    ? ` · ${dia.cantidadAnuladas} anulada${dia.cantidadAnuladas === 1 ? "" : "s"}`
                    : ""}
                </p>
              </div>
              <p className="text-lg font-black text-emerald-600">
                Subtotal: {formatoMoneda(dia.totalActivas)}
              </p>
            </div>

            {dia.ventas.map((venta) => (
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
                      {nombreProductoVenta(producto)}
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
          </section>
        ))}

      </div>

    </div>
  )
}

export default HistorialVentas
