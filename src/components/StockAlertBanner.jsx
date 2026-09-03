import { Link } from "react-router-dom"
import { AlertTriangle } from "lucide-react"
import { STOCK_BAJO_UMBRAL } from "../constants/inventario"

function StockAlertBanner({ cantidad }) {
  if (cantidad <= 0) return null

  return (
    <Link
      to="/reportes"
      className="flex items-center gap-3 mb-6 p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-200 hover:bg-red-100 dark:hover:bg-red-950/60 transition"
    >
      <AlertTriangle size={22} className="shrink-0" />
      <div>
        <p className="font-bold">
          {cantidad} producto{cantidad !== 1 ? "s" : ""} con stock bajo (≤ {STOCK_BAJO_UMBRAL})
        </p>
        <p className="text-sm opacity-80">Ver detalle en Reportes</p>
      </div>
    </Link>
  )
}

export default StockAlertBanner
