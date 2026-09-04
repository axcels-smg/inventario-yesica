import { useEffect, useState, useMemo } from "react"
import Modal from "../components/Modal"
import Swal from "sweetalert2"

import {
  Pencil,
  Trash2,
  PackageSearch,
  PackagePlus,
  Package,
  ChevronDown,
} from "lucide-react"

import { db } from "../firebase"

import {
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  runTransaction,
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
import { registrarMovimiento } from "../utils/movimientos"
import { TIPOS_MOVIMIENTO, STOCK_BAJO_UMBRAL } from "../constants/inventario"
import { esStockBajo, esStockAgotado, etiquetaEstadoStock, resumenStockBajo } from "../utils/stock"
import { useTienda } from "../context/TiendaContext"
import { listarPorTienda } from "../utils/consultasTienda"
import AvisoOtraTienda from "../components/AvisoOtraTienda"

function Productos() {
  const { tiendaActual, esTiendaPropia } = useTienda()
  const puedeEditar = esTiendaPropia

  // PRODUCTOS
  const [productos, setProductos] = useState([])

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
  const [cargando, setCargando] = useState(true)

  // EDITAR
  const [editandoId, setEditandoId] = useState(null)

  const [modalAbierto, setModalAbierto] = useState(false)
  const [modalReponerAbierto, setModalReponerAbierto] = useState(false)
  const [productoReponer, setProductoReponer] = useState(null)
  const [cantidadReponer, setCantidadReponer] = useState("")
  const [reponiendo, setReponiendo] = useState(false)
  const [resumenAbierto, setResumenAbierto] = useState(false)

  useEffect(() => {
    if (tiendaActual) {
      obtenerProductos()
    }
  }, [tiendaActual?.id])

  // OBTENER
  async function obtenerProductos() {
    if (!tiendaActual) return

    try {
      setCargando(true)
      const lista = await listarPorTienda("productos", tiendaActual.id)
      setProductos(lista)

    } catch (error) {
      console.log(error)

      Swal.fire({
        icon: "error",
        title: "Error cargando productos",
      })
    } finally {
      setCargando(false)
    }
  }

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

  function cambiarCantidadReponer(valor) {
    if (/^\d*$/.test(valor)) {
      setCantidadReponer(valor)
    }
  }

  function abrirReponer(producto) {
    setProductoReponer(producto)
    setCantidadReponer("")
    setModalReponerAbierto(true)
  }

  function cerrarReponer() {
    setModalReponerAbierto(false)
    setProductoReponer(null)
    setCantidadReponer("")
  }

  async function confirmarReponer(e) {
    e.preventDefault()
    if (!esTiendaPropia) return

    if (!productoReponer) return

    const cantidad = Number(cantidadReponer)

    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      Swal.fire({
        icon: "warning",
        title: "Cantidad inválida",
        text: "Ingresa un número entero mayor a 0",
      })
      return
    }

    try {
      setReponiendo(true)

      await runTransaction(db, async (transaction) => {
        const productoRef = doc(db, "productos", productoReponer.id)
        const productoSnap = await transaction.get(productoRef)

        if (!productoSnap.exists()) {
          throw new Error("El producto ya no existe")
        }

        const stockActual = Number(productoSnap.data().stock)

        if (!Number.isFinite(stockActual) || stockActual < 0) {
          throw new Error("Stock inválido en el producto")
        }

        transaction.update(productoRef, {
          stock: stockActual + cantidad,
        })
      })

      await registrarMovimiento({
        tipo: TIPOS_MOVIMIENTO.REPOSICION,
        productoId: productoReponer.id,
        productoNombre: `${productoReponer.marca} ${productoReponer.modelo}`.trim(),
        cantidad,
        stockAntes: Number(productoReponer.stock),
        stockDespues: Number(productoReponer.stock) + cantidad,
        detalle: `Reposición +${cantidad} unidades`,
        tiendaId: tiendaActual.id,
      })

      Swal.fire({
        icon: "success",
        title: "Stock repuesto",
        text: `+${cantidad} unidades. Nuevo stock: ${Number(productoReponer.stock) + cantidad}`,
        timer: 2000,
        showConfirmButton: false,
      })

      cerrarReponer()
      obtenerProductos()

    } catch (error) {
      console.log(error)

      Swal.fire({
        icon: "error",
        title: "Error al reponer",
        text: error.message,
      })
    } finally {
      setReponiendo(false)
    }
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

    if (!marcaLimpia || !categoriaLimpia || !modeloLimpio || precio === "" || stock === "") {
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

    if (!Number.isInteger(stockNumero) || stockNumero < 0) {
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
        const productoAnterior = productos.find((p) => p.id === editandoId)
        const stockAnterior = Number(productoAnterior?.stock)

        await updateDoc(doc(db, "productos", editandoId), {
          marca: marcaLimpia,
          categoria: categoriaLimpia,
          modelo: modeloLimpio,
          codigo: codigoLimpio,
          precio: precioNumero,
          stock: stockNumero,
        })

        if (stockAnterior !== stockNumero) {
          await registrarMovimiento({
            tipo: TIPOS_MOVIMIENTO.EDICION_STOCK,
            productoId: editandoId,
            productoNombre: `${marcaLimpia} ${modeloLimpio}`.trim(),
            cantidad: stockNumero - stockAnterior,
            stockAntes: stockAnterior,
            stockDespues: stockNumero,
            detalle: "Edición manual de stock",
            tiendaId: tiendaActual.id,
          })
        }

        Swal.fire({
          icon: "success",
          title: "Producto actualizado",
          timer: 1500,
          showConfirmButton: false,
        })

      } else {

        await addDoc(collection(db, "productos"), {
          marca: marcaLimpia,
          categoria: categoriaLimpia,
          modelo: modeloLimpio,
          codigo: codigoLimpio,
          precio: precioNumero,
          stock: stockNumero,
          tiendaId: tiendaActual.id,
        })

        Swal.fire({
          icon: "success",
          title: "Producto agregado",
          timer: 1500,
          showConfirmButton: false,
        })
      }

      obtenerProductos()
      limpiarFormulario()
      setEditandoId(null)
      setModalAbierto(false)

    } catch (error) {
      console.log(error)

      Swal.fire({
        icon: "error",
        title: "Error guardando producto",
      })
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

        await deleteDoc(doc(db, "productos", id))

        obtenerProductos()

        Swal.fire({
          icon: "success",
          title: "Eliminado",
          timer: 1200,
          showConfirmButton: false,
        })
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
            {productosFiltrados.length} de {productos.length} productos — {PRODUCTOS_POR_PAGINA} por página
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

        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl">
          <p className="text-slate-500 dark:text-slate-400">Stock total</p>
          <h2 className="text-3xl font-black dark:text-white">
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
              <th className="p-4 text-left dark:text-white">Stock</th>
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

                <td className="p-4 dark:text-white">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={poco ? "font-bold text-red-600" : ""}>
                      {p.stock}
                    </span>
                    {poco && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          agotado
                            ? "bg-red-200 text-red-900 dark:bg-red-900 dark:text-red-100"
                            : "bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100"
                        }`}
                      >
                        {etiquetaEstadoStock(p.stock)}
                      </span>
                    )}
                  </div>
                </td>

                <td className="p-4 flex gap-2">

                  {puedeEditar && <button
                    onClick={() => abrirReponer(p)}
                    className="bg-green-600 text-white p-2 rounded-xl hover:bg-green-700"
                    title="Reponer stock"
                    aria-label="Reponer stock"
                  >
                    <PackagePlus size={18} />
                  </button>}

                  {puedeEditar && (
                    <button
                      onClick={() => editarProducto(p)}
                      className="bg-yellow-500 text-white p-2 rounded-xl"
                      title="Editar"
                      aria-label="Editar producto"
                    >
                      <Pencil size={18} />
                    </button>
                  )}

                  {puedeEditar && (
                    <button
                      onClick={() => eliminarProducto(p.id)}
                      className="bg-red-500 text-white p-2 rounded-xl"
                      title="Eliminar"
                      aria-label="Eliminar producto"
                    >
                      <Trash2 size={18} />
                    </button>
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
          <input
            value={stock}
            onChange={(e) => cambiarStock(e.target.value)}
            placeholder="Stock"
            inputMode="numeric"
            type="text"
            className="p-3 rounded-xl border dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />

          {puedeEditar && (
            <button className="bg-blue-600 text-white py-3 rounded-xl">
              Guardar
            </button>
          )}

        </form>

      </Modal>

      <Modal isOpen={modalReponerAbierto} onClose={cerrarReponer}>

        <h2 className="text-2xl font-bold mb-2 dark:text-white">
          Reponer stock
        </h2>

        {productoReponer && (
          <p className="text-slate-500 dark:text-slate-400 mb-4">
            {productoReponer.marca} — {productoReponer.modelo}
            <br />
            Stock actual: <strong>{productoReponer.stock}</strong>
          </p>
        )}

        <form onSubmit={confirmarReponer} className="flex flex-col gap-3">

          <input
            value={cantidadReponer}
            onChange={(e) => cambiarCantidadReponer(e.target.value)}
            placeholder="Cantidad a sumar"
            inputMode="numeric"
            type="text"
            className="p-4 rounded-2xl border dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />

          <button
            disabled={reponiendo}
            className={`py-3 rounded-xl text-white font-bold ${
              reponiendo ? "bg-slate-400" : "bg-green-600 hover:bg-green-700"
            }`}
          >
            {reponiendo ? "Guardando..." : "Confirmar reposición"}
          </button>

        </form>

      </Modal>

    </div>
  )
}

export default Productos
