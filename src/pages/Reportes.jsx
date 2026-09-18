import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
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
import { AlertTriangle, Download, MessageCircle, Mail, Printer } from "lucide-react"

import { filtrarProductosStockBajo, resumenStockBajo, filtrarProductosPorEstadoStock } from "../utils/stock"
import { agruparPorCategoriaMarcaModelo, agruparPocoStockPorTienda } from "../utils/reporteStock"
import {
  agruparVentasPorDia,
  DIAS_HISTORIAL_VENTAS,
  filtrarVentasPorCliente,
  filtrarVentasPorFecha,
  filtrarVentasUltimoMes,
  obtenerRangoPreset,
  resumenCuentaVentas,
} from "../utils/reportesFiltros"
import { exportarReporteContable, exportarPocoStockEstructurado } from "../utils/excel"
import { formatoMoneda, nombreProductoVenta } from "../utils/reciboCliente"
import { filtrarVentasActivas } from "../utils/ventas"
import { imprimirModelosStock } from "../utils/impresion"
import { STOCK_BAJO_UMBRAL } from "../constants/inventario"
import { enlaceWhatsAppStockBajo, enlaceEmailStockBajo, obtenerTelefonoWhatsApp, guardarTelefonoWhatsApp } from "../utils/whatsapp"
import AlertasStockAcumulativas from "../components/AlertasStockAcumulativas"
import ReportePantallasDescontadas from "../components/ReportePantallasDescontadas"
import ReporteStockEstructurado from "../components/ReporteStockEstructurado"
import { useTienda } from "../context/TiendaContext"
import { useRol } from "../context/RolContext"
import { useProductosLive } from "../context/ProductosLiveContext"
import { useOperacionesLive } from "../context/OperacionesLiveContext"
import AvisoOtraTienda from "../components/AvisoOtraTienda"

function Reportes() {
  const { tiendaActual, tiendas, esTiendaPropia } = useTienda()
  const { esSuperAdmin } = useRol()
  const { productos, todosLosProductos, cargarTodasLasTiendas } = useProductosLive()
  const { ventas, clientes } = useOperacionesLive()

  const [fechaDesde, setFechaDesde] = useState("")
  const [fechaHasta, setFechaHasta] = useState("")
  const [clienteId, setClienteId] = useState("")
  const [telefonoWhatsApp, setTelefonoWhatsApp] = useState(
    obtenerTelefonoWhatsApp()
  )
  const [filtroStockReporte, setFiltroStockReporte] = useState("bajo")
  const [filtroCategoriaStock, setFiltroCategoriaStock] = useState("")
  const [busquedaStock, setBusquedaStock] = useState("")
  const [alcanceStock, setAlcanceStock] = useState("tienda")
  const [pestana, setPestana] = useState("ventas")

  const rangoMes = obtenerRangoPreset("30dias")

  useEffect(() => {
    const { fechaDesde: d, fechaHasta: h } = obtenerRangoPreset("30dias")
    setFechaDesde(d)
    setFechaHasta(h)
    setClienteId("")
  }, [tiendaActual?.id])

  useEffect(() => {
    if (alcanceStock === "todas") {
      cargarTodasLasTiendas().catch(() => {})
    }
  }, [alcanceStock, cargarTodasLasTiendas])

  const clienteSeleccionado = clientes.find((c) => c.id === clienteId)

  const ventasDelMes = useMemo(() => filtrarVentasUltimoMes(ventas), [ventas])

  const ventasPeriodo = useMemo(() => {
    let lista = filtrarVentasPorFecha(ventasDelMes, fechaDesde, fechaHasta)
    lista = filtrarVentasPorCliente(
      lista,
      clienteId,
      clienteSeleccionado?.nombre || ""
    )
    return lista
  }, [ventasDelMes, fechaDesde, fechaHasta, clienteId, clienteSeleccionado])

  const ventasActivas = useMemo(
    () => filtrarVentasActivas(ventasPeriodo),
    [ventasPeriodo]
  )

  const resumen = useMemo(
    () => resumenCuentaVentas(ventasPeriodo),
    [ventasPeriodo]
  )

  const productosStockBajo = filtrarProductosStockBajo(productos)
  const resumenPocoStock = resumenStockBajo(productos)
  const categoriasStock = useMemo(() => {
    const fuente = alcanceStock === "todas" ? todosLosProductos : productos
    return [...new Set(fuente.map((p) => p.categoria).filter(Boolean))].sort((a, b) =>
      String(a).localeCompare(String(b), "es")
    )
  }, [alcanceStock, productos, todosLosProductos])
  const listaStockReporte = useMemo(() => {
    let lista = filtrarProductosPorEstadoStock(productos, filtroStockReporte)
    if (filtroCategoriaStock) {
      lista = lista.filter((p) => p.categoria === filtroCategoriaStock)
    }
    const q = busquedaStock.trim().toLowerCase()
    if (q) {
      lista = lista.filter((p) =>
        `${p.codigo || ""} ${p.marca || ""} ${p.modelo || ""} ${p.categoria || ""}`
          .toLowerCase()
          .includes(q)
      )
    }
    return lista
  }, [productos, filtroStockReporte, filtroCategoriaStock, busquedaStock])

  const gruposStockTienda = useMemo(
    () => agruparPorCategoriaMarcaModelo(listaStockReporte, tiendaActual?.nombre || ""),
    [listaStockReporte, tiendaActual?.nombre]
  )

  const reporteStockTodas = useMemo(() => {
    let lista = filtrarProductosPorEstadoStock(todosLosProductos, filtroStockReporte)
    if (filtroCategoriaStock) {
      lista = lista.filter((p) => p.categoria === filtroCategoriaStock)
    }
    const q = busquedaStock.trim().toLowerCase()
    if (q) {
      lista = lista.filter((p) =>
        `${p.codigo || ""} ${p.marca || ""} ${p.modelo || ""} ${p.categoria || ""}`
          .toLowerCase()
          .includes(q)
      )
    }
    return {
      lista,
      tiendas: agruparPocoStockPorTienda(lista, tiendas, { estadoStock: "" }),
    }
  }, [todosLosProductos, tiendas, filtroStockReporte, filtroCategoriaStock, busquedaStock])

  const listaAlertaStock =
    alcanceStock === "todas" ? reporteStockTodas.lista : listaStockReporte
  const nombreAlertaStock =
    alcanceStock === "todas" ? "Todas las tiendas" : tiendaActual?.nombre || ""

  const ventasPorDia = agruparVentasPorDia(ventasActivas).slice(0, 31)

  const productosVendidos = useMemo(() => {
    const productosMap = {}
    ventasActivas.forEach((venta) => {
      venta.productos?.forEach((p) => {
        const nombre = nombreProductoVenta(p)
        if (!productosMap[nombre]) {
          productosMap[nombre] = { nombre, cantidad: 0, total: 0 }
        }
        const cant = Number(p.cantidad) || 0
        productosMap[nombre].cantidad += cant
        productosMap[nombre].total += Number(p.precio) * cant
      })
    })

    return Object.values(productosMap)
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 8)
  }, [ventasActivas])

  const clientesPorMonto = useMemo(() => {
    const mapa = {}
    ventasActivas.forEach((v) => {
      const c = v.cliente || "Sin nombre"
      if (!mapa[c]) mapa[c] = { cliente: c, total: 0, cantidad: 0 }
      mapa[c].total += Number(v.total) || 0
      mapa[c].cantidad += 1
    })
    return Object.values(mapa)
      .sort((a, b) => b.total - a.total)
      .slice(0, 8)
  }, [ventasActivas])

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

  if (!esTiendaPropia && !esSuperAdmin()) {
    return <AvisoOtraTienda modo="bloqueo" />
  }

  return (
    <div className="space-y-10">
      {!esTiendaPropia && <AvisoOtraTienda />}
      <div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-800 dark:text-white break-words">
          Reportes
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-3 text-lg">
          {tiendaActual?.nombre ? `${tiendaActual.nombre} · ` : ""}
          Resumen del negocio. Para rendir cuentas a un cliente usa{" "}
          <Link to="/historial" className="font-bold text-blue-600 dark:text-blue-400 underline">
            Historial
          </Link>
          . El inventario completo se baja en{" "}
          <Link to="/excel" className="font-bold text-blue-600 dark:text-blue-400 underline">
            Excel
          </Link>
          .
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          ["ventas", "Ventas"],
          ["stock", "Poco stock"],
          ["pantallas", "Pantallas"],
          ["alertas", "Alertas 3 días"],
        ].map(([id, etiqueta]) => (
          <button
            key={id}
            type="button"
            onClick={() => setPestana(id)}
            className={`px-4 py-2 rounded-2xl text-sm font-bold ${
              pestana === id
                ? "bg-slate-800 text-white"
                : "bg-white dark:bg-slate-900 border dark:border-slate-700 dark:text-slate-200"
            }`}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {pestana === "ventas" && (
      <>
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border dark:border-slate-800 space-y-4">
        <h2 className="text-xl font-bold dark:text-white">1. Período</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Mismos {DIAS_HISTORIAL_VENTAS} días que Historial. Elige un día, una semana o el mes. El cliente es opcional (para ver su movimiento, no para imprimir su cuenta).
        </p>

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
            <label className="text-sm text-slate-500 dark:text-slate-400 block mb-1">Cliente (opcional)</label>
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

        <div className="flex flex-wrap gap-3 items-center">
          <button
            type="button"
            onClick={() => exportarReporteContable(ventasActivas)}
            className="flex items-center gap-2 bg-green-600 text-white px-5 py-3 rounded-2xl font-bold hover:bg-green-700"
          >
            <Download size={18} />
            Excel de este período
          </button>
          <Link
            to="/historial"
            className="flex items-center gap-2 px-5 py-3 rounded-2xl border dark:border-slate-700 font-medium dark:text-white hover:border-blue-500"
          >
            Estado de cuenta (Historial)
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">Ventas válidas</p>
          <p className="text-3xl font-black dark:text-white">{resumen.activas}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">Unidades</p>
          <p className="text-3xl font-black dark:text-white">{resumen.unidades}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">Anuladas (no suman)</p>
          <p className="text-3xl font-black dark:text-white">{resumen.anuladas}</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-950/40 rounded-3xl p-5 border border-emerald-200 dark:border-emerald-900">
          <p className="text-xs text-emerald-700 dark:text-emerald-300">Ingresos</p>
          <p className="text-3xl font-black text-emerald-700 dark:text-emerald-300">
            {formatoMoneda(resumen.total)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border dark:border-slate-800">
          <h2 className="text-xl font-bold mb-4 dark:text-white">Qué se vendió</h2>
          {productosVendidos.length === 0 ? (
            <p className="text-slate-500">Sin ventas en este período.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 dark:bg-slate-800">
                  <tr>
                    <th className="p-2 text-left">Modelo</th>
                    <th className="p-2 text-right">Unid.</th>
                    <th className="p-2 text-right">Soles</th>
                  </tr>
                </thead>
                <tbody>
                  {productosVendidos.map((p) => (
                    <tr key={p.nombre} className="border-t dark:border-slate-800">
                      <td className="p-2 dark:text-white">{p.nombre}</td>
                      <td className="p-2 text-right font-bold dark:text-white">{p.cantidad}</td>
                      <td className="p-2 text-right">{formatoMoneda(p.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border dark:border-slate-800">
          <h2 className="text-xl font-bold mb-4 dark:text-white">Quién compró (por soles)</h2>
          {clientesPorMonto.length === 0 ? (
            <p className="text-slate-500">Sin clientes en este período.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 dark:bg-slate-800">
                  <tr>
                    <th className="p-2 text-left">Cliente</th>
                    <th className="p-2 text-right">Ventas</th>
                    <th className="p-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {clientesPorMonto.map((c) => (
                    <tr key={c.cliente} className="border-t dark:border-slate-800">
                      <td className="p-2 dark:text-white">{c.cliente}</td>
                      <td className="p-2 text-right">{c.cantidad}</td>
                      <td className="p-2 text-right font-bold dark:text-white">{formatoMoneda(c.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {productosVendidos.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border dark:border-slate-800">
          <h2 className="text-xl font-bold mb-4 dark:text-white">Unidades por modelo</h2>
          <div className="h-[200px] sm:h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productosVendidos} layout="vertical">
                <XAxis type="number" />
                <YAxis dataKey="nombre" type="category" width={140} fontSize={10} />
                <Tooltip />
                <Bar dataKey="cantidad" fill="#16a34a" name="Unidades" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border dark:border-slate-800">
          <h2 className="text-xl font-bold mb-6 dark:text-white">
            Ingresos por día
          </h2>
          {ventasPorDia.length === 0 ? (
            <p className="text-slate-500">Sin ingresos en este período.</p>
          ) : (
          <div className="h-[220px] sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ventasPorDia}>
                <XAxis dataKey="fecha" fontSize={11} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="total" fill="#2563eb" name="S/" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border dark:border-slate-800">
          <h2 className="text-xl font-bold mb-6 dark:text-white">
            Clientes por monto
          </h2>
          {clientesPorMonto.length === 0 ? (
            <p className="text-slate-500">Sin datos.</p>
          ) : (
          <div className="h-[220px] sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={clientesPorMonto}
                  dataKey="total"
                  nameKey="cliente"
                  outerRadius={110}
                  label
                >
                  {clientesPorMonto.map((_, i) => (
                    <Cell key={i} fill={colores[i % colores.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(valor) => formatoMoneda(valor)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          )}
        </div>
      </div>
      </>
      )}

      {pestana === "stock" && (
      <div className="space-y-8">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border dark:border-slate-800">
          <AlertTriangle className="text-red-500" size={38} />
          <p className="text-slate-500 dark:text-slate-400 mt-4">No hay (stock 0) en esta tienda</p>
          <h2 className="text-4xl font-black dark:text-white">
            {resumenPocoStock.agotados}
          </h2>
          <p className="text-sm text-slate-500 mt-3">
            Abajo filtras y bajas Excel o imprimes. El inventario completo de todas las tiendas está en{" "}
            <Link to="/excel" className="font-bold text-blue-600 dark:text-blue-400 underline">
              Excel
            </Link>
            .
          </p>
        </div>

        {listaAlertaStock.length > 0 && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-3xl p-6 space-y-4">
            <h2 className="text-xl font-bold text-red-800 dark:text-red-200">
              Alertas de stock — {tiendaActual?.nombre || "esta tienda"}
            </h2>
            <p className="text-sm text-red-700 dark:text-red-300">
              El WhatsApp envía la lista agrupada por categoría y marca ({listaAlertaStock.length} ítems).
              Guarda tu número de Perú; si ya empieza con 51 no se duplica.
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
                  listaAlertaStock.length > 0 ? listaAlertaStock : productosStockBajo,
                  telefonoWhatsApp,
                  nombreAlertaStock
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
                  listaAlertaStock.length > 0 ? listaAlertaStock : productosStockBajo,
                  "",
                  nombreAlertaStock
                )}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-blue-600 text-white font-bold"
              >
                <Mail size={18} />
                Enviar por Email
              </a>
            </div>
          </div>
        )}

      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border dark:border-slate-800">
        <h2 className="text-2xl font-bold mb-2 text-red-500">
          Poco stock — categoría, marca y modelo
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Abre solo la categoría que necesitas. Excel e imprimir siguen sacando la lista completa.
        </p>

        <div className="flex flex-wrap gap-3 mb-6">
          <div className="flex rounded-2xl border dark:border-slate-700 overflow-hidden">
            <button
              type="button"
              onClick={() => setAlcanceStock("tienda")}
              className={`px-4 py-3 text-sm font-bold ${
                alcanceStock === "tienda"
                  ? "bg-slate-800 text-white"
                  : "bg-white dark:bg-slate-900 dark:text-slate-200"
              }`}
            >
              {tiendaActual?.nombre || "Esta tienda"}
            </button>
            <button
              type="button"
              onClick={() => setAlcanceStock("todas")}
              className={`px-4 py-3 text-sm font-bold ${
                alcanceStock === "todas"
                  ? "bg-slate-800 text-white"
                  : "bg-white dark:bg-slate-900 dark:text-slate-200"
              }`}
            >
              Todas las tiendas
            </button>
          </div>
          <select
            value={filtroStockReporte}
            onChange={(e) => setFiltroStockReporte(e.target.value)}
            className="p-3 rounded-2xl border dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="bajo">No hay + poco stock (≤{STOCK_BAJO_UMBRAL})</option>
            <option value="no_hay">Solo lo que no hay (0)</option>
            <option value="poco">Solo poco stock (1–{STOCK_BAJO_UMBRAL})</option>
          </select>
          <select
            value={filtroCategoriaStock}
            onChange={(e) => setFiltroCategoriaStock(e.target.value)}
            className="p-3 rounded-2xl border dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="">Todas las categorías</option>
            {categoriasStock.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input
            value={busquedaStock}
            onChange={(e) => setBusquedaStock(e.target.value)}
            placeholder="Buscar modelo, marca, código..."
            className="p-3 rounded-2xl border flex-1 min-w-[200px] dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <button
            type="button"
            onClick={() => {
              const lista =
                alcanceStock === "todas" ? reporteStockTodas.lista : listaStockReporte
              if (lista.length === 0) {
                return Swal.fire({
                  icon: "info",
                  title: "Nada que exportar",
                  text: "Cambia el filtro o no hay modelos con ese estado.",
                })
              }
              const r = exportarPocoStockEstructurado({
                productos: lista,
                nombreTienda:
                  alcanceStock === "todas"
                    ? "Todas las tiendas"
                    : tiendaActual?.nombre || "Tienda",
                tiendas,
                todas: alcanceStock === "todas",
                estadoStock: filtroStockReporte,
              })
              Swal.fire({
                icon: "success",
                title:
                  filtroStockReporte === "no_hay"
                    ? "Excel de lo que no hay"
                    : "Excel de poco stock",
                text: `${r.categorias} categorías · ${r.productos} modelos. Una hoja por categoría.`,
              })
            }}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-green-700 text-white font-bold"
          >
            <Download size={18} />
            Excel de este reporte
          </button>
          <button
            type="button"
            onClick={() => {
              const lista =
                alcanceStock === "todas" ? reporteStockTodas.lista : listaStockReporte
              const nombre =
                alcanceStock === "todas"
                  ? "Todas las tiendas"
                  : tiendaActual?.nombre || "Tienda"
              imprimirModelosStock({
                grupos: agruparPorCategoriaMarcaModelo(lista, nombre),
                nombreTienda: nombre,
                titulo:
                  filtroStockReporte === "no_hay"
                    ? "Modelos que ya no hay (stock 0)"
                    : `Poco stock (≤ ${STOCK_BAJO_UMBRAL} u.)`,
                nota:
                  filtroStockReporte === "no_hay"
                    ? "Solo modelos en 0. El aviso de 3 unidades incluye también 1, 2 y 3."
                    : `Incluye stock 0 hasta ${STOCK_BAJO_UMBRAL}.`,
              })
            }}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-800 text-white font-bold"
          >
            <Printer size={18} />
            Imprimir este reporte
          </button>
        </div>

        {alcanceStock === "todas" ? (
          reporteStockTodas.tiendas.length === 0 ? (
            <p className="text-slate-500">Ninguna tienda tiene productos con este filtro.</p>
          ) : (
            <div className="space-y-14">
              {reporteStockTodas.tiendas.map((tienda) => (
                <div key={tienda.tiendaId}>
                  <h3 className="text-3xl font-black mb-6 text-slate-900 dark:text-white">
                    {tienda.nombre}
                    <span className="block text-base font-medium text-slate-500 mt-1">
                      {tienda.total} modelos a reponer
                    </span>
                  </h3>
                  <ReporteStockEstructurado grupos={tienda.grupos} />
                </div>
              ))}
            </div>
          )
        ) : (
          <ReporteStockEstructurado
            grupos={gruposStockTienda}
            vacio={
              filtroStockReporte === "no_hay"
                ? "No hay productos agotados con este filtro. Todo está en stock."
                : "No hay productos con poco stock en esta tienda."
            }
          />
        )}
      </div>
      </div>
      )}

      <div className={pestana === "pantallas" ? "" : "hidden"}>
        <ReportePantallasDescontadas tiendaId={tiendaActual?.id} />
      </div>
      <div className={pestana === "alertas" ? "" : "hidden"}>
        <AlertasStockAcumulativas tiendaId={tiendaActual?.id} />
      </div>
    </div>
  )
}

export default Reportes
