import { AlertTriangle, Calendar, Package, Download } from "lucide-react"
import Swal from "sweetalert2"
import { useAlertasStockHistorial } from "../hooks/useAlertasStockHistorial"
import { etiquetaEstadoStock, esStockAgotado } from "../utils/stock"
import { DIAS_CICLO_ALERTAS, formatearFechaKey } from "../utils/alertasStock"
import { exportarPocoStockCiclo3Dias } from "../utils/excel"
import { useTienda } from "../context/TiendaContext"
import { useProductosLive } from "../context/ProductosLiveContext"

function AlertasStockAcumulativas({ tiendaId }) {
  const { tiendaActual } = useTienda()
  const { productos, cargando: cargandoProductos } = useProductosLive()
  const { alertas, listaAcumulativa, cargando, recargar } = useAlertasStockHistorial(
    tiendaId,
    productos,
    !cargandoProductos
  )

  function descargarExcelCiclo() {
    if (alertas.length === 0) {
      Swal.fire({
        icon: "info",
        title: "Aún no hay días guardados",
        text: "Entra a Reportes cada día. Se guardan solo los últimos 3 días.",
      })
      return
    }
    const r = exportarPocoStockCiclo3Dias(
      alertas,
      tiendaActual?.nombre || "Tienda"
    )
    Swal.fire({
      icon: "success",
      title: "Excel de 3 días",
      text: `${r.categorias} categorías · ${r.dias} día(s). Cada categoría es un cuadro (PANTALLA, LENTE…).`,
    })
  }

  if (cargando) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
        <p className="text-slate-500">Cargando alertas...</p>
      </div>
    )
  }

  if (alertas.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3 text-slate-500">
          <Package size={24} />
          <p>No hay alertas de poco stock en los últimos {DIAS_CICLO_ALERTAS} días</p>
        </div>
      </div>
    )
  }

  // Formatear fecha key para mostrar
  const formatearFecha = (fechaKey) => formatearFechaKey(fechaKey)

  return (
    <div className="space-y-6">
      {/* Resumen de alertas por día */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Calendar size={24} className="text-red-500" />
            Poco stock — ciclo de {DIAS_CICLO_ALERTAS} días
          </h2>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={descargarExcelCiclo}
              className="flex items-center gap-2 text-sm font-bold text-white bg-green-700 px-3 py-2 rounded-xl"
            >
              <Download size={16} />
              Excel (un cuadro por categoría)
            </button>
            <button
              type="button"
              onClick={recargar}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Actualizar
            </button>
          </div>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Al entrar a Reportes se guarda el poco stock de hoy. Solo quedan 3 días; el más viejo se borra. El Excel tiene un cuadro por categoría (PANTALLA, LENTE, BATERIA…).
        </p>

        <div className="space-y-3">
          {alertas.map((alerta) => (
            <div
              key={alerta.id}
              className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-900"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle size={20} className="text-red-500" />
                <div>
                  <p className="font-semibold text-red-700 dark:text-red-300">
                    {formatearFecha(alerta.fechaKey)}
                  </p>
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {alerta.cantidad} producto{alerta.cantidad !== 1 ? "s" : ""} con stock bajo
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-red-700 dark:text-red-200">
                  {alerta.cantidad}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lista acumulativa de productos */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Package size={24} className="text-orange-500" />
          Lista Acumulativa de Productos
        </h2>

        <div className="space-y-3">
          {listaAcumulativa.map((producto) => (
            <div
              key={producto.id}
              className={`p-4 rounded-xl border ${
                esStockAgotado(producto.stock)
                  ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900"
                  : "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {producto.codigo ? `[${producto.codigo}] ` : ""}
                    {producto.nombre ||
                      `${producto.marca || ""} ${producto.modelo || ""}`.trim() ||
                      "Producto"}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {producto.categoria ? `${producto.categoria} · ` : ""}
                    Stock: {producto.stock} · {etiquetaEstadoStock(producto.stock)}
                    {producto.precio != null ? ` · S/ ${producto.precio}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-orange-600 dark:text-orange-400 mb-1">
                    Días con alerta:
                  </p>
                  <div className="flex gap-1 flex-wrap justify-end">
                    {producto.diasConAlerta.map((dia) => (
                      <span
                        key={dia}
                        className="text-xs bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200 px-2 py-1 rounded"
                      >
                        {formatearFecha(dia)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default AlertasStockAcumulativas
