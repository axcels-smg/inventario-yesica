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
        transition-all
        duration-300
      "
    >

      <Sidebar />

      <main
        className="
          flex-1
          p-8
          overflow-y-auto
        "
      >

        <Outlet />

      </main>

    </div>
  )
}

export default MainLayout