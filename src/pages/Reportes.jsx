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

import { esCategoriaPantalla, esStockAgotado, esStockBajo, etiquetaEstadoStock } from "../utils/stock"
import { agruparVariantes, separarReporteStock } from "../utils/variantesModelo"
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
import { enlaceWhatsAppTexto, enlaceEmailTexto, obtenerTelefonoWhatsApp, guardarTelefonoWhatsApp } from "../utils/whatsapp"
import AlertasStockAcumulativas from "../components/AlertasStockAcumulativas"
import ReportePantallasDescontadas from "../components/ReportePantallasDescontadas"
import { useTienda } from "../context/TiendaContext"
import { useRol } from "../context/RolContext"
import { useProductosLive } from "../context/ProductosLiveContext"
import { useOperacionesLive } from "../context/OperacionesLiveContext"
import AvisoOtraTienda from "../components/AvisoOtraTienda"

function CeldaReporte({ lista, stock }) {
  const primero = lista?.[0]
  if (!primero) {
    return (
      <td className="p-3 align-top">
        <div className="min-h-[72px] rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400">—</div>
      </td>
    )
  }
  const agotado = esStockAgotado(stock)
  const poco = esStockBajo(stock)
  return (
    <td className="p-3 align-top min-w-[180px]">
      <div className={`rounded-2xl border p-3 h-full ${
        agotado
          ? "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900"
          : poco
          ? "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900"
          : "bg-slate-50 border-slate-200 dark:bg-slate-800/60 dark:border-slate-700"
      }`}>
        <p className="text-sm font-medium leading-snug dark:text-white">{primero.modelo}</p>
        <div className="flex items-end justify-between gap-2 mt-2">
          <p className={`text-3xl font-black tabular-nums leading-none ${
            agotado ? "text-red-600 dark:text-red-300" : poco ? "text-amber-700 dark:text-amber-200" : "text-emerald-700 dark:text-emerald-300"
          }`}>{stock}</p>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{etiquetaEstadoStock(stock)}</p>
        </div>
      </div>
    </td>
  )
}

function estadoDelTotal(total) {
  if (total === 0) return "En 0"
  if (total < 3) return "Menor que 3"
  if (total < 5) return "Menor que 5"
  return "OK"
}

function filasDelReporte(productos, tienda) {
  return agruparVariantes(productos).map((familia) => {
    const pantalla = esCategoriaPantalla(familia)
    return {
      tienda,
      marca: familia.marca,
      categoria: familia.categoria,
      normal: pantalla ? (familia.hayNormal ? familia.normal[0].modelo : "—") : familia.normal[0]?.modelo || "",
      stockNormal: pantalla ? (familia.hayNormal ? familia.stockNormal : "—") : familia.total,
      yiifix: pantalla && familia.hayYiifix ? familia.yiifix[0].modelo : "—",
      stockYiifix: pantalla && familia.hayYiifix ? familia.stockYiifix : "—",
      mecanico: pantalla && familia.hayMecanico ? familia.mecanico[0].modelo : "—",
      stockMecanico: pantalla && familia.hayMecanico ? familia.stockMecanico : "—",
      total: familia.total,
      estado: estadoDelTotal(familia.total),
    }
  })
}

function textoDelReporte(filas, titulo, nombreTienda) {
  const tope = 40
  const lineas = filas.slice(0, tope).map((fila) => {
    if (fila.yiifix === "—" && fila.mecanico === "—") {
      return `${fila.marca} ${fila.categoria} ${fila.normal}: ${fila.total}`
    }
    return `${fila.marca} ${fila.normal} ${fila.stockNormal} | YIIFIX ${fila.stockYiifix} | Mecánico ${fila.stockMecanico} | Total ${fila.total}`
  })
  const resto = filas.length > tope ? `\n…y ${filas.length - tope} más. El Excel trae la lista completa.` : ""
  return `${titulo}\n${nombreTienda}\n${filas.length} filas\n\n${lineas.join("\n")}${resto}`
}

function TablaReporteComoProductos({ productos }) {
  const filas = agruparVariantes(productos)
  if (filas.length === 0) return null
  return (
    <div className="overflow-x-auto rounded-2xl border dark:border-slate-800">
      <table className="w-full min-w-[860px]">
        <thead className="bg-slate-100 dark:bg-slate-800">
          <tr>
            <th className="p-4 text-left dark:text-white">Marca</th>
            <th className="p-4 text-left dark:text-white">Categoría</th>
            <th className="p-4 text-left dark:text-white">Normal</th>
            <th className="p-4 text-left dark:text-white">YIIFIX</th>
            <th className="p-4 text-left dark:text-white">Mecánico</th>
            <th className="p-4 text-left dark:text-white">Total</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((familia) => {
            const pantalla = esCategoriaPantalla(familia)
            const etiquetaTotal = familia.total === 0 ? "En 0" : familia.total < 3 ? "Menor que 3" : familia.total < 5 ? "Menor que 5" : "OK"
            if (!pantalla) {
              const p = familia.normal[0]
              return (
                <tr key={familia.clave} className="border-t dark:border-slate-800">
                  <td className="p-4 font-bold dark:text-white whitespace-nowrap">{familia.marca}</td>
                  <td className="p-4">
                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-3 py-1 rounded-full text-sm">{familia.categoria}</span>
                  </td>
                  <td className="p-4 dark:text-white" colSpan={3}>{p?.modelo}</td>
                  <td className="p-3 align-top">
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-3 min-w-[110px]">
                      <p className="text-3xl font-black dark:text-white tabular-nums leading-none">{familia.total}</p>
                      <p className="text-xs font-bold mt-2 text-amber-700 dark:text-amber-300">{etiquetaEstadoStock(familia.total)}</p>
                    </div>
                  </td>
                </tr>
              )
            }
            return (
              <tr key={familia.clave} className="border-t dark:border-slate-800">
                <td className="p-4 font-bold dark:text-white whitespace-nowrap">{familia.marca}</td>
                <td className="p-4">
                  <span className="bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full text-sm">{familia.categoria}</span>
                </td>
                <CeldaReporte lista={familia.normal} stock={familia.stockNormal} />
                <CeldaReporte lista={familia.yiifix} stock={familia.stockYiifix} />
                <CeldaReporte lista={familia.mecanico} stock={familia.stockMecanico} />
                <td className="p-3 align-top">
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 min-w-[110px]">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">Total</p>
                    <p className="text-3xl font-black dark:text-white tabular-nums leading-none mt-1">{familia.total}</p>
                    <p className={`text-xs font-bold mt-2 ${familia.total < 5 ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}`}>{etiquetaTotal}</p>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

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
  const [filtroStockReporte, setFiltroStockReporte] = useState("menor3")
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

  const categoriasStock = useMemo(() => {
    const fuente = alcanceStock === "todas" ? todosLosProductos : productos
    return [...new Set(fuente.map((p) => p.categoria).filter(Boolean))].sort((a, b) =>
      String(a).localeCompare(String(b), "es")
    )
  }, [alcanceStock, productos, todosLosProductos])
  const reporteTienda = useMemo(
    () => separarReporteStock(productos, filtroStockReporte),
    [productos, filtroStockReporte]
  )

  const listaStockReporte = useMemo(() => {
    let lista = reporteTienda.lista
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
  }, [reporteTienda, filtroCategoriaStock, busquedaStock])

  const reporteStockTodas = useMemo(() => {
    let lista = separarReporteStock(todosLosProductos, filtroStockReporte).lista
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
    return { lista }
  }, [todosLosProductos, filtroStockReporte, filtroCategoriaStock, busquedaStock])

  const listaAlertaStock =
    alcanceStock === "todas" ? reporteStockTodas.lista : listaStockReporte
  const nombreAlertaStock =
    alcanceStock === "todas" ? "Todas las tiendas" : tiendaActual?.nombre || ""
  const tituloCorte =
    filtroStockReporte === "no_hay"
      ? "En 0"
      : filtroStockReporte === "menor5"
      ? "Menor que 5"
      : "Menor que 3"
  const filasSalida = useMemo(() => {
    if (alcanceStock === "todas") {
      return tiendas.flatMap((tienda) => {
        const deTienda = reporteStockTodas.lista.filter((p) => p.tiendaId === tienda.id)
        return filasDelReporte(deTienda, tienda.nombre)
      })
    }
    return filasDelReporte(listaStockReporte, tiendaActual?.nombre || "Tienda")
  }, [alcanceStock, tiendas, reporteStockTodas.lista, listaStockReporte, tiendaActual?.nombre])
  const enCeroTienda = useMemo(
    () => filasDelReporte(separarReporteStock(productos, "no_hay").lista, "").length,
    [productos]
  )

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
          <p className="text-slate-500 dark:text-slate-400 mt-4">En 0 en esta tienda</p>
          <h2 className="text-4xl font-black dark:text-white">
            {enCeroTienda}
          </h2>
          <p className="text-sm text-slate-500 mt-3">
            Cuenta filas: una pantalla suma normal + YIIFIX + mecánico. El inventario completo está en{" "}
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
              WhatsApp y correo envían este corte ({filasSalida.length} filas), igual que la tabla.
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
                href={enlaceWhatsAppTexto(
                  textoDelReporte(filasSalida, tituloCorte, nombreAlertaStock),
                  telefonoWhatsApp
                )}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-green-600 text-white font-bold"
              >
                <MessageCircle size={18} />
                Enviar por WhatsApp
              </a>
              <a
                href={enlaceEmailTexto(
                  textoDelReporte(filasSalida, tituloCorte, nombreAlertaStock),
                  `${tituloCorte} - ${nombreAlertaStock}`
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
          {tituloCorte}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          {filasSalida.length} filas. En pantallas el corte usa el total. Excel, imprimir y WhatsApp sacan esta misma lista.
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
            <option value="no_hay">En 0</option>
            <option value="menor3">Menor que 3</option>
            <option value="menor5">Menor que 5</option>
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
                    ? "Excel de pantallas y modelos en 0"
                    : filtroStockReporte === "menor5"
                    ? "Excel de menor que 5"
                    : "Excel de menor que 3",
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
              const nombre =
                alcanceStock === "todas"
                  ? "Todas las tiendas"
                  : tiendaActual?.nombre || "Tienda"
              imprimirModelosStock({
                filasAgrupadas: filasSalida,
                nombreTienda: nombre,
                titulo: tituloCorte,
                nota: "Pantallas: una fila con normal, YIIFIX, mecánico y total.",
              })
            }}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-800 text-white font-bold"
          >
            <Printer size={18} />
            Imprimir este reporte
          </button>
        </div>

        {alcanceStock === "todas" ? (
          reporteStockTodas.lista.length === 0 ? (
            <p className="text-slate-500">Ninguna tienda tiene productos con este filtro.</p>
          ) : (
            <div className="space-y-10">
              {tiendas.map((tienda) => {
                const deTienda = reporteStockTodas.lista.filter((p) => p.tiendaId === tienda.id)
                if (deTienda.length === 0) return null
                return (
                  <div key={tienda.id}>
                    <h3 className="text-2xl font-black mb-4 text-slate-900 dark:text-white">{tienda.nombre}</h3>
                    <TablaReporteComoProductos productos={deTienda} />
                  </div>
                )
              })}
            </div>
          )
        ) : listaStockReporte.length === 0 ? (
          <p className="text-slate-500">
            {filtroStockReporte === "no_hay"
              ? "No hay productos agotados con este filtro. Todo está en stock."
              : "No hay productos con este corte en esta tienda."}
          </p>
        ) : (
          <TablaReporteComoProductos productos={listaStockReporte} />
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
