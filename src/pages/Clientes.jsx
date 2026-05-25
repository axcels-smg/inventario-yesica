import { useEffect, useState } from "react"
import Swal from "sweetalert2"
import { Pencil, Search, Trash2, X } from "lucide-react"

import { db } from "../firebase"
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore"
import { obtenerTiempoFecha } from "../utils/fechas"

function Clientes() {

  const [clientes, setClientes] = useState([])

  const [nombre, setNombre] = useState("")
  const [telefono, setTelefono] = useState("")
  const [correo, setCorreo] = useState("")
  const [direccion, setDireccion] = useState("")
  const [busqueda, setBusqueda] = useState("")
  const [editandoId, setEditandoId] = useState(null)

  useEffect(() => {
    cargarClientes()
  }, [])

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
        obtenerTiempoFecha(b.fecha || b.fechaTexto) -
        obtenerTiempoFecha(a.fecha || a.fechaTexto)
      )

      setClientes(lista)

    } catch (error) {
      console.log(error)
    }
  }

  function limpiarFormulario() {
    setNombre("")
    setTelefono("")
    setCorreo("")
    setDireccion("")
    setEditandoId(null)
  }

  function editarCliente(cliente) {
    setNombre(cliente.nombre || "")
    setTelefono(cliente.telefono || "")
    setCorreo(cliente.correo || "")
    setDireccion(cliente.direccion || "")
    setEditandoId(cliente.id)
  }

  async function guardarCliente(e) {
    e.preventDefault()

    const nombreLimpio = nombre.trim()
    const telefonoLimpio = telefono.trim()
    const correoLimpio = correo.trim()
    const direccionLimpia = direccion.trim()

    if (!nombreLimpio || !telefonoLimpio || !correoLimpio) {
      Swal.fire({
        icon: "warning",
        title: "Completa los campos",
      })
      return
    }

    try {
      if (editandoId) {
        await updateDoc(doc(db, "clientes", editandoId), {
          nombre: nombreLimpio,
          telefono: telefonoLimpio,
          correo: correoLimpio,
          direccion: direccionLimpia,
          actualizado: serverTimestamp(),
        })
      } else {
        await addDoc(collection(db, "clientes"), {
          nombre: nombreLimpio,
          telefono: telefonoLimpio,
          correo: correoLimpio,
          direccion: direccionLimpia,
          fecha: serverTimestamp(),
          fechaTexto: new Date().toLocaleString("es-PE"),
        })
      }

      Swal.fire({
        icon: "success",
        title: editandoId ? "Cliente actualizado" : "Cliente agregado",
      })

      limpiarFormulario()
      cargarClientes()

    } catch (error) {
      console.log(error)

      Swal.fire({
        icon: "error",
        title: "Error al guardar",
      })
    }
  }

  async function eliminarCliente(id) {
    const result = await Swal.fire({
      title: "¿Eliminar cliente?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
    })

    if (!result.isConfirmed) return

    try {
      await deleteDoc(doc(db, "clientes", id))

      Swal.fire({
        icon: "success",
        title: "Cliente eliminado",
      })

      if (editandoId === id) {
        limpiarFormulario()
      }

      cargarClientes()

    } catch (error) {
      console.log(error)
    }
  }

  const terminosBusqueda = busqueda
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  const clientesFiltrados = clientes.filter((cliente) => {
    const textoCliente = `
      ${cliente.nombre || ""}
      ${cliente.telefono || ""}
      ${cliente.correo || ""}
      ${cliente.direccion || ""}
    `.toLowerCase()

    return terminosBusqueda.every((termino) =>
      textoCliente.includes(termino)
    )
  })

  return (
    <div className="space-y-8">

      <div>
        <h1 className="text-5xl font-black text-slate-800 dark:text-white">
          Clientes
        </h1>

        <p className="text-slate-500 dark:text-slate-400 mt-3 text-lg">
          Gestión de clientes del sistema
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 p-6">

          <h2 className="text-3xl font-black mb-6 dark:text-white">
            {editandoId ? "Editar Cliente" : "Nuevo Cliente"}
          </h2>

          <form onSubmit={guardarCliente} className="flex flex-col gap-4">

            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre"
              className="p-4 rounded-2xl border dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />

            <input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="Teléfono"
              className="p-4 rounded-2xl border dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />

            <input
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder="Correo"
              className="p-4 rounded-2xl border dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />

            <input
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder="Dirección"
              className="p-4 rounded-2xl border dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />

            <button className="bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 transition">
              {editandoId ? "Actualizar Cliente" : "Guardar Cliente"}
            </button>

            {editandoId && (
              <button
                type="button"
                onClick={limpiarFormulario}
                className="flex items-center justify-center gap-2 bg-slate-200 text-slate-700 py-4 rounded-2xl font-bold hover:bg-slate-300 transition"
              >
                <X size={18} />
                Cancelar edición
              </button>
            )}

          </form>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 p-6">

          <h2 className="text-3xl font-black mb-6 dark:text-white">
            Lista de Clientes
          </h2>

          <div className="relative mb-6">
            <Search
              className="absolute left-4 top-4 text-slate-400"
              size={20}
            />

            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar cliente..."
              className="w-full pl-12 pr-4 py-4 rounded-2xl border dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>

          <div className="flex flex-col gap-4">

            {clientesFiltrados.length === 0 && (
              <p className="text-slate-500 text-center">
                No hay clientes para mostrar
              </p>
            )}

            {clientesFiltrados.map((cliente) => (
              <div
                key={cliente.id}
                className="border dark:border-slate-700 rounded-2xl p-5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4"
              >

                <div>
                  <h3 className="font-bold text-lg dark:text-white">
                    {cliente.nombre}
                  </h3>

                  <p className="text-slate-500">{cliente.telefono}</p>
                  <p className="text-slate-500">{cliente.correo}</p>
                  <p className="text-slate-400 text-sm">{cliente.direccion}</p>
                </div>

                <div className="flex gap-2 self-end sm:self-auto">
                  <button
                    onClick={() => editarCliente(cliente)}
                    className="flex items-center gap-2 bg-yellow-500 text-white px-4 py-3 rounded-2xl hover:bg-yellow-600 transition"
                  >
                    <Pencil size={18} />
                    Editar
                  </button>

                  <button
                    onClick={() => eliminarCliente(cliente.id)}
                    className="flex items-center gap-2 bg-red-500 text-white px-4 py-3 rounded-2xl hover:bg-red-600 transition"
                  >
                    <Trash2 size={18} />
                    Eliminar
                  </button>
                </div>

              </div>
            ))}

          </div>
        </div>

      </div>
    </div>
  )
}

export default Clientes
