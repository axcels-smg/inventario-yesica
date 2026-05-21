import { useEffect, useState } from "react"
import Modal from "../components/Modal"
import Swal from "sweetalert2"

import {
  Pencil,
  Trash2,
  PackageSearch,
} from "lucide-react"

import { db } from "../firebase"

import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  doc,
} from "firebase/firestore"

function Productos() {

  // PRODUCTOS
  const [productos, setProductos] = useState([])

  // FORMULARIO
  const [marca, setMarca] = useState("")
  const [categoria, setCategoria] = useState("")
  const [modelo, setModelo] = useState("")
  const [precio, setPrecio] = useState("")
  const [stock, setStock] = useState("")

  // BUSQUEDA
  const [busqueda, setBusqueda] = useState("")

  // EDITAR
  const [editandoId, setEditandoId] = useState(null)

  const [modalAbierto, setModalAbierto] = useState(false)

  useEffect(() => {
    obtenerProductos()
  }, [])

  // OBTENER
  async function obtenerProductos() {
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

  // LIMPIAR
  function limpiarFormulario() {
    setMarca("")
    setCategoria("")
    setModelo("")
    setPrecio("")
    setStock("")
  }

  // GUARDAR / EDITAR
  async function agregarProducto(e) {
    e.preventDefault()

    if (!marca || !categoria || !modelo || !precio || !stock) {
      Swal.fire({
        icon: "warning",
        title: "Campos incompletos",
      })
      return
    }

    try {

      if (editandoId) {

        await updateDoc(doc(db, "productos", editandoId), {
          marca,
          categoria,
          modelo,
          precio,
          stock,
        })

        Swal.fire({
          icon: "success",
          title: "Producto actualizado",
          timer: 1500,
          showConfirmButton: false,
        })

      } else {

        await addDoc(collection(db, "productos"), {
          marca,
          categoria,
          modelo,
          precio,
          stock,
        })

        Swal.fire({
          icon: "success",
          title: "Producto agregado",
          timer: 1500,
          showConfirmButton: false,
        })
      }

      obtenerProductos()
      limpiarFormulario()
      setEditandoId(null)
      setModalAbierto(false)

    } catch (error) {
      console.log(error)

      Swal.fire({
        icon: "error",
        title: "Error guardando producto",
      })
    }
  }

  // ELIMINAR
  async function eliminarProducto(id) {

    Swal.fire({
      title: "¿Eliminar producto?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      confirmButtonText: "Eliminar",
    }).then(async (result) => {

      if (result.isConfirmed) {

        await deleteDoc(doc(db, "productos", id))

        obtenerProductos()

        Swal.fire({
          icon: "success",
          title: "Eliminado",
          timer: 1200,
          showConfirmButton: false,
        })
      }
    })
  }

  // EDITAR
  function editarProducto(producto) {
    setMarca(producto.marca)
    setCategoria(producto.categoria)
    setModelo(producto.modelo)
    setPrecio(producto.precio)
    setStock(producto.stock)

    setEditandoId(producto.id)
    setModalAbierto(true)
  }

  // FILTRO
  const productosFiltrados = productos.filter((p) =>
    `${p.marca} ${p.modelo} ${p.categoria}`
      .toLowerCase()
      .includes(busqueda.toLowerCase())
  )

  return (
    <div className="space-y-8">

      {/* HEADER */}
      <div className="flex flex-col lg:flex-row lg:justify-between gap-6">

        <div>
          <h1 className="text-5xl font-black text-slate-800 dark:text-white">
            Productos
          </h1>
          <p className="text-slate-500 mt-2">
            Gestiona tu inventario
          </p>
        </div>

        {/* SEARCH */}
        <div className="relative">

          <PackageSearch
            className="absolute left-4 top-4 text-slate-400"
            size={20}
          />

          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar..."
            className="pl-12 pr-4 py-4 rounded-2xl border w-[300px] dark:bg-slate-900 dark:text-white"
          />
        </div>
      </div>

      {/* BTN + STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl">
          <p>Total</p>
          <h2 className="text-3xl font-black">{productos.length}</h2>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl">
          <p>Stock total</p>
          <h2 className="text-3xl font-black">
            {productos.reduce((a, b) => a + Number(b.stock), 0)}
          </h2>
        </div>

        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 rounded-3xl flex justify-between items-center text-white">

          <div>
            <p>Inventario</p>
            <h2 className="text-2xl font-black">PRO</h2>
          </div>

          <button
            onClick={() => {
              limpiarFormulario()
              setEditandoId(null)
              setModalAbierto(true)
            }}
            className="bg-white text-blue-700 px-4 py-2 rounded-xl font-bold"
          >
            + Nuevo
          </button>

        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl overflow-hidden">

        <table className="w-full">

          <thead className="bg-slate-100 dark:bg-slate-800">
            <tr>
              <th className="p-4 text-left">Marca</th>
              <th className="p-4 text-left">Categoría</th>
              <th className="p-4 text-left">Modelo</th>
              <th className="p-4 text-left">Precio</th>
              <th className="p-4 text-left">Stock</th>
              <th className="p-4 text-left">Acciones</th>
            </tr>
          </thead>

          <tbody>

            {productosFiltrados.map((p) => (
              <tr key={p.id} className="border-t">

                <td className="p-4 font-bold">{p.marca}</td>

                <td className="p-4">
                  <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm">
                    {p.categoria}
                  </span>
                </td>

                <td className="p-4">{p.modelo}</td>

                <td className="p-4 font-bold">S/ {p.precio}</td>

                <td className="p-4">{p.stock}</td>

                <td className="p-4 flex gap-2">

                  <button
                    onClick={() => editarProducto(p)}
                    className="bg-yellow-500 text-white p-2 rounded-xl"
                  >
                    <Pencil size={18} />
                  </button>

                  <button
                    onClick={() => eliminarProducto(p.id)}
                    className="bg-red-500 text-white p-2 rounded-xl"
                  >
                    <Trash2 size={18} />
                  </button>

                </td>

              </tr>
            ))}

          </tbody>

        </table>

      </div>

      {/* MODAL */}
      <Modal isOpen={modalAbierto} onClose={() => setModalAbierto(false)}>

        <h2 className="text-2xl font-bold mb-4">
          {editandoId ? "Editar" : "Nuevo"}
        </h2>

        <form onSubmit={agregarProducto} className="flex flex-col gap-3">

          <input value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Marca" />
          <input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Categoría" />
          <input value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="Modelo" />
          <input value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="Precio" />
          <input value={stock} onChange={(e) => setStock(e.target.value)} placeholder="Stock" />

          <button className="bg-blue-600 text-white py-3 rounded-xl">
            Guardar
          </button>

        </form>

      </Modal>

    </div>
  )
}

export default Productos