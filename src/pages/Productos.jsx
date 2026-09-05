import { useEffect, useState, useMemo, useRef } from "react"
import Modal from "../components/Modal"
import Swal from "sweetalert2"

import {
  Pencil,
  Trash2,
  PackageSearch,
  Package,
  ChevronDown,
  SlidersHorizontal,
} from "lucide-react"

import { db } from "../firebase"

import {
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
} from "firebase/firestore"

import {
  filtrarProductos,
  obtenerValoresUnicos,
  PRODUCTOS_POR_PAGINA,
  buscarProductoDuplicado,
  obtenerModelosDuplicados,
  conteoPorClaveModelo,
  claveModeloProducto,
} from "../utils/productos"
import { aplicarAjusteStock } from "../utils/ajusteStock"
import { esErrorCuota } from "../utils/cuotaFirebase"
import { errorOperacion } from "../utils/erroresUi"
import { STOCK_BAJO_UMBRAL } from "../constants/inventario"
import { esStockBajo, esStockAgotado, etiquetaEstadoStock, resumenStockBajo } from "../utils/stock"
import { useTienda } from "../context/TiendaContext"
import { useProductosLive } from "../context/ProductosLiveContext"
import AvisoOtraTienda from "../components/AvisoOtraTienda"

const ESPERA_GUARDADO_MS = 80

function Productos() {
  const { tiendaActual, tiendaPropia, esTiendaPropia } = useTienda()
  const {
    productos: productosLive,
    setProductos: setProductosLive,
    cargando: cargandoLive,
  } = useProductosLive()
  const puedeEditar = esTiendaPropia
  const [parpadeoIds, setParpadeoIds] = useState(() => new Set())
  const stockAnteriorRef = useRef({})

  // FORMULARIO
  const [marca, setMarca] = useState("")
  const [categoria, setCategoria] = useState("")
  const [modelo, setModelo] = useState("")
  const [codigo, setCodigo] = useState("")
  const [precio, setPrecio] = useState("")
  const [stock, setStock] = useState("")

  // BUSQUEDA Y FILTROS
  const [busqueda, setBusqueda] = useState("")
  const [filtroMarca, setFiltroMarca] = useState("")
  const [filtroCategoria, setFiltroCategoria] = useState("")
  const [paginaActual, setPaginaActual] = useState(1)
  const cargando = cargandoLive

  // EDITAR
  const [editandoId, setEditandoId] = useState(null)

  const [modalAbierto, setModalAbierto] = useState(false)
  const [modalAjusteAbierto, setModalAjusteAbierto] = useState(false)
  const [productoAjuste, setProductoAjuste] = useState(null)
  const [cantidadAjuste, setCantidadAjuste] = useState("")
  const [ajustandoId, setAjustandoId] = useState("")
  const [idsPendientes, setIdsPendientes] = useState(() => new Set())
  const [resumenAbierto, setResumenAbierto] = useState(false)
  const pendientesRef = useRef(new Map())
  const timersRef = useRef(new Map())

  const productos = useMemo(
    () =>
      productosLive.map((p) => {
        const pend = pendientesRef.current.get(p.id)
        return pend ? { ...p, stock: pend.stockBase + pend.delta } : p
      }),
    [productosLive, idsPendientes]
  )

  useEffect(() => {
    const cambiaron = []
    productosLive.forEach((p) => {
      const actual = Number(p.stock)
      const antes = stockAnteriorRef.current[p.id]
      if (
        antes !== undefined &&
        antes !== actual &&
        !pendientesRef.current.has(p.id)
      ) {
        cambiaron.push(p.id)
      }
      stockAnteriorRef.current[p.id] = actual
    })
    if (cambiaron.length === 0) return undefined
    setParpadeoIds(new Set(cambiaron))
    const t = setTimeout(() => setParpadeoIds(new Set()), 2500)
    return () => clearTimeout(t)
  }, [productosLive])

  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => clearTimeout(t))
      timersRef.current.clear()
      pendientesRef.current.forEach((pend) => {
        if (pend.delta) {
          aplicarAjusteStock(pend.producto, pend.delta).catch(() => {})
        }
      })
      pendientesRef.current.clear()
    }
  }, [tiendaActual?.id])

  useEffect(() => {
    setPaginaActual(1)
  }, [busqueda, filtroMarca, filtroCategoria])

  // LIMPIAR
  function limpiarFormulario() {
    setMarca("")
    setCategoria("")
    setModelo("")
    setCodigo("")
    setPrecio("")
    setStock("")
  }

  function cambiarPrecio(valor) {
    if (/^\d*\.?\d*$/.test(valor)) {
      setPrecio(valor)
    }
  }

  function cambiarStock(valor) {
    if (/^\d*$/.test(valor)) {
      setStock(valor)
    }
  }

  function cambiarCantidadAjuste(valor) {
    if (/^-?\d*$/.test(valor)) {
      setCantidadAjuste(valor)
    }
  }

  function marcarPendiente(id, activo) {
    setIdsPendientes((prev) => {
      const next = new Set(prev)
      if (activo) next.add(id)
      else next.delete(id)
      return next
    })
  }

  async function flushPendiente(id) {
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }

    const pend = pendientesRef.current.get(id)
    pendientesRef.current.delete(id)
    marcarPendiente(id, false)

    if (!pend || pend.delta === 0 || !tiendaPropia) return true

    const ok = await aplicarDelta(pend.producto, pend.delta, { silencioso: true })
    if (!ok) {
      setProductosLive((lista) =>
        lista.map((p) =>
          p.id === id ? { ...p, stock: pend.stockBase } : p
        )
      )
    }
    return ok
  }

  function ajusteRapido(producto, delta) {
    if (!esTiendaPropia || !tiendaPropia) return
    if (producto.tiendaId && producto.tiendaId !== tiendaPropia.id) return

    const id = producto.id
    const prev = pendientesRef.current.get(id)
    const stockBase = prev ? prev.stockBase : Number(producto.stock)
    const deltaAcum = (prev?.delta || 0) + delta

    if (stockBase + deltaAcum < 0) {
      Swal.fire({
        icon: "warning",
        title: "No alcanza",
        text: `Hay ${stockBase} u. No se puede restar ${Math.abs(deltaAcum)}.`,
      })
      return
    }

    pendientesRef.current.set(id, {
      producto: { ...producto, stock: stockBase },
      stockBase,
      delta: deltaAcum,
    })
    marcarPendiente(id, true)

    setProductosLive((lista) =>
      lista.map((p) =>
        p.id === id ? { ...p, stock: stockBase + deltaAcum } : p
      )
    )

    const anterior = timersRef.current.get(id)
    if (anterior) clearTimeout(anterior)
    timersRef.current.set(
      id,
      setTimeout(() => {
        flushPendiente(id)
      }, ESPERA_GUARDADO_MS)
    )
  }

  async function abrirAjuste(producto) {
    await flushPendiente(producto.id)
    setProductoAjuste({
      ...producto,
      stock:
        productos.find((p) => p.id === producto.id)?.stock ?? producto.stock,
    })
    setCantidadAjuste("")
    setModalAjusteAbierto(true)
  }

  function cerrarAjuste() {
    setModalAjusteAbierto(false)
    setProductoAjuste(null)
    setCantidadAjuste("")
  }

  async function aplicarDelta(producto, delta, { silencioso } = {}) {
    if (!esTiendaPropia || !tiendaPropia) return false
    if (producto.tiendaId && producto.tiendaId !== tiendaPropia.id) return false

    try {
      setAjustandoId(producto.id)
      const { stockDespues, cambio, diferido } = await aplicarAjusteStock(
        producto,
        delta
      )

      setProductosLive((lista) =>
        lista.map((p) =>
          p.id === producto.id ? { ...p, stock: stockDespues } : p
        )
      )

      if (productoAjuste?.id === producto.id) {
        setProductoAjuste((p) => (p ? { ...p, stock: stockDespues } : p))
      }

      if (!silencioso && !diferido) {
        const signo = cambio > 0 ? "+" : ""
        Swal.fire({
          icon: "success",
          title: `Stock ${signo}${cambio}`,
          text: `Ahora: ${stockDespues} u.`,
          timer: 1200,
          showConfirmButton: false,
        })
      }

      return true
    } catch (error) {
      if (esErrorCuota(error)) return true
      errorOperacion(error, "No se pudo ajustar")
      return false
    } finally {
      setAjustandoId("")
    }
  }

  async function confirmarAjuste(e) {
    e.preventDefault()
    if (!productoAjuste) return

    const ok = await aplicarDelta(productoAjuste, Number(cantidadAjuste))
    if (ok) cerrarAjuste()
  }

  // GUARDAR / EDITAR
  async function agregarProducto(e) {
    e.preventDefault()
    if (!esTiendaPropia) return

    const marcaLimpia = marca.trim()
    const categoriaLimpia = categoria.trim()
    const modeloLimpio = modelo.trim()
    const codigoLimpio = codigo.trim()
    const precioNumero = Number(precio)
    const stockNumero = Number(stock)

    if (
      !marcaLimpia ||
      !categoriaLimpia ||
      !modeloLimpio ||
      precio === "" ||
      (!editandoId && stock === "")
    ) {
      Swal.fire({
        icon: "warning",
        title: "Campos incompletos",
      })
      return
    }

    if (Number.isNaN(precioNumero) || precioNumero < 0) {
      Swal.fire({
        icon: "warning",
        title: "Precio inválido",
        text: "El precio solo puede contener números",
      })
      return
    }

    if (!editandoId && (!Number.isInteger(stockNumero) || stockNumero < 0)) {
      Swal.fire({
        icon: "warning",
        title: "Stock inválido",
        text: "El stock solo puede contener números enteros",
      })
      return
    }

    const duplicado = buscarProductoDuplicado(productos, {
      marca: marcaLimpia,
      categoria: categoriaLimpia,
      modelo: modeloLimpio,
      excludeId: editandoId,
    })

    if (duplicado) {
      Swal.fire({
        icon: "warning",
        title: "Producto ya registrado",
        text: `Ya existe "${marcaLimpia} / ${categoriaLimpia} / ${modeloLimpio}". No se pueden repetir la misma marca, categoría y modelo.`,
      })
      return
    }

    try {

      if (editandoId) {
        const datos = {
          marca: marcaLimpia,
          categoria: categoriaLimpia,
          modelo: modeloLimpio,
          codigo: codigoLimpio,
          precio: precioNumero,
        }

        await updateDoc(doc(db, "productos", editandoId), datos)
        setProductosLive((lista) =>
          lista.map((p) => (p.id === editandoId ? { ...p, ...datos } : p))
        )

        Swal.fire({
          icon: "success",
          title: "Producto actualizado",
          timer: 1500,
          showConfirmButton: false,
        })

      } else {

        const creado = await addDoc(collection(db, "productos"), {
          marca: marcaLimpia,
          categoria: categoriaLimpia,
          modelo: modeloLimpio,
          codigo: codigoLimpio,
          precio: precioNumero,
          stock: stockNumero,
          tiendaId: tiendaActual.id,
        })
        setProductosLive((lista) => [
          ...lista,
          {
            id: creado.id,
            marca: marcaLimpia,
            categoria: categoriaLimpia,
            modelo: modeloLimpio,
            codigo: codigoLimpio,
            precio: precioNumero,
            stock: stockNumero,
            tiendaId: tiendaActual.id,
          },
        ])

        Swal.fire({
          icon: "success",
          title: "Producto agregado",
          timer: 1500,
          showConfirmButton: false,
        })
      }

      limpiarFormulario()
      setEditandoId(null)
      setModalAbierto(false)

    } catch (error) {
      console.log(error)

      errorOperacion(error, "Error guardando producto")
    }
  }

  // ELIMINAR
  async function eliminarProducto(id) {
    if (!esTiendaPropia) return

    Swal.fire({
      title: "¿Eliminar producto?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      confirmButtonText: "Eliminar",
    }).then(async (result) => {

      if (result.isConfirmed) {

        try {
          await deleteDoc(doc(db, "productos", id))
          setProductosLive((lista) => lista.filter((p) => p.id !== id))

          Swal.fire({
            icon: "success",
            title: "Eliminado",
            timer: 1200,
            showConfirmButton: false,
          })
        } catch (error) {
          errorOperacion(error, "No se pudo eliminar")
        }
      }
    })
  }

  // EDITAR
  function editarProducto(producto) {
    // Validar que el producto pertenezca a la tienda actual
    if (producto.tiendaId && producto.tiendaId !== tiendaActual.id) {
      Swal.fire({
        icon: "error",
        title: "Producto no disponible",
        text: "Este producto pertenece a otra tienda",
      })
      return
    }
    
    setMarca(producto.marca)
    setCategoria(producto.categoria)
    setModelo(producto.modelo)
    setCodigo(producto.codigo || "")
    setPrecio(producto.precio)
    setStock(producto.stock)

    setEditandoId(producto.id)
    setModalAbierto(true)
  }

  const marcas = useMemo(
    () => obtenerValoresUnicos(productos, "marca"),
    [productos]
  )

  const categorias = useMemo(
    () => obtenerValoresUnicos(productos, "categoria"),
    [productos]
  )

  const productosFiltrados = useMemo(
    () =>
      filtrarProductos(productos, {
        busqueda,
        marca: filtroMarca,
        categoria: filtroCategoria,
      }),
    [productos, busqueda, filtroMarca, filtroCategoria]
  )

  const modelosDuplicados = useMemo(
    () => obtenerModelosDuplicados(productos),
    [productos]
  )

  const conteoModelos = useMemo(
    () => conteoPorClaveModelo(productos),
    [productos]
  )

  const pocoStock = useMemo(() => resumenStockBajo(productos), [productos])

  const resumenPorCategoria = useMemo(() => {
    const mapa = new Map()
    productos.forEach((p) => {
      const cat = p.categoria || "Sin categoría"
      const actual = mapa.get(cat) || { categoria: cat, cantidad: 0, stock: 0 }
      actual.cantidad += 1
      actual.stock += Number(p.stock || 0)
      mapa.set(cat, actual)
    })
    return [...mapa.values()].sort((a, b) =>
      String(a.categoria).localeCompare(String(b.categoria), "es")
    )
  }, [productos])

  const totalPaginas = Math.max(
    1,
    Math.ceil(productosFiltrados.length / PRODUCTOS_POR_PAGINA)
  )

  const paginaSegura = Math.min(paginaActual, totalPaginas)

  const productosPagina = productosFiltrados.slice(
    (paginaSegura - 1) * PRODUCTOS_POR_PAGINA,
    paginaSegura * PRODUCTOS_POR_PAGINA
  )

  const indiceDesde =
    productosFiltrados.length === 0
      ? 0
      : (paginaSegura - 1) * PRODUCTOS_POR_PAGINA + 1

  const indiceHasta = Math.min(
    paginaSegura * PRODUCTOS_POR_PAGINA,
    productosFiltrados.length
  )

  return (
    <div className="space-y-8">
      <AvisoOtraTienda />

      {/* HEADER */}
      <div className="flex flex-col lg:flex-row lg:justify-between gap-6">

        <div>
          <h1 className="text-5xl font-black text-slate-800 dark:text-white">
            Productos
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">
            {tiendaActual?.nombre ? `${tiendaActual.nombre} · ` : ""}
            {productosFiltrados.length} de {productos.length} productos
            {!puedeEditar ? " · solo lectura" : ""}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <select
            value={filtroMarca}
            onChange={(e) => setFiltroMarca(e.target.value)}
            className="p-3 rounded-2xl border dark:bg-slate-900 dark:text-white min-w-[160px]"
          >
            <option value="">Todas las marcas</option>
            {marcas.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <select
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            className="p-3 rounded-2xl border dark:bg-slate-900 dark:text-white min-w-[160px]"
          >
            <option value="">Todas las categorías</option>
            {categorias.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <div className="relative flex-1 min-w-[220px]">
            <PackageSearch
              className="absolute left-4 top-4 text-slate-400"
              size={20}
            />

            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Código, marca, modelo..."
              className="w-full pl-12 pr-4 py-4 rounded-2xl border dark:bg-slate-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* BTN + STATS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl">
          <p className="text-slate-500 dark:text-slate-400">Total</p>
          <h2 className="text-3xl font-black dark:text-white">{productos.length}</h2>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-emerald-200 dark:border-emerald-900">
          <p className="text-slate-500 dark:text-slate-400">Stock total</p>
          <h2 className="text-3xl font-black text-emerald-700 dark:text-emerald-300 tabular-nums">
            {productos.reduce((a, b) => a + Number(b.stock || 0), 0)}
          </h2>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-red-100 dark:border-red-900">
          <p className="text-red-600 dark:text-red-300">Poco stock (≤{STOCK_BAJO_UMBRAL})</p>
          <h2 className="text-3xl font-black text-red-700 dark:text-red-200">
            {pocoStock.total}
          </h2>
          <p className="text-xs text-red-500 mt-1">
            {pocoStock.agotados} agotados · {pocoStock.poco} poco
          </p>
        </div>

        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 rounded-3xl flex justify-between items-center text-white">

          <div>
            <p>Inventario</p>
            <h2 className="text-2xl font-black">PRO</h2>
          </div>

          {puedeEditar && (
          <button
            onClick={() => {
              limpiarFormulario()
              setEditandoId(null)
              setModalAbierto(true)
            }}
            className="bg-white text-blue-700 px-4 py-2 rounded-xl font-bold"
          >
            + Nuevo
          </button>
          )}

        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl overflow-hidden">

        {modelosDuplicados.length > 0 && (
          <div className="p-4 border-b border-amber-200 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-900 text-amber-900 dark:text-amber-200">
            <p className="font-bold">
              Hay {modelosDuplicados.length} producto
              {modelosDuplicados.length === 1 ? "" : "s"} repetido
              {modelosDuplicados.length === 1 ? "" : "s"}
            </p>
            <p className="text-sm mt-1">
              No se borran los que ya ingresaste. Desde ahora no se podrá
              registrar la misma marca, categoría y modelo otra vez.
            </p>
            <ul className="mt-2 text-sm list-disc list-inside space-y-0.5">
              {modelosDuplicados.slice(0, 8).map((d) => (
                <li key={`${d.marca}-${d.categoria}-${d.modelo}`}>
                  {d.marca} / {d.categoria} / {d.modelo}: hay {d.cantidad} iguales
                </li>
              ))}
              {modelosDuplicados.length > 8 && (
                <li>…y {modelosDuplicados.length - 8} más</li>
              )}
            </ul>
          </div>
        )}

        {productosFiltrados.length > 0 && (
          <p className="p-4 text-sm text-slate-500 dark:text-slate-400 border-b dark:border-slate-800">
            Mostrando {indiceDesde}–{indiceHasta} de {productosFiltrados.length}
            {productosFiltrados.length !== productos.length &&
              ` (filtrado de ${productos.length})`}
          </p>
        )}

        <table className="w-full">

          <thead className="bg-slate-100 dark:bg-slate-800">
            <tr>
              <th className="p-4 text-left dark:text-white">Código</th>
              <th className="p-4 text-left dark:text-white">Marca</th>
              <th className="p-4 text-left dark:text-white">Categoría</th>
              <th className="p-4 text-left dark:text-white">Modelo</th>
              <th className="p-4 text-left dark:text-white">Precio</th>
              <th className="p-4 text-left dark:text-white min-w-[160px]">
                Stock
                {puedeEditar && (
                  <span className="block text-xs font-normal text-slate-400">
                    −1 / +1
                  </span>
                )}
              </th>
              <th className="p-4 text-left dark:text-white">Acciones</th>
            </tr>
          </thead>

          <tbody>

            {cargando && productos.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500 dark:text-slate-400">
                  Cargando productos...
                </td>
              </tr>
            )}

            {!cargando && productosPagina.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500 dark:text-slate-400">
                  No hay productos para mostrar
                </td>
              </tr>
            )}

            {productosPagina.map((p) => {
              const veces = conteoModelos.get(claveModeloProducto(p)) || 1
              const esDuplicado = veces > 1
              const poco = esStockBajo(p.stock)
              const agotado = esStockAgotado(p.stock)
              const cambioEnVivo = parpadeoIds.has(p.id)

              return (
              <tr
                key={p.id}
                className={`border-t ${
                  agotado
                    ? "bg-red-50/80 dark:bg-red-950/20"
                    : poco
                    ? "bg-amber-50/70 dark:bg-amber-950/15"
                    : esDuplicado
                    ? "bg-amber-50/80 dark:bg-amber-950/20"
                    : ""
                }`}
              >

                <td className="p-4 font-mono text-sm text-slate-600 dark:text-slate-400">
                  {p.codigo || "—"}
                </td>

                <td className="p-4 font-bold dark:text-white">{p.marca}</td>

                <td className="p-4">
                  <span className="bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full text-sm">
                    {p.categoria}
                  </span>
                </td>

                <td className="p-4 dark:text-white">
                  <div className="flex flex-wrap items-center gap-2">
                    <span>{p.modelo}</span>
                    {esDuplicado && (
                      <span
                        className="bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100 px-2 py-0.5 rounded-full text-xs font-bold"
                        title={`Hay ${veces} con la misma marca, categoría y modelo`}
                      >
                        Hay {veces} iguales
                      </span>
                    )}
                  </div>
                </td>

                <td className="p-4 font-bold dark:text-white">S/ {p.precio}</td>

                <td className="p-3 dark:text-white">
                  <div
                    className={`rounded-xl px-2.5 py-2 border min-w-[140px] ${
                      cambioEnVivo ? "ring-2 ring-emerald-400 animate-pulse" : ""
                    } ${
                      agotado
                        ? "bg-red-100 border-red-300 dark:bg-red-950/50 dark:border-red-700"
                        : poco
                        ? "bg-amber-50 border-amber-300 dark:bg-amber-950/40 dark:border-amber-600"
                        : "bg-emerald-50/80 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-2xl font-black leading-none tabular-nums ${
                          agotado
                            ? "text-red-700 dark:text-red-200"
                            : poco
                            ? "text-amber-800 dark:text-amber-200"
                            : "text-emerald-700 dark:text-emerald-200"
                        }`}
                      >
                        {p.stock}
                      </span>
                      {poco && (
                        <span
                          className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                            agotado
                              ? "bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-100"
                              : "bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100"
                          }`}
                        >
                          {etiquetaEstadoStock(p.stock)}
                        </span>
                      )}
                    </div>
                    {idsPendientes.has(p.id) && (
                      <span className="text-xs text-slate-400 mt-1 block">
                        guardando…
                      </span>
                    )}
                    {puedeEditar && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <button
                          type="button"
                          disabled={ajustandoId === p.id || Number(p.stock) <= 0}
                          onClick={() => ajusteRapido(p, -1)}
                          className="flex-1 py-1 rounded-lg bg-red-100 text-red-700 text-xs font-bold hover:bg-red-200 disabled:opacity-40 dark:bg-red-950 dark:text-red-200"
                          title="Restar 1"
                        >
                          −1
                        </button>
                        <button
                          type="button"
                          disabled={ajustandoId === p.id}
                          onClick={() => ajusteRapido(p, 1)}
                          className="flex-1 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-40"
                          title="Sumar 1"
                        >
                          +1
                        </button>
                      </div>
                    )}
                  </div>
                </td>

                <td className="p-4">
                  {puedeEditar ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => abrirAjuste(p)}
                        className="bg-slate-700 text-white p-2 rounded-xl hover:bg-slate-800"
                        title="Ajustar otra cantidad"
                        aria-label="Ajustar stock"
                      >
                        <SlidersHorizontal size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => editarProducto(p)}
                        className="bg-yellow-500 text-white p-2 rounded-xl"
                        title="Editar datos"
                        aria-label="Editar producto"
                      >
                        <Pencil size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => eliminarProducto(p.id)}
                        className="bg-red-500 text-white p-2 rounded-xl"
                        title="Eliminar"
                        aria-label="Eliminar producto"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">Solo ver</span>
                  )}
                </td>

              </tr>
              )
            })}

          </tbody>

        </table>

        {totalPaginas > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 border-t dark:border-slate-800">
            <button
              type="button"
              onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
              disabled={paginaSegura <= 1}
              className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 disabled:opacity-40 dark:text-white"
            >
              Anterior
            </button>

            <span className="text-slate-600 dark:text-slate-400 font-medium">
              Página {paginaSegura} de {totalPaginas}
            </span>

            <button
              type="button"
              onClick={() =>
                setPaginaActual((p) => Math.min(totalPaginas, p + 1))
              }
              disabled={paginaSegura >= totalPaginas}
              className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 disabled:opacity-40 dark:text-white"
            >
              Siguiente
            </button>
          </div>
        )}

      </div>

      {resumenPorCategoria.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border dark:border-slate-800 overflow-hidden">
          <button
            type="button"
            onClick={() => setResumenAbierto((v) => !v)}
            className="w-full flex items-center justify-between gap-3 p-5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"
          >
            <span className="text-lg font-bold dark:text-white flex items-center gap-2">
              <Package size={20} className="text-blue-600 dark:text-blue-400" />
              Resumen por categoría — {tiendaActual?.nombre || "Tienda actual"}
            </span>
            <ChevronDown
              size={22}
              className={`text-slate-400 shrink-0 transition-transform ${resumenAbierto ? "rotate-180" : ""}`}
            />
          </button>

          {resumenAbierto && (
          <div className="px-6 pb-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                  <th className="p-4 text-left dark:text-white">Categoría</th>
                  <th className="p-4 text-right dark:text-white">Productos</th>
                  <th className="p-4 text-right dark:text-white">Stock total</th>
                  <th className="p-4 text-left dark:text-white w-48">Participación</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const totalProductos = resumenPorCategoria.reduce(
                    (s, c) => s + c.cantidad,
                    0
                  )
                  return resumenPorCategoria.map((c) => {
                    const porcentaje =
                      totalProductos > 0
                        ? Math.round((c.cantidad / totalProductos) * 100)
                        : 0
                    return (
                      <tr
                        key={c.categoria}
                        className="border-b dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30"
                      >
                        <td className="p-4 font-medium dark:text-white">
                          <span className="bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full">
                            {c.categoria}
                          </span>
                        </td>
                        <td className="p-4 text-right font-bold dark:text-slate-300">
                          {c.cantidad}
                        </td>
                        <td className="p-4 text-right font-bold dark:text-slate-300">
                          {c.stock}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 rounded-full"
                                style={{ width: `${porcentaje}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-500 dark:text-slate-400 w-10 text-right">
                              {porcentaje}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                })()}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 dark:bg-slate-800 font-black">
                  <td className="p-4 dark:text-white">TOTAL</td>
                  <td className="p-4 text-right text-blue-600 dark:text-blue-400">
                    {resumenPorCategoria.reduce((s, c) => s + c.cantidad, 0)}
                  </td>
                  <td className="p-4 text-right text-blue-600 dark:text-blue-400">
                    {resumenPorCategoria.reduce((s, c) => s + c.stock, 0)}
                  </td>
                  <td className="p-4" />
                </tr>
              </tfoot>
            </table>
          </div>
          )}
        </div>
      )}

      {/* MODAL */}
      <Modal isOpen={modalAbierto} onClose={() => setModalAbierto(false)}>

        <h2 className="text-2xl font-bold mb-4 dark:text-white">
          {editandoId ? "Editar" : "Nuevo"}
        </h2>

        <form onSubmit={agregarProducto} className="flex flex-col gap-3">

          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="Código / SKU (opcional)"
            className="p-3 rounded-xl border dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <input
            value={marca}
            onChange={(e) => setMarca(e.target.value)}
            placeholder="Marca"
            className="p-3 rounded-xl border dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <input
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            placeholder="Categoría"
            className="p-3 rounded-xl border dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <input
            value={modelo}
            onChange={(e) => setModelo(e.target.value)}
            placeholder="Modelo"
            className="p-3 rounded-xl border dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <input
            value={precio}
            onChange={(e) => cambiarPrecio(e.target.value)}
            placeholder="Precio"
            inputMode="decimal"
            type="text"
            className="p-3 rounded-xl border dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          {editandoId ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              El stock se cambia con −1 / +1 o Ajustar. No se edita aquí.
            </p>
          ) : (
            <input
              value={stock}
              onChange={(e) => cambiarStock(e.target.value)}
              placeholder="Stock inicial"
              inputMode="numeric"
              type="text"
              className="p-3 rounded-xl border dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          )}

          {puedeEditar && (
            <button className="bg-blue-600 text-white py-3 rounded-xl">
              Guardar
            </button>
          )}

        </form>

      </Modal>

      <Modal isOpen={modalAjusteAbierto} onClose={cerrarAjuste}>

        <h2 className="text-2xl font-bold mb-2 dark:text-white">
          Ajustar stock
        </h2>

        {productoAjuste && (
          <p className="text-slate-500 dark:text-slate-400 mb-4">
            {productoAjuste.marca} — {productoAjuste.modelo}
            <br />
            Stock actual:{" "}
            <strong className="text-xl font-black tabular-nums">
              {productoAjuste.stock}
            </strong>
            {Number.isInteger(Number(cantidadAjuste)) && Number(cantidadAjuste) !== 0 && (
              <>
                {" "}→{" "}
                {Number(productoAjuste.stock) + Number(cantidadAjuste) < 0 ? (
                  <strong className="text-red-600">no alcanza</strong>
                ) : (
                  <strong>{Number(productoAjuste.stock) + Number(cantidadAjuste)}</strong>
                )}
              </>
            )}
          </p>
        )}

        <div className="flex flex-wrap gap-2 mb-4">
          {[-4, -2, -1, 1, 2, 5, 10].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setCantidadAjuste(String(n))}
              className={`px-3 py-2 rounded-xl text-sm font-bold ${
                n < 0
                  ? "bg-red-100 text-red-700 hover:bg-red-200"
                  : "bg-green-100 text-green-800 hover:bg-green-200"
              }`}
            >
              {n > 0 ? `+${n}` : n}
            </button>
          ))}
        </div>

        <form onSubmit={confirmarAjuste} className="flex flex-col gap-3">

          <input
            value={cantidadAjuste}
            onChange={(e) => cambiarCantidadAjuste(e.target.value)}
            placeholder="Otra cantidad, ej. -4 o +12"
            inputMode="text"
            type="text"
            className="p-4 rounded-2xl border dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />

          <button
            type="submit"
            disabled={ajustandoId === productoAjuste?.id}
            className={`py-3 rounded-xl text-white font-bold ${
              ajustandoId === productoAjuste?.id
                ? "bg-slate-400"
                : Number(cantidadAjuste) < 0
                ? "bg-red-600 hover:bg-red-700"
                : "bg-green-600 hover:bg-green-700"
            }`}
          >
            {ajustandoId === productoAjuste?.id
              ? "Guardando..."
              : "Confirmar ajuste"}
          </button>

        </form>

      </Modal>

    </div>
  )
}

export default Productos
