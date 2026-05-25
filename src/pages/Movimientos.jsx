import { useEffect, useState } from "react"
import { collection, getDocs } from "firebase/firestore"
import { History } from "lucide-react"

import { db } from "../firebase"
import { obtenerTiempoFecha } from "../utils/fechas"
import { ETIQUETAS_MOVIMIENTO } from "../constants/inventario"

const COLORES_TIPO = {
  venta: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  anulacion: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  reposicion: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  edicion_stock: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
  importacion: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
}

function Movimientos() {
  const [movimientos, setMovimientos] = useState([])
  const [filtroTipo, setFiltroTipo] = useState("")
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    cargarMovimientos()
  }, [])

  async function cargarMovimientos() {
    try {
      setCargando(true)
      const snap = await getDocs(collection(db, "movimientos"))
      const lista = []

      snap.forEach((docu) => {
        lista.push({ id: docu.id, ...docu.data() })
      })

      lista.sort(
        (a, b) =>
          obtenerTiempoFecha(b.fecha || b.fechaTexto) -
          obtenerTiempoFecha(a.fecha || a.fechaTexto)
      )

      setMovimientos(lista)
    } catch (error) {
      console.log(error)
    } finally {
      setCargando(false)
    }
  }

  const listaFiltrada = filtroTipo
    ? movimientos.filter((m) => m.tipo === filtroTipo)
    : movimientos

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-5xl font-black text-slate-800 dark:text-white flex items-center gap-3">
          <History size={40} />
          Movimientos
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-3 text-lg">
          Historial de ventas, anulaciones, reposiciones y cambios de stock
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          className="p-3 rounded-2xl border dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        >
          <option value="">Todos los tipos</option>
          {Object.entries(ETIQUETAS_MOVIMIENTO).map(([clave, etiqueta]) => (
            <option key={clave} value={clave}>
              {etiqueta}
            </option>
          ))}
        </select>

        <button
          onClick={cargarMovimientos}
          className="px-4 py-3 rounded-2xl bg-blue-600 text-white font-medium"
        >
          Actualizar
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="bg-slate-100 dark:bg-slate-800">
              <tr>
                <th className="p-4 text-left">Fecha</th>
                <th className="p-4 text-left">Tipo</th>
                <th className="p-4 text-left">Producto</th>
                <th className="p-4 text-left">Cantidad</th>
                <th className="p-4 text-left">Stock</th>
                <th className="p-4 text-left">Boleta / Cliente</th>
                <th className="p-4 text-left">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {cargando && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    Cargando...
                  </td>
                </tr>
              )}

              {!cargando && listaFiltrada.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No hay movimientos registrados
                  </td>
                </tr>
              )}

              {listaFiltrada.map((m) => (
                <tr key={m.id} className="border-t dark:border-slate-800">
                  <td className="p-4 text-sm text-slate-600 dark:text-slate-400">
                    {m.fechaTexto || "—"}
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        COLORES_TIPO[m.tipo] || "bg-slate-200"
                      }`}
                    >
                      {ETIQUETAS_MOVIMIENTO[m.tipo] || m.tipo}
                    </span>
                  </td>
                  <td className="p-4 font-medium dark:text-white">
                    {m.productoNombre || "—"}
                  </td>
                  <td className="p-4">{m.cantidad ?? "—"}</td>
                  <td className="p-4 text-sm">
                    {m.stockAntes != null && m.stockDespues != null
                      ? `${m.stockAntes} → ${m.stockDespues}`
                      : "—"}
                  </td>
                  <td className="p-4 text-sm">
                    {m.numeroBoleta && <div>Boleta #{m.numeroBoleta}</div>}
                    {m.cliente && <div>{m.cliente}</div>}
                  </td>
                  <td className="p-4 text-sm text-slate-500 max-w-[200px]">
                    {m.detalle || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default Movimientos
