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
        h-full
        flex
        flex-col
        p-6
        pt-14
        lg:pt-6
        text-white
        bg-gradient-to-b
        from-slate-950
        via-slate-950
        to-slate-900
        border-r
        border-slate-800
      "
    >

      <div className="shrink-0 mb-6">
        <h1 className="text-3xl lg:text-4xl font-black leading-tight">
          <span className="text-blue-500">Inventario</span>
          <br />
          Yesica
        </h1>

        <p className="text-slate-400 mt-2 text-sm tracking-wide">
          Sistema de gestión profesional
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto flex flex-col gap-2 min-h-0 pr-1 -mr-1">
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
                py-3
                rounded-2xl
                text-base
                font-medium
                transition-all
                duration-200
                group
                shrink-0

                ${
                  isActive
                    ? `
                      bg-blue-600
                      shadow-lg
                      shadow-blue-500/20
                    `
                    : `
                      hover:bg-slate-800/60
                    `
                }
              `
            }
          >
            <span className="text-slate-300 group-hover:text-white transition shrink-0">
              {link.icon}
            </span>

            <span className="flex-1">{link.name}</span>

            {link.path === "/reportes" && stockBajoCantidad > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[22px] text-center shrink-0">
                {stockBajoCantidad > 99 ? "99+" : stockBajoCantidad}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="shrink-0 pt-4 mt-2 border-t border-slate-800">
        <div className="mb-4">
          <ThemeButton />
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
          <p className="text-slate-400 text-sm">Inventario Yesica</p>
          <h3 className="text-xl font-bold mt-1 text-white">Versión PRO</h3>
          <p className="text-slate-500 text-xs mt-1">8 módulos activos</p>
        </div>
      </div>
    </div>
  )
}

export default Sidebar
