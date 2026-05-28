import { useEffect, useState } from "react"
import Swal from "sweetalert2"
import {
  ArrowRight,
  Package,
  Check,
  X,
  Clock,
  Truck,
  Plus,
  Search,
} from "lucide-react"
import {
  collection,
  getDocs,
  doc,
  addDoc,
  updateDoc,
  runTransaction,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore"
import { db } from "../firebase"
import { useTienda } from "../context/TiendaContext"
import {
  ESTADOS_TRANSFERENCIA,
  ETIQUETAS_ESTADOS_TRANSFERENCIA,
} from "../constants/inventario"

function Transferencias() {
  const { tiendaActual, tiendas } = useTienda()
  const [transferencias, setTransferencias] = useState([])
  const [productosOrigen, setProductosOrigen] = useState([])
  const [modalAbierto, setModalAbierto] = useState(false)
  const [cargando, setCargando] = useState(true)

  const [destinoTienda, setDestinoTienda] = useState("")
  const [productoSeleccionado, setProductoSeleccionado] = useState("")
  const [cantidad, setCantidad] = useState("")
  const [busquedaProducto, setBusquedaProducto] = useState("")

  useEffect(() => {
    if (tiendaActual) {
      cargarTransferencias()
      cargarProductosOrigen()
    }
  }, [tiendaActual])

  async function cargarTransferencias() {
    try {
      setCargando(true)
      const q = query(
        collection(db, "transferencias"),
        where("origenTiendaId", "==", tiendaActual.id)
      )
      const snap = await getDocs(q)
      const lista = []
      snap.forEach((docu) => {
        lista.push({ id: docu.id, ...docu.data() })
      })
      setTransferencias(lista)
    } catch (error) {
      console.error("Error cargando transferencias:", error)
    } finally {
      setCargando(false)
    }
  }

  async function cargarProductosOrigen() {
    if (!tiendaActual) return

    try {
      const q = query(
        collection(db, "productos"),
        where("tiendaId", "==", tiendaActual.id)
      )
      const snap = await getDocs(q)
      const lista = []
      snap.forEach((docu) => {
        lista.push({ id: docu.id, ...docu.data() })
      })
      setProductosOrigen(lista)
    } catch (error) {
      console.error("Error cargando productos:", error)
    }
  }

  async function crearTransferencia(e) {
    e.preventDefault()

    if (!destinoTienda || !productoSeleccionado || !cantidad) {
      return Swal.fire({
        icon: "warning",
        title: "Campos incompletos",
        text: "Completa todos los campos",
      })
    }

    const producto = productosOrigen.find((p) => p.id === productoSeleccionado)
    const cantidadNum = Number(cantidad)

    if (cantidadNum <= 0) {
      return Swal.fire({
        icon: "warning",
        title: "Cantidad inválida",
        text: "La cantidad debe ser mayor a 0",
      })
    }

    if (cantidadNum > producto.stock) {
      return Swal.fire({
        icon: "warning",
        title: "Stock insuficiente",
        text: `Solo hay ${producto.stock} unidades disponibles`,
      })
    }

    try {
      await addDoc(collection(db, "transferencias"), {
        origenTiendaId: tiendaActual.id,
        origenTiendaNombre: tiendaActual.nombre,
        destinoTiendaId: destinoTienda,
        destinoTiendaNombre: tiendas.find((t) => t.id === destinoTienda)?.nombre,
        productos: [
          {
            productoId: productoSeleccionado,
            productoNombre: producto.marca || producto.nombre,
            cantidad: cantidadNum,
          },
        ],
        estado: ESTADOS_TRANSFERENCIA.PENDIENTE,
        fecha: serverTimestamp(),
        fechaTexto: new Date().toLocaleString("es-PE"),
        tiendaId: tiendaActual.id,
      })

      Swal.fire({
        icon: "success",
        title: "Transferencia creada",
        timer: 1500,
        showConfirmButton: false,
      })

      setModalAbierto(false)
      setDestinoTienda("")
      setProductoSeleccionado("")
      setCantidad("")
      cargarTransferencias()
    } catch (error) {
      console.error("Error creando transferencia:", error)
      Swal.fire({
        icon: "error",
        title: "Error al crear transferencia",
      })
    }
  }

  async function aprobarTransferencia(transferencia) {
    const confirmacion = await Swal.fire({
      title: "¿Aprobar transferencia?",
      text: "El stock será reservado para esta transferencia",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Aprobar",
      cancelButtonText: "Cancelar",
    })

    if (!confirmacion.isConfirmed) return

    try {
      await updateDoc(doc(db, "transferencias", transferencia.id), {
        estado: ESTADOS_TRANSFERENCIA.APROBADA,
      })

      Swal.fire({
        icon: "success",
        title: "Transferencia aprobada",
        timer: 1500,
        showConfirmButton: false,
      })

      cargarTransferencias()
    } catch (error) {
      console.error("Error aprobando transferencia:", error)
      Swal.fire({
        icon: "error",
        title: "Error al aprobar",
      })
    }
  }

  async function enviarTransferencia(transferencia) {
    const confirmacion = await Swal.fire({
      title: "¿Enviar transferencia?",
      text: "El stock será descontado de la tienda origen",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Enviar",
      cancelButtonText: "Cancelar",
    })

    if (!confirmacion.isConfirmed) return

    try {
      await runTransaction(db, async (transaction) => {
        const transferenciaRef = doc(db, "transferencias", transferencia.id)
        const transferenciaSnap = await transaction.get(transferenciaRef)

        if (!transferenciaSnap.exists()) {
          throw "Transferencia no encontrada"
        }

        for (const item of transferencia.productos) {
          const productoRef = doc(db, "productos", item.productoId)
          const productoSnap = await transaction.get(productoRef)

          if (!productoSnap.exists()) {
            throw "Producto no encontrado"
          }

          const stockActual = productoSnap.data().stock
          const nuevoStock = stockActual - item.cantidad

          if (nuevoStock < 0) {
            throw "Stock insuficiente"
          }

          transaction.update(productoRef, { stock: nuevoStock })
        }

        transaction.update(transferenciaRef, {
          estado: ESTADOS_TRANSFERENCIA.EN_TRANSITO,
        })
      })

      Swal.fire({
        icon: "success",
        title: "Transferencia enviada",
        timer: 1500,
        showConfirmButton: false,
      })

      cargarTransferencias()
      cargarProductosOrigen()
    } catch (error) {
      console.error("Error enviando transferencia:", error)
      Swal.fire({
        icon: "error",
        title: "Error al enviar",
        text: error.message || "Ocurrió un error",
      })
    }
  }

  async function completarTransferencia(transferencia) {
    const confirmacion = await Swal.fire({
      title: "¿Completar transferencia?",
      text: "El stock será agregado a la tienda destino",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Completar",
      cancelButtonText: "Cancelar",
    })

    if (!confirmacion.isConfirmed) return

    try {
      // Primero obtener los datos necesarios fuera de la transacción
      const productosDestinoMap = new Map()
      
      for (const item of transferencia.productos) {
        const q = query(
          collection(db, "productos"),
          where("tiendaId", "==", transferencia.destinoTiendaId),
          where("codigo", "==", item.productoId)
        )
        const querySnapshot = await getDocs(q)
        
        if (!querySnapshot.empty) {
          productosDestinoMap.set(item.productoId, {
            id: querySnapshot.docs[0].id,
            stock: querySnapshot.docs[0].data().stock,
          })
        } else {
          productosDestinoMap.set(item.productoId, null)
        }
      }

      await runTransaction(db, async (transaction) => {
        const transferenciaRef = doc(db, "transferencias", transferencia.id)
        const transferenciaSnap = await transaction.get(transferenciaRef)

        if (!transferenciaSnap.exists()) {
          throw "Transferencia no encontrada"
        }

        const transferenciaData = transferenciaSnap.data()

        for (const item of transferenciaData.productos) {
          const productoDestino = productosDestinoMap.get(item.productoId)
          
          if (productoDestino === null) {
            // Si no existe el producto en destino, crearlo
            const nuevoProductoRef = doc(collection(db, "productos"))
            transaction.set(nuevoProductoRef, {
              codigo: item.productoId,
              marca: item.productoNombre,
              modelo: "",
              categoria: "",
              precio: 0,
              stock: item.cantidad,
              tiendaId: transferenciaData.destinoTiendaId,
            })
          } else {
            // Si existe, actualizar el stock
            const productoDestinoRef = doc(db, "productos", productoDestino.id)
            const nuevoStock = productoDestino.stock + item.cantidad
            transaction.update(productoDestinoRef, { stock: nuevoStock })
          }
        }

        transaction.update(transferenciaRef, {
          estado: ESTADOS_TRANSFERENCIA.COMPLETADA,
        })
      })

      Swal.fire({
        icon: "success",
        title: "Transferencia completada",
        timer: 1500,
        showConfirmButton: false,
      })

      cargarTransferencias()
    } catch (error) {
      console.error("Error completando transferencia:", error)
      Swal.fire({
        icon: "error",
        title: "Error al completar",
        text: error.message || "Ocurrió un error",
      })
    }
  }

  async function cancelarTransferencia(transferencia) {
    const confirmacion = await Swal.fire({
      title: "¿Cancelar transferencia?",
      text: "Esta acción no se puede deshacer",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Cancelar",
      cancelButtonText: "No",
      confirmButtonColor: "#ef4444",
    })

    if (!confirmacion.isConfirmed) return

    try {
      await updateDoc(doc(db, "transferencias", transferencia.id), {
        estado: ESTADOS_TRANSFERENCIA.CANCELADA,
      })

      Swal.fire({
        icon: "success",
        title: "Transferencia cancelada",
        timer: 1500,
        showConfirmButton: false,
      })

      cargarTransferencias()
    } catch (error) {
      console.error("Error cancelando transferencia:", error)
      Swal.fire({
        icon: "error",
        title: "Error al cancelar",
      })
    }
  }

  const productosFiltrados = productosOrigen.filter((p) => {
    const nombre = ((p.marca || p.nombre) + " " + (p.modelo || "")).toLowerCase()
    return nombre.includes(busquedaProducto.toLowerCase())
  })

  const estadoColor = {
    pendiente: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
    aprobada: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
    en_transito: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
    completada: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
    rechazada: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
    cancelada: "bg-gray-100 text-gray-800 dark:bg-gray-950 dark:text-gray-300",
  }

  const estadoIcon = {
    pendiente: <Clock size={16} />,
    aprobada: <Check size={16} />,
    en_transito: <Truck size={16} />,
    completada: <Check size={16} />,
    rechazada: <X size={16} />,
    cancelada: <X size={16} />,
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-5xl font-black text-slate-800 dark:text-white">
            Transferencias de Stock
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-3 text-lg">
            Gestiona transferencias entre tiendas
          </p>
        </div>
        <button
          onClick={() => setModalAbierto(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-blue-700 transition"
        >
          <Plus size={20} />
          Nueva Transferencia
        </button>
      </div>

      {/* Lista de Transferencias */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border dark:border-slate-800">
        <h2 className="text-2xl font-bold mb-6 dark:text-white">
          Historial de Transferencias ({transferencias.length})
        </h2>

        {cargando ? (
          <p className="text-slate-500 dark:text-slate-400 text-center py-8">Cargando...</p>
        ) : transferencias.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400 text-center py-8">
            No hay transferencias registradas
          </p>
        ) : (
          <div className="space-y-4">
            {transferencias.map((transferencia) => (
              <div
                key={transferencia.id}
                className="border dark:border-slate-700 rounded-2xl p-5"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span
                        className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${estadoColor[transferencia.estado]}`}
                      >
                        {estadoIcon[transferencia.estado]}
                        {ETIQUETAS_ESTADOS_TRANSFERENCIA[transferencia.estado]}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 text-sm">
                        {transferencia.fechaTexto}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-lg">
                      <span className="font-semibold dark:text-white">
                        {transferencia.origenTiendaNombre}
                      </span>
                      <ArrowRight size={20} className="text-slate-400" />
                      <span className="font-semibold dark:text-white">
                        {transferencia.destinoTiendaNombre}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  {transferencia.productos.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400"
                    >
                      <Package size={16} />
                      <span>{item.productoNombre}</span>
                      <span className="font-semibold">x{item.cantidad}</span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-4 border-t dark:border-slate-700">
                  {transferencia.estado === ESTADOS_TRANSFERENCIA.PENDIENTE && (
                    <>
                      <button
                        onClick={() => aprobarTransferencia(transferencia)}
                        className="flex-1 flex items-center justify-center gap-2 bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 py-2 rounded-xl font-medium hover:bg-blue-200 transition"
                      >
                        <Check size={16} />
                        Aprobar
                      </button>
                      <button
                        onClick={() => cancelarTransferencia(transferencia)}
                        className="flex-1 flex items-center justify-center gap-2 bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 py-2 rounded-xl font-medium hover:bg-red-200 transition"
                      >
                        <X size={16} />
                        Cancelar
                      </button>
                    </>
                  )}

                  {transferencia.estado === ESTADOS_TRANSFERENCIA.APROBADA && (
                    <button
                      onClick={() => enviarTransferencia(transferencia)}
                      className="flex-1 flex items-center justify-center gap-2 bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 py-2 rounded-xl font-medium hover:bg-purple-200 transition"
                    >
                      <Truck size={16} />
                      Enviar
                    </button>
                  )}

                  {transferencia.estado === ESTADOS_TRANSFERENCIA.EN_TRANSITO && (
                    <button
                      onClick={() => completarTransferencia(transferencia)}
                      className="flex-1 flex items-center justify-center gap-2 bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300 py-2 rounded-xl font-medium hover:bg-green-200 transition"
                    >
                      <Check size={16} />
                      Recibir y Completar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Nueva Transferencia */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-lg mx-4">
            <h2 className="text-2xl font-bold mb-6 dark:text-white">
              Nueva Transferencia
            </h2>

            <form onSubmit={crearTransferencia} className="space-y-4">
              <div>
                <label className="text-sm text-slate-500 dark:text-slate-400 block mb-1">
                  Tienda Destino
                </label>
                <select
                  value={destinoTienda}
                  onChange={(e) => setDestinoTienda(e.target.value)}
                  className="w-full p-3 rounded-2xl border dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  required
                >
                  <option value="">Seleccionar tienda</option>
                  {tiendas
                    .filter((t) => t.id !== tiendaActual?.id)
                    .map((tienda) => (
                      <option key={tienda.id} value={tienda.id}>
                        {tienda.nombre}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-sm text-slate-500 dark:text-slate-400 block mb-1">
                  Producto
                </label>
                <div className="relative">
                  <Search
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    value={busquedaProducto}
                    onChange={(e) => setBusquedaProducto(e.target.value)}
                    className="w-full p-3 pl-10 rounded-2xl border dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    placeholder="Buscar producto..."
                  />
                </div>
                {busquedaProducto && productosFiltrados.length > 0 && (
                  <div className="mt-2 max-h-40 overflow-y-auto border dark:border-slate-700 rounded-2xl">
                    {productosFiltrados.map((producto) => (
                      <button
                        key={producto.id}
                        type="button"
                        onClick={() => {
                          setProductoSeleccionado(producto.id)
                          setBusquedaProducto(producto.marca || producto.nombre)
                        }}
                        className="w-full p-3 text-left hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-white transition"
                      >
                        {producto.marca || producto.nombre} - Stock:{" "}
                        {producto.stock}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm text-slate-500 dark:text-slate-400 block mb-1">
                  Cantidad
                </label>
                <input
                  type="number"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  className="w-full p-3 rounded-2xl border dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  placeholder="Cantidad a transferir"
                  min="1"
                  required
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-3 rounded-2xl font-bold hover:bg-blue-700 transition"
                >
                  Crear Transferencia
                </button>
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  className="px-6 py-3 bg-slate-200 dark:bg-slate-700 dark:text-white rounded-2xl font-bold hover:bg-slate-300 transition"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Transferencias
