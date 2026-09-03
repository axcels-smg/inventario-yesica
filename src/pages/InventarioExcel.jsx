import { useRef, useState } from "react"
import Swal from "sweetalert2"
import { FileDown, FileUp, Table } from "lucide-react"
import { collection, writeBatch, doc } from "firebase/firestore"

import { db } from "../firebase"
import {
  exportarProductosExcel,
  exportarPlantillaExcel,
  leerProductosDesdeExcel,
} from "../utils/excel"
import { registrarMovimiento } from "../utils/movimientos"
import { TIPOS_MOVIMIENTO } from "../constants/inventario"
import { useTienda } from "../context/TiendaContext"
import AvisoOtraTienda from "../components/AvisoOtraTienda"
import { listarPorTienda } from "../utils/consultasTienda"
import {
  claveModeloProducto,
} from "../utils/productos"

function InventarioExcel() {
  const { tiendaActual, esTiendaPropia } = useTienda()
  const inputRef = useRef(null)
  const [importando, setImportando] = useState(false)
  const [vistaPrevia, setVistaPrevia] = useState([])

  async function cargarProductosDeTienda() {
    return listarPorTienda("productos", tiendaActual?.id)
  }

  async function exportarInventario() {
    try {
      const productos = await cargarProductosDeTienda()

      if (productos.length === 0) {
        Swal.fire({ icon: "info", title: "No hay productos para exportar" })
        return
      }

      exportarProductosExcel(productos)

      Swal.fire({
        icon: "success",
        title: "Excel exportado",
        text: `${productos.length} productos`,
        timer: 2000,
        showConfirmButton: false,
      })
    } catch (error) {
      Swal.fire({ icon: "error", title: "Error al exportar", text: error.message })
    }
  }

  async function manejarArchivo(e) {
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
        title: `¿Importar ${productos.length} productos?`,
        text: "Se agregarán como registros nuevos en Firebase",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Importar",
      })

      if (!confirmacion.isConfirmed) return

      setImportando(true)

      const deEstaTienda = await cargarProductosDeTienda()
      const clavesVistas = new Set(
        deEstaTienda.map((p) => claveModeloProducto(p))
      )

      const nuevos = []
      let omitidos = 0

      for (const p of productos) {
        const clave = claveModeloProducto(p)
        if (!clave || clave === "||||") {
          omitidos += 1
          continue
        }
        if (clavesVistas.has(clave)) {
          omitidos += 1
          continue
        }
        clavesVistas.add(clave)
        nuevos.push(p)
      }

      if (nuevos.length === 0) {
        Swal.fire({
          icon: "info",
          title: "Nada que importar",
          text:
            omitidos > 0
              ? `Se omitieron ${omitidos} porque ya existe la misma marca, categoría y modelo, o faltan datos.`
              : "No hay productos válidos en el archivo",
        })
        return
      }

      const LOTE = 400
      let importados = 0

      for (let i = 0; i < nuevos.length; i += LOTE) {
        const trozo = nuevos.slice(i, i + LOTE)
        const batch = writeBatch(db)

        trozo.forEach((p) => {
          const ref = doc(collection(db, "productos"))
          batch.set(ref, {
            codigo: p.codigo || "",
            marca: p.marca,
            categoria: p.categoria,
            modelo: p.modelo,
            precio: p.precio,
            stock: p.stock,
            tiendaId: tiendaActual.id,
          })
        })

        await batch.commit()
        importados += trozo.length
      }

      await registrarMovimiento({
        tipo: TIPOS_MOVIMIENTO.IMPORTACION,
        detalle: `Importados ${importados} productos desde Excel${
          omitidos ? ` (${omitidos} omitidos por duplicado marca/categoría/modelo)` : ""
        }`,
        cantidad: importados,
        tiendaId: tiendaActual.id,
      })

      Swal.fire({
        icon: "success",
        title: "Importación completa",
        text:
          omitidos > 0
            ? `${importados} agregados. ${omitidos} omitidos (misma marca, categoría y modelo).`
            : `${importados} productos agregados`,
      })

      setVistaPrevia([])
      if (inputRef.current) inputRef.current.value = ""
    } catch (error) {
      Swal.fire({ icon: "error", title: "Error al importar", text: error.message })
    } finally {
      setImportando(false)
    }
  }

  if (!esTiendaPropia) {
    return <AvisoOtraTienda modo="bloqueo" />
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-5xl font-black text-slate-800 dark:text-white flex items-center gap-3">
          <Table size={40} />
          Excel — Inventario
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-3 text-lg">
          Importa o exporta miles de modelos en tabla organizada
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <button
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
          onClick={exportarInventario}
          className="bg-white dark:bg-slate-900 border dark:border-slate-800 p-6 rounded-3xl text-left hover:border-green-500 transition"
        >
          <FileDown className="text-green-600 mb-3" size={32} />
          <h3 className="font-bold text-lg dark:text-white">Exportar inventario</h3>
          <p className="text-slate-500 text-sm mt-1">
            Todo el catálogo en .xlsx
          </p>
        </button>

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
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border dark:border-slate-800 p-6">
        <h2 className="text-xl font-bold mb-4 dark:text-white">Columnas del archivo</h2>
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
