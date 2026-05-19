import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  BarChart3,
  History,
} from "lucide-react"

import {
  NavLink,
} from "react-router-dom"

import ThemeButton from "./ThemeButton"

function Sidebar() {

  const links = [

    {
      name: "Dashboard",
      path: "/",
      icon: <LayoutDashboard size={22} />,
    },

    {
      name: "Productos",
      path: "/productos",
      icon: <Package size={22} />,
    },

    {
      name: "Ventas",
      path: "/ventas",
      icon: <ShoppingCart size={22} />,
    },

    {
      name: "Clientes",
      path: "/clientes",
      icon: <Users size={22} />,
    },

    {
      name: "Reportes",
      path: "/reportes",
      icon: <BarChart3 size={22} />,
    },

    {
      name: "Historial",
      path: "/historial",
      icon: <History size={22} />,
    },
  ]

  return (

    <div
      className="
        w-[300px]
        min-h-screen
        bg-[#020617]
        text-white
        flex
        flex-col
        p-6
        border-r
        border-slate-800
      "
    >

      {/* LOGO */}
      <div className="mb-12">

        <h1
          className="
            text-5xl
            font-black
            leading-tight
          "
        >
          <span className="text-blue-500">
            Inventario
          </span>

          <br />

          Yesica
        </h1>

        <p
          className="
            text-slate-400
            mt-4
            text-lg
          "
        >
          Sistema Profesional
        </p>

      </div>

      {/* MENU */}
      <div className="flex flex-col gap-4">

        {links.map((link) => (

          <NavLink
            key={link.path}
            to={link.path}
            className={({ isActive }) =>

              `
              flex
              items-center
              gap-4
              px-6
              py-5
              rounded-3xl
              text-xl
              transition-all
              duration-300

              ${
                isActive
                  ? `
                    bg-blue-600
                    shadow-lg
                    shadow-blue-500/30
                  `
                  : `
                    hover:bg-slate-800
                  `
              }
              `
            }
          >

            {link.icon}

            <span>
              {link.name}
            </span>

          </NavLink>

        ))}

      </div>

      {/* FOOTER */}
      <div className="mt-auto">

        <div className="mb-6">
          <ThemeButton />
        </div>

        <div
          className="
            bg-slate-900
            border
            border-slate-800
            rounded-3xl
            p-5
          "
        >

          <p className="text-slate-400">
            Inventario Yesica
          </p>

          <h3
            className="
              text-3xl
              font-bold
              mt-2
            "
          >
            Versión PRO
          </h3>

        </div>

      </div>

    </div>
  )
}

export default Sidebar