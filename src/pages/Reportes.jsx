import { useEffect, useMemo, useState } from "react"
import Swal from "sweetalert2"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import {
  FileText,
  DollarSign,
  AlertTriangle,
  Download,
  MessageCircle,
  Mail,
  FileDown,
} from "lucide-react"

import { filtrarProductosStockBajo, etiquetaEstadoStock, esStockAgotado, resumenStockBajo } from "../utils/stock"
import {
  aplicarFiltrosReporte,
  agruparVentasPorDia,
  obtenerRangoPreset,
} from "../utils/reportesFiltros"
import { exportarReporteContable } from "../utils/excel"
import {
  enlaceWhatsAppTexto,
  enlaceEmailTexto,
  textoReciboPeriodo,
  descargarPdfReciboPeriodo,
  formatoMoneda,
  nombreProductoVenta,
} from "../utils/reciboCliente"
import { STOCK_BAJO_UMBRAL } from "../constants/inventario"
import { enlaceWhatsAppStockBajo, enlaceEmailStockBajo, obtenerTelefonoWhatsApp, guardarTelefonoWhatsApp } from "../utils/whatsapp"
import AlertasStockAcumulativas from "../components/AlertasStockAcumulativas"
import { useTienda } from "../context/TiendaContext"
import AvisoOtraTienda from "../components/AvisoOtraTienda"
import { listarPorTienda } from "../utils/consultasTienda"

function Reportes() {
  const { tiendaActual, esTiendaPropia } = useTienda()
  const [ventas, setVentas] = useState([])
  const [productos, setProductos] = useState([])
  const [clientes, setClientes] = useState([])

  const [fechaDesde, setFechaDesde] = useState("")
  const [fechaHasta, setFechaHasta] = useState("")
  const [clienteId, setClienteId] = useState("")
  const [telefonoWhatsApp, setTelefonoWhatsApp] = useState(
    obtenerTelefonoWhatsApp()
  )

  useEffect(() => {
    if (tiendaActual) {
      cargarDatos()
    }
    const { fechaDesde: d, fechaHasta: h } = obtenerRangoPreset("mes")
    setFechaDesde(d)
    setFechaHasta(h)
  }, [tiendaActual?.id])

  async function cargarDatos() {
    if (!tiendaActual) return

    const [listaVentas, listaProductos, listaClientes] = await Promise.all([
      listarPorTienda("ventas", tiendaActual.id),
      listarPorTienda("productos", tiendaActual.id),
      listarPorTienda("clientes", tiendaActual.id),
    ])

    listaClientes.sort((a, b) =>
      String(a.nombre || "").localeCompare(String(b.nombre || ""))
    )

    setVentas(listaVentas)
    setProductos(listaProductos)
    setClientes(listaClientes)
  }

  const clienteSeleccionado = clientes.find((c) => c.id === clienteId)

  const ventasFiltradas = useMemo(
    () =>
      aplicarFiltrosReporte(ventas, {
        fechaDesde,
        fechaHasta,
        clienteId,
        clienteNombre: clienteSeleccionado?.nombre || "",
      }),
    [ventas, fechaDesde, fechaHasta, clienteId, clienteSeleccionado]
  )

  const ingresosFiltrados = ventasFiltradas.reduce(
    (acc, v) => acc + Number(v.total),
    0
  )

  const productosStockBajo = filtrarProductosStockBajo(productos)
  const resumenPocoStock = resumenStockBajo(productos)
  const ventasPorDia = agruparVentasPorDia(ventasFiltradas).slice(0, 31)

  const productosVendidos = useMemo(() => {
    const productosMap = {}
    ventasFiltradas.forEach((venta) => {
      venta.productos?.forEach((p) => {
        const nombre = p.marca || p.nombre || "Producto"
        productosMap[nombre] = (productosMap[nombre] || 0) + Number(p.cantidad)
      })
    })

    return Object.entries(productosMap)
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 12)
  }, [ventasFiltradas])

  const clientesFrecuentes = useMemo(() => {
    const clientesMap = {}
    ventasFiltradas.forEach((v) => {
      const c = v.cliente || "Sin nombre"
      clientesMap[c] = (clientesMap[c] || 0) + 1
    })

    return Object.entries(clientesMap)
      .map(([cliente, cantidad]) => ({ cliente, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 8)
  }, [ventasFiltradas])

  const colores = ["#2563eb", "#16a34a", "#dc2626", "#ca8a04", "#9333ea"]

  function aplicarPreset(preset) {
    const rango = obtenerRangoPreset(preset)
    setFechaDesde(rango.fechaDesde)
    setFechaHasta(rango.fechaHasta)
  }

  function guardarWhatsApp() {
    guardarTelefonoWhatsApp(telefonoWhatsApp)
    Swal.fire({ icon: "success", title: "Número guardado", timer: 1200 })
  }

  function abrirReciboWhatsApp() {
    if (!clienteSeleccionado) {
      return Swal.fire({
        icon: "info",
        title: "Elige un cliente",
        text: "Selecciona el cliente y las fechas. Así se arma su recibo de ese período.",
      })
    }
    if (ventasFiltradas.length === 0) {
      return Swal.fire({ icon: "info", title: "Sin ventas", text: "Ese cliente no tiene ventas en las fechas elegidas." })
    }
    const texto = textoReciboPeriodo({
      ventas: ventasFiltradas,
      cliente: clienteSeleccionado,
      fechaDesde,
      fechaHasta,
      tienda: tiendaActual,
    })
    const telefono = clienteSeleccionado.telefono || ""
    if (!telefono) {
      Swal.fire({
        icon: "warning",
        title: "El cliente no tiene teléfono",
        text: "Se abrirá WhatsApp para que elijas el contacto.",
      })
    }
    window.open(enlaceWhatsAppTexto(texto, telefono), "_blank")
  }

  function abrirReciboEmail() {
    if (!clienteSeleccionado) {
      return Swal.fire({
        icon: "info",
        title: "Elige un cliente",
        text: "Selecciona el cliente y las fechas para enviar su recibo.",
      })
    }
    if (ventasFiltradas.length === 0) {
      return Swal.fire({ icon: "info", title: "Sin ventas", text: "Ese cliente no tiene ventas en las fechas elegidas." })
    }
    const texto = textoReciboPeriodo({
      ventas: ventasFiltradas,
      cliente: clienteSeleccionado,
      fechaDesde,
      fechaHasta,
      tienda: tiendaActual,
    })
    window.location.href = enlaceEmailTexto(
      texto,
      clienteSeleccionado.correo || "",
      `Recibo de compras — ${clienteSeleccionado.nombre}`
    )
  }

  async function descargarReciboPdf() {
    if (!clienteSeleccionado) {
      return Swal.fire({
        icon: "info",
        title: "Elige un cliente",
        text: "Selecciona el cliente y las fechas para descargar su recibo.",
      })
    }
    if (ventasFiltradas.length === 0) {
      return Swal.fire({ icon: "info", title: "Sin ventas", text: "Ese cliente no tiene ventas en las fechas elegidas." })
    }
    await descargarPdfReciboPeriodo({
      ventas: ventasFiltradas,
      cliente: clienteSeleccionado,
      fechaDesde,
      fechaHasta,
      tienda: tiendaActual,
    })
  }

  if (!esTiendaPropia) {
    return <AvisoOtraTienda modo="bloqueo" />
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-5xl font-black text-slate-800 dark:text-white">
          Reportes
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-3 text-lg">
          {tiendaActual?.nombre ? `${tiendaActual.nombre} · ` : ""}
          Elige fechas y un cliente para ver y enviar su recibo de compras.
        </p>
      </div>

      {/* FILTROS */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border dark:border-slate-800 space-y-4">
        <h2 className="text-xl font-bold dark:text-white">Filtros del reporte</h2>

        <div className="flex flex-wrap gap-2">
          {[
            ["hoy", "Hoy"],
            ["semana", "Esta semana"],
            ["mes", "Este mes"],
          ].map(([clave, etiqueta]) => (
            <button
              key={clave}
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
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="w-full p-3 rounded-2xl border dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <div>
            <label className="text-sm text-slate-500 dark:text-slate-400 block mb-1">Hasta</label>
            <input
              type="date"
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

        <button
          onClick={() => exportarReporteContable(ventasFiltradas)}
          className="flex items-center gap-2 bg-green-600 text-white px-5 py-3 rounded-2xl font-bold hover:bg-green-700"
        >
          <Download size={18} />
          Exportar Excel contable (filtro actual)
        </button>
      </div>

      {/* RECIBO POR CLIENTE + FECHAS */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border dark:border-slate-800 space-y-4">
        <h2 className="text-xl font-bold dark:text-white">Recibo del cliente</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          1) Elige <b>Desde</b> y <b>Hasta</b>. 2) Elige el <b>cliente</b>. 3) Envía el resumen de esas compras por WhatsApp, correo o PDF.
        </p>

        {!clienteId && (
          <p className="text-amber-700 dark:text-amber-300 text-sm">
            Todavía no hay cliente seleccionado. El reporte de arriba muestra todas las ventas del período. Para el recibo, elige un cliente.
          </p>
        )}

        {clienteSeleccionado && (
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-800 p-4 space-y-2">
            <p className="dark:text-white">
              <b>{clienteSeleccionado.nombre}</b>
              {clienteSeleccionado.telefono ? ` · Tel ${clienteSeleccionado.telefono}` : " · sin teléfono"}
              {clienteSeleccionado.correo ? ` · ${clienteSeleccionado.correo}` : ""}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Período {fechaDesde || "—"} al {fechaHasta || "—"} · {ventasFiltradas.length} ventas · {formatoMoneda(ingresosFiltrados)}
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={abrirReciboWhatsApp}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-green-600 text-white font-bold hover:bg-green-700"
          >
            <MessageCircle size={18} />
            Enviar recibo por WhatsApp
          </button>
          <button
            type="button"
            onClick={abrirReciboEmail}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-blue-600 text-white font-bold hover:bg-blue-700"
          >
            <Mail size={18} />
            Enviar recibo por correo
          </button>
          <button
            type="button"
            onClick={descargarReciboPdf}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-800 text-white font-bold hover:bg-slate-900"
          >
            <FileDown size={18} />
            Descargar PDF del período
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border dark:border-slate-800">
          <FileText className="text-blue-500" size={38} />
          <p className="text-slate-500 dark:text-slate-400 mt-4">Ventas (filtro)</p>
          <h2 className="text-4xl font-black dark:text-white">
            {ventasFiltradas.length}
          </h2>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border dark:border-slate-800">
          <DollarSign className="text-green-500" size={38} />
          <p className="text-slate-500 dark:text-slate-400 mt-4">Ingresos (filtro)</p>
          <h2 className="text-4xl font-black dark:text-white">
            S/ {Number(ingresosFiltrados).toFixed(2)}
          </h2>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border dark:border-slate-800">
          <AlertTriangle className="text-red-500" size={38} />
          <p className="text-slate-500 dark:text-slate-400 mt-4">Poco stock (≤{STOCK_BAJO_UMBRAL})</p>
          <h2 className="text-4xl font-black dark:text-white">
            {resumenPocoStock.total}
          </h2>
          <p className="text-xs text-slate-500 mt-2">
            {resumenPocoStock.agotados} agotados · {resumenPocoStock.poco} poco stock
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border dark:border-slate-800">
          <p className="text-slate-500 dark:text-slate-400 mt-2">Clientes en filtro</p>
          <h2 className="text-4xl font-black dark:text-white">
            {new Set(ventasFiltradas.map((v) => v.cliente)).size}
          </h2>
        </div>
      </div>

      {/* ALERTAS WHATSAPP / EMAIL */}
      {productosStockBajo.length > 0 && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-3xl p-6 space-y-4">
          <h2 className="text-xl font-bold text-red-800 dark:text-red-200">
            Alertas de poco stock — {tiendaActual?.nombre || "esta tienda"}
          </h2>
          <p className="text-sm text-red-700 dark:text-red-300">
            WhatsApp automático requiere abrir el enlace (sin servidor). Guarda tu
            número con código de Perú sin el +51.
          </p>
          <div className="flex flex-wrap gap-3 items-end">
            <input
              value={telefonoWhatsApp}
              onChange={(e) => setTelefonoWhatsApp(e.target.value)}
              placeholder="Ej: 999888777"
              className="p-3 rounded-2xl border flex-1 min-w-[200px] dark:bg-slate-900 dark:text-white"
            />
            <button
              onClick={guardarWhatsApp}
              className="px-4 py-3 rounded-2xl bg-slate-800 text-white"
            >
              Guardar número
            </button>
            <a
              href={enlaceWhatsAppStockBajo(
                productosStockBajo,
                telefonoWhatsApp,
                tiendaActual?.nombre || ""
              )}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-green-600 text-white font-bold"
            >
              <MessageCircle size={18} />
              Enviar por WhatsApp
            </a>
            <a
              href={enlaceEmailStockBajo(
                productosStockBajo,
                "",
                tiendaActual?.nombre || ""
              )}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-blue-600 text-white font-bold"
            >
              <Mail size={18} />
              Enviar por Email
            </a>
          </div>
        </div>
      )}

      {/* ALERTAS ACUMULATIVAS POR DÍA */}
      <AlertasStockAcumulativas tiendaId={tiendaActual?.id} />

      {/* TABLA VENTAS FILTRADAS */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border dark:border-slate-800 overflow-x-auto">
        <h2 className="text-xl font-bold mb-4 dark:text-white">
          {clienteSeleccionado
            ? `Compras de ${clienteSeleccionado.nombre}`
            : "Ventas del período"}
        </h2>
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-slate-100 dark:bg-slate-800">
            <tr>
              <th className="p-3 text-left">Boleta</th>
              <th className="p-3 text-left">Fecha</th>
              <th className="p-3 text-left">Cliente</th>
              <th className="p-3 text-left">Productos</th>
              <th className="p-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {ventasFiltradas.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-slate-500">
                  Sin ventas en este filtro
                </td>
              </tr>
            )}
            {ventasFiltradas.slice(0, 80).map((v) => (
              <tr key={v.id} className="border-t dark:border-slate-800 align-top">
                <td className="p-3 font-mono">
                  {v.numeroBoleta != null
                    ? String(v.numeroBoleta).padStart(6, "0")
                    : "—"}
                </td>
                <td className="p-3">{v.fechaTexto || "—"}</td>
                <td className="p-3">{v.cliente}</td>
                <td className="p-3 text-slate-600 dark:text-slate-300">
                  {(v.productos || []).map((p, i) => (
                    <div key={i}>
                      {nombreProductoVenta(p)} × {p.cantidad}
                    </div>
                  ))}
                </td>
                <td className="p-3 text-right font-bold">{formatoMoneda(v.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {ventasFiltradas.length > 80 && (
          <p className="text-slate-500 text-sm mt-3">
            Mostrando 80 de {ventasFiltradas.length} — exporta Excel o el PDF del cliente para ver todas
          </p>
        )}
      </div>

      {productosVendidos.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border dark:border-slate-800">
          <h2 className="text-xl font-bold mb-4 dark:text-white">
            Top productos vendidos (período)
          </h2>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productosVendidos} layout="vertical">
                <XAxis type="number" />
                <YAxis dataKey="nombre" type="category" width={120} fontSize={10} />
                <Tooltip />
                <Bar dataKey="cantidad" fill="#16a34a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border dark:border-slate-800">
          <h2 className="text-2xl font-bold mb-6 dark:text-white">
            Ingresos por día
          </h2>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ventasPorDia}>
                <XAxis dataKey="fecha" fontSize={11} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="total" fill="#2563eb" name="S/" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border dark:border-slate-800">
          <h2 className="text-2xl font-bold mb-6 dark:text-white">
            Clientes (período)
          </h2>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={clientesFrecuentes}
                  dataKey="cantidad"
                  nameKey="cliente"
                  outerRadius={110}
                  label
                >
                  {clientesFrecuentes.map((_, i) => (
                    <Cell key={i} fill={colores[i % colores.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border dark:border-slate-800">
        <h2 className="text-2xl font-bold mb-2 text-red-500">
          Poco stock — {tiendaActual?.nombre || "tienda"}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Productos con {STOCK_BAJO_UMBRAL} unidades o menos. Agotado = 0.
        </p>
        {productosStockBajo.length === 0 ? (
          <p className="text-slate-500">No hay productos con poco stock en esta tienda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-100 dark:bg-slate-800">
                <tr>
                  <th className="p-3 text-left">Código</th>
                  <th className="p-3 text-left">Producto</th>
                  <th className="p-3 text-left">Categoría</th>
                  <th className="p-3 text-right">Stock</th>
                  <th className="p-3 text-left">Estado</th>
                  <th className="p-3 text-right">Precio</th>
                </tr>
              </thead>
              <tbody>
                {productosStockBajo.map((p) => {
                  const agotado = esStockAgotado(p.stock)
                  return (
                    <tr
                      key={p.id}
                      className={`border-t dark:border-slate-800 ${
                        agotado
                          ? "bg-red-50/80 dark:bg-red-950/20"
                          : "bg-amber-50/50 dark:bg-amber-950/10"
                      }`}
                    >
                      <td className="p-3 font-mono text-slate-600 dark:text-slate-400">
                        {p.codigo || "—"}
                      </td>
                      <td className="p-3 font-medium dark:text-white">
                        {p.marca} {p.modelo}
                      </td>
                      <td className="p-3">{p.categoria || "—"}</td>
                      <td className="p-3 text-right font-bold text-red-600">
                        {p.stock}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-bold ${
                            agotado
                              ? "bg-red-200 text-red-900 dark:bg-red-900 dark:text-red-100"
                              : "bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100"
                          }`}
                        >
                          {etiquetaEstadoStock(p.stock)}
                        </span>
                      </td>
                      <td className="p-3 text-right">S/ {p.precio}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default Reportes
