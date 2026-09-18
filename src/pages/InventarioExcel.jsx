import { useRef, useState } from "react"
import Swal from "sweetalert2"
import { FileDown, FileUp, Table, Store } from "lucide-react"
import { collection, writeBatch, doc, runTransaction, serverTimestamp } from "firebase/firestore"

import { db } from "../firebase"
import {
  exportarProductosExcel,
  exportarPlantillaExcel,
  leerProductosDesdeExcel,
  exportarInventarioDetalladoTienda,
  exportarInventarioDetalladoTodasLasTiendas,
} from "../utils/excel"
import { registrarMovimiento } from "../utils/movimientos"
import { STOCK_EXCEL_MENOR_A_3, STOCK_EXCEL_MENOR_A_5, TIPOS_MOVIMIENTO } from "../constants/inventario"
import { useTienda } from "../context/TiendaContext"
import { useRol } from "../context/RolContext"
import { useProductosLive } from "../context/ProductosLiveContext"
import AvisoOtraTienda from "../components/AvisoOtraTienda"
import { errorOperacion } from "../utils/erroresUi"
import { claveModeloProducto } from "../utils/productos"

function clasificarImportacion(filas, productosLive) {
  const porClave = new Map()
  productosLive.forEach((p) => {
    const clave = claveModeloProducto(p)
    if (!clave || clave === "||||" || porClave.has(clave)) return
    porClave.set(clave, p)
  })

  const actualizaciones = new Map()
  const nuevos = new Map()
  let invalidos = 0

  for (const p of filas) {
    const clave = claveModeloProducto(p)
    if (!clave || clave === "||||") {
      invalidos += 1
      continue
    }
    const existente = porClave.get(clave)
    if (existente?.id) {
      actualizaciones.set(existente.id, {
        id: existente.id,
        codigo: p.codigo || existente.codigo || "",
        marca: p.marca,
        categoria: p.categoria,
        modelo: p.modelo,
        precio: p.tienePrecio ? p.precio : existente.precio,
        stock: p.tieneStock ? p.stock : existente.stock,
        stockOrigen: Number(existente.stock) || 0,
        tienePrecio: p.tienePrecio,
        tieneStock: p.tieneStock,
      })
    } else {
      nuevos.set(clave, p)
      porClave.set(clave, p)
    }
  }

  return {
    listaNuevos: [...nuevos.values()],
    listaUpdates: [...actualizaciones.values()],
    invalidos,
  }
}

function InventarioExcel() {
  const { tiendaActual, esTiendaPropia, tiendas } = useTienda()
  const { puedeEditarProductos, puedeCrearProductos } = useRol()
  const { productos: productosLive, cargarTodasLasTiendas } = useProductosLive()
  const inputRef = useRef(null)
  const [importando, setImportando] = useState(false)
  const [exportandoTodas, setExportandoTodas] = useState(false)
  const [filtroTodas, setFiltroTodas] = useState("")
  const [vistaPrevia, setVistaPrevia] = useState([])
  const [resumenImport, setResumenImport] = useState(null)

  const puedeImportar =
    esTiendaPropia && (puedeEditarProductos() || puedeCrearProductos())

  function exportarParaReimportar() {
    try {
      if (productosLive.length === 0) {
        Swal.fire({ icon: "info", title: "No hay productos para exportar" })
        return
      }

      exportarProductosExcel(productosLive)

      Swal.fire({
        icon: "success",
        title: "Excel para reimportar",
        text: `${productosLive.length} productos en una sola hoja. Este es el archivo que se puede volver a subir.`,
        timer: 2200,
        showConfirmButton: false,
      })
    } catch (error) {
      errorOperacion(error, "Error al exportar")
    }
  }

  function exportarDetalladoEstaTienda() {
    try {
      if (productosLive.length === 0) {
        Swal.fire({ icon: "info", title: "No hay productos para exportar" })
        return
      }

      const r = exportarInventarioDetalladoTienda(
        productosLive,
        tiendaActual?.nombre || "Tienda"
      )

      Swal.fire({
        icon: "success",
        title: "Inventario descargado",
        text: `${tiendaActual?.nombre || "Tienda"}: ${r.modelos} modelos en ${r.categorias} categorías. Para ver y contar. No lo uses para importar.`,
      })
    } catch (error) {
      errorOperacion(error, "Error al exportar")
    }
  }

  async function exportarDetalladoTodas() {
    const stockMenorA = filtroTodas ? Number(filtroTodas) : undefined
    try {
      setExportandoTodas(true)
      const lista = await cargarTodasLasTiendas({ force: true })
      if (!lista.length) {
        Swal.fire({ icon: "info", title: "No hay productos para exportar" })
        return
      }

      const r = exportarInventarioDetalladoTodasLasTiendas(lista, tiendas, {
        stockMenorA,
      })

      if (r.modelos === 0) {
        Swal.fire({
          icon: "info",
          title: stockMenorA
            ? `Nada con stock menor a ${stockMenorA}`
            : "No hay productos para exportar",
          text: "No hay modelos que cumplan ese filtro en las tiendas.",
        })
        return
      }

      Swal.fire({
        icon: "success",
        title: stockMenorA
          ? `Excel menor a ${stockMenorA} (todas las tiendas)`
          : "Excel de todas las tiendas",
        text: stockMenorA
          ? `${r.tiendas} tiendas · ${r.modelos} modelos con stock menor a ${stockMenorA} en alguna tienda.`
          : `${r.tiendas} tiendas · ${r.modelos} modelos · ${r.categorias} categorías. Una columna de stock por local.`,
      })
    } catch (error) {
      errorOperacion(error, "Error al exportar")
    } finally {
      setExportandoTodas(false)
    }
  }

  async function manejarArchivo(e) {
    if (!puedeImportar) return
    const archivo = e.target.files?.[0]
    if (!archivo) return

    try {
      const productos = await leerProductosDesdeExcel(archivo)
      const clasificado = clasificarImportacion(productos, productosLive)
      setVistaPrevia(productos.slice(0, 50))
      setResumenImport({
        filas: productos.length,
        nuevos: clasificado.listaNuevos.length,
        actualizados: clasificado.listaUpdates.length,
        invalidos: clasificado.invalidos,
      })

      if (productos.length === 0) {
        Swal.fire({
          icon: "warning",
          title: "Archivo vacío",
          text: "Usa la plantilla o el Excel de una sola hoja (Codigo, Marca, Categoria, Modelo, Precio, Stock).",
        })
        return
      }

      if (clasificado.listaNuevos.length === 0 && clasificado.listaUpdates.length === 0) {
        Swal.fire({
          icon: "info",
          title: "Nada que importar",
          text:
            clasificado.invalidos > 0
              ? `${clasificado.invalidos} filas sin marca/categoría/modelo válidos.`
              : "No hay productos válidos en el archivo",
        })
        return
      }

      const confirmacion = await Swal.fire({
        title: "¿Aplicar este Excel?",
        html: `
          <p class="text-left">El <b>stock del archivo es el que debe quedar</b>, no se suma al actual.</p>
          <p class="text-left mt-3">Filas leídas: <b>${productos.length}</b></p>
          <p class="text-left">Se actualizan: <b>${clasificado.listaUpdates.length}</b></p>
          <p class="text-left">Se crean: <b>${clasificado.listaNuevos.length}</b></p>
          ${clasificado.invalidos ? `<p class="text-left">Filas inválidas (se saltan): <b>${clasificado.invalidos}</b></p>` : ""}
        `,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Importar",
        cancelButtonText: "Cancelar",
      })

      if (!confirmacion.isConfirmed) return

      setImportando(true)

      const { listaNuevos, listaUpdates, invalidos } = clasificado
      const LOTE = 400
      let importados = 0
      let actualizados = 0

      for (const p of listaUpdates) {
        if (!p.tieneStock) continue
        await runTransaction(db, async (transaction) => {
          const ref = doc(db, "productos", p.id)
          const snap = await transaction.get(ref)
          if (!snap.exists()) return
          const actual = Number(snap.data().stock)
          const origen = Number(p.stockOrigen)
          const base = Number.isFinite(origen) ? origen : actual
          const delta = p.stock - base
          const nuevo = (Number.isFinite(actual) ? actual : 0) + delta
          if (nuevo < 0) {
            throw new Error(
              `El stock de ${p.marca} ${p.modelo} quedaría en ${nuevo}. Revisa el Excel.`
            )
          }
          const datos = {
            codigo: p.codigo || "",
            marca: p.marca,
            categoria: p.categoria,
            modelo: p.modelo,
            stock: nuevo,
            actualizado: serverTimestamp(),
          }
          if (p.tienePrecio) datos.precio = p.precio
          transaction.update(ref, datos)
        })
        actualizados += 1
      }

      const soloDatos = listaUpdates.filter((p) => !p.tieneStock)
      for (let i = 0; i < soloDatos.length; i += LOTE) {
        const trozo = soloDatos.slice(i, i + LOTE)
        const batch = writeBatch(db)
        trozo.forEach((p) => {
          const datos = {
            codigo: p.codigo || "",
            marca: p.marca,
            categoria: p.categoria,
            modelo: p.modelo,
            actualizado: serverTimestamp(),
          }
          if (p.tienePrecio) datos.precio = p.precio
          batch.update(doc(db, "productos", p.id), datos)
        })
        await batch.commit()
        actualizados += trozo.length
      }

      for (let i = 0; i < listaNuevos.length; i += LOTE) {
        const trozo = listaNuevos.slice(i, i + LOTE)
        const batch = writeBatch(db)

        trozo.forEach((p) => {
          const ref = doc(collection(db, "productos"))
          batch.set(ref, {
            codigo: p.codigo || "",
            marca: p.marca,
            categoria: p.categoria,
            modelo: p.modelo,
            precio: p.tienePrecio ? p.precio : 0,
            stock: p.tieneStock ? p.stock : 0,
            tiendaId: tiendaActual.id,
            actualizado: serverTimestamp(),
          })
        })

        await batch.commit()
        importados += trozo.length
      }

      await registrarMovimiento({
        tipo: TIPOS_MOVIMIENTO.IMPORTACION,
        detalle: `Excel: ${importados} nuevos, ${actualizados} actualizados${
          invalidos ? `, ${invalidos} filas inválidas` : ""
        }`,
        cantidad: importados + actualizados,
        tiendaId: tiendaActual.id,
      })

      await cargarTodasLasTiendas({ force: true })

      Swal.fire({
        icon: "success",
        title: "Importación completa",
        text: `${importados} agregados. ${actualizados} con stock/precio actualizado.`,
      })

      setVistaPrevia([])
      setResumenImport(null)
      if (inputRef.current) inputRef.current.value = ""
    } catch (error) {
      errorOperacion(error, "Error al importar")
    } finally {
      setImportando(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className="space-y-8">
      <AvisoOtraTienda />

      <div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-800 dark:text-white flex items-center gap-3 break-words">
          <Table size={40} />
          Excel — Inventario
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-3 text-lg">
          {tiendaActual?.nombre ? `${tiendaActual.nombre} · ` : ""}
          Baja el stock para verlo, o súbelo para corregirlo. Las ventas se rinden en Historial.
        </p>
      </div>

      <section className="bg-white dark:bg-slate-900 rounded-3xl border dark:border-slate-800 p-6 space-y-4">
        <h2 className="text-xl font-bold dark:text-white">1. Bajar esta tienda</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          El detallado es para revisar (PANTALLA, LENTE…). El de una hoja es el que luego se puede volver a importar.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={exportarDetalladoEstaTienda}
            className="flex items-center gap-2 bg-green-600 text-white px-5 py-3 rounded-2xl font-bold hover:bg-green-700"
          >
            <FileDown size={18} />
            Descargar inventario
          </button>
          <button
            type="button"
            onClick={exportarParaReimportar}
            className="flex items-center gap-2 bg-white dark:bg-slate-800 border dark:border-slate-700 text-slate-800 dark:text-white px-5 py-3 rounded-2xl font-medium hover:border-green-500"
          >
            <FileDown size={18} />
            Descargar para reimportar
          </button>
        </div>
      </section>

      <section className="bg-white dark:bg-slate-900 rounded-3xl border dark:border-slate-800 p-6 space-y-4">
        <h2 className="text-xl font-bold dark:text-white flex items-center gap-2">
          <Store size={22} />
          2. Bajar todas las tiendas
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          Un modelo por fila y una columna de stock por local. Elige si quieres todo o solo lo que hay que reponer.
        </p>
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="sm:w-64">
            <label className="text-sm text-slate-500 dark:text-slate-400 block mb-1">Qué incluir</label>
            <select
              value={filtroTodas}
              onChange={(e) => setFiltroTodas(e.target.value)}
              className="w-full p-3 rounded-2xl border dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="">Todo el inventario</option>
              <option value={String(STOCK_EXCEL_MENOR_A_3)}>Solo menor a {STOCK_EXCEL_MENOR_A_3}</option>
              <option value={String(STOCK_EXCEL_MENOR_A_5)}>Solo menor a {STOCK_EXCEL_MENOR_A_5}</option>
            </select>
          </div>
          <button
            type="button"
            onClick={exportarDetalladoTodas}
            disabled={exportandoTodas}
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-3 rounded-2xl font-bold hover:bg-blue-700 disabled:bg-slate-400"
          >
            <FileDown size={18} />
            {exportandoTodas ? "Preparando…" : "Descargar"}
          </button>
        </div>
      </section>

      <section className="bg-white dark:bg-slate-900 rounded-3xl border dark:border-slate-800 p-6 space-y-4">
        <h2 className="text-xl font-bold dark:text-white">3. Subir / corregir stock</h2>
        <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 p-4 text-sm text-amber-900 dark:text-amber-200 space-y-1">
          <p>El número de <b>Stock en el Excel es el que debe quedar</b> en el sistema. No se suma.</p>
          <p>Importa la <b>plantilla</b> o el archivo <b>para reimportar</b>. No subas el Excel detallado (el de varias hojas).</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={exportarPlantillaExcel}
            className="flex items-center gap-2 bg-white dark:bg-slate-800 border dark:border-slate-700 px-5 py-3 rounded-2xl font-medium dark:text-white"
          >
            <FileDown size={18} />
            Plantilla
          </button>

          {puedeImportar ? (
            <label className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-white cursor-pointer ${importando ? "bg-slate-400" : "bg-blue-600 hover:bg-blue-700"}`}>
              <FileUp size={18} />
              {importando ? "Importando…" : "Importar Excel"}
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={manejarArchivo}
                disabled={importando}
                className="hidden"
              />
            </label>
          ) : (
            <div className="px-5 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 text-sm">
              {esTiendaPropia
                ? "Solo un administrador puede importar."
                : "Solo se puede importar en tu propia tienda."}
            </div>
          )}
        </div>

        <p className="text-xs text-slate-500">
          Columnas: Codigo · Marca · Categoria · Modelo · Precio · Stock. Ejemplo: SAMSUNG · PANTALLA · A05.
        </p>
      </section>

      {resumenImport && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border dark:border-slate-800 p-6">
          <h2 className="text-xl font-bold mb-3 dark:text-white">Último archivo leído</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            {resumenImport.filas} filas · {resumenImport.actualizados} a actualizar · {resumenImport.nuevos} nuevos
            {resumenImport.invalidos ? ` · ${resumenImport.invalidos} inválidas` : ""}
          </p>
          {vistaPrevia.length > 0 && (
            <div className="overflow-x-auto max-h-[300px]">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0">
                  <tr>
                    <th className="p-2 text-left">Código</th>
                    <th className="p-2 text-left">Marca</th>
                    <th className="p-2 text-left">Modelo</th>
                    <th className="p-2 text-left">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {vistaPrevia.map((p, i) => (
                    <tr key={i} className="border-t dark:border-slate-800">
                      <td className="p-2">{p.codigo || "—"}</td>
                      <td className="p-2">{p.marca}</td>
                      <td className="p-2">{p.modelo}</td>
                      <td className="p-2">{p.stock ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default InventarioExcel
