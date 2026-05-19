import { useEffect, useState } from "react"

import {
  collection,
  getDocs,
} from "firebase/firestore"

import { db } from "../firebase"

import jsPDF from "jspdf"

function HistorialVentas() {

  const [ventas, setVentas] =
    useState([])

  // CARGAR VENTAS
  useEffect(() => {

    cargarVentas()

  }, [])

  async function cargarVentas() {

    try {

      const querySnapshot =
        await getDocs(
          collection(db, "ventas")
        )

      const listaVentas = []

      querySnapshot.forEach((documento) => {

        listaVentas.push({
          id: documento.id,
          ...documento.data(),
        })

      })

      setVentas(listaVentas)

    } catch (error) {

      console.log(error)
    }
  }

  // GENERAR PDF
  function descargarPDF(venta) {

    const doc = new jsPDF()

    let y = 20

    // TITULO
    doc.setFontSize(22)

    doc.text(
      "BOLETA DE VENTA",
      20,
      y
    )

    y += 20

    // CLIENTE
    doc.setFontSize(14)

    doc.text(
      `Cliente: ${venta.cliente}`,
      20,
      y
    )

    y += 10

    doc.text(
      `Telefono: ${venta.telefono}`,
      20,
      y
    )

    y += 10

    doc.text(
      `Fecha: ${venta.fecha}`,
      20,
      y
    )

    y += 20

    // PRODUCTOS
    doc.setFontSize(16)

    doc.text(
      "Productos",
      20,
      y
    )

    y += 10

    venta.productos.forEach(
      (producto) => {

        const subtotal =
          Number(producto.precio) *
          producto.cantidad

        doc.setFontSize(12)

        doc.text(
          `${producto.nombre}`,
          20,
          y
        )

        doc.text(
          `Cant: ${producto.cantidad}`,
          100,
          y
        )

        doc.text(
          `S/ ${subtotal}`,
          150,
          y
        )

        y += 10
      }
    )

    y += 10

    // TOTAL
    doc.setFontSize(18)

    doc.text(
      `TOTAL: S/ ${venta.total}`,
      20,
      y
    )

    // DESCARGAR
    doc.save(
      `venta-${venta.id}.pdf`
    )
  }

  return (

    <div>

      {/* TITULO */}
      <div className="mb-8">

        <h1 className="text-4xl font-bold text-slate-800">
          Historial de Ventas
        </h1>

        <p className="text-slate-500 mt-2">
          Todas las ventas realizadas
        </p>

      </div>

      {/* LISTA */}
      <div className="flex flex-col gap-6">

        {ventas.length === 0 && (

          <div className="bg-white rounded-2xl shadow p-10 text-center text-slate-500">

            No hay ventas registradas

          </div>
        )}

        {ventas.map((venta) => (

          <div
            key={venta.id}
            className="bg-white rounded-2xl shadow p-6"
          >

            {/* HEADER */}
            <div className="flex justify-between items-center border-b pb-4 mb-4">

              <div>

                <h2 className="text-2xl font-bold">
                  Venta
                </h2>

                <p className="text-slate-500">
                  {venta.fecha}
                </p>

                <p className="mt-2 font-medium">
                  Cliente:
                  {" "}
                  {venta.cliente}
                </p>

                <p className="text-slate-500">
                  Tel:
                  {" "}
                  {venta.telefono}
                </p>

              </div>

              <div className="text-right">

                <h3 className="text-3xl font-bold text-green-600">
                  S/ {venta.total}
                </h3>

                <button
                  onClick={() =>
                    descargarPDF(venta)
                  }
                  className="mt-4 bg-blue-600 text-white px-5 py-2 rounded-xl hover:bg-blue-700 transition"
                >
                  Descargar PDF
                </button>

              </div>

            </div>

            {/* PRODUCTOS */}
            <div className="flex flex-col gap-3">

              {venta.productos?.map((producto) => (

                <div
                  key={producto.id}
                  className="border rounded-xl p-4 flex justify-between"
                >

                  <div>

                    <h4 className="font-semibold">
                      {producto.nombre}
                    </h4>

                    <p className="text-slate-500">
                      Cantidad:
                      {" "}
                      {producto.cantidad}
                    </p>

                  </div>

                  <p className="font-bold">

                    S/
                    {" "}
                    {Number(producto.precio) *
                      producto.cantidad}

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