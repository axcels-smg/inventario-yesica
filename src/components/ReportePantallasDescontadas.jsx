import { useState } from "react"
import { Calendar, Download, Monitor, User } from "lucide-react"
import Swal from "sweetalert2"
import { useDescuentosPantallas } from "../hooks/useDescuentosPantallas"
import { useTienda } from "../context/TiendaContext"
import { exportarDescuentosCiclo7Dias } from "../utils/excel"
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
    const hay = dias.some((d) => (d.items || []).length > 0)
    if (!hay) {
      Swal.fire({
        icon: "info",
        title: "Aún no hay descuentos",
        text: `Se guardan ${DIAS_CICLO_DESCUENTOS} días. Vende o transfiere pantallas y vuelve a entrar a Reportes.`,
      })
      return
    }
    const r = exportarDescuentosCiclo7Dias(dias, nombre)
    Swal.fire({
      icon: "success",
      title: "Excel de 7 días",
      text: `${r.dias} días · ${r.pantallas} líneas de pantallas · ${r.lineas} descuentos en total. Hojas: Resumen, Pantallas, Todo descontado, y un cuadro por día.`,
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
            {nombre}: cada venta o transferencia resta stock. Se guarda el detalle (modelo, marca, categoría, cliente, boleta). Al octavo día se borra el más viejo.
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
              <button
                type="button"
                onClick={() => setDiaAbierto(abierto ? "" : dia.fechaKey)}
                className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <div className="flex items-center gap-3">
                  <Calendar size={18} className="text-blue-500" />
                  <div>
                    <p className="font-semibold dark:text-white">{fecha}</p>
                    <p className="text-sm text-slate-500">
                      {pantallas.length} línea{pantallas.length === 1 ? "" : "s"} de pantallas · {dia.unidadesPantallas || 0} u. · {items.length} descuentos en total
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

              {abierto && (
                <div className="px-4 pb-4 overflow-x-auto">
                  {items.length === 0 ? (
                    <p className="text-sm text-slate-500">Ese día no se descontó stock.</p>
                  ) : (
                    <table className="w-full text-sm min-w-[720px]">
                      <thead className="bg-slate-100 dark:bg-slate-800">
                        <tr>
                          <th className="p-2 text-left">Categoría</th>
                          <th className="p-2 text-left">Marca</th>
                          <th className="p-2 text-left">Modelo</th>
                          <th className="p-2 text-right">Cant.</th>
                          <th className="p-2 text-left">Cliente</th>
                          <th className="p-2 text-left">Boleta</th>
                          <th className="p-2 text-left">Tipo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, i) => (
                          <tr
                            key={`${item.productoId}-${item.ventaId}-${i}`}
                            className={`border-t dark:border-slate-700 ${
                              item.pantalla ? "bg-blue-50/60 dark:bg-blue-950/20" : ""
                            }`}
                          >
                            <td className="p-2">{item.categoria}</td>
                            <td className="p-2">{item.marca}</td>
                            <td className="p-2 font-medium dark:text-white">
                              {item.modelo}
                              {item.codigo ? ` · ${item.codigo}` : ""}
                            </td>
                            <td className="p-2 text-right font-bold">{item.cantidad}</td>
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
