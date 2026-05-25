import { useEffect, useState } from "react"
import Swal from "sweetalert2"
import { Minus, PackageSearch, Plus, Trash2 } from "lucide-react"

import {
  collection,
  getDocs,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore"

import { db } from "../firebase"

import {
  filtrarProductos,
  obtenerValoresUnicos,
  MIN_CARACTERES_BUSQUEDA,
  MAX_RESULTADOS_VENTAS,
} from "../utils/productos"

function Ventas() {

  const [productos, setProductos] = useState([])
  const [clientes, setClientes] = useState([])
  const [cargandoProductos, setCargandoProductos] = useState(true)

  const [clienteSeleccionado, setClienteSeleccionado] = useState("")
  const [carrito, setCarrito] = useState([])
  const [busquedaProducto, setBusquedaProducto] = useState("")
  const [filtroMarca, setFiltroMarca] = useState("")
  const [filtroCategoria, setFiltroCategoria] = useState("")
  const [vendiendo, setVendiendo] = useState(false)

  useEffect(() => {
    cargarProductos()
    cargarClientes()
  }, [])

  async function cargarProductos() {
    try {
      setCargandoProductos(true)

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
    } finally {
      setCargandoProductos(false)
    }
  }

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

      lista.sort((a, b) =>
        String(a.nombre || "").localeCompare(String(b.nombre || ""))
      )

      setClientes(lista)

    } catch (error) {
      console.log(error)
      Swal.fire({
        icon: "error",
        title: "Error cargando clientes",
      })
    }
  }

  function obtenerStockProducto(id) {
    const producto = productos.find((p) => p.id === id)
    return Number(producto?.stock || 0)
  }

  function agregarAlCarrito(producto) {
    const stockProducto = Number(producto.stock)

    if (stockProducto <= 0) {
      Swal.fire({
        icon: "error",
        title: "Sin stock",
      })
      return
    }

    const existe = carrito.find((item) => item.id === producto.id)

    if (existe) {
      aumentarCantidad(producto.id)
      return
    }

    setCarrito([
      ...carrito,
      { ...producto, cantidad: 1 },
    ])
  }

  function aumentarCantidad(id) {
    const stockProducto = obtenerStockProducto(id)

    setCarrito((items) =>
      items.map((item) => {
        if (item.id !== id) return item

        if (item.cantidad >= stockProducto) {
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
      })
    )
  }

  function disminuirCantidad(id) {
    setCarrito((items) =>
      items
        .map((item) => {
          if (item.id !== id) return item

          return {
            ...item,
            cantidad: item.cantidad - 1,
          }
        })
        .filter((item) => item.cantidad > 0)
    )
  }

  function cambiarCantidad(id, valor) {
    if (!/^\d*$/.test(valor)) return

    const cantidad = Number(valor)
    const stockProducto = obtenerStockProducto(id)

    setCarrito((items) =>
      items.map((item) => {
        if (item.id !== id) return item

        if (valor === "") {
          return {
            ...item,
            cantidad: "",
          }
        }

        return {
          ...item,
          cantidad: Math.min(cantidad, stockProducto),
        }
      })
    )
  }

  function normalizarCantidad(id) {
    setCarrito((items) =>
      items
        .map((item) => {
          if (item.id !== id) return item

          return {
            ...item,
            cantidad: Number(item.cantidad) || 1,
          }
        })
        .filter((item) => item.cantidad > 0)
    )
  }

  function eliminarDelCarrito(id) {
    setCarrito(carrito.filter((i) => i.id !== id))
  }

  const total = carrito.reduce(
    (acc, item) => acc + Number(item.precio) * Number(item.cantidad || 0),
    0
  )

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

    const carritoValido = carrito.every((item) =>
      Number.isInteger(Number(item.cantidad)) && Number(item.cantidad) > 0
    )

    if (!carritoValido) {
      return Swal.fire({
        icon: "warning",
        title: "Revisa las cantidades",
      })
    }

    const confirmacion = await Swal.fire({
      title: "¿Finalizar venta?",
      text: `Total S/ ${total}`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Finalizar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#16a34a",
    })

    if (!confirmacion.isConfirmed) return

    try {
      setVendiendo(true)

      const clienteData = clientes.find(
        (c) => c.id === clienteSeleccionado
      )

      const productosVenta = carrito.map((item) => ({
        ...item,
        cantidad: Number(item.cantidad),
      }))

      await runTransaction(db, async (transaction) => {
        const productosActuales = []

        for (const item of productosVenta) {
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
          productos: productosVenta,
          total,
          fecha: serverTimestamp(),
          fechaTexto: new Date().toLocaleString("es-PE"),
        })
      })

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

  const marcas = obtenerValoresUnicos(productos, "marca")
  const categorias = obtenerValoresUnicos(productos, "categoria")

  const busquedaLista = busquedaProducto.trim().length >= MIN_CARACTERES_BUSQUEDA

  const productosFiltrados = filtrarProductos(productos, {
    busqueda: busquedaLista ? busquedaProducto : "",
    marca: filtroMarca,
    categoria: filtroCategoria,
  })

  const totalCoincidencias = busquedaLista ? productosFiltrados.length : 0

  const productosMostrar = busquedaLista
    ? productosFiltrados.slice(0, MAX_RESULTADOS_VENTAS)
    : []

  const hayMasResultados = totalCoincidencias > MAX_RESULTADOS_VENTAS

  return (
    <div className="space-y-8">

      <div>
        <h1 className="text-5xl font-black text-slate-800 dark:text-white">
          Ventas
        </h1>

        <p className="text-slate-500 dark:text-slate-400 mt-2">
          Busca por código, marca o modelo (mín. {MIN_CARACTERES_BUSQUEDA} letras).
          Catálogo: {productos.length} productos.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6">

          <div className="flex flex-col gap-4 mb-6">
            <h2 className="text-3xl font-bold dark:text-white">
              Buscar producto
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select
                value={filtroMarca}
                onChange={(e) => setFiltroMarca(e.target.value)}
                className="p-3 rounded-2xl border dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                <option value="">Todas las marcas</option>
                {marcas.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>

              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                className="p-3 rounded-2xl border dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                <option value="">Todas las categorías</option>
                {categorias.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="relative">
              <PackageSearch
                className="absolute left-4 top-4 text-slate-400"
                size={20}
              />

              <input
                value={busquedaProducto}
                onChange={(e) => setBusquedaProducto(e.target.value)}
                placeholder="Código, marca, modelo..."
                className="w-full pl-12 pr-4 py-4 rounded-2xl border dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>

            {busquedaLista && totalCoincidencias > 0 && (
              <p className="text-sm text-slate-500">
                Mostrando {productosMostrar.length} de {totalCoincidencias} resultados
                {hayMasResultados && " (refina la búsqueda para ver más exacto)"}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-4 max-h-[520px] overflow-y-auto">

            {cargandoProductos && (
              <p className="text-slate-500 text-center py-8">
                Cargando catálogo...
              </p>
            )}

            {!cargandoProductos && !busquedaLista && (
              <div className="text-center py-10 text-slate-500 border border-dashed dark:border-slate-700 rounded-2xl">
                <PackageSearch className="mx-auto mb-3 opacity-40" size={40} />
                <p className="font-medium">Escribe para buscar un producto</p>
                <p className="text-sm mt-1">
                  Mínimo {MIN_CARACTERES_BUSQUEDA} caracteres
                </p>
              </div>
            )}

            {!cargandoProductos && busquedaLista && productosMostrar.length === 0 && (
              <p className="text-slate-500 text-center py-8">
                No se encontraron productos
              </p>
            )}

            {productosMostrar.map((p) => (
              <div
                key={p.id}
                className="border dark:border-slate-700 rounded-2xl p-5 flex flex-col sm:flex-row sm:justify-between gap-4"
              >

                <div>
                  {p.codigo && (
                    <p className="text-xs font-mono text-blue-600 dark:text-blue-400 mb-1">
                      {p.codigo}
                    </p>
                  )}

                  <h3 className="font-bold dark:text-white">
                    {p.marca}
                  </h3>

                  <p className="text-sm text-slate-500">
                    {p.categoria}
                  </p>

                  <p className="text-sm dark:text-slate-300">{p.modelo}</p>

                  <p className="font-bold mt-2 dark:text-white">
                    S/ {p.precio}
                  </p>

                  <p className="text-sm text-slate-400">
                    Stock: {p.stock}
                  </p>
                </div>

                <button
                  onClick={() => agregarAlCarrito(p)}
                  disabled={Number(p.stock) <= 0}
                  className={`px-4 py-3 rounded-xl text-white self-start sm:self-center ${
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

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6">

          <h2 className="text-3xl font-bold mb-6 dark:text-white">
            Carrito
          </h2>

          <select
            value={clienteSeleccionado}
            onChange={(e) => setClienteSeleccionado(e.target.value)}
            className="w-full p-4 rounded-2xl mb-6 border dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          >
            <option value="">Selecciona cliente</option>

            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>

          <div className="flex flex-col gap-4">

            {carrito.length === 0 && (
              <p className="text-slate-500 text-center">
                Agrega productos para iniciar una venta
              </p>
            )}

            {carrito.map((item) => (
              <div key={item.id} className="border dark:border-slate-700 p-4 rounded-2xl flex flex-col gap-4">

                <div className="flex justify-between gap-4">
                  <div>
                    <p className="font-bold dark:text-white">{item.marca}</p>
                    <p className="text-sm text-slate-500">{item.modelo}</p>
                    {item.codigo && (
                      <p className="text-xs text-slate-400 font-mono">{item.codigo}</p>
                    )}
                    <p className="text-sm text-slate-500">
                      Stock: {obtenerStockProducto(item.id)}
                    </p>
                  </div>

                  <button
                    onClick={() => eliminarDelCarrito(item.id)}
                    className="bg-red-500 text-white w-11 h-11 rounded-xl flex items-center justify-center"
                    aria-label="Eliminar producto"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => disminuirCantidad(item.id)}
                      className="bg-slate-200 dark:bg-slate-800 dark:text-white w-10 h-10 rounded-xl flex items-center justify-center"
                      aria-label="Restar cantidad"
                    >
                      <Minus size={18} />
                    </button>

                    <input
                      value={item.cantidad}
                      onChange={(e) => cambiarCantidad(item.id, e.target.value)}
                      onBlur={() => normalizarCantidad(item.id)}
                      inputMode="numeric"
                      className="w-20 text-center p-3 rounded-xl border dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />

                    <button
                      onClick={() => aumentarCantidad(item.id)}
                      className="bg-slate-200 dark:bg-slate-800 dark:text-white w-10 h-10 rounded-xl flex items-center justify-center"
                      aria-label="Sumar cantidad"
                    >
                      <Plus size={18} />
                    </button>
                  </div>

                  <p className="font-bold dark:text-white">
                    Subtotal: S/ {Number(item.precio) * Number(item.cantidad || 0)}
                  </p>
                </div>

              </div>
            ))}

          </div>

          <div className="mt-6 border-t dark:border-slate-700 pt-4">

            <h2 className="text-3xl font-black dark:text-white">
              Total: S/ {total}
            </h2>

            <button
              onClick={finalizarVenta}
              disabled={vendiendo}
              className={`w-full mt-4 text-white py-4 rounded-2xl ${
                vendiendo ? "bg-slate-400" : "bg-green-600 hover:bg-green-700"
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
