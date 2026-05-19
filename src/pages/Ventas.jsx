import { useEffect, useState } from "react"

import Swal from "sweetalert2"

import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
} from "firebase/firestore"

import { db } from "../firebase"

function Ventas() {

  // PRODUCTOS
  const [productos, setProductos] =
    useState([])

  // CLIENTES
  const [clientes, setClientes] =
    useState([])

  // CLIENTE SELECCIONADO
  const [
    clienteSeleccionado,
    setClienteSeleccionado,
  ] = useState("")

  // CARRITO
  const [carrito, setCarrito] =
    useState([])

  // CARGAR PRODUCTOS
  useEffect(() => {

    cargarProductos()

  }, [])

  // CARGAR CLIENTES
  useEffect(() => {

    cargarClientes()

  }, [])

  // OBTENER PRODUCTOS
  async function cargarProductos() {

    try {

      const querySnapshot =
        await getDocs(
          collection(db, "productos")
        )

      const listaProductos = []

      querySnapshot.forEach((documento) => {

        listaProductos.push({
          id: documento.id,
          ...documento.data(),
        })

      })

      setProductos(listaProductos)

    } catch (error) {

      console.log(error)

      Swal.fire({
        icon: "error",
        title: "Error cargando productos",
      })
    }
  }

  // OBTENER CLIENTES
  async function cargarClientes() {

    try {

      const querySnapshot =
        await getDocs(
          collection(db, "clientes")
        )

      const listaClientes = []

      querySnapshot.forEach((documento) => {

        listaClientes.push({
          id: documento.id,
          ...documento.data(),
        })

      })

      setClientes(listaClientes)

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

    // VALIDAR STOCK
    if (Number(producto.stock) <= 0) {

      Swal.fire({
        icon: "error",
        title: "Sin stock",
        text:
          "Este producto ya no tiene stock",
      })

      return
    }

    // BUSCAR SI EXISTE
    const productoExiste =
      carrito.find(
        (item) =>
          item.id === producto.id
      )

    // SI YA EXISTE
    if (productoExiste) {

      const nuevoCarrito =
        carrito.map((item) => {

          if (item.id === producto.id) {

            // VALIDAR STOCK
            if (
              item.cantidad >=
              Number(producto.stock)
            ) {

              Swal.fire({
                icon: "warning",
                title:
                  "Stock máximo alcanzado",
              })

              return item
            }

            return {
              ...item,
              cantidad:
                item.cantidad + 1,
            }
          }

          return item
        })

      setCarrito(nuevoCarrito)

    } else {

      // AGREGAR NUEVO
      setCarrito([
        ...carrito,
        {
          ...producto,
          cantidad: 1,
        },
      ])
    }
  }

  // ELIMINAR DEL CARRITO
  function eliminarDelCarrito(id) {

    const nuevoCarrito =
      carrito.filter(
        (item) => item.id !== id
      )

    setCarrito(nuevoCarrito)
  }

  // TOTAL
  const total = carrito.reduce(
    (acc, item) =>
      acc +
      Number(item.precio) *
        item.cantidad,
    0
  )

  // FINALIZAR VENTA
  async function finalizarVenta() {

    // VALIDAR CLIENTE
    if (!clienteSeleccionado) {

      Swal.fire({
        icon: "warning",
        title:
          "Selecciona un cliente",
      })

      return
    }

    // VALIDAR CARRITO
    if (carrito.length === 0) {

      Swal.fire({
        icon: "warning",
        title: "Carrito vacío",
      })

      return
    }

    try {

      // DESCONTAR STOCK
      for (const item of carrito) {

        const productoOriginal =
          productos.find(
            (producto) =>
              producto.id === item.id
          )

        const nuevoStock =
          Number(
            productoOriginal.stock
          ) - item.cantidad

        await updateDoc(
          doc(
            db,
            "productos",
            item.id
          ),
          {
            stock: nuevoStock,
          }
        )
      }

      // BUSCAR CLIENTE
      const clienteData =
        clientes.find(
          (cliente) =>
            cliente.id ===
            clienteSeleccionado
        )

      // CREAR VENTA
      const nuevaVenta = {

        cliente:
          clienteData?.nombre || "",

        telefono:
          clienteData?.telefono || "",

        productos: carrito,

        total,

        fecha:
          new Date().toLocaleString(),
      }

      // GUARDAR EN FIREBASE
      await addDoc(
        collection(db, "ventas"),
        nuevaVenta
      )

      // LIMPIAR
      setCarrito([])

      setClienteSeleccionado("")

      // RECARGAR PRODUCTOS
      cargarProductos()

      Swal.fire({
        icon: "success",
        title: "Venta realizada",
        text: `Total: S/ ${total}`,
      })

    } catch (error) {

      console.log(error)

      Swal.fire({
        icon: "error",
        title: "Error al vender",
      })
    }
  }

  return (

    <div className="space-y-8">

      {/* TITULO */}
      <div>

        <h1 className="text-5xl font-black text-slate-800 dark:text-white">
          Ventas
        </h1>

        <p className="text-slate-500 dark:text-slate-400 mt-3 text-lg">
          Sistema profesional de ventas
        </p>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* PRODUCTOS */}
        <div className="
          bg-white
          dark:bg-slate-900
          rounded-3xl
          shadow-sm
          border
          border-slate-100
          dark:border-slate-800
          p-6
        ">

          <h2 className="text-3xl font-black mb-6 dark:text-white">
            Productos
          </h2>

          <div className="flex flex-col gap-4">

            {productos.map((producto) => (

              <div
                key={producto.id}
                className="
                  border
                  border-slate-200
                  dark:border-slate-700
                  rounded-2xl
                  p-5
                  flex
                  justify-between
                  items-center
                  hover:shadow-md
                  transition-all
                "
              >

                <div>

                  <h3 className="font-bold text-lg dark:text-white">
                    {producto.marca}
                  </h3>

                  <p className="text-slate-500 text-sm">
                    {producto.categoria}
                  </p>

                  <p className="text-slate-400 text-sm">
                    {producto.modelo}
                  </p>

                  <p className="font-bold mt-2 dark:text-slate-200">
                    S/ {producto.precio}
                  </p>

                  <p className="text-sm text-slate-400 mt-1">
                    Stock: {producto.stock}
                  </p>

                </div>

                <button
                  disabled={
                    Number(producto.stock) <= 0
                  }
                  onClick={() =>
                    agregarAlCarrito(producto)
                  }
                  className={`px-5 py-3 rounded-2xl text-white font-semibold transition-all ${
                    Number(producto.stock) <= 0
                      ? "bg-slate-400 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700 hover:scale-105"
                  }`}
                >

                  {Number(producto.stock) <= 0
                    ? "Sin stock"
                    : "Agregar"}

                </button>

              </div>

            ))}

          </div>

        </div>

        {/* CARRITO */}
        <div className="
          bg-white
          dark:bg-slate-900
          rounded-3xl
          shadow-sm
          border
          border-slate-100
          dark:border-slate-800
          p-6
        ">

          <h2 className="text-3xl font-black mb-6 dark:text-white">
            Carrito
          </h2>

          {/* CLIENTE */}
          <div className="mb-6">

            <label className="block mb-2 font-semibold dark:text-white">
              Cliente
            </label>

            <select
              value={clienteSeleccionado}
              onChange={(e) =>
                setClienteSeleccionado(
                  e.target.value
                )
              }
              className="
                w-full
                border
                border-slate-300
                dark:border-slate-700
                dark:bg-slate-900
                dark:text-white
                p-4
                rounded-2xl
                focus:outline-none
                focus:ring-4
                focus:ring-blue-500/20
              "
            >

              <option value="">
                Selecciona un cliente
              </option>

              {clientes.map((cliente) => (

                <option
                  key={cliente.id}
                  value={cliente.id}
                >
                  {cliente.nombre}
                </option>

              ))}

            </select>

          </div>

          <div className="flex flex-col gap-4">

            {carrito.map((item) => (

              <div
                key={item.id}
                className="
                  border
                  border-slate-200
                  dark:border-slate-700
                  rounded-2xl
                  p-5
                  flex
                  justify-between
                  items-center
                "
              >

                <div>

                  <h3 className="font-bold text-lg dark:text-white">
                    {item.marca}
                  </h3>

                  <p className="text-slate-500 text-sm">
                    {item.categoria}
                  </p>

                  <p className="text-slate-400 text-sm">
                    {item.modelo}
                  </p>

                  <p className="mt-2 dark:text-slate-200">
                    Cantidad: {item.cantidad}
                  </p>

                  <p className="font-bold mt-1 dark:text-white">
                    Subtotal:
                    {" "}
                    S/
                    {" "}
                    {Number(item.precio) *
                      item.cantidad}
                  </p>

                </div>

                <button
                  onClick={() =>
                    eliminarDelCarrito(item.id)
                  }
                  className="
                    bg-red-500
                    text-white
                    px-5
                    py-3
                    rounded-2xl
                    hover:bg-red-600
                    hover:scale-105
                    transition-all
                  "
                >
                  Eliminar
                </button>

              </div>

            ))}

          </div>

          {/* TOTAL */}
          <div className="mt-8 border-t border-slate-200 dark:border-slate-700 pt-6">

            <h3 className="text-4xl font-black dark:text-white">

              Total:
              {" "}
              S/
              {" "}
              {total}

            </h3>

            <button
              onClick={finalizarVenta}
              className="
                mt-6
                w-full
                bg-green-600
                text-white
                py-4
                rounded-2xl
                hover:bg-green-700
                hover:scale-[1.02]
                transition-all
                font-bold
                text-lg
              "
            >
              Finalizar Venta
            </button>

          </div>

        </div>

      </div>

    </div>
  )
}

export default Ventas