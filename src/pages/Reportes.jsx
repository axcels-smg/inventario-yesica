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

function Reportes() {

  // STATES
  const [ventas, setVentas] =
    useState([])

  const [productos, setProductos] =
    useState([])

  // CARGAR DATA
  useEffect(() => {

    cargarVentas()
    cargarProductos()

  }, [])

  async function cargarVentas() {

    const querySnapshot =
      await getDocs(
        collection(db, "ventas")
      )

    const lista = []

    querySnapshot.forEach((doc) => {

      lista.push({
        id: doc.id,
        ...doc.data(),
      })
    })

    setVentas(lista)
  }

  async function cargarProductos() {

    const querySnapshot =
      await getDocs(
        collection(db, "productos")
      )

    const lista = []

    querySnapshot.forEach((doc) => {

      lista.push({
        id: doc.id,
        ...doc.data(),
      })
    })

    setProductos(lista)
  }

  // KPIs
  const ingresosTotales =
    ventas.reduce(
      (acc, venta) =>
        acc + Number(venta.total),
      0
    )

  const productosStockBajo =
    productos.filter(
      (producto) =>
        Number(producto.stock) <= 5
    )

  // CLIENTES FRECUENTES
  const clientesMap = {}

  ventas.forEach((venta) => {

    if (!clientesMap[venta.cliente]) {

      clientesMap[venta.cliente] = 0
    }

    clientesMap[venta.cliente]++
  })

  const clientesFrecuentes =
    Object.entries(clientesMap).map(
      ([cliente, cantidad]) => ({
        cliente,
        cantidad,
      })
    )

  // PRODUCTOS MÁS VENDIDOS
  const productosMap = {}

  ventas.forEach((venta) => {

    venta.productos?.forEach(
      (producto) => {

        if (!productosMap[producto.nombre]) {

          productosMap[producto.nombre] = 0
        }

        productosMap[producto.nombre] +=
          Number(producto.cantidad)
      }
    )
  })

  const productosVendidos =
    Object.entries(productosMap).map(
      ([nombre, cantidad]) => ({
        nombre,
        cantidad,
      })
    )

  // COLORES
  const colores = [
    "#2563eb",
    "#16a34a",
    "#dc2626",
    "#ca8a04",
    "#9333ea",
  ]

  return (

    <div>

      {/* TITULO */}
      <div className="mb-8">

        <h1 className="text-4xl font-bold text-slate-800">
          Reportes
        </h1>

        <p className="text-slate-500 mt-2">
          Estadísticas generales del sistema
        </p>

      </div>

      {/* CARDS */}
      <div className="grid grid-cols-4 gap-6 mb-10">

        <div className="bg-white rounded-2xl shadow p-6">

          <div className="flex justify-between items-center">

            <div>

              <p className="text-slate-500">
                Ventas
              </p>

              <h2 className="text-4xl font-bold mt-2">
                {ventas.length}
              </h2>

            </div>

            <FileText
              size={40}
              className="text-blue-600"
            />

          </div>

        </div>

        <div className="bg-white rounded-2xl shadow p-6">

          <div className="flex justify-between items-center">

            <div>

              <p className="text-slate-500">
                Ingresos
              </p>

              <h2 className="text-4xl font-bold mt-2">
                S/ {ingresosTotales}
              </h2>

            </div>

            <DollarSign
              size={40}
              className="text-green-600"
            />

          </div>

        </div>

        <div className="bg-white rounded-2xl shadow p-6">

          <div className="flex justify-between items-center">

            <div>

              <p className="text-slate-500">
                Stock Bajo
              </p>

              <h2 className="text-4xl font-bold mt-2">
                {productosStockBajo.length}
              </h2>

            </div>

            <AlertTriangle
              size={40}
              className="text-red-600"
            />

          </div>

        </div>

        <div className="bg-white rounded-2xl shadow p-6">

          <div className="flex justify-between items-center">

            <div>

              <p className="text-slate-500">
                Clientes
              </p>

              <h2 className="text-4xl font-bold mt-2">
                {clientesFrecuentes.length}
              </h2>

            </div>

            <Users
              size={40}
              className="text-purple-600"
            />

          </div>

        </div>

      </div>

      {/* GRAFICOS */}
      <div className="grid grid-cols-2 gap-8">

        {/* PRODUCTOS MÁS VENDIDOS */}
        <div className="bg-white rounded-2xl shadow p-6">

          <h2 className="text-2xl font-bold mb-6">
            Productos Más Vendidos
          </h2>

          <div className="h-[400px]">

            <ResponsiveContainer
              width="100%"
              height="100%"
            >

              <BarChart
                data={productosVendidos}
              >

                <XAxis dataKey="nombre" />

                <YAxis />

                <Tooltip />

                <Bar dataKey="cantidad" />

              </BarChart>

            </ResponsiveContainer>

          </div>

        </div>

        {/* CLIENTES */}
        <div className="bg-white rounded-2xl shadow p-6">

          <h2 className="text-2xl font-bold mb-6">
            Clientes Frecuentes
          </h2>

          <div className="h-[400px]">

            <ResponsiveContainer
              width="100%"
              height="100%"
            >

              <PieChart>

                <Pie
                  data={clientesFrecuentes}
                  dataKey="cantidad"
                  nameKey="cliente"
                  outerRadius={140}
                  label
                >

                  {clientesFrecuentes.map(
                    (entry, index) => (

                    <Cell
                      key={index}
                      fill={
                        colores[
                          index % colores.length
                        ]
                      }
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
      <div className="bg-white rounded-2xl shadow p-6 mt-10">

        <h2 className="text-2xl font-bold mb-6 text-red-600">
          Productos con Stock Bajo
        </h2>

        <div className="flex flex-col gap-4">

          {productosStockBajo.map(
            (producto) => (

            <div
              key={producto.id}
              className="border rounded-xl p-4 flex justify-between"
            >

              <h3 className="font-semibold">
                {producto.nombre}
              </h3>

              <p className="text-red-600 font-bold">
                Stock:
                {" "}
                {producto.stock}
              </p>

            </div>

          ))}

        </div>

      </div>

    </div>
  )
}

export default Reportes