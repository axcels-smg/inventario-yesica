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

  // STATES
  const [clientes, setClientes] =
    useState([])

  const [nombre, setNombre] =
    useState("")

  const [telefono, setTelefono] =
    useState("")

  const [correo, setCorreo] =
    useState("")

  const [direccion, setDireccion] =
    useState("")

  // CARGAR CLIENTES
  async function cargarClientes() {

    try {

      const querySnapshot =
        await getDocs(
          collection(db, "clientes")
        )

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

  // USE EFFECT
  useEffect(() => {

    cargarClientes()

  }, [])

  // AGREGAR CLIENTE
  async function agregarCliente(e) {

    e.preventDefault()

    if (
      !nombre ||
      !telefono ||
      !correo
    ) {

      Swal.fire({
        icon: "warning",
        title: "Completa los campos",
      })

      return
    }

    try {

      const nuevoCliente = {
        nombre,
        telefono,
        correo,
        direccion,
        fecha:
          new Date().toLocaleString(),
      }

      await addDoc(
        collection(db, "clientes"),
        nuevoCliente
      )

      Swal.fire({
        icon: "success",
        title: "Cliente agregado",
      })

      // LIMPIAR
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

  // ELIMINAR CLIENTE
  async function eliminarCliente(id) {

    try {

      await deleteDoc(
        doc(db, "clientes", id)
      )

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

    <div>

      {/* TITULO */}
      <div className="mb-8">

        <h1 className="text-4xl font-bold text-slate-800">
          Clientes
        </h1>

        <p className="text-slate-500 mt-2">
          Gestión de clientes
        </p>

      </div>

      <div className="grid grid-cols-2 gap-8">

        {/* FORMULARIO */}
        <div className="bg-white rounded-2xl shadow p-6">

          <h2 className="text-2xl font-bold mb-6">
            Nuevo Cliente
          </h2>

          <form
            onSubmit={agregarCliente}
            className="flex flex-col gap-4"
          >

            <input
              type="text"
              placeholder="Nombre"
              value={nombre}
              onChange={(e) =>
                setNombre(e.target.value)
              }
              className="border p-3 rounded-xl"
            />

            <input
              type="text"
              placeholder="Teléfono"
              value={telefono}
              onChange={(e) =>
                setTelefono(e.target.value)
              }
              className="border p-3 rounded-xl"
            />

            <input
              type="email"
              placeholder="Correo"
              value={correo}
              onChange={(e) =>
                setCorreo(e.target.value)
              }
              className="border p-3 rounded-xl"
            />

            <input
              type="text"
              placeholder="Dirección"
              value={direccion}
              onChange={(e) =>
                setDireccion(e.target.value)
              }
              className="border p-3 rounded-xl"
            />

            <button
              className="bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 transition"
            >
              Guardar Cliente
            </button>

          </form>

        </div>

        {/* LISTA */}
        <div className="bg-white rounded-2xl shadow p-6">

          <h2 className="text-2xl font-bold mb-6">
            Lista de Clientes
          </h2>

          <div className="flex flex-col gap-4">

            {clientes.length === 0 && (

              <div className="text-slate-500 text-center">
                No hay clientes
              </div>
            )}

            {clientes.map((cliente) => (

              <div
                key={cliente.id}
                className="border rounded-xl p-4"
              >

                <div className="flex justify-between">

                  <div>

                    <h3 className="font-bold text-lg">
                      {cliente.nombre}
                    </h3>

                    <p className="text-slate-500">
                      {cliente.telefono}
                    </p>

                    <p className="text-slate-500">
                      {cliente.correo}
                    </p>

                    <p className="text-slate-400 text-sm">
                      {cliente.direccion}
                    </p>

                  </div>

                  <button
                    onClick={() =>
                      eliminarCliente(cliente.id)
                    }
                    className="bg-red-500 text-white px-4 py-2 rounded-xl hover:bg-red-600 transition h-fit"
                  >
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