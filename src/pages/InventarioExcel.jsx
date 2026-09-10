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
import { TIPOS_MOVIMIENTO } from "../constants/inventario"
import { useTienda } from "../context/TiendaContext"
import { useProductosLive } from "../context/ProductosLiveContext"
import AvisoOtraTienda from "../components/AvisoOtraTienda"
import { errorOperacion } from "../utils/erroresUi"
import {
  claveModeloProducto,
} from "../utils/productos"

function InventarioExcel() {
  const { tiendaActual, esTiendaPropia, tiendas } = useTienda()
  const { productos: productosLive, cargarTodasLasTiendas } = useProductosLive()
  const inputRef = useRef(null)
  const [importando, setImportando] = useState(false)
  const [vistaPrevia, setVistaPrevia] = useState([])

  function exportarInventarioSimple() {
    try {
      if (productosLive.length === 0) {
        Swal.fire({ icon: "info", title: "No hay productos para exportar" })
        return
      }

      exportarProductosExcel(productosLive)

      Swal.fire({
        icon: "success",
        title: "Excel exportado",
        text: `${productosLive.length} productos en una sola hoja`,
        timer: 2000,
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
        title: "Excel detallado descargado",
        text: `${tiendaActual?.nombre || "Tienda"}: ${r.modelos} modelos en ${r.categorias} categorías. Abre la hoja «Por modelo». Cada categoría (PANTALLA, LENTE…) lista un renglón por modelo.`,
      })
    } catch (error) {
      errorOperacion(error, "Error al exportar")
    }
  }

  async function exportarDetalladoTodas() {
    try {
      const lista = await cargarTodasLasTiendas({ force: true })
      if (!lista.length) {
        Swal.fire({ icon: "info", title: "No hay productos para exportar" })
        return
      }

      const r = exportarInventarioDetalladoTodasLasTiendas(
        lista,
        tiendas
      )

      Swal.fire({
        icon: "success",
        title: "Excel de todas las tiendas",
        text: `${r.tiendas} tiendas · ${r.modelos} modelos · ${r.categorias} categorías. En «Por modelo» cada modelo tiene una columna de stock por tienda.`,
      })
    } catch (error) {
      errorOperacion(error, "Error al exportar")
    }
  }

  async function manejarArchivo(e) {
    if (!esTiendaPropia) return
    const archivo = e.target.files?.[0]
    if (!archivo) return

    try {
      const productos = await leerProductosDesdeExcel(archivo)
      setVistaPrevia(productos.slice(0, 50))

      if (productos.length === 0) {
        Swal.fire({
          icon: "warning",
          title: "Archivo vacío",
          text: "Usa columnas: Codigo, Marca, Categoria, Modelo, Precio, Stock",
        })
        return
      }

      const confirmacion = await Swal.fire({
        title: `¿Importar ${productos.length} filas?`,
        text: "Si ya existe la misma marca, categoría y modelo, se actualiza el stock y el precio. Si no existe, se crea.",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Importar",
      })

      if (!confirmacion.isConfirmed) return

      setImportando(true)

      const porClave = new Map()
      productosLive.forEach((p) => {
        const clave = claveModeloProducto(p)
        if (!clave || clave === "||||" || porClave.has(clave)) return
        porClave.set(clave, p)
      })

      const actualizaciones = new Map()
      const nuevos = new Map()
      let invalidos = 0

      for (const p of productos) {
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

      const listaNuevos = [...nuevos.values()]
      const listaUpdates = [...actualizaciones.values()]

      if (listaNuevos.length === 0 && listaUpdates.length === 0) {
        Swal.fire({
          icon: "info",
          title: "Nada que importar",
          text:
            invalidos > 0
              ? `${invalidos} filas sin marca/categoría/modelo válidos.`
              : "No hay productos válidos en el archivo",
        })
        return
      }

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
      if (inputRef.current) inputRef.current.value = ""
    } catch (error) {
      errorOperacion(error, "Error al importar")
    } finally {
      setImportando(false)
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
          Descarga un cuadro por categoría (PANTALLA, LENTE, BATERIA…) o el de todas las tiendas.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <button
          type="button"
          onClick={exportarDetalladoEstaTienda}
          className="bg-white dark:bg-slate-900 border dark:border-slate-800 p-6 rounded-3xl text-left hover:border-green-500 transition"
        >
          <FileDown className="text-green-600 mb-3" size={32} />
          <h3 className="font-bold text-lg dark:text-white">
            Excel detallado de esta tienda
          </h3>
          <p className="text-slate-500 text-sm mt-1">
            {tiendaActual?.nombre || "Tienda actual"}: un renglón por modelo (HONOR X7B, SAMSUNG A16…). Hojas PANTALLA, LENTE, FLEX… con filtro. Primera columna: el modelo.
          </p>
        </button>

        <button
          type="button"
          onClick={exportarDetalladoTodas}
          className="bg-white dark:bg-slate-900 border dark:border-slate-800 p-6 rounded-3xl text-left hover:border-blue-500 transition"
        >
          <Store className="text-blue-600 mb-3" size={32} />
          <h3 className="font-bold text-lg dark:text-white">
            Excel detallado de todas las tiendas
          </h3>
          <p className="text-slate-500 text-sm mt-1">
            Cada modelo en una sola fila y una columna de stock por tienda. Así ves si el HONOR X7B hay en Plaza Norte y en las demás.
          </p>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <button
          type="button"
          onClick={exportarPlantillaExcel}
          className="bg-white dark:bg-slate-900 border dark:border-slate-800 p-6 rounded-3xl text-left hover:border-blue-500 transition"
        >
          <FileDown className="text-blue-600 mb-3" size={32} />
          <h3 className="font-bold text-lg dark:text-white">Plantilla</h3>
          <p className="text-slate-500 text-sm mt-1">
            Descarga ejemplo con columnas correctas
          </p>
        </button>

        <button
          type="button"
          onClick={exportarInventarioSimple}
          className="bg-white dark:bg-slate-900 border dark:border-slate-800 p-6 rounded-3xl text-left hover:border-green-500 transition"
        >
          <FileDown className="text-green-600 mb-3" size={32} />
          <h3 className="font-bold text-lg dark:text-white">Exportar simple</h3>
          <p className="text-slate-500 text-sm mt-1">
            Una sola hoja. Al reimportar se actualiza el stock de lo que ya existe.
          </p>
        </button>

        {esTiendaPropia ? (
        <label className="bg-blue-600 text-white p-6 rounded-3xl text-left cursor-pointer hover:bg-blue-700 transition">
          <FileUp className="mb-3" size={32} />
          <h3 className="font-bold text-lg">
            {importando ? "Importando..." : "Importar Excel"}
          </h3>
          <p className="text-blue-100 text-sm mt-1">
            .xlsx con marca, modelo, stock, precio
          </p>
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
          <div className="bg-slate-100 dark:bg-slate-900 border dark:border-slate-800 p-6 rounded-3xl text-left">
            <FileUp className="text-slate-400 mb-3" size={32} />
            <h3 className="font-bold text-lg dark:text-white">Importar</h3>
            <p className="text-slate-500 text-sm mt-1">
              Solo se puede importar en tu propia tienda.
            </p>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border dark:border-slate-800 p-6">
        <h2 className="text-xl font-bold mb-2 dark:text-white">Excel detallado (por modelo)</h2>
        <p className="text-slate-500 text-sm mb-4">
          La columna principal es el modelo. En cada hoja puedes filtrar. Orden: categoría → marca → modelo (A10 antes que A16).
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border dark:border-slate-700 rounded-xl overflow-hidden text-sm">
            <thead className="bg-slate-100 dark:bg-slate-800">
              <tr>
                <th className="p-3 text-left">N°</th>
                <th className="p-3 text-left">Modelo</th>
                <th className="p-3 text-left">Marca</th>
                <th className="p-3 text-left">Categoría</th>
                <th className="p-3 text-left">Código</th>
                <th className="p-3 text-left">Precio unit.</th>
                <th className="p-3 text-left">Stock</th>
                <th className="p-3 text-left">Estado</th>
                <th className="p-3 text-left">Valor</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t dark:border-slate-700">
                <td className="p-3">1</td>
                <td className="p-3 font-medium">X7B</td>
                <td className="p-3">HONOR</td>
                <td className="p-3">PANTALLA</td>
                <td className="p-3">—</td>
                <td className="p-3">85</td>
                <td className="p-3">4</td>
                <td className="p-3">OK</td>
                <td className="p-3">340</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-slate-500 text-sm mt-4">
          Hojas: Resumen · Por modelo · Sin stock · Detalle · PANTALLA · LENTE · BATERIA · …
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border dark:border-slate-800 p-6">
        <h2 className="text-xl font-bold mb-4 dark:text-white">Columnas para importar</h2>
        <div className="overflow-x-auto">
          <table className="w-full border dark:border-slate-700 rounded-xl overflow-hidden">
            <thead className="bg-slate-100 dark:bg-slate-800">
              <tr>
                <th className="p-3 text-left">Codigo</th>
                <th className="p-3 text-left">Marca</th>
                <th className="p-3 text-left">Categoria</th>
                <th className="p-3 text-left">Modelo</th>
                <th className="p-3 text-left">Precio</th>
                <th className="p-3 text-left">Stock</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t dark:border-slate-700">
                <td className="p-3 font-mono text-sm">SKU-001</td>
                <td className="p-3">Nike</td>
                <td className="p-3">Zapatillas</td>
                <td className="p-3">Air Max</td>
                <td className="p-3">250</td>
                <td className="p-3">10</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {vistaPrevia.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border dark:border-slate-800 p-6">
          <h2 className="text-xl font-bold mb-4 dark:text-white">
            Vista previa (primeras filas)
          </h2>
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
                    <td className="p-2">{p.stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default InventarioExcel
