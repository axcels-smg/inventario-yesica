import { useState } from "react"
import { Calendar, Download, Monitor, User } from "lucide-react"
import Swal from "sweetalert2"
import { useDescuentosPantallas } from "../hooks/useDescuentosPantallas"
import { useTienda } from "../context/TiendaContext"
import { exportarDescuentosCiclo7Dias, exportarPantallasDeUnDia } from "../utils/excel"
import {
  DIAS_CICLO_DESCUENTOS,
  filtrarPantallas,
} from "../utils/reportePantallas"
import { formatearFechaKey } from "../utils/alertasStock"

function ReportePantallasDescontadas({ tiendaId }) {
  const { tiendaActual } = useTienda()
  const nombre = tiendaActual?.nombre || "Tienda"
  const { dias, cargando, recargar } = useDescuentosPantallas(tiendaId, nombre)
  const [diaAbierto, setDiaAbierto] = useState("")

  function descargarExcel() {
    const hay = dias.some((d) => (d.pantallas || d.items || []).length > 0)
    if (!hay) {
      return Swal.fire({
        icon: "info",
        title: "Aún no hay pantallas vendidas",
        text: `Se guardan ${DIAS_CICLO_DESCUENTOS} días. Si hoy vendes 10 pantallas, aparecen en este día con modelo, cliente y boleta. Al octavo día se borra el más viejo.`,
      })
    }
    const r = exportarDescuentosCiclo7Dias(dias, nombre)
    Swal.fire({
      icon: "success",
      title: "Excel de 7 días",
      text: `${r.dias} días · ${r.pantallas} líneas. Una hoja por día y el detalle de cada venta.`,
    })
  }

  function descargarExcelDia(e, dia) {
    e.stopPropagation()
    const r = exportarPantallasDeUnDia(dia, nombre)
    if (r.filas === 0) {
      return Swal.fire({
        icon: "info",
        title: `Nada el ${r.fecha}`,
        text: "Ese día no se vendió ni se transfirió ninguna pantalla.",
      })
    }
    Swal.fire({
      icon: "success",
      title: `Excel ${r.fecha}`,
      text: `${r.unidades} pantallas · ${r.filas} líneas con modelo, cliente, boleta y stock que queda.`,
    })
  }

  if (cargando) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
        <p className="text-slate-500">Cargando pantallas descontadas...</p>
      </div>
    )
  }

  const totalPantallas = dias.reduce((s, d) => s + (Number(d.unidadesPantallas) || 0), 0)

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 dark:text-white">
            <Monitor size={24} className="text-blue-600" />
            Pantallas descontadas — {DIAS_CICLO_DESCUENTOS} días
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Ejemplo: si hay 1000 en stock y hoy vendes 10, aquí salen esas 10 con modelo, cliente y boleta. Puedes bajar el Excel de ese día. Solo se guardan {DIAS_CICLO_DESCUENTOS} días; al octavo se borra el primero.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={descargarExcel}
            className="flex items-center gap-2 text-sm font-bold text-white bg-green-700 px-3 py-2 rounded-xl"
          >
            <Download size={16} />
            Excel 7 días
          </button>
          <button type="button" onClick={recargar} className="text-sm text-blue-600 hover:text-blue-700">
            Actualizar
          </button>
        </div>
      </div>

      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
        En este ciclo: {totalPantallas} pantalla{totalPantallas === 1 ? "" : "s"} descontada{totalPantallas === 1 ? "" : "s"}
      </p>

      <div className="space-y-3">
        {dias.map((dia) => {
          const items = dia.items || []
          const pantallas = dia.pantallas || filtrarPantallas(items)
          const abierto = diaAbierto === dia.fechaKey
          const fecha = formatearFechaKey(dia.fechaKey)
          return (
            <div
              key={dia.id || dia.fechaKey}
              className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
            >
              <div className="flex items-center gap-2 p-3 sm:p-4 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                <button
                  type="button"
                  onClick={() => setDiaAbierto(abierto ? "" : dia.fechaKey)}
                  className="flex-1 min-w-0 flex items-center justify-between gap-3 text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Calendar size={18} className="text-blue-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-semibold dark:text-white">{fecha}</p>
                      <p className="text-sm text-slate-500">
                        {Number(dia.unidadesPantallas || 0)} pantalla{Number(dia.unidadesPantallas || 0) === 1 ? "" : "s"} vendida{Number(dia.unidadesPantallas || 0) === 1 ? "" : "s"} · {pantallas.length} modelo{pantallas.length === 1 ? "" : "s"}
                      </p>
                      {(dia.clientes || []).length > 0 && (
                        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                          <User size={12} />
                          {(dia.clientes || []).slice(0, 4).join(", ")}
                          {(dia.clientes || []).length > 4 ? "…" : ""}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-2xl font-black text-blue-700 dark:text-blue-300 tabular-nums">
                    {dia.unidadesPantallas || 0}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={(e) => descargarExcelDia(e, dia)}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl bg-green-700 text-white text-xs font-bold shrink-0"
                >
                  <Download size={14} />
                  Excel del día
                </button>
              </div>

              {abierto && (
                <div className="px-4 pb-4 overflow-x-auto">
                  {pantallas.length === 0 ? (
                    <p className="text-sm text-slate-500">Ese día no se vendió ninguna pantalla.</p>
                  ) : (
                    <table className="w-full text-sm min-w-[720px]">
                      <thead className="bg-slate-100 dark:bg-slate-800">
                        <tr>
                          <th className="p-2 text-left">Marca</th>
                          <th className="p-2 text-left">Modelo</th>
                          <th className="p-2 text-right">Vendidas</th>
                          <th className="p-2 text-right">Stock ahora</th>
                          <th className="p-2 text-left">Cliente</th>
                          <th className="p-2 text-left">Boleta</th>
                          <th className="p-2 text-left">Tipo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pantallas.map((item, i) => (
                          <tr
                            key={`${item.productoId}-${item.ventaId}-${i}`}
                            className="border-t dark:border-slate-700 bg-blue-50/60 dark:bg-blue-950/20"
                          >
                            <td className="p-2">{item.marca}</td>
                            <td className="p-2 font-medium dark:text-white">
                              {item.modelo}
                              {item.codigo ? ` · ${item.codigo}` : ""}
                            </td>
                            <td className="p-2 text-right font-bold">{item.cantidad}</td>
                            <td className="p-2 text-right">
                              {item.stockActual === "" || item.stockActual == null ? "—" : item.stockActual}
                            </td>
                            <td className="p-2">
                              {item.cliente || (item.destino ? `→ ${item.destino}` : "—")}
                            </td>
                            <td className="p-2">{item.boleta || "—"}</td>
                            <td className="p-2 capitalize">{item.tipo}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default ReportePantallasDescontadas
