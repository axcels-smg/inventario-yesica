import { Outlet } from "react-router-dom"
import { Menu, X } from "lucide-react"
import { useState } from "react"
import Sidebar from "../components/Sidebar"

function MainLayout() {
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false)

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
      {/* SIDEBAR */}
      <aside
        className="
          hidden
          md:flex
          md:w-72
          fixed
          h-full
          z-50
        "
      >
        <Sidebar />
      </aside>

      {/* MENU MOVIL */}
      <header
        className="
          md:hidden
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
          onClick={() => setMenuMovilAbierto(true)}
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
          aria-label="Abrir menu"
        >
          <Menu size={24} />
        </button>

        <div className="text-right">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Inventario
          </p>
          <h1 className="text-lg font-black text-slate-900 dark:text-white">
            Yesica
          </h1>
        </div>
      </header>

      {menuMovilAbierto && (
        <div className="md:hidden fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 w-full h-full"
            onClick={() => setMenuMovilAbierto(false)}
            aria-label="Cerrar menu"
          />

          <div className="relative w-[300px] max-w-[85vw] h-full">
            <button
              type="button"
              onClick={() => setMenuMovilAbierto(false)}
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
              aria-label="Cerrar menu"
            >
              <X size={22} />
            </button>

            <Sidebar onNavigate={() => setMenuMovilAbierto(false)} />
          </div>
        </div>
      )}

      {/* CONTENIDO */}
      <div
        className="
          flex-1
          md:ml-72
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
            md:p-8
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
