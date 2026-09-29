import { useCallback, useEffect, useState } from "react"
import Swal from "sweetalert2"
import { AlertTriangle, Plus, Search } from "lucide-react"
import {
  addDoc,
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore"
import { db } from "../firebase"
import { useTienda } from "../context/TiendaContext"
import { useRol } from "../context/RolContext"
import { useProductosLive } from "../context/ProductosLiveContext"
import { registrarMovimiento } from "../utils/movimientos"
import { listarPorTienda, invalidarCacheTienda } from "../utils/consultasTienda"
import { errorOperacion } from "../utils/erroresUi"
import { exportarDanadosExcel } from "../utils/excel"
import AvisoOtraTienda from "../components/AvisoOtraTienda"
import {
  ETIQUETAS_MOTIVO_DANADO,
  MOTIVOS_DANADO,
  TIPOS_MOVIMIENTO,
} from "../constants/inventario"

function nombreProducto(item) {
  const partes = [item.marca, item.categoria, item.modelo].filter((p) => String(p || "").trim())
  return partes.join(" · ") || item.productoNombre || "Producto"
}

function descuentaMotivo(motivo) {
  return motivo === MOTIVOS_DANADO.LLEGO || motivo === MOTIVOS_DANADO.TIENDA
}

function efectoStock(item) {
  if (!item.descuentaStock) return "La venta ya lo bajó"
  return `Bajó ${item.cantidad}`
}

function Danados() {
  const { tiendaActual, esTiendaPropia } = useTienda()
  const { puedeVender, puedeReponerStock } = useRol()
  const { productos, aplicarCambiosStock } = useProductosLive()
  const [lista, setLista] = useState([])
  const [cargando, setCargando] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState("")
  const [productoId, setProductoId] = useState("")
  const [cantidad, setCantidad] = useState("1")
  const [motivo, setMotivo] = useState(MOTIVOS_DANADO.LLEGO)
  const [detalle, setDetalle] = useState("")
  const [guardando, setGuardando] = useState(false)

  const puedeRegistrar = esTiendaPropia && (puedeVender() || puedeReponerStock())

  const cargar = useCallback(async () => {
    if (!tiendaActual?.id) return
    try {
      setCargando(true)
      const data = await listarPorTienda("danados", tiendaActual.id, { force: true })
      data.sort((a, b) => Number(b.fechaMillis || 0) - Number(a.fechaMillis || 0))
      setLista(data)
    } catch (error) {
      errorOperacion(error, "No se pudieron cargar los dañados")
    } finally {
      setCargando(false)
    }
  }, [tiendaActual])

  useEffect(() => {
    cargar()
  }, [cargar])

  function limpiar() {
    setBusqueda("")
    setProductoId("")
    setCantidad("1")
    setMotivo(MOTIVOS_DANADO.LLEGO)
    setDetalle("")
  }

  const producto = productos.find((p) => p.id === productoId)
  const filtrados = productos.filter((p) => {
    const texto = `${p.marca || ""} ${p.categoria || ""} ${p.modelo || ""} ${p.codigo || ""}`.toLowerCase()
    return texto.includes(busqueda.toLowerCase())
  })
  const cantidadNum = Number.parseInt(String(cantidad).trim(), 10)
  const bajaStock = descuentaMotivo(motivo)
  const stockActual = Number(producto?.stock || 0)

  async function guardar(e) {
    e.preventDefault()
    if (!puedeRegistrar || !tiendaActual || guardando) return
    if (!producto) {
      return Swal.fire({ icon: "warning", title: "Falta el producto", text: "Elige un producto de esta tienda" })
    }
    if (!Number.isInteger(cantidadNum) || cantidadNum <= 0) {
      return Swal.fire({ icon: "warning", title: "Cantidad inválida", text: "La cantidad tiene que ser un número entero mayor a 0" })
    }
    if (bajaStock && cantidadNum > stockActual) {
      return Swal.fire({
        icon: "warning",
        title: "Stock insuficiente",
        text: `Solo hay ${stockActual} de ${nombreProducto(producto)} en ${tiendaActual.nombre}`,
      })
    }

    const etiqueta = ETIQUETAS_MOTIVO_DANADO[motivo]
    const confirmar = await Swal.fire({
      title: bajaStock ? "¿Descontar como dañado?" : "¿Anotar la devolución?",
      html: `
        <div style="text-align:left;font-size:14px;line-height:1.6">
          <p><b>Producto:</b> ${nombreProducto(producto)}</p>
          <p><b>Cantidad:</b> ${cantidadNum}</p>
          <p><b>Motivo:</b> ${etiqueta}</p>
          <hr/>
          ${bajaStock
            ? `<p>Se descuentan ${cantidadNum} de <b>${tiendaActual.nombre}</b>. Quedarían ${stockActual - cantidadNum}.</p>`
            : `<p>La venta ya descontó esta pieza. Aquí solo se anota y el stock sigue en ${stockActual}.</p>`
          }
        </div>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: bajaStock ? "Descontar" : "Anotar",
      cancelButtonText: "Volver",
    })
    if (!confirmar.isConfirmed) return

    const base = {
      tiendaId: tiendaActual.id,
      tiendaNombre: tiendaActual.nombre || "",
      productoId: producto.id,
      productoNombre: nombreProducto(producto),
      marca: producto.marca || "",
      categoria: producto.categoria || "",
      modelo: producto.modelo || "",
      codigo: producto.codigo || "",
      cantidad: cantidadNum,
      motivo,
      detalle: detalle.trim(),
      descuentaStock: bajaStock,
      fecha: serverTimestamp(),
      fechaTexto: new Date().toLocaleString("es-PE"),
      fechaMillis: Date.now(),
    }

    try {
      setGuardando(true)
      if (bajaStock) {
        const productoRef = doc(db, "productos", producto.id)
        const danadoRef = doc(collection(db, "danados"))
        let stockAntes = stockActual
        let stockDespues = stockActual - cantidadNum
        await runTransaction(db, async (transaction) => {
          const snap = await transaction.get(productoRef)
          if (!snap.exists()) throw new Error("No se encontró el producto")
          const data = snap.data()
          if (data.tiendaId && data.tiendaId !== tiendaActual.id) {
            throw new Error("Ese producto no es de esta tienda")
          }
          stockAntes = Number(data.stock || 0)
          if (stockAntes < cantidadNum) {
            throw new Error(`Solo hay ${stockAntes} de ${nombreProducto(producto)}`)
          }
          stockDespues = stockAntes - cantidadNum
          transaction.update(productoRef, {
            stock: stockDespues,
            actualizado: serverTimestamp(),
          })
          transaction.set(danadoRef, { ...base, stockAntes, stockDespues })
        })
        await registrarMovimiento({
          tipo: TIPOS_MOVIMIENTO.DANADO,
          productoId: producto.id,
          productoNombre: nombreProducto(producto),
          cantidad: cantidadNum,
          stockAntes,
          stockDespues,
          detalle: `${etiqueta}: ${cantidadNum} × ${nombreProducto(producto)}`,
          tiendaId: tiendaActual.id,
        })
        aplicarCambiosStock([{ id: producto.id, delta: -cantidadNum }])
      } else {
        await addDoc(collection(db, "danados"), {
          ...base,
          stockAntes: stockActual,
          stockDespues: stockActual,
        })
      }

      invalidarCacheTienda("danados", tiendaActual.id)
      setModalAbierto(false)
      limpiar()
      await cargar()
      Swal.fire({
        icon: "success",
        title: bajaStock ? "Stock descontado" : "Devolución anotada",
        timer: 1600,
        showConfirmButton: false,
      })
    } catch (error) {
      errorOperacion(error, "No se pudo guardar")
    } finally {
      setGuardando(false)
    }
  }

  function descargarExcel() {
    if (!lista.length) {
      return Swal.fire({
        icon: "info",
        title: "Sin dañados",
        text: "Todavía no hay filas para el Excel de esta tienda",
      })
    }
    exportarDanadosExcel(
      lista.map((item) => ({
        ...item,
        motivoTexto: ETIQUETAS_MOTIVO_DANADO[item.motivo] || item.motivo || "",
        efectoStock: efectoStock(item),
      })),
      tiendaActual?.nombre || "Tienda"
    )
  }

  return (
    <div className="space-y-8">
      <AvisoOtraTienda />
      <div className="flex justify-between items-center gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-800 dark:text-white break-words">
            Dañados
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-3 text-lg">
            Lo que llega dañado o se malogra se descuenta. Lo que el cliente devuelve ya salió en la venta y solo se anota.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {puedeRegistrar && (
            <button
              type="button"
              onClick={() => { limpiar(); setModalAbierto(true) }}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-blue-700 transition"
            >
              <Plus size={20} />
              Registrar dañado
            </button>
          )}
          <button
            type="button"
            onClick={descargarExcel}
            className="px-6 py-3 rounded-2xl font-bold bg-white dark:bg-slate-900 text-slate-700 dark:text-white border dark:border-slate-700"
          >
            Descargar Excel
          </button>
        </div>
      </div>

      {cargando ? (
        <p className="text-slate-500 dark:text-slate-400">Cargando dañados...</p>
      ) : lista.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center">
          <AlertTriangle className="mx-auto mb-3 text-slate-400" />
          <p className="text-slate-600 dark:text-slate-300 text-lg">Todavía no hay dañados en {(tiendaActual?.nombre || "esta tienda").trim()}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {lista.map((item) => (
            <article key={item.id} className="rounded-3xl border dark:border-slate-700 bg-white dark:bg-slate-900 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-lg dark:text-white">{nombreProducto(item)}</p>
                  <p className="text-sm text-slate-500 mt-1">{item.fechaTexto}</p>
                  {item.detalle ? <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">{item.detalle}</p> : null}
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold px-3 py-1 rounded-full inline-block bg-slate-100 dark:bg-slate-800 dark:text-white">
                    {ETIQUETAS_MOTIVO_DANADO[item.motivo] || item.motivo}
                  </p>
                  <p className="mt-2 font-bold dark:text-white">{item.cantidad} u.</p>
                  <p className="text-sm text-slate-500">{efectoStock(item)}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {modalAbierto && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-3xl p-4 sm:p-6 w-full max-w-lg max-h-[92dvh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6 dark:text-white">Registrar dañado</h2>
            <form onSubmit={guardar} className="space-y-4">
              <div>
                <label className="text-sm text-slate-500 dark:text-slate-400 block mb-1">Producto de {tiendaActual?.nombre}</label>
                <div className="relative">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={busqueda}
                    onChange={(e) => { setBusqueda(e.target.value); setProductoId("") }}
                    className="w-full p-3 pl-10 rounded-2xl border dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    placeholder="Buscar por marca, categoría o modelo..."
                  />
                </div>
                {busqueda && filtrados.length > 0 && (
                  <div className="mt-2 max-h-40 overflow-y-auto border dark:border-slate-700 rounded-2xl">
                    {filtrados.slice(0, 30).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setProductoId(p.id)
                          setBusqueda(nombreProducto(p))
                        }}
                        className={`w-full p-3 text-left hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-white ${productoId === p.id ? "bg-blue-50 dark:bg-blue-950" : ""}`}
                      >
                        <span className="font-medium">{nombreProducto(p)}</span>
                        <span className="block text-xs text-slate-500">Stock: {p.stock}</span>
                      </button>
                    ))}
                  </div>
                )}
                {busqueda && filtrados.length === 0 && (
                  <p className="text-sm text-slate-500 mt-2">No hay ese producto en {tiendaActual?.nombre}.</p>
                )}
              </div>

              {producto && (
                <p className="text-sm dark:text-white">Stock en {tiendaActual?.nombre}: <b>{stockActual}</b></p>
              )}

              <div>
                <label className="text-sm text-slate-500 dark:text-slate-400 block mb-1">Cantidad</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  className="w-full p-3 rounded-2xl border dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  required
                />
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm text-slate-500 dark:text-slate-400 mb-1">Motivo</legend>
                {Object.entries(ETIQUETAS_MOTIVO_DANADO).map(([clave, etiqueta]) => (
                  <label key={clave} className="flex items-center gap-2 dark:text-white">
                    <input
                      type="radio"
                      name="motivo"
                      value={clave}
                      checked={motivo === clave}
                      onChange={() => setMotivo(clave)}
                    />
                    {etiqueta}
                  </label>
                ))}
              </fieldset>

              <div>
                <label className="text-sm text-slate-500 dark:text-slate-400 block mb-1">Detalle</label>
                <input
                  type="text"
                  value={detalle}
                  onChange={(e) => setDetalle(e.target.value)}
                  className="w-full p-3 rounded-2xl border dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  placeholder="Pantalla rayada"
                />
              </div>

              {producto && Number.isInteger(cantidadNum) && cantidadNum > 0 && (
                <div className="rounded-2xl bg-blue-50 dark:bg-blue-950/40 p-4 text-sm dark:text-white">
                  {bajaStock
                    ? `Se descuentan ${cantidadNum} de ${tiendaActual?.nombre}. Quedarían ${Math.max(0, stockActual - cantidadNum)}.`
                    : `La venta ya descontó esta pieza. Aquí solo se anota y el stock sigue en ${stockActual}.`}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={guardando}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-2xl font-bold hover:bg-blue-700 transition disabled:opacity-60"
                >
                  {guardando ? "Guardando..." : bajaStock ? "Descontar" : "Anotar"}
                </button>
                <button
                  type="button"
                  onClick={() => { setModalAbierto(false); limpiar() }}
                  className="px-6 py-3 bg-slate-200 dark:bg-slate-700 dark:text-white rounded-2xl font-bold"
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

export default Danados
