import { useCallback, useEffect, useState } from "react"
import { collection, getDocs } from "firebase/firestore"
import {
  Package,
  ShoppingCart,
  DollarSign,
  Store,
  BarChart3,
  PieChart as PieChartIcon,
} from "lucide-react"
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
import { db } from "../firebase"
import { useTienda } from "../context/TiendaContext"

function DashboardGlobal() {
  const { tiendas } = useTienda()
  const [datosConsolidados, setDatosConsolidados] = useState({
    totalProductos: 0,
    totalVentas: 0,
    totalIngresos: 0,
    ventasPorTienda: [],
    productosPorTienda: [],
    ingresosPorTienda: [],
    categoriasPorTienda: [],
  })
  const [cargando, setCargando] = useState(true)

  const cargarDatosConsolidados = useCallback(async () => {
    try {
      setCargando(true)

      const [snapVentas, snapProductos] = await Promise.all([
        getDocs(collection(db, "ventas")),
        getDocs(collection(db, "productos")),
      ])

      const ventas = []
      snapVentas.forEach((d) => ventas.push({ id: d.id, ...d.data() }))

      const productos = []
      snapProductos.forEach((d) => productos.push({ id: d.id, ...d.data() }))

      const ventasPorTienda = tiendas.map((tienda) => {
        const ventasTienda = ventas.filter((v) => v.tiendaId === tienda.id && !v.anulada)
        return {
          nombre: tienda.nombre,
          ventas: ventasTienda.length,
          ingresos: ventasTienda.reduce((sum, v) => sum + Number(v.total || 0), 0),
        }
      })

      const productosPorTienda = tiendas.map((tienda) => {
        const productosTienda = productos.filter((p) => p.tiendaId === tienda.id)
        return {
          nombre: tienda.nombre,
          productos: productosTienda.length,
          stockTotal: productosTienda.reduce((sum, p) => sum + Number(p.stock || 0), 0),
        }
      })

      const ingresosPorTienda = tiendas.map((tienda) => {
        const ventasTienda = ventas.filter((v) => v.tiendaId === tienda.id && !v.anulada)
        return {
          nombre: tienda.nombre,
          ingresos: ventasTienda.reduce((sum, v) => sum + Number(v.total || 0), 0),
        }
      })

      const categoriasPorTienda = tiendas.map((tienda) => {
        const productosTienda = productos.filter((p) => p.tiendaId === tienda.id)
        const mapaCategorias = new Map()
        let totalTienda = 0
        let stockTienda = 0

        productosTienda.forEach((p) => {
          const cat = p.categoria || "Sin categoría"
          const actual = mapaCategorias.get(cat) || { cantidad: 0, stock: 0 }
          actual.cantidad += 1
          actual.stock += Number(p.stock || 0)
          mapaCategorias.set(cat, actual)
          totalTienda += 1
          stockTienda += Number(p.stock || 0)
        })

        const categorias = [...mapaCategorias.entries()]
          .map(([nombre, datos]) => ({
            nombre,
            cantidad: datos.cantidad,
            stock: datos.stock,
          }))
          .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), "es"))

        return {
          tiendaId: tienda.id,
          tiendaNombre: tienda.nombre,
          totalProductos: totalTienda,
          totalStock: stockTienda,
          categorias,
        }
      })

      setDatosConsolidados({
        totalProductos: productos.length,
        totalVentas: ventas.filter((v) => !v.anulada).length,
        totalIngresos: ventas
          .filter((v) => !v.anulada)
          .reduce((sum, v) => sum + Number(v.total || 0), 0),
        ventasPorTienda,
        productosPorTienda,
        ingresosPorTienda,
        categoriasPorTienda,
      })
    } catch (error) {
      console.error("Error cargando datos consolidados:", error)
    } finally {
      setCargando(false)
    }
  }, [tiendas])

  useEffect(() => {
    cargarDatosConsolidados()
  }, [cargarDatosConsolidados])

  const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-5xl font-black text-slate-800 dark:text-white">
          Dashboard Global
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-3 text-lg">
          Vista consolidada de todas las tiendas
        </p>
      </div>

      {cargando ? (
        <div className="text-center py-12 text-slate-500">Cargando datos...</div>
      ) : (
        <>
          {/* KPIs Globales */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border dark:border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-950 rounded-2xl">
                  <Package size={24} className="text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-sm text-slate-500">Total</span>
              </div>
              <p className="text-3xl font-bold dark:text-white">
                {datosConsolidados.totalProductos}
              </p>
              <p className="text-slate-500 text-sm mt-1">Productos</p>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border dark:border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-green-100 dark:bg-green-950 rounded-2xl">
                  <ShoppingCart size={24} className="text-green-600 dark:text-green-400" />
                </div>
                <span className="text-sm text-slate-500">Total</span>
              </div>
              <p className="text-3xl font-bold dark:text-white">
                {datosConsolidados.totalVentas}
              </p>
              <p className="text-slate-500 text-sm mt-1">Ventas</p>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border dark:border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-purple-100 dark:bg-purple-950 rounded-2xl">
                  <DollarSign size={24} className="text-purple-600 dark:text-purple-400" />
                </div>
                <span className="text-sm text-slate-500">Total</span>
              </div>
              <p className="text-3xl font-bold dark:text-white">
                S/ {datosConsolidados.totalIngresos.toLocaleString()}
              </p>
              <p className="text-slate-500 text-sm mt-1">Ingresos</p>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border dark:border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-orange-100 dark:bg-orange-950 rounded-2xl">
                  <Store size={24} className="text-orange-600 dark:text-orange-400" />
                </div>
                <span className="text-sm text-slate-500">Total</span>
              </div>
              <p className="text-3xl font-bold dark:text-white">{tiendas.length}</p>
              <p className="text-slate-500 text-sm mt-1">Tiendas</p>
            </div>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Ventas por Tienda */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border dark:border-slate-800">
              <h3 className="text-xl font-bold mb-6 dark:text-white flex items-center gap-2">
                <ShoppingCart size={20} />
                Ventas por Tienda
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={datosConsolidados.ventasPorTienda}>
                  <XAxis dataKey="nombre" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="ventas" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Ingresos por Tienda */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border dark:border-slate-800">
              <h3 className="text-xl font-bold mb-6 dark:text-white flex items-center gap-2">
                <DollarSign size={20} />
                Ingresos por Tienda
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={datosConsolidados.ingresosPorTienda}>
                  <XAxis dataKey="nombre" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="ingresos" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Productos por Tienda */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border dark:border-slate-800">
              <h3 className="text-xl font-bold mb-6 dark:text-white flex items-center gap-2">
                <Package size={20} />
                Productos por Tienda
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={datosConsolidados.productosPorTienda}>
                  <XAxis dataKey="nombre" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="productos" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Distribución de Ingresos */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border dark:border-slate-800">
              <h3 className="text-xl font-bold mb-6 dark:text-white flex items-center gap-2">
                <PieChartIcon size={20} />
                Distribución de Ingresos
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={datosConsolidados.ingresosPorTienda}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ nombre, ingresos }) => `${nombre}: S/ ${ingresos.toLocaleString()}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="ingresos"
                  >
                    {datosConsolidados.ingresosPorTienda.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tabla Resumen por Tienda */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border dark:border-slate-800">
            <h3 className="text-xl font-bold mb-6 dark:text-white flex items-center gap-2">
              <BarChart3 size={20} />
              Resumen por Tienda
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b dark:border-slate-700">
                    <th className="text-left p-4 dark:text-white">Tienda</th>
                    <th className="text-right p-4 dark:text-white">Productos</th>
                    <th className="text-right p-4 dark:text-white">Stock Total</th>
                    <th className="text-right p-4 dark:text-white">Ventas</th>
                    <th className="text-right p-4 dark:text-white">Ingresos</th>
                  </tr>
                </thead>
                <tbody>
                  {tiendas.map((tienda) => {
                    const ventasTienda = datosConsolidados.ventasPorTienda.find(
                      (v) => v.nombre === tienda.nombre
                    )
                    const productosTienda = datosConsolidados.productosPorTienda.find(
                      (p) => p.nombre === tienda.nombre
                    )
                    const ingresosTienda = datosConsolidados.ingresosPorTienda.find(
                      (i) => i.nombre === tienda.nombre
                    )

                    return (
                      <tr key={tienda.id} className="border-b dark:border-slate-800">
                        <td className="p-4 dark:text-white font-medium">{tienda.nombre}</td>
                        <td className="p-4 text-right dark:text-slate-300">
                          {productosTienda?.productos || 0}
                        </td>
                        <td className="p-4 text-right dark:text-slate-300">
                          {productosTienda?.stockTotal || 0}
                        </td>
                        <td className="p-4 text-right dark:text-slate-300">
                          {ventasTienda?.ventas || 0}
                        </td>
                        <td className="p-4 text-right dark:text-slate-300 font-semibold">
                          S/ {(ingresosTienda?.ingresos || 0).toLocaleString()}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Desglose por categoría y tienda */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border dark:border-slate-800">
            <h3 className="text-xl font-bold mb-6 dark:text-white flex items-center gap-2">
              <Package size={20} />
              Inventario por Categoría y Tienda
            </h3>
            <div className="space-y-8">
              {datosConsolidados.categoriasPorTienda.map((t) => (
                <div
                  key={t.tiendaId}
                  className="border-b dark:border-slate-800 pb-6 last:border-b-0 last:pb-0"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <h4 className="text-lg font-bold dark:text-white flex items-center gap-2">
                      <Store size={18} className="text-orange-500" />
                      {t.tiendaNombre}
                    </h4>
                    <div className="flex gap-4 text-sm">
                      <span className="bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full">
                        {t.totalProductos} productos
                      </span>
                      <span className="bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 px-3 py-1 rounded-full">
                        {t.totalStock} stock total
                      </span>
                    </div>
                  </div>

                  {t.categorias.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400 italic px-2">
                      Sin productos registrados
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                            <th className="p-3 text-left dark:text-white">Categoría</th>
                            <th className="p-3 text-right dark:text-white">Productos</th>
                            <th className="p-3 text-right dark:text-white">Stock</th>
                            <th className="p-3 text-left dark:text-white w-56">Distribución</th>
                          </tr>
                        </thead>
                        <tbody>
                          {t.categorias.map((c) => {
                            const porcentaje =
                              t.totalProductos > 0
                                ? Math.round((c.cantidad / t.totalProductos) * 100)
                                : 0
                            return (
                              <tr
                                key={c.nombre}
                                className="border-b dark:border-slate-800 last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-800/30"
                              >
                                <td className="p-3 font-medium dark:text-white">
                                  <span className="bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full text-xs">
                                    {c.nombre}
                                  </span>
                                </td>
                                <td className="p-3 text-right font-bold dark:text-slate-300">
                                  {c.cantidad}
                                </td>
                                <td className="p-3 text-right font-bold dark:text-slate-300">
                                  {c.stock}
                                </td>
                                <td className="p-3">
                                  <div className="flex items-center gap-3">
                                    <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                                        style={{ width: `${porcentaje}%` }}
                                      />
                                    </div>
                                    <span className="text-xs text-slate-500 dark:text-slate-400 w-10 text-right">
                                      {porcentaje}%
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default DashboardGlobal
