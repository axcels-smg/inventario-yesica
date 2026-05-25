import { useEffect, useState } from "react"
import Swal from "sweetalert2"

import {
  collection,
  getDocs,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore"

import { db } from "../firebase"

function Ventas() {

  const [productos, setProductos] = useState([])
  const [clientes, setClientes] = useState([])

  const [clienteSeleccionado, setClienteSeleccionado] = useState("")
  const [carrito, setCarrito] = useState([])
  const [vendiendo, setVendiendo] = useState(false)

  useEffect(() => {
    cargarProductos()
    cargarClientes()
  }, [])

  // PRODUCTOS
  async function cargarProductos() {
    try {
      const querySnapshot = await getDocs(collection(db, "productos"))

      const lista = []

      querySnapshot.forEach((docu) => {
        lista.push({
          id: docu.id,
          ...docu.data(),
        })
      })

      setProductos(lista)

    } catch (error) {
      console.log(error)
      Swal.fire({
        icon: "error",
        title: "Error cargando productos",
      })
    }
  }

  // CLIENTES
  async function cargarClientes() {
    try {
      const querySnapshot = await getDocs(collection(db, "clientes"))

      const lista = []

      querySnapshot.forEach((docu) => {
        lista.push({
          id: docu.id,
          ...docu.data(),
        })
      })

      setClientes(lista)

    } catch (error) {
      console.log(error)
      Swal.fire({
        icon: "error",
        title: "Error cargando clientes",
      })
    }
  }

  // AGREGAR AL CARRITO
  function agregarAlCarrito(producto) {

    if (Number(producto.stock) <= 0) {
      Swal.fire({
        icon: "error",
        title: "Sin stock",
      })
      return
    }

    const existe = carrito.find((item) => item.id === producto.id)

    if (existe) {

      const nuevo = carrito.map((item) => {

        if (item.id === producto.id) {

          if (item.cantidad >= Number(producto.stock)) {
            Swal.fire({
              icon: "warning",
              title: "Stock máximo alcanzado",
            })
            return item
          }

          return {
            ...item,
            cantidad: item.cantidad + 1,
          }
        }

        return item
      })

      setCarrito(nuevo)

    } else {

      setCarrito([
        ...carrito,
        { ...producto, cantidad: 1 },
      ])
    }
  }

  // ELIMINAR
  function eliminarDelCarrito(id) {
    setCarrito(carrito.filter((i) => i.id !== id))
  }

  // TOTAL
  const total = carrito.reduce(
    (acc, item) => acc + Number(item.precio) * item.cantidad,
    0
  )

  // FINALIZAR VENTA
  async function finalizarVenta() {

    if (!clienteSeleccionado) {
      return Swal.fire({
        icon: "warning",
        title: "Selecciona cliente",
      })
    }

    if (carrito.length === 0) {
      return Swal.fire({
        icon: "warning",
        title: "Carrito vacío",
      })
    }

    try {
      setVendiendo(true)

      const clienteData = clientes.find(
        (c) => c.id === clienteSeleccionado
      )

      await runTransaction(db, async (transaction) => {
        const productosActuales = []

        for (const item of carrito) {
          const productoRef = doc(db, "productos", item.id)
          const productoSnap = await transaction.get(productoRef)

          if (!productoSnap.exists()) {
            throw new Error(`El producto ${item.marca} ya no existe`)
          }

          const productoActual = productoSnap.data()
          const stockActual = Number(productoActual.stock)

          if (!Number.isFinite(stockActual)) {
            throw new Error(`Stock inválido para ${item.marca}`)
          }

          if (stockActual < item.cantidad) {
            throw new Error(`Stock insuficiente para ${item.marca}`)
          }

          productosActuales.push({
            ref: productoRef,
            stock: stockActual,
            item,
          })
        }

        productosActuales.forEach(({ ref, stock, item }) => {
          transaction.update(ref, {
            stock: stock - item.cantidad,
          })
        })

        const ventaRef = doc(collection(db, "ventas"))

        transaction.set(ventaRef, {
          cliente: clienteData?.nombre || "",
          clienteId: clienteData?.id || "",
          telefono: clienteData?.telefono || "",
          productos: carrito,
          total,
          fecha: serverTimestamp(),
          fechaTexto: new Date().toLocaleString("es-PE"),
        })
      })

      // RESET
      setCarrito([])
      setClienteSeleccionado("")
      cargarProductos()

      Swal.fire({
        icon: "success",
        title: "Venta realizada",
        text: `Total S/ ${total}`,
      })

    } catch (error) {
      console.log(error)

      Swal.fire({
        icon: "error",
        title: "Error al vender",
        text: error.message,
      })
    } finally {
      setVendiendo(false)
    }
  }

  return (
    <div className="space-y-8">

      {/* HEADER */}
      <div>
        <h1 className="text-5xl font-black text-slate-800 dark:text-white">
          Ventas
        </h1>

        <p className="text-slate-500 dark:text-slate-400 mt-2">
          Sistema de ventas profesional
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* PRODUCTOS */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6">

          <h2 className="text-3xl font-bold mb-6 dark:text-white">
            Productos
          </h2>

          <div className="flex flex-col gap-4">

            {productos.map((p) => (
              <div
                key={p.id}
                className="border rounded-2xl p-5 flex justify-between"
              >

                <div>
                  <h3 className="font-bold dark:text-white">
                    {p.marca}
                  </h3>

                  <p className="text-sm text-slate-500">
                    {p.categoria}
                  </p>

                  <p className="text-sm">{p.modelo}</p>

                  <p className="font-bold mt-2">
                    S/ {p.precio}
                  </p>

                  <p className="text-sm text-slate-400">
                    Stock: {p.stock}
                  </p>
                </div>

                <button
                  onClick={() => agregarAlCarrito(p)}
                  disabled={Number(p.stock) <= 0}
                  className={`px-4 py-2 rounded-xl text-white ${
                    Number(p.stock) <= 0
                      ? "bg-slate-400"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {Number(p.stock) <= 0 ? "Sin stock" : "Agregar"}
                </button>

              </div>
            ))}

          </div>

        </div>

        {/* CARRITO */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6">

          <h2 className="text-3xl font-bold mb-6 dark:text-white">
            Carrito
          </h2>

          {/* CLIENTE */}
          <select
            value={clienteSeleccionado}
            onChange={(e) => setClienteSeleccionado(e.target.value)}
            className="w-full p-4 rounded-2xl mb-6"
          >
            <option value="">Selecciona cliente</option>

            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>

          {/* ITEMS */}
          <div className="flex flex-col gap-4">

            {carrito.map((item) => (
              <div key={item.id} className="border p-4 rounded-2xl flex justify-between">

                <div>
                  <p className="font-bold">{item.marca}</p>
                  <p>Cantidad: {item.cantidad}</p>
                  <p>
                    Subtotal: S/ {item.precio * item.cantidad}
                  </p>
                </div>

                <button
                  onClick={() => eliminarDelCarrito(item.id)}
                  className="bg-red-500 text-white px-4 py-2 rounded-xl"
                >
                  Eliminar
                </button>

              </div>
            ))}

          </div>

          {/* TOTAL */}
          <div className="mt-6 border-t pt-4">

            <h2 className="text-3xl font-black">
              Total: S/ {total}
            </h2>

            <button
              onClick={finalizarVenta}
              disabled={vendiendo}
              className={`w-full mt-4 text-white py-4 rounded-2xl ${
                vendiendo ? "bg-slate-400" : "bg-green-600"
              }`}
            >
              {vendiendo ? "Procesando..." : "Finalizar Venta"}
            </button>

          </div>

        </div>

      </div>

    </div>
  )
}

export default Ventas
