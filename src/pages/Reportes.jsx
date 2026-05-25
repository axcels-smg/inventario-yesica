import { useEffect, useState } from "react"

import {
  collection,
  getDocs,
} from "firebase/firestore"

import { db } from "../firebase"

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
  Users,
} from "lucide-react"
import { obtenerTiempoFecha } from "../utils/fechas"

function Reportes() {

  const [ventas, setVentas] = useState([])
  const [productos, setProductos] = useState([])

  useEffect(() => {
    cargarVentas()
    cargarProductos()
  }, [])

  async function cargarVentas() {
    const querySnapshot = await getDocs(collection(db, "ventas"))

    const lista = []
    querySnapshot.forEach((doc) => {
      lista.push({ id: doc.id, ...doc.data() })
    })

    lista.sort((a, b) =>
      obtenerTiempoFecha(b.fecha || b.fechaTexto) -
      obtenerTiempoFecha(a.fecha || a.fechaTexto)
    )

    setVentas(lista)
  }

  async function cargarProductos() {
    const querySnapshot = await getDocs(collection(db, "productos"))

    const lista = []
    querySnapshot.forEach((doc) => {
      lista.push({ id: doc.id, ...doc.data() })
    })

    setProductos(lista)
  }

  // KPIs
  const ingresosTotales = ventas.reduce(
    (acc, venta) => acc + Number(venta.total),
    0
  )

  const productosStockBajo = productos
    .filter((p) => Number(p.stock) <= 5)
    .sort((a, b) => Number(a.stock) - Number(b.stock))

  // CLIENTES FRECUENTES
  const clientesMap = {}

  ventas.forEach((venta) => {
    const cliente = venta.cliente || "Sin nombre"

    if (!clientesMap[cliente]) {
      clientesMap[cliente] = 0
    }

    clientesMap[cliente]++
  })

  const clientesFrecuentes = Object.entries(clientesMap)
    .map(([cliente, cantidad]) => ({
      cliente,
      cantidad,
    }))
    .sort((a, b) => b.cantidad - a.cantidad)

  // PRODUCTOS VENDIDOS
  const productosMap = {}

  ventas.forEach((venta) => {
    venta.productos?.forEach((producto) => {
      const nombre = producto.marca || producto.nombre || "Producto"

      if (!productosMap[nombre]) {
        productosMap[nombre] = 0
      }

      productosMap[nombre] += Number(producto.cantidad)
    })
  })

  const productosVendidos = Object.entries(productosMap)
    .map(([nombre, cantidad]) => ({
      nombre,
      cantidad,
    }))
    .sort((a, b) => b.cantidad - a.cantidad)

  const colores = ["#2563eb", "#16a34a", "#dc2626", "#ca8a04", "#9333ea"]

  return (
    <div className="space-y-10">

      {/* HEADER */}
      <div>
        <h1 className="text-5xl font-black text-slate-800 dark:text-white">
          Reportes
        </h1>

        <p className="text-slate-500 dark:text-slate-400 mt-3 text-lg">
          Análisis completo del sistema de inventario
        </p>
      </div>

      {/* CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border dark:border-slate-800">
          <FileText className="text-blue-500" size={38} />
          <p className="text-slate-500 mt-4">Ventas</p>
          <h2 className="text-4xl font-black dark:text-white">{ventas.length}</h2>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border dark:border-slate-800">
          <DollarSign className="text-green-500" size={38} />
          <p className="text-slate-500 mt-4">Ingresos</p>
          <h2 className="text-4xl font-black dark:text-white">
            S/ {ingresosTotales}
          </h2>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border dark:border-slate-800">
          <AlertTriangle className="text-red-500" size={38} />
          <p className="text-slate-500 mt-4">Stock Bajo</p>
          <h2 className="text-4xl font-black dark:text-white">
            {productosStockBajo.length}
          </h2>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border dark:border-slate-800">
          <Users className="text-purple-500" size={38} />
          <p className="text-slate-500 mt-4">Clientes</p>
          <h2 className="text-4xl font-black dark:text-white">
            {clientesFrecuentes.length}
          </h2>
        </div>

      </div>

      {/* GRAFICOS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* PRODUCTOS MÁS VENDIDOS */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border dark:border-slate-800">

          <h2 className="text-2xl font-bold mb-6 dark:text-white">
            Productos más vendidos
          </h2>

          <div className="h-[380px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productosVendidos}>
                <XAxis dataKey="nombre" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="cantidad" fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </div>

        </div>

        {/* CLIENTES FRECUENTES */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border dark:border-slate-800">

          <h2 className="text-2xl font-bold mb-6 dark:text-white">
            Clientes frecuentes
          </h2>

          <div className="h-[380px]">

            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={clientesFrecuentes}
                  dataKey="cantidad"
                  nameKey="cliente"
                  outerRadius={130}
                  label
                >
                  {clientesFrecuentes.map((_, index) => (
                    <Cell
                      key={index}
                      fill={colores[index % colores.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>

          </div>

        </div>

      </div>

      {/* STOCK BAJO */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border dark:border-slate-800">

        <h2 className="text-2xl font-bold mb-6 text-red-500">
          Productos con stock bajo
        </h2>

        <div className="flex flex-col gap-4">

          {productosStockBajo.map((producto) => (
            <div
              key={producto.id}
              className="flex justify-between p-4 border dark:border-slate-700 rounded-2xl"
            >
              <p className="font-semibold dark:text-white">
                {producto.marca || producto.nombre}
              </p>

              <p className="text-red-500 font-bold">
                Stock: {producto.stock}
              </p>
            </div>
          ))}

        </div>

      </div>

    </div>
  )
}

export default Reportes
