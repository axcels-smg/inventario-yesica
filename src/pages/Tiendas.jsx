import { useEffect, useState } from "react"
import Swal from "sweetalert2"
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore"
import { createUserWithEmailAndPassword, getAuth } from "firebase/auth"
import { initializeApp, getApps } from "firebase/app"
import { Store, Plus, Edit2, Trash2, MapPin, Phone, FileText } from "lucide-react"
import { db } from "../firebase"

// Segunda app de Firebase usada únicamente para crear usuarios sin afectar la sesión del admin
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}
const secondaryApp = getApps().find((a) => a.name === "secondary") || initializeApp(firebaseConfig, "secondary")
const authSecundario = getAuth(secondaryApp)
import { useTienda } from "../context/TiendaContext"

function Tiendas() {
  const [tiendas, setTiendas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [modoEdicion, setModoEdicion] = useState(false)
  const [tiendaEditando, setTiendaEditando] = useState(null)
  const { cargarTiendas, tiendaPropia } = useTienda()

  const [formulario, setFormulario] = useState({
    nombre: "",
    direccion: "",
    ruc: "",
    telefono: "",
    email: "",
    password: "",
    activo: true,
  })

  useEffect(() => {
    cargarTiendasLista()
  }, [])

  async function cargarTiendasLista() {
    try {
      setCargando(true)
      const querySnapshot = await getDocs(collection(db, "Tienda"))
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
        text: error.message || "Error de conexión con Firebase",
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
      password: "",
      activo: true,
    })
    setModoEdicion(false)
    setTiendaEditando(null)
  }

  async function guardarTienda(e) {
    e.preventDefault()

    if (!modoEdicion || tiendaEditando?.id !== tiendaPropia?.id) {
      return Swal.fire({
        icon: "warning",
        title: "Solo lectura",
        text: "Solo puedes editar los datos de tu propia tienda.",
      })
    }

    if (!formulario.nombre.trim()) {
      return Swal.fire({
        icon: "warning",
        title: "Nombre requerido",
        text: "El nombre de la tienda es obligatorio",
      })
    }

    if (!modoEdicion && (!formulario.email.trim() || !formulario.password.trim())) {
      return Swal.fire({
        icon: "warning",
        title: "Credenciales requeridas",
        text: "El email y contraseña son obligatorios para crear una tienda",
      })
    }

    try {
      if (modoEdicion && tiendaEditando) {
        // Al editar, no cambiar email/password
        // eslint-disable-next-line no-unused-vars
        const { password: _password, ...datosTienda } = formulario
        await updateDoc(doc(db, "Tienda", tiendaEditando.id), datosTienda)
        Swal.fire({
          icon: "success",
          title: "Tienda actualizada",
          timer: 1500,
          showConfirmButton: false,
        })
      } else {
        // Crear usuario usando la app secundaria para NO desloguear al admin
        const userCredential = await createUserWithEmailAndPassword(
          authSecundario,
          formulario.email,
          formulario.password
        )
        // Cerrar sesión del nuevo usuario en la app secundaria inmediatamente
        await authSecundario.signOut()

        const uid = userCredential.user.uid

        // Crear documento de tienda usando el UID como ID
        // eslint-disable-next-line no-unused-vars
        const { password: _password, ...datosTienda } = formulario
        await setDoc(doc(db, "Tienda", uid), {
          ...datosTienda,
          authUid: uid,
          rol: "admin_tienda",
          fechaCreacion: new Date(),
        })

        Swal.fire({
          icon: "success",
          title: "Tienda creada",
          text: "Usuario de acceso creado exitosamente",
          timer: 2000,
          showConfirmButton: false,
        })
      }

      limpiarFormulario()
      cargarTiendasLista()
      cargarTiendas()
    } catch (error) {
      console.error("Error guardando tienda:", error)

      if (error.code === "auth/email-already-in-use") {
        Swal.fire({
          icon: "error",
          title: "Error al guardar",
          text: "El email ya está en uso",
        })
      } else if (error.code === "auth/weak-password") {
        Swal.fire({
          icon: "error",
          title: "Error al guardar",
          text: "La contraseña debe tener al menos 6 caracteres",
        })
      } else if (error.code === "auth/invalid-email") {
        Swal.fire({
          icon: "error",
          title: "Error al guardar",
          text: "Email inválido",
        })
      } else {
        Swal.fire({
          icon: "error",
          title: "Error al guardar",
          text: error.message,
        })
      }
    }
  }

  function editarTienda(tienda) {
    if (tienda.id !== tiendaPropia?.id) {
      return Swal.fire({
        icon: "info",
        title: "Solo lectura",
        text: "Puedes ver esta tienda, pero no modificarla.",
      })
    }
    setFormulario(tienda)
    setModoEdicion(true)
    setTiendaEditando(tienda)
  }

  async function eliminarTienda(tienda) {
    if (tienda.id !== tiendaPropia?.id) {
      return Swal.fire({
        icon: "warning",
        title: "No permitido",
        text: "No puedes eliminar otra tienda.",
      })
    }
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
      await deleteDoc(doc(db, "Tienda", tienda.id))
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
          Puedes ver todas las tiendas. Solo editas la tuya.
        </p>
      </div>

      {/* Formulario: solo al editar la tienda propia */}
      {modoEdicion && tiendaEditando?.id === tiendaPropia?.id && (
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
                disabled={modoEdicion}
              />
            </div>

            {!modoEdicion && (
              <div>
                <label className="text-sm text-slate-500 dark:text-slate-400 block mb-1">Contraseña *</label>
                <input
                  type="password"
                  value={formulario.password}
                  onChange={(e) => setFormulario({ ...formulario, password: e.target.value })}
                  className="w-full p-3 rounded-2xl border dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                  required={!modoEdicion}
                />
              </div>
            )}
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
      )}

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

                {tienda.id === tiendaPropia?.id ? (
                <div className="flex gap-2 mt-4 pt-4 border-t dark:border-slate-700">
                  <button
                    onClick={() => editarTienda(tienda)}
                    className="flex-1 flex items-center justify-center gap-2 bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 py-2 rounded-xl font-medium hover:bg-blue-200 transition"
                  >
                    <Edit2 size={16} />
                    Editar
                  </button>
                </div>
                ) : (
                <p className="mt-4 pt-4 border-t dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
                  Solo lectura
                </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Tiendas
