import { useEffect, useState } from "react"
import Swal from "sweetalert2"
import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc } from "firebase/firestore"
import { Store, Plus, Edit2, Trash2, MapPin, Phone, FileText } from "lucide-react"
import { db } from "../firebase"
import { useTienda } from "../context/TiendaContext"

function Tiendas() {
  const [tiendas, setTiendas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [modoEdicion, setModoEdicion] = useState(false)
  const [tiendaEditando, setTiendaEditando] = useState(null)
  const { cargarTiendas } = useTienda()

  const [formulario, setFormulario] = useState({
    nombre: "",
    direccion: "",
    ruc: "",
    telefono: "",
    email: "",
    activo: true,
  })

  useEffect(() => {
    cargarTiendasLista()
  }, [])

  async function cargarTiendasLista() {
    try {
      setCargando(true)
      const querySnapshot = await getDocs(collection(db, "tiendas"))
      const lista = []
      querySnapshot.forEach((docu) => {
        lista.push({ id: docu.id, ...docu.data() })
      })
      setTiendas(lista)
    } catch (error) {
      console.error("Error cargando tiendas:", error)
      Swal.fire({
        icon: "error",
        title: "Error al cargar tiendas",
      })
    } finally {
      setCargando(false)
    }
  }

  function limpiarFormulario() {
    setFormulario({
      nombre: "",
      direccion: "",
      ruc: "",
      telefono: "",
      email: "",
      activo: true,
    })
    setModoEdicion(false)
    setTiendaEditando(null)
  }

  async function guardarTienda(e) {
    e.preventDefault()

    if (!formulario.nombre.trim()) {
      return Swal.fire({
        icon: "warning",
        title: "Nombre requerido",
        text: "El nombre de la tienda es obligatorio",
      })
    }

    try {
      if (modoEdicion && tiendaEditando) {
        await updateDoc(doc(db, "tiendas", tiendaEditando.id), formulario)
        Swal.fire({
          icon: "success",
          title: "Tienda actualizada",
          timer: 1500,
          showConfirmButton: false,
        })
      } else {
        await addDoc(collection(db, "tiendas"), formulario)
        Swal.fire({
          icon: "success",
          title: "Tienda creada",
          timer: 1500,
          showConfirmButton: false,
        })
      }

      limpiarFormulario()
      cargarTiendasLista()
      cargarTiendas()
    } catch (error) {
      console.error("Error guardando tienda:", error)
      Swal.fire({
        icon: "error",
        title: "Error al guardar",
        text: error.message,
      })
    }
  }

  function editarTienda(tienda) {
    setFormulario(tienda)
    setModoEdicion(true)
    setTiendaEditando(tienda)
  }

  async function eliminarTienda(tienda) {
    const confirmacion = await Swal.fire({
      title: "¿Eliminar esta tienda?",
      text: "Esta acción no se puede deshacer",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ef4444",
    })

    if (!confirmacion.isConfirmed) return

    try {
      await deleteDoc(doc(db, "tiendas", tienda.id))
      setTiendas(tiendas.filter((t) => t.id !== tienda.id))
      cargarTiendas()
      Swal.fire({
        icon: "success",
        title: "Tienda eliminada",
        timer: 1500,
        showConfirmButton: false,
      })
    } catch (error) {
      console.error("Error eliminando tienda:", error)
      Swal.fire({
        icon: "error",
        title: "Error al eliminar",
        text: error.message,
      })
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-5xl font-black text-slate-800 dark:text-white">
          Gestión de Tiendas
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-3 text-lg">
          Administra todas las tiendas del sistema multitienda
        </p>
      </div>

      {/* Formulario */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border dark:border-slate-800">
        <h2 className="text-2xl font-bold mb-6 dark:text-white flex items-center gap-2">
          {modoEdicion ? <Edit2 size={24} /> : <Plus size={24} />}
          {modoEdicion ? "Editar Tienda" : "Nueva Tienda"}
        </h2>

        <form onSubmit={guardarTienda} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-slate-500 dark:text-slate-400 block mb-1">Nombre *</label>
              <input
                type="text"
                value={formulario.nombre}
                onChange={(e) => setFormulario({ ...formulario, nombre: e.target.value })}
                className="w-full p-3 rounded-2xl border dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                placeholder="Ej: Tienda Central"
                required
              />
            </div>

            <div>
              <label className="text-sm text-slate-500 dark:text-slate-400 block mb-1">RUC</label>
              <input
                type="text"
                value={formulario.ruc}
                onChange={(e) => setFormulario({ ...formulario, ruc: e.target.value })}
                className="w-full p-3 rounded-2xl border dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                placeholder="Ej: 20600000001"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm text-slate-500 dark:text-slate-400 block mb-1">Dirección</label>
              <input
                type="text"
                value={formulario.direccion}
                onChange={(e) => setFormulario({ ...formulario, direccion: e.target.value })}
                className="w-full p-3 rounded-2xl border dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                placeholder="Ej: Av. Principal 123, Lima"
              />
            </div>

            <div>
              <label className="text-sm text-slate-500 dark:text-slate-400 block mb-1">Teléfono</label>
              <input
                type="text"
                value={formulario.telefono}
                onChange={(e) => setFormulario({ ...formulario, telefono: e.target.value })}
                className="w-full p-3 rounded-2xl border dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                placeholder="Ej: +51 999 888 777"
              />
            </div>

            <div>
              <label className="text-sm text-slate-500 dark:text-slate-400 block mb-1">Email</label>
              <input
                type="email"
                value={formulario.email}
                onChange={(e) => setFormulario({ ...formulario, email: e.target.value })}
                className="w-full p-3 rounded-2xl border dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                placeholder="Ej: tienda@ejemplo.com"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white py-3 rounded-2xl font-bold hover:bg-blue-700 transition"
            >
              {modoEdicion ? "Actualizar Tienda" : "Crear Tienda"}
            </button>

            {modoEdicion && (
              <button
                type="button"
                onClick={limpiarFormulario}
                className="px-6 py-3 bg-slate-200 dark:bg-slate-700 dark:text-white rounded-2xl font-bold hover:bg-slate-300 transition"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Lista de Tiendas */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border dark:border-slate-800">
        <h2 className="text-2xl font-bold mb-6 dark:text-white flex items-center gap-2">
          <Store size={24} />
          Tiendas Registradas ({tiendas.length})
        </h2>

        {cargando ? (
          <p className="text-slate-500 dark:text-slate-400 text-center py-8">Cargando tiendas...</p>
        ) : tiendas.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400 text-center py-8">No hay tiendas registradas</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tiendas.map((tienda) => (
              <div
                key={tienda.id}
                className={`border dark:border-slate-700 rounded-2xl p-5 ${
                  !tienda.activo ? "opacity-60" : ""
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-2">
                    <Store size={20} className="text-blue-500" />
                    <h3 className="font-bold text-lg dark:text-white">{tienda.nombre}</h3>
                  </div>
                  {!tienda.activo && (
                    <span className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 text-xs px-2 py-1 rounded-full font-bold">
                      Inactiva
                    </span>
                  )}
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <FileText size={16} />
                    <span>RUC: {tienda.ruc || "—"}</span>
                  </div>

                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <MapPin size={16} />
                    <span>{tienda.direccion || "—"}</span>
                  </div>

                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <Phone size={16} />
                    <span>{tienda.telefono || "—"}</span>
                  </div>
                </div>

                <div className="flex gap-2 mt-4 pt-4 border-t dark:border-slate-700">
                  <button
                    onClick={() => editarTienda(tienda)}
                    className="flex-1 flex items-center justify-center gap-2 bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 py-2 rounded-xl font-medium hover:bg-blue-200 transition"
                  >
                    <Edit2 size={16} />
                    Editar
                  </button>

                  <button
                    onClick={() => eliminarTienda(tienda)}
                    className="flex-1 flex items-center justify-center gap-2 bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 py-2 rounded-xl font-medium hover:bg-red-200 transition"
                  >
                    <Trash2 size={16} />
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Tiendas
