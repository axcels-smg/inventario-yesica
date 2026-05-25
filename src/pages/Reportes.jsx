import { useEffect, useMemo, useState } from "react"
import { collection, getDocs } from "firebase/firestore"
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
} from "lucide-react"

import { db } from "../firebase"
import { filtrarProductosStockBajo } from "../utils/stock"
import {
  aplicarFiltrosReporte,
  agruparVentasPorDia,
  obtenerRangoPreset,
} from "../utils/reportesFiltros"
import { exportarReporteContable } from "../utils/excel"
import {
  enlaceWhatsAppStockBajo,
  enlaceEmailStockBajo,
  obtenerTelefonoWhatsApp,
  guardarTelefonoWhatsApp,
} from "../utils/whatsapp"
import { STOCK_BAJO_UMBRAL } from "../constants/inventario"
import AlertasStockAcumulativas from "../components/AlertasStockAcumulativas"
import { useTienda } from "../context/TiendaContext"

function Reportes() {
  const { tiendaActual } = useTienda()
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
  }, [tiendaActual])

  async function cargarDatos() {
    if (!tiendaActual) return

    const [snapVentas, snapProductos, snapClientes] = await Promise.all([
      getDocs(collection(db, "ventas")),
      getDocs(collection(db, "productos")),
      getDocs(collection(db, "clientes")),
    ])

    const listaVentas = []
    snapVentas.forEach((d) => {
      const data = d.data()
      if (!data.tiendaId || data.tiendaId === tiendaActual.id) {
        listaVentas.push({ id: d.id, ...data })
      }
    })

    const listaProductos = []
    snapProductos.forEach((d) => {
      const data = d.data()
      if (!data.tiendaId || data.tiendaId === tiendaActual.id) {
        listaProductos.push({ id: d.id, ...data })
      }
    })

    const listaClientes = []
    snapClientes.forEach((d) => {
      const data = d.data()
      if (!data.tiendaId || data.tiendaId === tiendaActual.id) {
        listaClientes.push({ id: d.id, ...data })
      }
    })
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
  const ventasPorDia = agruparVentasPorDia(ventasFiltradas).slice(0, 14)

  const productosMap = {}
  ventasFiltradas.forEach((venta) => {
    venta.productos?.forEach((p) => {
      const nombre = p.marca || p.nombre || "Producto"
      productosMap[nombre] = (productosMap[nombre] || 0) + Number(p.cantidad)
    })
  })

  const productosVendidos = Object.entries(productosMap)
    .map(([nombre, cantidad]) => ({ nombre, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 12)

  const clientesMap = {}
  ventasFiltradas.forEach((v) => {
    const c = v.cliente || "Sin nombre"
    clientesMap[c] = (clientesMap[c] || 0) + 1
  })

  const clientesFrecuentes = Object.entries(clientesMap)
    .map(([cliente, cantidad]) => ({ cliente, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 8)

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

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-5xl font-black text-slate-800 dark:text-white">
          Reportes
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-3 text-lg">
          Filtros por fecha y cliente · Exportación contable · Alertas
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
            S/ {ingresosFiltrados}
          </h2>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border dark:border-slate-800">
          <AlertTriangle className="text-red-500" size={38} />
          <p className="text-slate-500 dark:text-slate-400 mt-4">Stock bajo (≤{STOCK_BAJO_UMBRAL})</p>
          <h2 className="text-4xl font-black dark:text-white">
            {productosStockBajo.length}
          </h2>
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
            Alertas de stock bajo
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
              href={enlaceWhatsAppStockBajo(productosStockBajo, telefonoWhatsApp)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-green-600 text-white font-bold"
            >
              <MessageCircle size={18} />
              Enviar por WhatsApp
            </a>
            <a
              href={enlaceEmailStockBajo(productosStockBajo)}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-blue-600 text-white font-bold"
            >
              <Mail size={18} />
              Enviar por Email
            </a>
          </div>
        </div>
      )}

      {/* ALERTAS ACUMULATIVAS POR DÍA */}
      <AlertasStockAcumulativas />

      {/* TABLA VENTAS FILTRADAS */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border dark:border-slate-800 overflow-x-auto">
        <h2 className="text-xl font-bold mb-4 dark:text-white">
          Ventas del período
        </h2>
        <table className="w-full min-w-[600px] text-sm">
          <thead className="bg-slate-100 dark:bg-slate-800">
            <tr>
              <th className="p-3 text-left">Boleta</th>
              <th className="p-3 text-left">Fecha</th>
              <th className="p-3 text-left">Cliente</th>
              <th className="p-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {ventasFiltradas.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-slate-500">
                  Sin ventas en este filtro
                </td>
              </tr>
            )}
            {ventasFiltradas.slice(0, 50).map((v) => (
              <tr key={v.id} className="border-t dark:border-slate-800">
                <td className="p-3 font-mono">
                  {v.numeroBoleta != null
                    ? String(v.numeroBoleta).padStart(6, "0")
                    : "—"}
                </td>
                <td className="p-3">{v.fechaTexto || "—"}</td>
                <td className="p-3">{v.cliente}</td>
                <td className="p-3 text-right font-bold">S/ {v.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {ventasFiltradas.length > 50 && (
          <p className="text-slate-500 text-sm mt-3">
            Mostrando 50 de {ventasFiltradas.length} — exporta Excel para ver todas
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
        <h2 className="text-2xl font-bold mb-6 text-red-500">Stock bajo</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto">
          {productosStockBajo.map((p) => (
            <div
              key={p.id}
              className="flex justify-between p-3 border dark:border-slate-700 rounded-xl"
            >
              <span className="font-medium dark:text-white">
                {p.marca} {p.modelo}
              </span>
              <span className="text-red-500 font-bold">{p.stock}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Reportes
