import { Outlet } from "react-router-dom"
import { Menu, X } from "lucide-react"
import { useEffect, useState } from "react"
import Sidebar from "../components/Sidebar"
import { useStockBajo } from "../hooks/useStockBajo"
import { useTienda } from "../context/TiendaContext"
import { STOCK_BAJO_UMBRAL } from "../constants/inventario"

function MainLayout() {
  const [menuAbierto, setMenuAbierto] = useState(false)
  const { tiendaActual } = useTienda()
  const { cantidad: alertasStock } = useStockBajo(tiendaActual?.id)

  useEffect(() => {
    document.body.style.overflow = menuAbierto ? "hidden" : ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [menuAbierto])

  return (
    <div className="flex min-h-screen min-h-[100dvh] bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 transition-colors duration-300">

      <aside className="hidden lg:block fixed left-0 top-0 z-30 h-[100dvh] w-[min(300px,32vw)]">
        <Sidebar />
      </aside>

      {menuAbierto && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 w-full h-full"
            onClick={() => setMenuAbierto(false)}
            aria-label="Cerrar menú"
          />

          <div className="relative h-full w-[min(300px,92vw)] bg-slate-950 shadow-2xl">
            <button
              type="button"
              onClick={() => setMenuAbierto(false)}
              className="absolute top-3 right-3 z-10 w-11 h-11 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-white"
              aria-label="Cerrar menú"
            >
              <X size={22} />
            </button>

            <Sidebar onNavigate={() => setMenuAbierto(false)} />
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col min-h-screen min-w-0 w-full lg:ml-[min(300px,32vw)]">
        <header className="fixed top-0 left-0 right-0 lg:left-[min(300px,32vw)] h-16 z-40 flex items-center gap-3 px-3 sm:px-4 glass border-b border-slate-200 dark:border-slate-800 shadow-soft">
          <button
            type="button"
            onClick={() => setMenuAbierto(true)}
            className="lg:hidden shrink-0 w-11 h-11 flex items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
            aria-label="Abrir menú"
          >
            <Menu size={24} />
          </button>

          <div className="hidden lg:block text-slate-500 dark:text-slate-400 text-sm font-medium truncate">
            Panel de inventario
          </div>

          <div className="text-right flex items-center gap-2 sm:gap-3 ml-auto min-w-0">
            {alertasStock > 0 && (
              <span
                className="bg-red-500 text-white text-[11px] sm:text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap"
                title={`Productos con poco stock en ${tiendaActual?.nombre || "esta tienda"} (≤ ${STOCK_BAJO_UMBRAL} u.)`}
              >
                {alertasStock} poco stock
              </span>
            )}
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 truncate max-w-[42vw] sm:max-w-none">
                {tiendaActual?.nombre || "Inventario"}
              </p>
              <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
                G.R.L.
              </h1>
            </div>
          </div>
        </header>

        <main className="flex-1 w-full min-w-0 p-3 pt-[4.75rem] pb-[max(3rem,env(safe-area-inset-bottom))] sm:p-4 sm:pt-20 md:px-8 md:pt-24 overflow-x-clip">
          <div className="max-w-7xl mx-auto w-full min-w-0">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

export default MainLayout
