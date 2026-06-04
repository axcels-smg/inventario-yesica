import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  BarChart3,
  History,
  ClipboardList,
  Table,
  Store,
  ChevronDown,
  ArrowRight,
  Globe,
  LogOut,
} from "lucide-react"
import { useStockBajo } from "../hooks/useStockBajo"
import { useTienda } from "../context/TiendaContext"
import { useRol } from "../context/RolContext"
import { useAuth } from "../context/AuthContext"

import { NavLink, useNavigate } from "react-router-dom"
import { useState } from "react"
import ThemeButton from "./ThemeButton"
import SelectorRol from "./SelectorRol"
import Swal from "sweetalert2"

function Sidebar({ onNavigate }) {
  const { cantidad: stockBajoCantidad } = useStockBajo()
  const { tiendaActual, tiendas, seleccionarTienda, cargando } = useTienda()
  const { esSuperAdmin, puedeHacerTransferencias } = useRol()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [selectorAbierto, setSelectorAbierto] = useState(false)

  async function handleLogout() {
    const { value: confirmar } = await Swal.fire({
      title: "¿Cerrar sesión?",
      text: "Serás redirigido a la página de login",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Cerrar sesión",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ef4444",
    })

    if (confirmar) {
      const resultado = await logout()
      if (resultado.success) {
        navigate("/login")
      }
    }
  }

  const links = [
    {
      name: "Dashboard",
      path: "/",
      icon: <LayoutDashboard size={22} />,
    },
    {
      name: "Dashboard Global",
      path: "/global",
      icon: <Globe size={22} />,
      soloSuperAdmin: true,
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
    {
      name: "Tiendas",
      path: "/tiendas",
      icon: <Store size={22} />,
      soloSuperAdmin: true,
    },
    {
      name: "Transferencias",
      path: "/transferencias",
      icon: <ArrowRight size={22} />,
      requierePermiso: "transferencias",
    },
  ]

  const linksFiltrados = links.filter((link) => {
    if (link.soloSuperAdmin && !esSuperAdmin()) return false
    if (link.requierePermiso && !puedeHacerTransferencias()) return false
    return true
  })

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

      <div className="shrink-0 mb-6 pb-6 border-b border-slate-800">
        <h1 className="text-3xl lg:text-4xl font-black leading-tight">
          <span className="text-blue-500">Inventario</span>
          <br />
          G.R.L.
        </h1>

        <p className="text-slate-400 mt-2 text-sm tracking-wide">
          Sistema de gestión profesional
        </p>
      </div>

      {/* Selector de Tienda */}
      <div className="shrink-0 mb-4 pb-4 border-b border-slate-800/50">
        <div className="relative">
          <button
            onClick={() => setSelectorAbierto(!selectorAbierto)}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700 hover:border-slate-600 rounded-2xl transition-all duration-200 hover:shadow-soft"
          >
            <div className="flex items-center gap-3">
              <Store size={20} className="text-blue-400" />
              <div className="text-left">
                <p className="text-xs text-slate-400">Tienda actual</p>
                <p className="text-sm font-semibold text-white">
                  {cargando ? "Cargando..." : tiendaActual?.nombre || "Seleccionar tienda"}
                </p>
              </div>
            </div>
            <ChevronDown
              size={18}
              className={`text-slate-400 transition-transform ${
                selectorAbierto ? "rotate-180" : ""
              }`}
            />
          </button>

          {selectorAbierto && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-2xl shadow-xl z-50 max-h-[300px] overflow-y-auto">
              {cargando ? (
                <div className="p-4 text-center text-slate-400">
                  Cargando tiendas...
                </div>
              ) : tiendas.length === 0 ? (
                <div className="p-4 text-center text-slate-400">
                  No hay tiendas disponibles
                </div>
              ) : (
                tiendas.map((tienda) => (
                  <button
                    key={tienda.id}
                    onClick={() => {
                      seleccionarTienda(tienda)
                      setSelectorAbierto(false)
                    }}
                    className={`w-full px-4 py-3 text-left hover:bg-slate-800 transition-all duration-200 hover:pl-5 ${
                      tiendaActual?.id === tienda.id ? "bg-slate-800" : ""
                    }`}
                  >
                    <p className="font-medium text-white">{tienda.nombre}</p>
                    <p className="text-xs text-slate-400">{tienda.direccion}</p>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto flex flex-col gap-1.5 min-h-0 pr-1 -mr-1">
        {linksFiltrados.map((link) => (
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
                relative
                overflow-hidden

                ${
                  isActive
                    ? `
                      bg-gradient-to-r
                      from-blue-600
                      to-blue-500
                      shadow-lg
                      shadow-blue-500/30
                      border-l-4
                      border-blue-400
                    `
                    : `
                      hover:bg-slate-800/60
                      hover:translate-x-1
                      border-l-4
                      border-transparent
                    `
                }
              `
            }
          >
            <span className={`transition-all duration-200 shrink-0 ${
              link.path === "/" ? "text-blue-400 group-hover:text-blue-300" : "text-slate-300 group-hover:text-white group-hover:scale-110"
            }`}>
              {link.icon}
            </span>

            <span className="flex-1">{link.name}</span>

            {link.path === "/reportes" && stockBajoCantidad > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[22px] text-center shrink-0 animate-pulse shadow-lg shadow-red-500/30">
                {stockBajoCantidad > 99 ? "99+" : stockBajoCantidad}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="shrink-0 pt-4 mt-2 border-t border-slate-800 overflow-visible">
        <div className="mb-4">
          <ThemeButton />
        </div>

        <div className="mb-4 relative overflow-visible">
          <SelectorRol />
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 bg-red-600/20 hover:bg-red-600/30 border border-red-600/30 hover:border-red-600/50 rounded-2xl transition-all duration-200 text-red-400 hover:text-red-300 hover:shadow-soft"
        >
          <LogOut size={20} />
          <span className="font-medium">Cerrar Sesión</span>
        </button>
      </div>
    </div>
  )
}

export default Sidebar
