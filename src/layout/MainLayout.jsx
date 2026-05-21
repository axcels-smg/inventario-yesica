import { Outlet } from "react-router-dom"
import Sidebar from "../components/Sidebar"

function MainLayout() {
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