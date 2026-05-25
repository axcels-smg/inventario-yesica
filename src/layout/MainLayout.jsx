import { Outlet } from "react-router-dom"
import { Menu, X } from "lucide-react"
import { useState } from "react"
import Sidebar from "../components/Sidebar"
import { useStockBajo } from "../hooks/useStockBajo"

function MainLayout() {
  const [menuAbierto, setMenuAbierto] = useState(false)
  const { cantidad: alertasStock } = useStockBajo()

  return (
    <div
      className="
        flex
        min-h-screen
        bg-slate-100
        dark:bg-slate-950
        transition-colors
        duration-300
      "
    >
      {/* BARRA SUPERIOR */}
      <header
        className="
          fixed
          top-0
          left-0
          right-0
          h-16
          z-40
          flex
          items-center
          justify-between
          px-4
          bg-white
          dark:bg-slate-900
          border-b
          border-slate-200
          dark:border-slate-800
          shadow-sm
        "
      >
        <button
          type="button"
          onClick={() => setMenuAbierto(true)}
          className="
            w-11
            h-11
            flex
            items-center
            justify-center
            rounded-xl
            bg-blue-600
            text-white
          "
          aria-label="Abrir menú"
        >
          <Menu size={24} />
        </button>

        <div className="text-right flex items-center gap-3">
          {alertasStock > 0 && (
            <span
              className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full"
              title="Productos con stock bajo"
            >
              {alertasStock} stock bajo
            </span>
          )}
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Inventario
            </p>
            <h1 className="text-lg font-black text-slate-900 dark:text-white">
              Yesica
            </h1>
          </div>
        </div>
      </header>

      {menuAbierto && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 w-full h-full"
            onClick={() => setMenuAbierto(false)}
            aria-label="Cerrar menú"
          />

          <div className="relative w-[300px] max-w-[85vw] h-full">
            <button
              type="button"
              onClick={() => setMenuAbierto(false)}
              className="
                absolute
                top-4
                right-4
                z-10
                w-10
                h-10
                flex
                items-center
                justify-center
                rounded-xl
                bg-slate-800
                text-white
              "
              aria-label="Cerrar menú"
            >
              <X size={22} />
            </button>

            <Sidebar onNavigate={() => setMenuAbierto(false)} />
          </div>
        </div>
      )}

      {/* CONTENIDO */}
      <div
        className="
          flex-1
          flex
          flex-col
          min-h-screen
        "
      >
        {/* NAVBAR (opcional si luego lo agregas) */}
        {/* <Navbar /> */}

        {/* MAIN CONTENT */}
        <main
          className="
            flex-1
            p-4
            pt-20
            md:px-8
            md:pb-8
            md:pt-24
            overflow-y-auto
          "
        >
          <div
            className="
              max-w-7xl
              mx-auto
              w-full
            "
          >
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

export default MainLayout
