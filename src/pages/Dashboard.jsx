import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
  Package,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  AlertTriangle,
} from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { collection, getDocs } from "firebase/firestore"

import { db } from "../firebase"
import { esFechaDeHoy } from "../utils/fechas"
import { filtrarVentasActivas } from "../utils/ventas"
import { agruparVentasPorDia, obtenerRangoPreset } from "../utils/reportesFiltros"
import { filtrarProductosStockBajo } from "../utils/stock"
import StockAlertBanner from "../components/StockAlertBanner"
import { STOCK_BAJO_UMBRAL } from "../constants/inventario"
import { registrarAlertaDiaria, existeAlertaHoy } from "../utils/alertasStock"
import { useTienda } from "../context/TiendaContext"

function Dashboard() {
  const [productos, setProductos] = useState([])
  const [ventas, setVentas] = useState([])
  const { tiendaActual } = useTienda()

  useEffect(() => {
    if (tiendaActual) {
      cargarProductos()
      cargarVentas()
    }
  }, [tiendaActual, cargarProductos, cargarVentas])

  useEffect(() => {
    async function registrarAlertaSiNecesario() {
      if (productos.length === 0 || !tiendaActual) return

      const yaExiste = await existeAlertaHoy(tiendaActual.id)
      if (!yaExiste) {
        await registrarAlertaDiaria(productos, tiendaActual.id)
      }
    }

    registrarAlertaSiNecesario()
  }, [productos, tiendaActual])

  async function cargarProductos() {
    if (!tiendaActual) return

    const querySnapshot = await getDocs(collection(db, "productos"))
    const lista = []
    querySnapshot.forEach((docu) => {
      const data = docu.data()
      if (data.tiendaId === tiendaActual.id) {
        lista.push({ id: docu.id, ...data })
      }
    })
    setProductos(lista)
  }

  async function cargarVentas() {
    if (!tiendaActual) return

    const querySnapshot = await getDocs(collection(db, "ventas"))
    const lista = []
    querySnapshot.forEach((docu) => {
      const data = docu.data()
      if (data.tiendaId === tiendaActual.id) {
        lista.push({ id: docu.id, ...data })
      }
    })
    setVentas(lista)
  }

  const ventasActivas = filtrarVentasActivas(ventas)
  const stockBajo = filtrarProductosStockBajo(productos)

  const { fechaDesde, fechaHasta } = obtenerRangoPreset("semana")
  const ventasSemana = ventasActivas.filter((v) => {
    const t = new Date(`${fechaDesde}T00:00:00`).getTime()
    const h = new Date(`${fechaHasta}T23:59:59`).getTime()
    const vt = v.fecha?.toDate?.()
      ? v.fecha.toDate().getTime()
      : Date.parse(String(v.fechaTexto)) || 0
    return vt >= t && vt <= h
  })

  const dataGrafico = agruparVentasPorDia(ventasSemana).slice(0, 7).reverse()

  const totalProductos = productos.length
  const totalVentas = ventasActivas.length
  const ingresosTotales = ventasActivas.reduce(
    (acc, venta) => acc + Number(venta.total),
    0
  )
  const ventasHoy = ventasActivas.filter((venta) =>
    esFechaDeHoy(venta.fecha || venta.fechaTexto)
  ).length

  return (
    <div className="text-slate-900 dark:text-white transition-all duration-300">
      <div className="mb-6">
        <h1 className="text-5xl font-black dark:text-white">Dashboard</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-3 text-lg">
          Resumen general del inventario
        </p>
      </div>

      <StockAlertBanner cantidad={stockBajo.length} />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6 mb-10">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-slate-500 dark:text-slate-400">Productos</p>
              <h2 className="text-4xl font-black mt-2">{totalProductos}</h2>
            </div>
            <Package size={40} className="text-blue-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-slate-500 dark:text-slate-400">Ventas</p>
              <h2 className="text-4xl font-black mt-2">{totalVentas}</h2>
            </div>
            <ShoppingCart size={40} className="text-green-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-slate-500 dark:text-slate-400">Ingresos</p>
              <h2 className="text-4xl font-black mt-2">S/ {ingresosTotales}</h2>
            </div>
            <DollarSign size={40} className="text-yellow-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-slate-500 dark:text-slate-400">Ventas hoy</p>
              <h2 className="text-4xl font-black mt-2">{ventasHoy}</h2>
            </div>
            <TrendingUp size={40} className="text-purple-500" />
          </div>
        </div>

        <Link
          to="/reportes"
          className="bg-red-50 dark:bg-red-950/40 rounded-2xl p-6 border border-red-200 dark:border-red-900 hover:bg-red-100 transition"
        >
          <div className="flex justify-between items-center">
            <div>
              <p className="text-red-600 dark:text-red-300">Stock bajo</p>
              <h2 className="text-4xl font-black mt-2 text-red-700 dark:text-red-200">
                {stockBajo.length}
              </h2>
              <p className="text-xs text-red-500 mt-1">≤ {STOCK_BAJO_UMBRAL} u.</p>
            </div>
            <AlertTriangle size={40} className="text-red-500" />
          </div>
        </Link>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
        <h2 className="text-2xl font-bold mb-2 dark:text-white">Ingresos últimos 7 días</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Ventas activas por día</p>

        <div className="h-[400px]">
          {dataGrafico.length === 0 ? (
            <p className="text-center text-slate-500 dark:text-slate-400 py-20">
              Sin ventas esta semana
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataGrafico}>
                <XAxis dataKey="fecha" stroke="#94a3b8" tick={{ fill: "#94a3b8" }} />
                <YAxis stroke="#94a3b8" tick={{ fill: "#94a3b8" }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "#1e293b", 
                    border: "1px solid #334155",
                    color: "#fff"
                  }}
                  itemStyle={{ color: "#fff" }}
                />
                <Bar dataKey="total" fill="#2563eb" name="Ingresos S/" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
