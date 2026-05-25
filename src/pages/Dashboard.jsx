import { useEffect, useState } from "react"

import {
  Package,
  ShoppingCart,
  DollarSign,
  TrendingUp,
} from "lucide-react"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

import {
  collection,
  getDocs,
} from "firebase/firestore"

import { db } from "../firebase"
import { esFechaDeHoy } from "../utils/fechas"
import { filtrarVentasActivas } from "../utils/ventas"

function Dashboard() {

  const [productos, setProductos] = useState([])
  const [ventas, setVentas] = useState([])

  useEffect(() => {
    cargarProductos()
    cargarVentas()
  }, [])

  async function cargarProductos() {
    const querySnapshot = await getDocs(collection(db, "productos"))

    const lista = []
    querySnapshot.forEach((doc) => {
      lista.push({
        id: doc.id,
        ...doc.data(),
      })
    })

    setProductos(lista)
  }

  async function cargarVentas() {
    const querySnapshot = await getDocs(collection(db, "ventas"))

    const lista = []
    querySnapshot.forEach((doc) => {
      lista.push({
        id: doc.id,
        ...doc.data(),
      })
    })

    setVentas(lista)
  }

  const ventasActivas = filtrarVentasActivas(ventas)

  // KPIs (solo ventas no anuladas)
  const totalProductos = productos.length
  const totalVentas = ventasActivas.length

  const ingresosTotales = ventasActivas.reduce(
    (acc, venta) => acc + Number(venta.total),
    0
  )

  const ventasHoy = ventasActivas.filter((venta) => {
    return esFechaDeHoy(venta.fecha || venta.fechaTexto)
  }).length

  const dataGrafico = ventasActivas.map((venta, index) => ({
    nombre: `Venta ${index + 1}`,
    total: Number(venta.total),
  }))

  return (
    <div className="text-slate-900 dark:text-white transition-all duration-300">

      {/* HEADER */}
      <div className="mb-10">
        <h1 className="text-5xl font-black">
          Dashboard
        </h1>

        <p className="text-slate-500 dark:text-slate-400 mt-3 text-lg">
          Resumen general del sistema
        </p>
      </div>

      {/* CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-10">

        {/* PRODUCTOS */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-slate-500 dark:text-slate-400">
                Productos
              </p>

              <h2 className="text-4xl font-black mt-2">
                {totalProductos}
              </h2>
            </div>

            <Package size={40} className="text-blue-500" />
          </div>
        </div>

        {/* VENTAS */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-slate-500 dark:text-slate-400">
                Ventas
              </p>

              <h2 className="text-4xl font-black mt-2">
                {totalVentas}
              </h2>
            </div>

            <ShoppingCart size={40} className="text-green-500" />
          </div>
        </div>

        {/* INGRESOS */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-slate-500 dark:text-slate-400">
                Ingresos
              </p>

              <h2 className="text-4xl font-black mt-2">
                S/ {ingresosTotales}
              </h2>
            </div>

            <DollarSign size={40} className="text-yellow-500" />
          </div>
        </div>

        {/* VENTAS HOY */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-slate-500 dark:text-slate-400">
                Ventas Hoy
              </p>

              <h2 className="text-4xl font-black mt-2">
                {ventasHoy}
              </h2>
            </div>

            <TrendingUp size={40} className="text-purple-500" />
          </div>
        </div>

      </div>

      {/* GRAFICO */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">

        <h2 className="text-2xl font-bold mb-6">
          Ventas
        </h2>

        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">

            <BarChart data={dataGrafico}>
              <XAxis dataKey="nombre" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="total" />
            </BarChart>

          </ResponsiveContainer>
        </div>

      </div>

    </div>
  )
}

export default Dashboard
