import { useEffect, useState } from "react"

import {
  collection,
  getDocs,
} from "firebase/firestore"

import { db } from "../firebase"

import jsPDF from "jspdf"

import { FileDown, Receipt } from "lucide-react"
import { formatearFecha } from "../utils/fechas"

function HistorialVentas() {

  const [ventas, setVentas] = useState([])

  useEffect(() => {
    cargarVentas()
  }, [])

  async function cargarVentas() {
    try {
      const querySnapshot = await getDocs(collection(db, "ventas"))

      const listaVentas = []

      querySnapshot.forEach((doc) => {
        listaVentas.push({
          id: doc.id,
          ...doc.data(),
        })
      })

      setVentas(listaVentas)

    } catch (error) {
      console.log(error)
    }
  }

  function descargarPDF(venta) {
    const doc = new jsPDF()

    let y = 20

    doc.setFontSize(20)
    doc.text("BOLETA DE VENTA", 20, y)

    y += 15

    doc.setFontSize(12)
    doc.text(`Cliente: ${venta.cliente}`, 20, y)
    y += 8

    doc.text(`Teléfono: ${venta.telefono}`, 20, y)
    y += 8

    doc.text(`Fecha: ${formatearFecha(venta.fecha || venta.fechaTexto)}`, 20, y)
    y += 12

    doc.setFontSize(14)
    doc.text("PRODUCTOS", 20, y)
    y += 10

    venta.productos.forEach((producto) => {

      const subtotal =
        Number(producto.precio) * producto.cantidad

      doc.setFontSize(11)

      doc.text(`${producto.marca || producto.nombre}`, 20, y)
      doc.text(`Cant: ${producto.cantidad}`, 100, y)
      doc.text(`S/ ${subtotal}`, 150, y)

      y += 8
    })

    y += 10

    doc.setFontSize(16)
    doc.text(`TOTAL: S/ ${venta.total}`, 20, y)

    doc.save(`venta-${venta.id}.pdf`)
  }

  return (
    <div className="space-y-8">

      {/* HEADER */}
      <div>
        <h1 className="text-5xl font-black text-slate-800 dark:text-white">
          Historial de Ventas
        </h1>

        <p className="text-slate-500 dark:text-slate-400 mt-3 text-lg">
          Registro completo de todas las ventas realizadas
        </p>
      </div>

      {/* EMPTY STATE */}
      {ventas.length === 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border dark:border-slate-800 p-10 text-center text-slate-500">
          No hay ventas registradas
        </div>
      )}

      {/* LISTA */}
      <div className="flex flex-col gap-6">

        {ventas.map((venta) => (

          <div
            key={venta.id}
            className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border dark:border-slate-800 p-6"
          >

            {/* HEADER VENTA */}
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-6 border-b border-slate-200 dark:border-slate-800 pb-6">

              <div className="space-y-1">

                <div className="flex items-center gap-2 text-slate-700 dark:text-white">
                  <Receipt size={20} />
                  <h2 className="text-2xl font-bold">
                    Venta #{venta.id.slice(0, 6)}
                  </h2>
                </div>

                <p className="text-slate-500 dark:text-slate-400">
                  {formatearFecha(venta.fecha || venta.fechaTexto)}
                </p>

                <p className="font-medium dark:text-white">
                  Cliente: {venta.cliente}
                </p>

                <p className="text-slate-500">
                  Tel: {venta.telefono}
                </p>

              </div>

              <div className="text-right">

                <h3 className="text-4xl font-black text-green-600">
                  S/ {venta.total}
                </h3>

                <button
                  onClick={() => descargarPDF(venta)}
                  className="mt-4 flex items-center gap-2 bg-blue-600 text-white px-5 py-3 rounded-2xl hover:bg-blue-700 transition hover:scale-105"
                >
                  <FileDown size={18} />
                  Descargar PDF
                </button>

              </div>

            </div>

            {/* PRODUCTOS */}
            <div className="mt-6 flex flex-col gap-4">

              {venta.productos?.map((producto, index) => (

                <div
                  key={index}
                  className="flex justify-between items-center border dark:border-slate-800 rounded-2xl p-4"
                >

                  <div>
                    <h4 className="font-semibold dark:text-white">
                      {producto.marca || producto.nombre}
                    </h4>

                    <p className="text-slate-500 text-sm">
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

      </div>

    </div>
  )
}

export default HistorialVentas
