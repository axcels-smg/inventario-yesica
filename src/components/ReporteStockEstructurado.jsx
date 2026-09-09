import { etiquetaEstadoStock, esStockAgotado } from "../utils/stock"

function ReporteStockEstructurado({ grupos, vacio = "No hay productos en este reporte." }) {
  if (!grupos?.length) {
    return <p className="text-slate-500">{vacio}</p>
  }

  return (
    <div className="space-y-10">
      {grupos.map((cat) => (
        <section key={cat.categoria} className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-2 border-b-2 border-red-500/40 pb-2">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">
              {cat.categoria}
            </h3>
            <p className="text-sm text-slate-500">
              {cat.cantidad} modelo{cat.cantidad === 1 ? "" : "s"} · {cat.noHay} no hay · {cat.poco} poco stock
            </p>
          </div>

          {cat.marcas.map((marca) => (
            <div key={`${cat.categoria}-${marca.marca}`} className="space-y-2">
              <h4 className="text-lg font-bold text-blue-700 dark:text-blue-300">
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
        </section>
      ))}
    </div>
  )
}

export default ReporteStockEstructurado
