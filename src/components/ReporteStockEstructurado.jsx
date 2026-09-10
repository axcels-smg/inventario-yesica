import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { etiquetaEstadoStock, esStockAgotado } from "../utils/stock"

function ReporteStockEstructurado({ grupos, vacio = "No hay productos en este reporte." }) {
  const [abiertas, setAbiertas] = useState({})

  if (!grupos?.length) {
    return <p className="text-slate-500">{vacio}</p>
  }

  function toggleCategoria(categoria) {
    setAbiertas((prev) => ({ ...prev, [categoria]: !prev[categoria] }))
  }

  return (
    <div className="space-y-3">
      {grupos.map((cat) => {
        const abierta = Boolean(abiertas[cat.categoria])
        return (
          <section
            key={cat.categoria}
            className="rounded-2xl border dark:border-slate-800 overflow-hidden"
          >
            <button
              type="button"
              onClick={() => toggleCategoria(cat.categoria)}
              className="w-full flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-800 text-left"
            >
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                {cat.categoria}
              </h3>
              <p className="text-sm text-slate-500 flex items-center gap-2">
                {cat.cantidad} modelo{cat.cantidad === 1 ? "" : "s"} · {cat.noHay} no hay · {cat.poco} poco
                <ChevronDown
                  size={18}
                  className={`transition-transform ${abierta ? "rotate-180" : ""}`}
                />
              </p>
            </button>

            {abierta && (
              <div className="p-4 space-y-5">
                {cat.marcas.map((marca) => (
                  <div key={`${cat.categoria}-${marca.marca}`} className="space-y-2">
                    <h4 className="text-base font-bold text-blue-700 dark:text-blue-300">
                      {marca.marca}
                    </h4>
                    <div className="overflow-x-auto rounded-2xl border dark:border-slate-800">
                      <table className="w-full min-w-[720px] text-sm">
                        <thead className="bg-slate-100 dark:bg-slate-800">
                          <tr>
                            <th className="p-3 text-left">Modelo</th>
                            <th className="p-3 text-left">Código</th>
                            <th className="p-3 text-right">Precio</th>
                            <th className="p-3 text-right">Stock</th>
                            <th className="p-3 text-left">Estado</th>
                            <th className="p-3 text-right">Valor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {marca.modelos.map((m) => {
                            const agotado = esStockAgotado(m.stock)
                            return (
                              <tr
                                key={m.id || `${m.marca}-${m.modelo}-${m.codigo}`}
                                className={`border-t dark:border-slate-800 ${
                                  agotado
                                    ? "bg-red-50/80 dark:bg-red-950/20"
                                    : "bg-amber-50/50 dark:bg-amber-950/10"
                                }`}
                              >
                                <td className="p-3 font-medium dark:text-white">{m.modelo}</td>
                                <td className="p-3 font-mono text-slate-600 dark:text-slate-400">
                                  {m.codigo || "—"}
                                </td>
                                <td className="p-3 text-right">S/ {m.precio}</td>
                                <td className="p-3 text-right font-bold text-red-600">{m.stock}</td>
                                <td className="p-3">
                                  <span
                                    className={`px-2 py-1 rounded-full text-xs font-bold ${
                                      agotado
                                        ? "bg-red-200 text-red-900 dark:bg-red-900 dark:text-red-100"
                                        : "bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100"
                                    }`}
                                  >
                                    {etiquetaEstadoStock(m.stock)}
                                  </span>
                                </td>
                                <td className="p-3 text-right">S/ {m.valor}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

export default ReporteStockEstructurado
