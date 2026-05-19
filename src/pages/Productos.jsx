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
  const [productos, setProductos] =
    useState([])

  // FORMULARIO
  const [marca, setMarca] =
    useState("")

  const [categoria, setCategoria] =
    useState("")

  const [modelo, setModelo] =
    useState("")

  const [precio, setPrecio] =
    useState("")

  const [stock, setStock] =
    useState("")

  // BUSQUEDA
  const [busqueda, setBusqueda] =
    useState("")

  // EDITAR
  const [editandoId, setEditandoId] =
    useState(null)

  const [modalAbierto, setModalAbierto] =
    useState(false)

  // CARGAR PRODUCTOS
  useEffect(() => {

    obtenerProductos()

  }, [])

  // OBTENER PRODUCTOS
  async function obtenerProductos() {

    try {

      const querySnapshot =
        await getDocs(
          collection(db, "productos")
        )

      const listaProductos = []

      querySnapshot.forEach((docu) => {

        listaProductos.push({
          id: docu.id,
          ...docu.data(),
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

  // LIMPIAR
  function limpiarFormulario() {

    setMarca("")
    setCategoria("")
    setModelo("")
    setPrecio("")
    setStock("")
  }

  // AGREGAR O EDITAR PRODUCTO
  async function agregarProducto(e) {

    e.preventDefault()

    if (
      !marca ||
      !categoria ||
      !modelo ||
      !precio ||
      !stock
    ) {

      Swal.fire({
        icon: "warning",
        title: "Campos incompletos",
        text: "Completa todos los campos",
      })

      return
    }

    try {

      // EDITAR
      if (editandoId) {

        await updateDoc(
          doc(
            db,
            "productos",
            editandoId
          ),
          {
            marca,
            categoria,
            modelo,
            precio,
            stock,
          }
        )

        Swal.fire({
          icon: "success",
          title: "Producto actualizado",
          showConfirmButton: false,
          timer: 1500,
        })

      } else {

        // AGREGAR
        await addDoc(
          collection(db, "productos"),
          {
            marca,
            categoria,
            modelo,
            precio,
            stock,
          }
        )

        Swal.fire({
          icon: "success",
          title: "Producto agregado",
          showConfirmButton: false,
          timer: 1500,
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
      text: "No podrás recuperarlo",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    }).then(async (result) => {

      if (result.isConfirmed) {

        try {

          await deleteDoc(
            doc(
              db,
              "productos",
              id
            )
          )

          obtenerProductos()

          Swal.fire({
            icon: "success",
            title: "Producto eliminado",
            showConfirmButton: false,
            timer: 1500,
          })

        } catch (error) {

          console.log(error)

          Swal.fire({
            icon: "error",
            title: "Error eliminando producto",
          })
        }
      }
    })
  }

  // EDITAR
  function editarProducto(producto) {

    setMarca(producto.marca || "")
    setCategoria(producto.categoria || "")
    setModelo(producto.modelo || "")
    setPrecio(producto.precio || "")
    setStock(producto.stock || "")

    setEditandoId(producto.id)

    setModalAbierto(true)
  }

  // FILTRAR
  const productosFiltrados =
    productos.filter((producto) =>

      `${producto.marca} ${producto.modelo} ${producto.categoria}`
        .toLowerCase()
        .includes(
          busqueda.toLowerCase()
        )
    )

  return (

    <div className="space-y-8">

      {/* HEADER */}
      <div className="
        flex
        flex-col
        lg:flex-row
        lg:items-center
        lg:justify-between
        gap-6
      ">

        <div>

          <h1 className="
            text-5xl
            font-black
            text-slate-800
            dark:text-white
          ">
            Productos
          </h1>

          <p className="
            text-slate-500
            dark:text-slate-400
            mt-3
            text-lg
          ">
            Gestiona tu inventario profesionalmente
          </p>

        </div>

        {/* BUSCADOR */}
        <div className="relative">

          <PackageSearch
            className="
              absolute
              left-4
              top-4
              text-slate-400
            "
            size={22}
          />

          <input
            type="text"
            placeholder="Buscar producto..."
            value={busqueda}
            onChange={(e) =>
              setBusqueda(
                e.target.value
              )
            }
            className="
              w-[350px]
              pl-12
              pr-4
              py-4
              rounded-2xl
              border
              border-slate-200
              dark:border-slate-700
              bg-white
              dark:bg-slate-900
              dark:text-white
              shadow-sm
              focus:outline-none
              focus:ring-4
              focus:ring-blue-500/20
              transition-all
            "
          />

        </div>

      </div>

      {/* CARDS */}
      <div className="
        grid
        grid-cols-1
        md:grid-cols-3
        gap-6
      ">

        {/* TOTAL */}
        <div className="
          bg-white
          dark:bg-slate-900
          rounded-3xl
          p-6
          shadow-sm
          border
          border-slate-100
          dark:border-slate-800
        ">

          <p className="
            text-slate-500
            dark:text-slate-400
          ">
            Total Productos
          </p>

          <h2 className="
            text-4xl
            font-black
            mt-2
            text-slate-800
            dark:text-white
          ">
            {productos.length}
          </h2>

        </div>

        {/* STOCK */}
        <div className="
          bg-white
          dark:bg-slate-900
          rounded-3xl
          p-6
          shadow-sm
          border
          border-slate-100
          dark:border-slate-800
        ">

          <p className="
            text-slate-500
            dark:text-slate-400
          ">
            Stock Total
          </p>

          <h2 className="
            text-4xl
            font-black
            mt-2
            text-slate-800
            dark:text-white
          ">
            {
              productos.reduce(
                (acc, item) =>
                  acc +
                  Number(item.stock),
                0
              )
            }
          </h2>

        </div>

        {/* BOTON */}
        <div className="
          bg-gradient-to-r
          from-blue-600
          to-blue-700
          rounded-3xl
          p-6
          flex
          items-center
          justify-between
          shadow-xl
          shadow-blue-500/20
        ">

          <div>

            <p className="text-blue-100">
              Inventario
            </p>

            <h2 className="
              text-3xl
              font-black
              text-white
            ">
              PRO
            </h2>

          </div>

          <button
            onClick={() => {

              limpiarFormulario()

              setEditandoId(null)

              setModalAbierto(true)

            }}
            className="
              bg-white
              text-blue-700
              px-5
              py-3
              rounded-2xl
              font-bold
              hover:scale-105
              transition-all
            "
          >
            + Nuevo
          </button>

        </div>

      </div>

      {/* TABLA */}
      <div className="
        bg-white
        dark:bg-slate-900
        rounded-3xl
        shadow-sm
        border
        border-slate-100
        dark:border-slate-800
        overflow-hidden
      ">

        <table className="w-full">

          <thead className="
            bg-slate-50
            dark:bg-slate-800
          ">

            <tr>

              <th className="
                p-5
                text-left
                text-slate-500
                dark:text-slate-400
              ">
                Marca
              </th>

              <th className="
                p-5
                text-left
                text-slate-500
                dark:text-slate-400
              ">
                Categoría
              </th>

              <th className="
                p-5
                text-left
                text-slate-500
                dark:text-slate-400
              ">
                Modelo
              </th>

              <th className="
                p-5
                text-left
                text-slate-500
                dark:text-slate-400
              ">
                Precio
              </th>

              <th className="
                p-5
                text-left
                text-slate-500
                dark:text-slate-400
              ">
                Stock
              </th>

              <th className="
                p-5
                text-left
                text-slate-500
                dark:text-slate-400
              ">
                Acciones
              </th>

            </tr>

          </thead>

          <tbody>

            {productosFiltrados.map(
              (producto) => (

              <tr
                key={producto.id}
                className="
                  border-t
                  border-slate-100
                  dark:border-slate-800
                  hover:bg-slate-50
                  dark:hover:bg-slate-800/50
                  transition-all
                "
              >

                <td className="
                  p-5
                  font-bold
                  text-slate-800
                  dark:text-white
                ">
                  {producto.marca}
                </td>

                <td className="p-5">

                  <span className="
                    bg-blue-100
                    text-blue-700
                    px-4
                    py-2
                    rounded-full
                    text-sm
                    font-bold
                  ">
                    {producto.categoria}
                  </span>

                </td>

                <td className="
                  p-5
                  font-semibold
                  text-slate-700
                  dark:text-slate-200
                ">
                  {producto.modelo}
                </td>

                <td className="
                  p-5
                  font-bold
                  text-slate-700
                  dark:text-slate-200
                ">
                  S/ {producto.precio}
                </td>

                <td className="p-5">

                  <span
                    className={`
                      px-4
                      py-2
                      rounded-full
                      text-sm
                      font-bold

                      ${
                        Number(producto.stock) <= 5
                          ? `
                            bg-red-100
                            text-red-600
                          `
                          : `
                            bg-green-100
                            text-green-600
                          `
                      }
                    `}
                  >

                    {producto.stock}
                    {" "}
                    unidades

                  </span>

                </td>

                <td className="p-5">

                  <div className="flex gap-3">

                    <button
                      onClick={() =>
                        editarProducto(producto)
                      }
                      className="
                        bg-yellow-500
                        text-white
                        p-3
                        rounded-2xl
                        hover:bg-yellow-600
                        hover:scale-105
                        transition-all
                      "
                    >
                      <Pencil size={18} />
                    </button>

                    <button
                      onClick={() =>
                        eliminarProducto(producto.id)
                      }
                      className="
                        bg-red-500
                        text-white
                        p-3
                        rounded-2xl
                        hover:bg-red-600
                        hover:scale-105
                        transition-all
                      "
                    >
                      <Trash2 size={18} />
                    </button>

                  </div>

                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

      {/* MODAL */}
      <Modal
        isOpen={modalAbierto}
        onClose={() => {

          setModalAbierto(false)

          limpiarFormulario()

          setEditandoId(null)
        }}
      >

        <h2 className="
          text-3xl
          font-black
          mb-6
          text-slate-800
          dark:text-white
        ">

          {editandoId
            ? "Editar Producto"
            : "Nuevo Producto"}

        </h2>

        <form
          onSubmit={agregarProducto}
          className="flex flex-col gap-4"
        >

          <input
            type="text"
            placeholder="Marca"
            value={marca}
            onChange={(e) =>
              setMarca(e.target.value)
            }
            className="
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
          />

          <input
            type="text"
            placeholder="Categoría"
            value={categoria}
            onChange={(e) =>
              setCategoria(
                e.target.value
              )
            }
            className="
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
          />

          <input
            type="text"
            placeholder="Modelo"
            value={modelo}
            onChange={(e) =>
              setModelo(
                e.target.value
              )
            }
            className="
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
          />

          <input
            type="number"
            placeholder="Precio"
            value={precio}
            onChange={(e) =>
              setPrecio(
                e.target.value
              )
            }
            className="
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
          />

          <input
            type="number"
            placeholder="Stock"
            value={stock}
            onChange={(e) =>
              setStock(
                e.target.value
              )
            }
            className="
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
          />

          <button
            type="submit"
            className={`
              text-white
              py-4
              rounded-2xl
              transition-all
              font-bold
              hover:scale-[1.02]

              ${
                editandoId
                  ? `
                    bg-yellow-500
                    hover:bg-yellow-600
                  `
                  : `
                    bg-blue-600
                    hover:bg-blue-700
                  `
              }
            `}
          >

            {editandoId
              ? "Guardar Cambios"
              : "Agregar Producto"}

          </button>

        </form>

      </Modal>

    </div>
  )
}

export default Productos