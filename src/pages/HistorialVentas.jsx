import { useEffect, useState } from "react"

import {
  collection,
  doc,
  getDocs,
  deleteDoc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore"

import { db } from "../firebase"

import jsPDF from "jspdf"
import Swal from "sweetalert2"

import { FileDown, Receipt, Ban, Trash2, Printer } from "lucide-react"
import { formatearFecha, obtenerTiempoFecha } from "../utils/fechas"
import { formatearNumeroBoleta } from "../utils/boleta"
import { registrarMovimiento } from "../utils/movimientos"
import { TIPOS_MOVIMIENTO } from "../constants/inventario"
import { imprimirBoleta } from "../utils/impresion"

function HistorialVentas() {

  const [ventas, setVentas] = useState([])
  const [procesandoId, setProcesandoId] = useState(null)

  useEffect(() => {
    cargarVentas()
  }, [])

  async function cargarVentas() {
    try {
      const querySnapshot = await getDocs(collection(db, "ventas"))

      const listaVentas = []

      querySnapshot.forEach((docu) => {
        listaVentas.push({
          id: docu.id,
          ...docu.data(),
        })
      })

      listaVentas.sort((a, b) =>
        obtenerTiempoFecha(b.fecha || b.fechaTexto) -
        obtenerTiempoFecha(a.fecha || a.fechaTexto)
      )

      setVentas(listaVentas)

    } catch (error) {
      console.log(error)
      Swal.fire({
        icon: "error",
        title: "Error cargando ventas",
      })
    }
  }

  async function anularVenta(venta) {
    if (venta.anulada) {
      Swal.fire({
        icon: "info",
        title: "Venta ya anulada",
      })
      return
    }

    if (!venta.productos?.length) {
      Swal.fire({
        icon: "warning",
        title: "No se puede anular",
        text: "Esta venta no tiene productos registrados",
      })
      return
    }

    const confirmacion = await Swal.fire({
      title: "¿Anular esta venta?",
      html: `
        <p>Se devolverá el stock. La venta seguirá en el historial como anulada.</p>
        <p class="mt-2 font-bold">Total: S/ ${venta.total}</p>
      `,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Anular",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ea580c",
    })

    if (!confirmacion.isConfirmed) return

    try {
      setProcesandoId(venta.id)

      const registrosMovimiento = []
      let metaAnulacion = { cliente: "", numeroBoleta: "" }

      await runTransaction(db, async (transaction) => {
        const ventaRef = doc(db, "ventas", venta.id)
        const ventaSnap = await transaction.get(ventaRef)

        if (!ventaSnap.exists()) {
          throw new Error("La venta ya no existe")
        }

        const ventaActual = ventaSnap.data()

        if (ventaActual.anulada) {
          throw new Error("Esta venta ya fue anulada")
        }

        const productosVenta = ventaActual.productos || []

        if (productosVenta.length === 0) {
          throw new Error("La venta no tiene productos")
        }

        metaAnulacion = {
          cliente: ventaActual.cliente || "",
          numeroBoleta: ventaActual.numeroBoleta
            ? formatearNumeroBoleta(ventaActual.numeroBoleta)
            : "",
        }

        for (const item of productosVenta) {
          if (!item.id) {
            throw new Error("Un producto de la venta no tiene identificador")
          }

          const cantidad = Number(item.cantidad)
          const productoRef = doc(db, "productos", item.id)
          const productoSnap = await transaction.get(productoRef)

          if (!productoSnap.exists()) {
            throw new Error(`El producto ${item.marca || item.id} ya no existe`)
          }

          const stockActual = Number(productoSnap.data().stock)

          transaction.update(productoRef, {
            stock: stockActual + cantidad,
          })

          registrosMovimiento.push({
            productoId: item.id,
            productoNombre: `${item.marca || ""} ${item.modelo || ""}`.trim(),
            cantidad,
            stockAntes: stockActual,
            stockDespues: stockActual + cantidad,
          })
        }

        transaction.update(ventaRef, {
          anulada: true,
          fechaAnulacion: serverTimestamp(),
          fechaAnulacionTexto: new Date().toLocaleString("es-PE"),
        })
      })

      for (const mov of registrosMovimiento) {
        await registrarMovimiento({
          tipo: TIPOS_MOVIMIENTO.ANULACION,
          ...mov,
          ventaId: venta.id,
          numeroBoleta: metaAnulacion.numeroBoleta,
          cliente: metaAnulacion.cliente,
          detalle: `Anulación boleta #${metaAnulacion.numeroBoleta || venta.id.slice(0, 6)}`,
        })
      }

      await cargarVentas()

      Swal.fire({
        icon: "success",
        title: "Venta anulada",
        text: "El stock fue devuelto al inventario",
        timer: 2000,
        showConfirmButton: false,
      })

    } catch (error) {
      console.log(error)

      Swal.fire({
        icon: "error",
        title: "Error al anular",
        text: error.message,
      })
    } finally {
      setProcesandoId(null)
    }
  }

  async function eliminarVenta(venta) {
    const confirmacion = await Swal.fire({
      title: "¿Eliminar esta venta?",
      html: `
        <p>Se borrará de forma permanente y ya no se verá en el historial.</p>
        <p class="mt-2 text-red-600 font-bold">No devuelve stock. No se puede deshacer.</p>
        <p class="mt-2">Total: S/ ${venta.total}</p>
      `,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ef4444",
    })

    if (!confirmacion.isConfirmed) return

    try {
      setProcesandoId(venta.id)

      await deleteDoc(doc(db, "ventas", venta.id))

      setVentas((lista) => lista.filter((v) => v.id !== venta.id))

      Swal.fire({
        icon: "success",
        title: "Venta eliminada",
        timer: 1500,
        showConfirmButton: false,
      })

    } catch (error) {
      console.log(error)

      Swal.fire({
        icon: "error",
        title: "Error al eliminar",
        text: error.message,
      })
    } finally {
      setProcesandoId(null)
    }
  }

  function descargarPDF(venta) {
    if (!venta.productos?.length) {
      Swal.fire({
        icon: "warning",
        title: "Sin productos",
        text: "Esta venta no tiene productos para el PDF",
      })
      return
    }

    const pdf = new jsPDF()

    let y = 20

    const numeroBoleta =
      venta.numeroBoleta != null
        ? formatearNumeroBoleta(venta.numeroBoleta)
        : ""

    pdf.setFontSize(20)
    pdf.text(venta.anulada ? "BOLETA ANULADA" : "BOLETA DE VENTA", 20, y)

    y += 12

    if (numeroBoleta) {
      pdf.setFontSize(14)
      pdf.text(`N° ${numeroBoleta}`, 20, y)
      y += 10
    }

    pdf.setFontSize(12)
    pdf.text(`Cliente: ${venta.cliente}`, 20, y)
    y += 8

    pdf.text(`Teléfono: ${venta.telefono}`, 20, y)
    y += 8

    pdf.text(`Fecha: ${formatearFecha(venta.fecha || venta.fechaTexto)}`, 20, y)
    y += 8

    if (venta.anulada) {
      pdf.text(
        `Anulada: ${formatearFecha(venta.fechaAnulacion || venta.fechaAnulacionTexto)}`,
        20,
        y
      )
      y += 8
    }

    y += 4

    pdf.setFontSize(14)
    pdf.text("PRODUCTOS", 20, y)
    y += 10

    venta.productos.forEach((producto) => {
      const subtotal = Number(producto.precio) * producto.cantidad

      pdf.setFontSize(11)

      pdf.text(`${producto.marca || producto.nombre}`, 20, y)
      pdf.text(`Cant: ${producto.cantidad}`, 100, y)
      pdf.text(`S/ ${subtotal}`, 150, y)

      y += 8
    })

    y += 10

    pdf.setFontSize(16)
    pdf.text(`TOTAL: S/ ${venta.total}`, 20, y)

    pdf.save(`venta-${venta.id}.pdf`)
  }

  return (
    <div className="space-y-8">

      <div>
        <h1 className="text-5xl font-black text-slate-800 dark:text-white">
          Historial de Ventas
        </h1>

        <p className="text-slate-500 dark:text-slate-400 mt-3 text-lg">
          <strong>Anular</strong> devuelve el stock y deja la venta marcada.
          <strong> Eliminar</strong> la borra para siempre.
        </p>
      </div>

      {ventas.length === 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border dark:border-slate-800 p-10 text-center text-slate-500">
          No hay ventas registradas
        </div>
      )}

      <div className="flex flex-col gap-6">

        {ventas.map((venta) => (
          <div
            key={venta.id}
            className={`bg-white dark:bg-slate-900 rounded-3xl shadow-sm border p-6 ${
              venta.anulada
                ? "border-red-300 dark:border-red-900/50 opacity-80"
                : "dark:border-slate-800"
            }`}
          >

            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-6 border-b border-slate-200 dark:border-slate-800 pb-6">

              <div className="space-y-1">

                <div className="flex flex-wrap items-center gap-2 text-slate-700 dark:text-white">
                  <Receipt size={20} />
                  <h2 className="text-2xl font-bold">
                    {venta.numeroBoleta != null
                      ? `Boleta #${formatearNumeroBoleta(venta.numeroBoleta)}`
                      : `Venta #${venta.id.slice(0, 6)}`}
                  </h2>
                  {venta.anulada && (
                    <span className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 px-3 py-1 rounded-full text-sm font-bold">
                      ANULADA
                    </span>
                  )}
                </div>

                <p className="text-slate-500 dark:text-slate-400">
                  {formatearFecha(venta.fecha || venta.fechaTexto)}
                </p>

                {venta.anulada && (
                  <p className="text-red-500 text-sm">
                    Anulada: {formatearFecha(venta.fechaAnulacion || venta.fechaAnulacionTexto)}
                  </p>
                )}

                <p className="font-medium dark:text-white">
                  Cliente: {venta.cliente}
                </p>

                <p className="text-slate-500">
                  Tel: {venta.telefono}
                </p>

              </div>

              <div className="text-right flex flex-col items-end gap-3">

                <h3
                  className={`text-4xl font-black ${
                    venta.anulada ? "text-slate-400 line-through" : "text-green-600"
                  }`}
                >
                  S/ {venta.total}
                </h3>

                <div className="flex flex-wrap gap-2 justify-end">
                  <button
                    onClick={() => imprimirBoleta(venta)}
                    className="flex items-center gap-2 bg-slate-700 text-white px-5 py-3 rounded-2xl hover:bg-slate-800 transition"
                  >
                    <Printer size={18} />
                    Ticket
                  </button>

                  <button
                    onClick={() => descargarPDF(venta)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-5 py-3 rounded-2xl hover:bg-blue-700 transition"
                  >
                    <FileDown size={18} />
                    PDF
                  </button>

                  {!venta.anulada && (
                    <button
                      onClick={() => anularVenta(venta)}
                      disabled={procesandoId === venta.id}
                      className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-white transition ${
                        procesandoId === venta.id
                          ? "bg-slate-400"
                          : "bg-orange-600 hover:bg-orange-700"
                      }`}
                    >
                      <Ban size={18} />
                      Anular
                    </button>
                  )}

                  <button
                    onClick={() => eliminarVenta(venta)}
                    disabled={procesandoId === venta.id}
                    className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-white transition ${
                      procesandoId === venta.id
                        ? "bg-slate-400"
                        : "bg-red-600 hover:bg-red-700"
                    }`}
                  >
                    <Trash2 size={18} />
                    Eliminar
                  </button>
                </div>

              </div>

            </div>

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
