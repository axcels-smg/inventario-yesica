import { useEffect, useState } from "react"
import Swal from "sweetalert2"

import { db } from "../firebase"
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
} from "firebase/firestore"

function Clientes() {

  const [clientes, setClientes] = useState([])

  const [nombre, setNombre] = useState("")
  const [telefono, setTelefono] = useState("")
  const [correo, setCorreo] = useState("")
  const [direccion, setDireccion] = useState("")

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
    }
  }

  useEffect(() => {
    cargarClientes()
  }, [])

  async function agregarCliente(e) {
    e.preventDefault()

    if (!nombre || !telefono || !correo) {
      Swal.fire({
        icon: "warning",
        title: "Completa los campos",
      })
      return
    }

    try {
      await addDoc(collection(db, "clientes"), {
        nombre,
        telefono,
        correo,
        direccion,
        fecha: new Date().toLocaleString(),
      })

      Swal.fire({
        icon: "success",
        title: "Cliente agregado",
      })

      setNombre("")
      setTelefono("")
      setCorreo("")
      setDireccion("")

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
    try {
      await deleteDoc(doc(db, "clientes", id))

      Swal.fire({
        icon: "success",
        title: "Cliente eliminado",
      })

      cargarClientes()

    } catch (error) {
      console.log(error)
    }
  }

  return (
    <div className="space-y-8">

      {/* HEADER */}
      <div>
        <h1 className="text-5xl font-black text-slate-800 dark:text-white">
          Clientes
        </h1>

        <p className="text-slate-500 dark:text-slate-400 mt-3 text-lg">
          Gestión de clientes del sistema
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* FORM */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 p-6">

          <h2 className="text-3xl font-black mb-6 dark:text-white">
            Nuevo Cliente
          </h2>

          <form onSubmit={agregarCliente} className="flex flex-col gap-4">

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
              Guardar Cliente
            </button>

          </form>
        </div>

        {/* LISTA */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 p-6">

          <h2 className="text-3xl font-black mb-6 dark:text-white">
            Lista de Clientes
          </h2>

          <div className="flex flex-col gap-4">

            {clientes.length === 0 && (
              <p className="text-slate-500 text-center">
                No hay clientes registrados
              </p>
            )}

            {clientes.map((cliente) => (
              <div
                key={cliente.id}
                className="border dark:border-slate-700 rounded-2xl p-5 flex justify-between items-center"
              >

                <div>
                  <h3 className="font-bold text-lg dark:text-white">
                    {cliente.nombre}
                  </h3>

                  <p className="text-slate-500">{cliente.telefono}</p>
                  <p className="text-slate-500">{cliente.correo}</p>
                  <p className="text-slate-400 text-sm">{cliente.direccion}</p>
                </div>

                <button
                  onClick={() => eliminarCliente(cliente.id)}
                  className="bg-red-500 text-white px-4 py-3 rounded-2xl hover:bg-red-600 transition"
                >
                  Eliminar
                </button>

              </div>
            ))}

          </div>
        </div>

      </div>
    </div>
  )
}

export default Clientes