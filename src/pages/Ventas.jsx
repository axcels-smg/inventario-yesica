import { useEffect, useMemo, useRef, useState } from "react"
import Swal from "sweetalert2"
import { Minus, PackageSearch, Plus, Trash2, UserPlus } from "lucide-react"

import {
  addDoc,
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore"

import { db } from "../firebase"
import { formatearNumeroBoleta } from "../utils/boleta"
import { enlaceWhatsAppTexto, textoReciboVenta } from "../utils/reciboCliente"
import { registrarMovimiento } from "../utils/movimientos"
import { TIPOS_MOVIMIENTO } from "../constants/inventario"
import { useTienda } from "../context/TiendaContext"
import { useRol } from "../context/RolContext"
import { useProductosLive } from "../context/ProductosLiveContext"
import { useOperacionesLive } from "../context/OperacionesLiveContext"
import { invalidarCacheTienda } from "../utils/consultasTienda"
import { errorOperacion } from "../utils/erroresUi"
import { sincronizarCicloDescuentos } from "../utils/reportePantallas"
import { conReintentoCuota } from "../utils/firestoreLive"
import AvisoOtraTienda from "../components/AvisoOtraTienda"

import {
  filtrarProductos,
  obtenerValoresUnicos,
  MIN_CARACTERES_BUSQUEDA,
  MAX_RESULTADOS_VENTAS,
} from "../utils/productos"

function Ventas() {
  const { tiendaActual, esTiendaPropia } = useTienda()
  const { puedeVender, puedeCrearClientes } = useRol()
  const { productos, aplicarCambiosStock, cargando: cargandoProductos } = useProductosLive()
  const { clientes, setClientes } = useOperacionesLive()

  const [clienteSeleccionado, setClienteSeleccionado] = useState("")
  const [busquedaCliente, setBusquedaCliente] = useState("")
  const [mostrarNuevoCliente, setMostrarNuevoCliente] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState("")
  const [nuevoTelefono, setNuevoTelefono] = useState("")
  const [nuevoCorreo, setNuevoCorreo] = useState("")
  const [guardandoCliente, setGuardandoCliente] = useState(false)
  const [carrito, setCarrito] = useState([])
  const [busquedaProducto, setBusquedaProducto] = useState("")
  const [filtroMarca, setFiltroMarca] = useState("")
  const [filtroCategoria, setFiltroCategoria] = useState("")
  const [vendiendo, setVendiendo] = useState(false)
  const vendiendoRef = useRef(false)

  useEffect(() => {
    setCarrito([])
    setClienteSeleccionado("")
    setBusquedaCliente("")
  }, [tiendaActual?.id])

  useEffect(() => {
    setCarrito((items) => {
      let cambio = false
      const next = []
      for (const item of items) {
        const p = productos.find((x) => x.id === item.id)
        if (!p) {
          cambio = true
          continue
        }
        const stock = Number(p.stock) || 0
        if (stock <= 0) {
          cambio = true
          continue
        }
        const cantidad =
          item.cantidad === "" ? "" : Math.min(Number(item.cantidad) || 1, stock)
        if (
          cantidad !== item.cantidad ||
          Number(p.precio) !== Number(item.precio)
        ) {
          cambio = true
          next.push({ ...item, cantidad, precio: p.precio, stock })
        } else {
          next.push(item)
        }
      }
      return cambio ? next : items
    })
  }, [productos])

  const clientesFiltrados = useMemo(() => {
    const q = busquedaCliente.trim().toLowerCase()
    let lista = clientes
    if (q) {
      lista = clientes.filter((c) =>
        `${c.nombre || ""} ${c.telefono || ""} ${c.correo || ""}`
          .toLowerCase()
          .includes(q)
      )
    }
    if (clienteSeleccionado && !lista.some((c) => c.id === clienteSeleccionado)) {
      const extra = clientes.find((c) => c.id === clienteSeleccionado)
      if (extra) lista = [extra, ...lista]
    }
    return lista
  }, [clientes, busquedaCliente, clienteSeleccionado])

  async function agregarClienteRapido(e) {
    e.preventDefault()
    if (!tiendaActual || !puedeCrearClientes()) return
    if (guardandoCliente) return

    const nombreLimpio = nuevoNombre.trim()
    const telefonoLimpio = nuevoTelefono.trim()
    const correoLimpio = nuevoCorreo.trim()

    if (!nombreLimpio || !telefonoLimpio) {
      Swal.fire({
        icon: "warning",
        title: "Completa nombre y teléfono",
      })
      return
    }

    setGuardandoCliente(true)
    try {
      const docRef = await addDoc(collection(db, "clientes"), {
        nombre: nombreLimpio,
        telefono: telefonoLimpio,
        correo: correoLimpio,
        direccion: "",
        fecha: serverTimestamp(),
        fechaTexto: new Date().toLocaleString("es-PE"),
        tiendaId: tiendaActual.id,
      })

      const nuevo = {
        id: docRef.id,
        nombre: nombreLimpio,
        telefono: telefonoLimpio,
        correo: correoLimpio,
        direccion: "",
        tiendaId: tiendaActual.id,
      }

      setClientes((lista) =>
        [...lista, nuevo].sort((a, b) =>
          String(a.nombre || "").localeCompare(String(b.nombre || ""))
        )
      )
      setClienteSeleccionado(docRef.id)
      setBusquedaCliente("")
      setNuevoNombre("")
      setNuevoTelefono("")
      setNuevoCorreo("")
      setMostrarNuevoCliente(false)
      invalidarCacheTienda("clientes", tiendaActual.id)

      Swal.fire({
        icon: "success",
        title: "Cliente listo para la venta",
        timer: 1400,
        showConfirmButton: false,
      })
    } catch (error) {
      errorOperacion(error, "Error al agregar cliente")
    } finally {
      setGuardandoCliente(false)
    }
  }

  function obtenerStockProducto(id) {
    const producto = productos.find((p) => p.id === id)
    return Number(producto?.stock || 0)
  }

  function agregarAlCarrito(producto) {
    const stockProducto = Number(producto.stock)

    if (stockProducto <= 0) {
      Swal.fire({
        icon: "error",
        title: "Sin stock",
      })
      return
    }

    const existe = carrito.find((item) => item.id === producto.id)

    if (existe) {
      aumentarCantidad(producto.id)
      return
    }

    setCarrito([
      ...carrito,
      { ...producto, cantidad: 1 },
    ])
  }

  function aumentarCantidad(id) {
    const stockProducto = obtenerStockProducto(id)

    setCarrito((items) =>
      items.map((item) => {
        if (item.id !== id) return item

        if (item.cantidad >= stockProducto) {
          Swal.fire({
            icon: "warning",
            title: "Stock máximo alcanzado",
          })
          return item
        }

        return {
          ...item,
          cantidad: item.cantidad + 1,
        }
      })
    )
  }

  function disminuirCantidad(id) {
    setCarrito((items) =>
      items
        .map((item) => {
          if (item.id !== id) return item

          return {
            ...item,
            cantidad: item.cantidad - 1,
          }
        })
        .filter((item) => item.cantidad > 0)
    )
  }

  function cambiarCantidad(id, valor) {
    if (!/^\d*$/.test(valor)) return

    const cantidad = Number(valor)
    const stockProducto = obtenerStockProducto(id)

    setCarrito((items) =>
      items.map((item) => {
        if (item.id !== id) return item

        if (valor === "") {
          return {
            ...item,
            cantidad: "",
          }
        }

        return {
          ...item,
          cantidad: Math.min(cantidad, stockProducto),
        }
      })
    )
  }

  function normalizarCantidad(id) {
    setCarrito((items) =>
      items
        .map((item) => {
          if (item.id !== id) return item

          return {
            ...item,
            cantidad: Number(item.cantidad) || 1,
          }
        })
        .filter((item) => item.cantidad > 0)
    )
  }

  function eliminarDelCarrito(id) {
    setCarrito(carrito.filter((i) => i.id !== id))
  }

  const total = carrito.reduce(
    (acc, item) => acc + Number(item.precio) * Number(item.cantidad || 0),
    0
  )

  async function finalizarVenta() {
    if (vendiendoRef.current) return

    const clienteData = clientes.find((c) => c.id === clienteSeleccionado)

    if (!clienteSeleccionado || !clienteData) {
      return Swal.fire({
        icon: "warning",
        title: "Selecciona cliente",
        text: "Elige un cliente de la lista o agrégalo antes de vender.",
      })
    }

    if (carrito.length === 0) {
      return Swal.fire({
        icon: "warning",
        title: "Carrito vacío",
      })
    }

    const carritoValido = carrito.every((item) =>
      Number.isInteger(Number(item.cantidad)) && Number(item.cantidad) > 0
    )

    if (!carritoValido) {
      return Swal.fire({
        icon: "warning",
        title: "Revisa las cantidades",
      })
    }

    const sinPrecio = carrito.filter((item) => !(Number(item.precio) > 0))
    if (sinPrecio.length > 0) {
      const sigue = await Swal.fire({
        icon: "warning",
        title: "Hay productos a S/ 0",
        text: "El total de la boleta puede quedar en cero. ¿Vender igual?",
        showCancelButton: true,
        confirmButtonText: "Vender igual",
        cancelButtonText: "Cancelar",
      })
      if (!sigue.isConfirmed) return
    }

    const confirmacion = await Swal.fire({
      title: "¿Finalizar venta?",
      text: `Total S/ ${total}`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Finalizar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#16a34a",
    })

    if (!confirmacion.isConfirmed) return
    if (vendiendoRef.current) return

    vendiendoRef.current = true
    setVendiendo(true)

    try {
      const productosVenta = carrito.map((item) => ({
        id: item.id,
        codigo: item.codigo || "",
        marca: item.marca || "",
        modelo: item.modelo || "",
        categoria: item.categoria || "",
        precio: Number(item.precio) || 0,
        cantidad: Number(item.cantidad),
      }))

      const ventaRef = doc(collection(db, "ventas"))
      const contadorRef = doc(db, "config", `boleta_${tiendaActual.id}`)
      let numeroBoleta = 0
      let movimientosPendientes = []

      await conReintentoCuota(async () => {
        await runTransaction(db, async (transaction) => {
        movimientosPendientes = []
        const productosActuales = []

        const contadorSnap = await transaction.get(contadorRef)
        numeroBoleta = contadorSnap.exists()
          ? Number(contadorSnap.data().numeroBoleta || 0) + 1
          : 1

        for (const item of productosVenta) {
          const productoRef = doc(db, "productos", item.id)
          const productoSnap = await transaction.get(productoRef)

          if (!productoSnap.exists()) {
            throw new Error(`El producto ${item.marca} ya no existe`)
          }

          const productoActual = productoSnap.data()
          if (productoActual.tiendaId && productoActual.tiendaId !== tiendaActual.id) {
            throw new Error(`${item.marca} no pertenece a esta tienda`)
          }
          const stockActual = Number(productoActual.stock)

          if (!Number.isFinite(stockActual)) {
            throw new Error(`Stock inválido para ${item.marca}`)
          }

          if (stockActual < item.cantidad) {
            throw new Error(`Stock insuficiente para ${item.marca}`)
          }

          productosActuales.push({
            ref: productoRef,
            stock: stockActual,
            item,
          })

          movimientosPendientes.push({
            productoId: item.id,
            productoNombre: `${item.marca} ${item.modelo}`.trim(),
            cantidad: item.cantidad,
            stockAntes: stockActual,
            stockDespues: stockActual - item.cantidad,
          })
        }

        transaction.set(contadorRef, { numeroBoleta }, { merge: true })

        productosActuales.forEach(({ ref, stock, item }) => {
          transaction.update(ref, {
            stock: stock - item.cantidad,
            actualizado: serverTimestamp(),
          })
        })

        transaction.set(ventaRef, {
          cliente: clienteData.nombre || "",
          clienteId: clienteData.id || "",
          telefono: clienteData.telefono || "",
          correo: clienteData.correo || "",
          productos: productosVenta,
          total,
          numeroBoleta,
          fecha: serverTimestamp(),
          fechaTexto: new Date().toLocaleString("es-PE"),
          tiendaId: tiendaActual.id,
        })
        })
      })

      for (const mov of movimientosPendientes) {
        await registrarMovimiento({
          tipo: TIPOS_MOVIMIENTO.VENTA,
          ...mov,
          ventaId: ventaRef.id,
          numeroBoleta: formatearNumeroBoleta(numeroBoleta),
          cliente: clienteData.nombre || "",
          detalle: `Venta boleta #${formatearNumeroBoleta(numeroBoleta)}`,
          tiendaId: tiendaActual.id,
        })
      }

      const ventaHecha = {
        numeroBoleta,
        fechaTexto: new Date().toLocaleString("es-PE"),
        cliente: clienteData.nombre || "",
        telefono: clienteData.telefono || "",
        productos: productosVenta,
        total,
      }

      setCarrito([])
      setClienteSeleccionado("")
      aplicarCambiosStock(
        movimientosPendientes.map((mov) => ({
          id: mov.productoId,
          stock: mov.stockDespues,
        }))
      )
      invalidarCacheTienda("ventas", tiendaActual.id)
      invalidarCacheTienda("productos", tiendaActual.id)
      sincronizarCicloDescuentos(tiendaActual.id, tiendaActual.nombre).catch(() => {})

      const envio = await Swal.fire({
        icon: "success",
        title: "Venta realizada",
        text: `Boleta #${formatearNumeroBoleta(numeroBoleta)} — Total S/ ${Number(total).toFixed(2)}`,
        showCancelButton: true,
        confirmButtonText: "Enviar recibo por WhatsApp",
        cancelButtonText: "Cerrar",
        confirmButtonColor: "#16a34a",
      })

      if (envio.isConfirmed) {
        window.open(
          enlaceWhatsAppTexto(textoReciboVenta(ventaHecha, tiendaActual), clienteData.telefono),
          "_blank"
        )
      }

    } catch (error) {
      errorOperacion(error, "Error al vender")
    } finally {
      vendiendoRef.current = false
      setVendiendo(false)
    }
  }

  const marcas = obtenerValoresUnicos(productos, "marca")
  const categorias = obtenerValoresUnicos(productos, "categoria")

  const busquedaLista = busquedaProducto.trim().length >= MIN_CARACTERES_BUSQUEDA

  const productosFiltrados = filtrarProductos(productos, {
    busqueda: busquedaLista ? busquedaProducto : "",
    marca: filtroMarca,
    categoria: filtroCategoria,
  })

  const totalCoincidencias = busquedaLista ? productosFiltrados.length : 0

  const productosMostrar = busquedaLista
    ? productosFiltrados.slice(0, MAX_RESULTADOS_VENTAS)
    : []

  const hayMasResultados = totalCoincidencias > MAX_RESULTADOS_VENTAS

  if (!esTiendaPropia || !puedeVender()) {
    return <AvisoOtraTienda modo="bloqueo" />
  }

  return (
    <div className="space-y-8">

      <div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-800 dark:text-white break-words">
          Ventas
        </h1>

        <p className="text-slate-500 dark:text-slate-400 mt-2">
          Busca por código, marca o modelo (mín. {MIN_CARACTERES_BUSQUEDA} letras).
          Catálogo: {productos.length} productos.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 min-w-0">

          <div className="flex flex-col gap-4 mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold dark:text-white">
              Buscar producto
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select
                value={filtroMarca}
                onChange={(e) => setFiltroMarca(e.target.value)}
                className="p-3 rounded-2xl border dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                <option value="">Todas las marcas</option>
                {marcas.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>

              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                className="p-3 rounded-2xl border dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                <option value="">Todas las categorías</option>
                {categorias.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="relative">
              <PackageSearch
                className="absolute left-4 top-4 text-slate-400"
                size={20}
              />

              <input
                value={busquedaProducto}
                onChange={(e) => setBusquedaProducto(e.target.value)}
                placeholder="Código, marca, modelo..."
                className="w-full pl-12 pr-4 py-4 rounded-2xl border dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>

            {busquedaLista && totalCoincidencias > 0 && (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Mostrando {productosMostrar.length} de {totalCoincidencias} resultados
                {hayMasResultados && " (refina la búsqueda para ver más exacto)"}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-4 max-h-[520px] overflow-y-auto">

            {cargandoProductos && (
              <p className="text-slate-500 dark:text-slate-400 text-center py-8">
                Cargando catálogo...
              </p>
            )}

            {!cargandoProductos && !busquedaLista && (
              <div className="text-center py-10 text-slate-500 dark:text-slate-400 border border-dashed dark:border-slate-700 rounded-2xl">
                <PackageSearch className="mx-auto mb-3 opacity-40" size={40} />
                <p className="font-medium dark:text-white">Escribe para buscar un producto</p>
                <p className="text-sm mt-1 dark:text-slate-300">
                  Mínimo {MIN_CARACTERES_BUSQUEDA} caracteres
                </p>
              </div>
            )}

            {!cargandoProductos && busquedaLista && productosMostrar.length === 0 && (
              <p className="text-slate-500 dark:text-slate-400 text-center py-8">
                No se encontraron productos
              </p>
            )}

            {productosMostrar.map((p) => (
              <div
                key={p.id}
                className="border dark:border-slate-700 rounded-2xl p-5 flex flex-col sm:flex-row sm:justify-between gap-4"
              >

                <div>
                  {p.codigo && (
                    <p className="text-xs font-mono text-blue-600 dark:text-blue-400 mb-1">
                      {p.codigo}
                    </p>
                  )}

                  <h3 className="font-bold dark:text-white">
                    {p.marca}
                  </h3>

                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {p.categoria}
                  </p>

                  <p className="text-sm dark:text-slate-300">{p.modelo}</p>

                  <p className="font-bold mt-2 dark:text-white">
                    S/ {p.precio}
                  </p>

                  <p className="text-sm text-slate-400 dark:text-slate-500">
                    Stock: {p.stock}
                  </p>
                </div>

                <button
                  onClick={() => agregarAlCarrito(p)}
                  disabled={Number(p.stock) <= 0}
                  className={`px-4 py-3 rounded-xl text-white self-start sm:self-center ${
                    Number(p.stock) <= 0
                      ? "bg-slate-400"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {Number(p.stock) <= 0 ? "Sin stock" : "Agregar"}
                </button>

              </div>
            ))}

          </div>

        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 min-w-0">

          <h2 className="text-2xl sm:text-3xl font-bold mb-6 dark:text-white">
            Carrito
          </h2>

          <div className="mb-6 space-y-3">
            <input
              value={busquedaCliente}
              onChange={(e) => setBusquedaCliente(e.target.value)}
              placeholder="Buscar cliente por nombre o teléfono..."
              className="w-full p-4 rounded-2xl border dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />

            <select
              value={clienteSeleccionado}
              onChange={(e) => setClienteSeleccionado(e.target.value)}
              className="w-full p-4 rounded-2xl border dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            >
              <option value="">Selecciona cliente</option>

              {clientesFiltrados.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}{c.telefono ? ` · ${c.telefono}` : ""}
                </option>
              ))}
            </select>

            {clientes.length === 0 && (
              <p className="text-sm text-amber-700 dark:text-amber-300">
                No hay clientes en esta tienda. Agrégalo aquí para poder vender.
              </p>
            )}

            {busquedaCliente.trim() && clientesFiltrados.length === 0 && clientes.length > 0 && (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Ningún cliente coincide con la búsqueda.
              </p>
            )}

            {puedeCrearClientes() && (
              <>
                <button
                  type="button"
                  onClick={() => setMostrarNuevoCliente((v) => !v)}
                  className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium"
                >
                  <UserPlus size={18} />
                  {mostrarNuevoCliente ? "Cerrar formulario" : "Agregar cliente"}
                </button>

                {mostrarNuevoCliente && (
                  <form onSubmit={agregarClienteRapido} className="grid grid-cols-1 gap-3 border dark:border-slate-700 rounded-2xl p-4">
                    <input
                      value={nuevoNombre}
                      onChange={(e) => setNuevoNombre(e.target.value)}
                      placeholder="Nombre"
                      className="p-3 rounded-xl border dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />
                    <input
                      value={nuevoTelefono}
                      onChange={(e) => setNuevoTelefono(e.target.value)}
                      placeholder="Teléfono"
                      className="p-3 rounded-xl border dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />
                    <input
                      value={nuevoCorreo}
                      onChange={(e) => setNuevoCorreo(e.target.value)}
                      placeholder="Correo (opcional)"
                      className="p-3 rounded-xl border dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />
                    <button
                      type="submit"
                      disabled={guardandoCliente}
                      className={`text-white py-3 rounded-xl font-bold ${
                        guardandoCliente ? "bg-slate-400" : "bg-blue-600 hover:bg-blue-700"
                      }`}
                    >
                      {guardandoCliente ? "Guardando..." : "Guardar y seleccionar"}
                    </button>
                  </form>
                )}
              </>
            )}
          </div>

          <div className="flex flex-col gap-4">

            {carrito.length === 0 && (
              <p className="text-slate-500 dark:text-slate-400 text-center">
                Agrega productos para iniciar una venta
              </p>
            )}

            {carrito.map((item) => (
              <div key={item.id} className="border dark:border-slate-700 p-4 rounded-2xl flex flex-col gap-4">

                <div className="flex justify-between gap-4">
                  <div>
                    <p className="font-bold dark:text-white">{item.marca}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{item.modelo}</p>
                    {item.codigo && (
                      <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">{item.codigo}</p>
                    )}
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Stock: {obtenerStockProducto(item.id)}
                    </p>
                  </div>

                  <button
                    onClick={() => eliminarDelCarrito(item.id)}
                    className="bg-red-500 text-white w-11 h-11 rounded-xl flex items-center justify-center"
                    aria-label="Eliminar producto"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => disminuirCantidad(item.id)}
                      className="bg-slate-200 dark:bg-slate-800 dark:text-white w-10 h-10 rounded-xl flex items-center justify-center"
                      aria-label="Restar cantidad"
                    >
                      <Minus size={18} />
                    </button>

                    <input
                      value={item.cantidad}
                      onChange={(e) => cambiarCantidad(item.id, e.target.value)}
                      onBlur={() => normalizarCantidad(item.id)}
                      inputMode="numeric"
                      className="w-20 text-center p-3 rounded-xl border dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />

                    <button
                      onClick={() => aumentarCantidad(item.id)}
                      className="bg-slate-200 dark:bg-slate-800 dark:text-white w-10 h-10 rounded-xl flex items-center justify-center"
                      aria-label="Sumar cantidad"
                    >
                      <Plus size={18} />
                    </button>
                  </div>

                  <p className="font-bold dark:text-white">
                    Subtotal: S/ {Number(item.precio) * Number(item.cantidad || 0)}
                  </p>
                </div>

              </div>
            ))}

          </div>

          <div className="mt-6 border-t dark:border-slate-700 pt-4">

            <h2 className="text-3xl font-black dark:text-white">
              Total: S/ {total}
            </h2>

            <button
              onClick={finalizarVenta}
              disabled={vendiendo}
              className={`w-full mt-4 text-white py-4 rounded-2xl ${
                vendiendo ? "bg-slate-400" : "bg-green-600 hover:bg-green-700"
              }`}
            >
              {vendiendo ? "Procesando..." : "Finalizar Venta"}
            </button>

          </div>

        </div>

      </div>

    </div>
  )
}

export default Ventas
