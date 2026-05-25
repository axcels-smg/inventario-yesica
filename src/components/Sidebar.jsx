import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  BarChart3,
  History,
  ClipboardList,
  Table,
} from "lucide-react"
import { useStockBajo } from "../hooks/useStockBajo"

import { NavLink } from "react-router-dom"
import ThemeButton from "./ThemeButton"

function Sidebar({ onNavigate }) {
  const { cantidad: stockBajoCantidad } = useStockBajo()

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
    {
      name: "Movimientos",
      path: "/movimientos",
      icon: <ClipboardList size={22} />,
    },
    {
      name: "Excel",
      path: "/excel",
      icon: <Table size={22} />,
    },
  ]

  return (
    <div
      className="
        w-[300px]
        min-h-screen
        flex
        flex-col
        p-6
        text-white
        bg-gradient-to-b
        from-slate-950
        via-slate-950
        to-slate-900
        border-r
        border-slate-800
        overflow-y-auto
      "
    >

      {/* LOGO */}
      <div className="mb-10">
        <h1 className="text-4xl font-black leading-tight">
          <span className="text-blue-500">Inventario</span>
          <br />
          Yesica
        </h1>

        <p className="text-slate-400 mt-3 text-sm tracking-wide">
          Sistema de gestión profesional
        </p>
      </div>

      {/* MENU */}
      <nav className="flex flex-col gap-3">

        {links.map((link) => (
          <NavLink
            key={link.path}
            to={link.path}
            onClick={onNavigate}
            className={({ isActive }) =>
              `
                flex
                items-center
                gap-4
                px-5
                py-4
                rounded-2xl
                text-base
                font-medium
                transition-all
                duration-200
                group

                ${
                  isActive
                    ? `
                      bg-blue-600
                      shadow-lg
                      shadow-blue-500/20
                      scale-[1.02]
                    `
                    : `
                      hover:bg-slate-800/60
                      hover:translate-x-1
                    `
                }
              `
            }
          >
            <span
              className="
                text-slate-300
                group-hover:text-white
                transition
              "
            >
              {link.icon}
            </span>

            <span className="flex-1">{link.name}</span>
            {link.path === "/reportes" && stockBajoCantidad > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[22px] text-center">
                {stockBajoCantidad > 99 ? "99+" : stockBajoCantidad}
              </span>
            )}
          </NavLink>
        ))}

      </nav>

      {/* FOOTER */}
      <div className="mt-auto pt-6">

        {/* THEME BUTTON */}
        <div className="mb-6">
          <ThemeButton />
        </div>

        {/* CARD INFO */}
        <div
          className="
            bg-slate-900/60
            border
            border-slate-800
            rounded-2xl
            p-4
            backdrop-blur
          "
        >
          <p className="text-slate-400 text-sm">
            Inventario Yesica
          </p>

          <h3 className="text-2xl font-bold mt-1 text-white">
            Versión PRO
          </h3>

          <p className="text-slate-500 text-xs mt-2">
            Sistema SaaS en desarrollo
          </p>
        </div>

      </div>
    </div>
  )
}

export default Sidebar
