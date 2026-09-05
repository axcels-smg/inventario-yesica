import { useCallback, useEffect, useState } from "react"
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
  runTransaction,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore"
import { db } from "../firebase"
import { useTienda } from "../context/TiendaContext"
import { useProductosLive } from "../context/ProductosLiveContext"
import { registrarMovimiento } from "../utils/movimientos"
import {
  ESTADOS_TRANSFERENCIA,
  ETIQUETAS_ESTADOS_TRANSFERENCIA,
  TIPOS_MOVIMIENTO,
} from "../constants/inventario"
import { claveModeloProducto } from "../utils/productos"
import { errorOperacion } from "../utils/erroresUi"

function nombreExactoProducto(item) {
  const partes = [item.marca, item.categoria, item.modelo].filter((p) => String(p || "").trim())
  const nombre = partes.join(" · ") || item.productoNombre || "Producto"
  if (item.codigo) return `${nombre} (código ${item.codigo})`
  return nombre
}

function resumenTransferencia(transferencia) {
  const items = (transferencia.productos || []).map((item) =>
    `${nombreExactoProducto(item)} × ${item.cantidad}`
  )
  return {
    de: transferencia.origenTiendaNombre || "Tienda origen",
    para: transferencia.destinoTiendaNombre || "Tienda destino",
    items,
    textoItems: items.join("\n"),
  }
}

function Transferencias() {
  const { tiendaPropia: tiendaActual, tiendas } = useTienda()
  const { productosPropios: productosOrigen } = useProductosLive()
  const [transferencias, setTransferencias] = useState([])
  const [modalAbierto, setModalAbierto] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [pestana, setPestana] = useState("enviadas")

  const [destinoTienda, setDestinoTienda] = useState("")
  const [productoSeleccionado, setProductoSeleccionado] = useState("")
  const [cantidad, setCantidad] = useState("")
  const [busquedaProducto, setBusquedaProducto] = useState("")

  const cargarTransferencias = useCallback(async () => {
    if (!tiendaActual) return
    try {
      setCargando(true)
      const [snapEnviadas, snapRecibidas] = await Promise.all([
        getDocs(query(
          collection(db, "transferencias"),
          where("origenTiendaId", "==", tiendaActual.id)
        )),
        getDocs(query(
          collection(db, "transferencias"),
          where("destinoTiendaId", "==", tiendaActual.id)
        )),
      ])

      const mapa = new Map()
      snapEnviadas.forEach((d) => mapa.set(d.id, { id: d.id, ...d.data() }))
      snapRecibidas.forEach((d) => mapa.set(d.id, { id: d.id, ...d.data() }))
      setTransferencias([...mapa.values()])
    } catch (error) {
      console.error("Error cargando transferencias:", error)
    } finally {
      setCargando(false)
    }
  }, [tiendaActual])

  useEffect(() => {
    if (tiendaActual) {
      cargarTransferencias()
    }
  }, [tiendaActual, cargarTransferencias])

  async function crearTransferencia(e) {
    e.preventDefault()

    if (!destinoTienda || !productoSeleccionado || !cantidad) {
      return Swal.fire({ icon: "warning", title: "Campos incompletos", text: "Completa todos los campos" })
    }

    const producto = productosOrigen.find((p) => p.id === productoSeleccionado)
    if (!producto) {
      return Swal.fire({ icon: "warning", title: "Producto no válido", text: "Selecciona un producto de la lista" })
    }

    const cantidadNum = Number(cantidad)
    const destino = tiendas.find((t) => t.id === destinoTienda)

    if (cantidadNum <= 0) {
      return Swal.fire({ icon: "warning", title: "Cantidad inválida", text: "La cantidad debe ser mayor a 0" })
    }

    if (cantidadNum > Number(producto.stock || 0)) {
      return Swal.fire({
        icon: "warning",
        title: "Stock insuficiente",
        text: `Solo hay ${producto.stock} unidades de ${nombreExactoProducto(producto)} en ${tiendaActual.nombre}`,
      })
    }

    const confirmar = await Swal.fire({
      title: "Confirmar transferencia",
      html: `
        <div style="text-align:left;font-size:14px;line-height:1.6">
          <p><b>Producto:</b> ${nombreExactoProducto(producto)}</p>
          <p><b>Cantidad:</b> ${cantidadNum}</p>
          <p><b>De:</b> ${tiendaActual.nombre}</p>
          <p><b>Para:</b> ${destino?.nombre || "tienda destino"}</p>
          <hr/>
          <p>Al <b>enviar</b> se descuentan ${cantidadNum} de <b>${tiendaActual.nombre}</b>.</p>
          <p>Al <b>recibir</b> se agregan ${cantidadNum} en <b>${destino?.nombre || "destino"}</b>.</p>
        </div>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Crear",
      cancelButtonText: "Volver",
    })
    if (!confirmar.isConfirmed) return

    try {
      await addDoc(collection(db, "transferencias"), {
        origenTiendaId: tiendaActual.id,
        origenTiendaNombre: tiendaActual.nombre,
        destinoTiendaId: destinoTienda,
        destinoTiendaNombre: destino?.nombre || "",
        productos: [{
          productoId: producto.id,
          productoNombre: nombreExactoProducto(producto),
          marca: producto.marca || "",
          categoria: producto.categoria || "",
          modelo: producto.modelo || "",
          codigo: producto.codigo || "",
          precio: producto.precio || 0,
          cantidad: cantidadNum,
        }],
        estado: ESTADOS_TRANSFERENCIA.PENDIENTE,
        fecha: serverTimestamp(),
        fechaTexto: new Date().toLocaleString("es-PE"),
        tiendaId: tiendaActual.id,
      })

      Swal.fire({
        icon: "success",
        title: "Transferencia creada",
        text: `${cantidadNum} × ${nombreExactoProducto(producto)} de ${tiendaActual.nombre} hacia ${destino?.nombre}. Aún no se descontó stock: pulsa Enviar.`,
        timer: 2800,
        showConfirmButton: false,
      })
      setModalAbierto(false)
      setDestinoTienda("")
      setProductoSeleccionado("")
      setCantidad("")
      setBusquedaProducto("")
      cargarTransferencias()
    } catch (error) {
      errorOperacion(error, "Error al crear transferencia")
    }
  }

  async function enviarTransferencia(transferencia) {
    const r = resumenTransferencia(transferencia)
    const yaDescontado = transferencia.estado === ESTADOS_TRANSFERENCIA.APROBADA

    const confirmacion = await Swal.fire({
      title: "¿Enviar ahora?",
      html: `
        <div style="text-align:left;font-size:14px;line-height:1.6">
          <p><b>Producto:</b><br/>${r.textoItems.replace(/\n/g, "<br/>")}</p>
          <p><b>De:</b> ${r.de}</p>
          <p><b>Para:</b> ${r.para}</p>
          <hr/>
          <p>${yaDescontado
            ? "El stock ya estaba reservado. Solo se marca como enviado."
            : `Se descontará el stock de <b>${r.de}</b> ahora. En <b>${r.para}</b> se sumará cuando confirmen la recepción.`}</p>
        </div>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Enviar y descontar",
      cancelButtonText: "Cancelar",
    })
    if (!confirmacion.isConfirmed) return

    try {
      await runTransaction(db, async (transaction) => {
        const transRef = doc(db, "transferencias", transferencia.id)
        const transSnap = await transaction.get(transRef)
        if (!transSnap.exists()) throw new Error("Transferencia no encontrada")

        const data = transSnap.data()
        const estado = data.estado
        if (
          estado !== ESTADOS_TRANSFERENCIA.PENDIENTE &&
          estado !== ESTADOS_TRANSFERENCIA.APROBADA
        ) {
          throw new Error("Esta transferencia ya no se puede enviar")
        }

        const lecturas = []
        if (estado === ESTADOS_TRANSFERENCIA.PENDIENTE) {
          for (const item of data.productos) {
            const productoRef = doc(db, "productos", item.productoId)
            const snap = await transaction.get(productoRef)
            lecturas.push({ item, productoRef, snap })
          }
        }

        if (estado === ESTADOS_TRANSFERENCIA.PENDIENTE) {
          for (const { item, productoRef, snap } of lecturas) {
            if (!snap.exists()) throw new Error(`No se encontró ${nombreExactoProducto(item)} en ${r.de}`)
            const stockActual = Number(snap.data().stock || 0)
            if (stockActual < item.cantidad) {
              throw new Error(`Stock insuficiente de ${nombreExactoProducto(item)} en ${r.de}. Hay ${stockActual}, se necesitan ${item.cantidad}`)
            }
            transaction.update(productoRef, {
              stock: stockActual - item.cantidad,
              stockReservado: Math.max(0, Number(snap.data().stockReservado || 0)),
            })
          }
        }

        transaction.update(transRef, {
          estado: ESTADOS_TRANSFERENCIA.EN_TRANSITO,
          fechaEnvio: serverTimestamp(),
        })
      })

      if (!yaDescontado) {
        for (const item of transferencia.productos) {
          await registrarMovimiento({
            tipo: TIPOS_MOVIMIENTO.TRANSFERENCIA_SALIDA,
            productoId: item.productoId,
            productoNombre: nombreExactoProducto(item),
            cantidad: item.cantidad,
            detalle: `Salida: ${item.cantidad} × ${nombreExactoProducto(item)} de ${r.de} hacia ${r.para}`,
            tiendaId: transferencia.origenTiendaId,
          })
        }
      }

      Swal.fire({
        icon: "success",
        title: "Enviado",
        text: yaDescontado
          ? `En camino a ${r.para}.`
          : `Se descontó de ${r.de}. ${r.para} debe confirmar la recepción para que se agregue el stock.`,
        timer: 2500,
        showConfirmButton: false,
      })
      cargarTransferencias()
    } catch (error) {
      errorOperacion(error, "No se pudo enviar")
    }
  }

  async function completarTransferencia(transferencia) {
    const r = resumenTransferencia(transferencia)
    const confirmacion = await Swal.fire({
      title: "¿Confirmar recepción?",
      html: `
        <div style="text-align:left;font-size:14px;line-height:1.6">
          <p><b>Producto:</b><br/>${r.textoItems.replace(/\n/g, "<br/>")}</p>
          <p><b>De:</b> ${r.de}</p>
          <p><b>Para:</b> ${r.para} (esta tienda)</p>
          <hr/>
          <p>Se agregará el stock a <b>${r.para}</b>. Si el producto no existe aquí, se creará con los mismos datos.</p>
        </div>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Recibir y agregar stock",
      cancelButtonText: "Cancelar",
    })
    if (!confirmacion.isConfirmed) return

    try {
      const snapDestino = await getDocs(query(
        collection(db, "productos"),
        where("tiendaId", "==", transferencia.destinoTiendaId)
      ))
      const productosDestino = []
      snapDestino.forEach((d) => productosDestino.push({ id: d.id, ...d.data() }))

      const coincidencias = (transferencia.productos || []).map((item) => {
        const clave = claveModeloProducto(item)
        const encontrado = productosDestino.find((p) => claveModeloProducto(p) === clave)
        return {
          item,
          destinoId: encontrado?.id || null,
          nuevoRef: encontrado ? null : doc(collection(db, "productos")),
        }
      })

      await runTransaction(db, async (transaction) => {
        const transRef = doc(db, "transferencias", transferencia.id)
        const transSnap = await transaction.get(transRef)
        if (!transSnap.exists()) throw new Error("Transferencia no encontrada")
        if (transSnap.data().estado !== ESTADOS_TRANSFERENCIA.EN_TRANSITO) {
          throw new Error("Esta transferencia no está en tránsito")
        }

        const lecturasDestino = []
        for (const c of coincidencias) {
          if (c.destinoId) {
            const ref = doc(db, "productos", c.destinoId)
            const snap = await transaction.get(ref)
            lecturasDestino.push({ ...c, ref, snap })
          } else {
            lecturasDestino.push({ ...c, ref: c.nuevoRef, snap: null })
          }
        }

        for (const c of lecturasDestino) {
          if (c.destinoId) {
            if (!c.snap.exists()) throw new Error(`El producto destino de ${nombreExactoProducto(c.item)} ya no existe`)
            const stockActual = Number(c.snap.data().stock || 0)
            transaction.update(c.ref, { stock: stockActual + c.item.cantidad })
          } else {
            transaction.set(c.ref, {
              marca: c.item.marca || "",
              categoria: c.item.categoria || "",
              modelo: c.item.modelo || "",
              codigo: c.item.codigo || "",
              precio: c.item.precio || 0,
              stock: c.item.cantidad,
              tiendaId: transferencia.destinoTiendaId,
            })
          }
        }

        transaction.update(transRef, {
          estado: ESTADOS_TRANSFERENCIA.COMPLETADA,
          fechaCompletado: serverTimestamp(),
        })
      })

      for (const item of transferencia.productos) {
        await registrarMovimiento({
          tipo: TIPOS_MOVIMIENTO.TRANSFERENCIA_ENTRADA,
          productoId: item.productoId,
          productoNombre: nombreExactoProducto(item),
          cantidad: item.cantidad,
          detalle: `Entrada: ${item.cantidad} × ${nombreExactoProducto(item)} de ${r.de} hacia ${r.para}`,
          tiendaId: transferencia.destinoTiendaId,
        })
      }

      Swal.fire({
        icon: "success",
        title: "Stock agregado",
        text: `${r.textoItems} ya está en ${r.para}.`,
        timer: 2500,
        showConfirmButton: false,
      })
      cargarTransferencias()
    } catch (error) {
      errorOperacion(error, "No se pudo recibir")
    }
  }

  async function cancelarTransferencia(transferencia) {
    const r = resumenTransferencia(transferencia)
    const devolverStock =
      transferencia.estado === ESTADOS_TRANSFERENCIA.APROBADA ||
      transferencia.estado === ESTADOS_TRANSFERENCIA.EN_TRANSITO

    const confirmacion = await Swal.fire({
      title: "¿Cancelar transferencia?",
      html: devolverStock
        ? `<p style="text-align:left">Se devolverá a <b>${r.de}</b>:<br/>${r.textoItems.replace(/\n/g, "<br/>")}</p>`
        : `<p style="text-align:left">Se cancela el envío de:<br/>${r.textoItems.replace(/\n/g, "<br/>")}<br/>De ${r.de} para ${r.para}. El stock no se había descontado.</p>`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, cancelar",
      cancelButtonText: "No",
      confirmButtonColor: "#ef4444",
    })
    if (!confirmacion.isConfirmed) return

    try {
      await runTransaction(db, async (transaction) => {
        const transRef = doc(db, "transferencias", transferencia.id)
        const transSnap = await transaction.get(transRef)
        if (!transSnap.exists()) throw new Error("Transferencia no encontrada")

        const data = transSnap.data()
        const estado = data.estado
        if (
          estado === ESTADOS_TRANSFERENCIA.COMPLETADA ||
          estado === ESTADOS_TRANSFERENCIA.CANCELADA
        ) {
          throw new Error("Esta transferencia ya no se puede cancelar")
        }

        const hayQueDevolver =
          estado === ESTADOS_TRANSFERENCIA.APROBADA ||
          estado === ESTADOS_TRANSFERENCIA.EN_TRANSITO

        const lecturas = []
        if (hayQueDevolver) {
          for (const item of data.productos) {
            const productoRef = doc(db, "productos", item.productoId)
            const snap = await transaction.get(productoRef)
            lecturas.push({ item, productoRef, snap })
          }
        }

        if (hayQueDevolver) {
          for (const { item, productoRef, snap } of lecturas) {
            if (snap.exists()) {
              const stockActual = Number(snap.data().stock || 0)
              const reservado = Number(snap.data().stockReservado || 0)
              transaction.update(productoRef, {
                stock: stockActual + item.cantidad,
                stockReservado: Math.max(0, reservado - item.cantidad),
              })
            }
          }
        }

        transaction.update(transRef, { estado: ESTADOS_TRANSFERENCIA.CANCELADA })
      })

      Swal.fire({
        icon: "success",
        title: "Transferencia cancelada",
        text: devolverStock ? `Stock devuelto a ${r.de}.` : "No se movió stock.",
        timer: 2000,
        showConfirmButton: false,
      })
      cargarTransferencias()
    } catch (error) {
      errorOperacion(error, "Error al cancelar")
    }
  }

  const productoElegido = productosOrigen.find((p) => p.id === productoSeleccionado)
  const destinoElegido = tiendas.find((t) => t.id === destinoTienda)

  const productosFiltrados = productosOrigen.filter((p) => {
    const nombre = `${p.marca || ""} ${p.categoria || ""} ${p.modelo || ""} ${p.codigo || ""}`.toLowerCase()
    return nombre.includes(busquedaProducto.toLowerCase())
  })

  const transferenciasEnviadas = transferencias.filter((t) => t.origenTiendaId === tiendaActual?.id)
  const transferenciasRecibidas = transferencias.filter((t) => t.destinoTiendaId === tiendaActual?.id)
  const listaVisible = pestana === "enviadas" ? transferenciasEnviadas : transferenciasRecibidas

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
      <div className="flex justify-between items-center gap-4 flex-wrap">
        <div>
          <h1 className="text-5xl font-black text-slate-800 dark:text-white">
            Transferencias de Stock
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-3 text-lg">
            Envías un producto de tu tienda a otra: al enviar se descuenta, al recibir se agrega.
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

      <div className="flex gap-3">
        {[
          { key: "enviadas", label: `Enviadas (${transferenciasEnviadas.length})` },
          { key: "recibidas", label: `Recibidas (${transferenciasRecibidas.length})` },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setPestana(key)}
            className={`px-5 py-2 rounded-2xl font-semibold transition ${
              pestana === key
                ? "bg-blue-600 text-white"
                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border dark:border-slate-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border dark:border-slate-800">
        {cargando ? (
          <p className="text-slate-500 dark:text-slate-400 text-center py-8">Cargando...</p>
        ) : listaVisible.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400 text-center py-8">
            No hay transferencias {pestana === "enviadas" ? "enviadas" : "recibidas"}
          </p>
        ) : (
          <div className="space-y-4">
            {listaVisible.map((transferencia) => {
              const r = resumenTransferencia(transferencia)
              return (
              <div key={transferencia.id} className="border dark:border-slate-700 rounded-2xl p-5">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <span className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${estadoColor[transferencia.estado]}`}>
                    {estadoIcon[transferencia.estado]}
                    {ETIQUETAS_ESTADOS_TRANSFERENCIA[transferencia.estado]}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 text-sm">
                    {transferencia.fechaTexto}
                  </span>
                </div>

                <div className="grid md:grid-cols-3 gap-4 mb-4">
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">De (origen)</p>
                    <p className="font-semibold dark:text-white">{r.de}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3 flex items-center gap-2">
                    <ArrowRight className="text-slate-400 shrink-0" size={18} />
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Para (destino)</p>
                      <p className="font-semibold dark:text-white">{r.para}</p>
                    </div>
                  </div>
                  <div className="rounded-xl bg-blue-50 dark:bg-blue-950/40 p-3">
                    <p className="text-xs uppercase tracking-wide text-blue-700 dark:text-blue-300 mb-1">Stock</p>
                    <p className="text-sm dark:text-white">
                      {transferencia.estado === ESTADOS_TRANSFERENCIA.PENDIENTE && "Aún no se movió"}
                      {transferencia.estado === ESTADOS_TRANSFERENCIA.APROBADA && `Reservado / descontado en ${r.de}`}
                      {transferencia.estado === ESTADOS_TRANSFERENCIA.EN_TRANSITO && `Descontado en ${r.de}. Falta agregar en ${r.para}`}
                      {transferencia.estado === ESTADOS_TRANSFERENCIA.COMPLETADA && `Descontado en ${r.de} y agregado en ${r.para}`}
                      {transferencia.estado === ESTADOS_TRANSFERENCIA.CANCELADA && "Cancelada"}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  {(transferencia.productos || []).map((item, idx) => (
                    <div key={idx} className="flex flex-wrap items-center gap-3 text-sm border dark:border-slate-700 rounded-xl px-3 py-2">
                      <Package size={16} className="text-blue-500" />
                      <span className="font-semibold dark:text-white">{nombreExactoProducto(item)}</span>
                      <span className="ml-auto bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg font-bold dark:text-white">
                        {item.cantidad} unidades
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-4 border-t dark:border-slate-700 flex-wrap">
                  {transferencia.origenTiendaId === tiendaActual?.id && (
                    <>
                      {(transferencia.estado === ESTADOS_TRANSFERENCIA.PENDIENTE ||
                        transferencia.estado === ESTADOS_TRANSFERENCIA.APROBADA) && (
                        <>
                          <button
                            onClick={() => enviarTransferencia(transferencia)}
                            className="flex-1 flex items-center justify-center gap-2 bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 py-2 rounded-xl font-medium hover:bg-purple-200 transition"
                          >
                            <Truck size={16} /> Enviar (descontar de {r.de})
                          </button>
                          <button
                            onClick={() => cancelarTransferencia(transferencia)}
                            className="flex-1 flex items-center justify-center gap-2 bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 py-2 rounded-xl font-medium hover:bg-red-200 transition"
                          >
                            <X size={16} /> Cancelar
                          </button>
                        </>
                      )}
                      {transferencia.estado === ESTADOS_TRANSFERENCIA.EN_TRANSITO && (
                        <button
                          onClick={() => cancelarTransferencia(transferencia)}
                          className="flex-1 flex items-center justify-center gap-2 bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 py-2 rounded-xl font-medium hover:bg-red-200 transition"
                        >
                          <X size={16} /> Cancelar y devolver stock
                        </button>
                      )}
                    </>
                  )}

                  {transferencia.destinoTiendaId === tiendaActual?.id &&
                    transferencia.estado === ESTADOS_TRANSFERENCIA.EN_TRANSITO && (
                      <button
                        onClick={() => completarTransferencia(transferencia)}
                        className="flex-1 flex items-center justify-center gap-2 bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300 py-2 rounded-xl font-medium hover:bg-green-200 transition"
                      >
                        <Check size={16} /> Recibir (agregar a {r.para})
                      </button>
                    )}
                </div>
              </div>
              )
            })}
          </div>
        )}
      </div>

      {modalAbierto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6 dark:text-white">Nueva Transferencia</h2>

            <form onSubmit={crearTransferencia} className="space-y-4">
              <div>
                <label className="text-sm text-slate-500 dark:text-slate-400 block mb-1">De (tu tienda)</label>
                <div className="w-full p-3 rounded-2xl border dark:border-slate-700 bg-slate-100 dark:bg-slate-800 dark:text-white font-semibold">
                  {tiendaActual?.nombre}
                </div>
              </div>

              <div>
                <label className="text-sm text-slate-500 dark:text-slate-400 block mb-1">Para (tienda destino)</label>
                <select
                  value={destinoTienda}
                  onChange={(e) => setDestinoTienda(e.target.value)}
                  className="w-full p-3 rounded-2xl border dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  required
                >
                  <option value="">Seleccionar tienda</option>
                  {tiendas.filter((t) => t.id !== tiendaActual?.id).map((tienda) => (
                    <option key={tienda.id} value={tienda.id}>{tienda.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm text-slate-500 dark:text-slate-400 block mb-1">Producto exacto</label>
                <div className="relative">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={busquedaProducto}
                    onChange={(e) => { setBusquedaProducto(e.target.value); setProductoSeleccionado("") }}
                    className="w-full p-3 pl-10 rounded-2xl border dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    placeholder="Buscar por marca, categoría o modelo..."
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
                          setBusquedaProducto(nombreExactoProducto(producto))
                        }}
                        className={`w-full p-3 text-left hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-white transition ${productoSeleccionado === producto.id ? "bg-blue-50 dark:bg-blue-950" : ""}`}
                      >
                        <span className="font-medium">{nombreExactoProducto(producto)}</span>
                        <span className="block text-xs text-slate-500">Stock disponible: {producto.stock}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm text-slate-500 dark:text-slate-400 block mb-1">Cantidad</label>
                <input
                  type="number"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  className="w-full p-3 rounded-2xl border dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  placeholder="Cuántas unidades enviar"
                  min="1"
                  required
                />
              </div>

              {productoElegido && destinoElegido && cantidad && (
                <div className="rounded-2xl bg-blue-50 dark:bg-blue-950/40 p-4 text-sm dark:text-white">
                  <p className="font-bold mb-2">Resumen</p>
                  <p>Producto: <b>{nombreExactoProducto(productoElegido)}</b></p>
                  <p>Cantidad: <b>{cantidad}</b></p>
                  <p>De: <b>{tiendaActual?.nombre}</b> → Para: <b>{destinoElegido.nombre}</b></p>
                  <p className="mt-2 text-slate-600 dark:text-slate-300">
                    Al enviar se descuentan {cantidad} en {tiendaActual?.nombre}. Al recibir se agregan {cantidad} en {destinoElegido.nombre}.
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button type="submit" className="flex-1 bg-blue-600 text-white py-3 rounded-2xl font-bold hover:bg-blue-700 transition">
                  Crear Transferencia
                </button>
                <button
                  type="button"
                  onClick={() => { setModalAbierto(false); setDestinoTienda(""); setProductoSeleccionado(""); setCantidad(""); setBusquedaProducto("") }}
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
