import { createContext, useContext, useState, useEffect } from "react"
import { ROLES_USUARIO } from "../constants/inventario"

const RolContext = createContext()

export function useRol() {
  const context = useContext(RolContext)
  if (!context) {
    throw new Error("useRol debe usarse dentro de RolProvider")
  }
  return context
}

export function RolProvider({ children }) {
  const [rolActual, setRolActual] = useState(ROLES_USUARIO.LECTOR)

  useEffect(() => {
    const rolGuardado = localStorage.getItem("rolUsuario")
    if (rolGuardado) {
      setRolActual(rolGuardado)
    }
  }, [])

  function cambiarRol(rol) {
    setRolActual(rol)
    localStorage.setItem("rolUsuario", rol)
  }

  function tienePermiso(permiso) {
    const permisosPorRol = {
      [ROLES_USUARIO.SUPER_ADMIN]: [
        "ver_dashboard_global",
        "gestionar_tiendas",
        "ver_todas_tiendas",
        "transferencias",
        "anular_ventas",
        "eliminar_ventas",
        "editar_productos",
        "eliminar_productos",
        "crear_productos",
        "editar_clientes",
        "eliminar_clientes",
        "crear_clientes",
      ],
      [ROLES_USUARIO.ADMIN_TIENDA]: [
        "ver_dashboard",
        "ver_reportes",
        "ventas",
        "anular_ventas",
        "editar_productos",
        "eliminar_productos",
        "crear_productos",
        "editar_clientes",
        "eliminar_clientes",
        "crear_clientes",
        "transferencias",
      ],
      [ROLES_USUARIO.VENDEDOR]: [
        "ver_dashboard",
        "ventas",
        "ver_productos",
        "ver_clientes",
        "ver_reportes",
        "crear_clientes",
      ],
      [ROLES_USUARIO.LECTOR]: [
        "ver_dashboard",
        "ver_productos",
        "ver_clientes",
        "ver_reportes",
        "ver_ventas",
      ],
    }

    return permisosPorRol[rolActual]?.includes(permiso) || false
  }

  function esSuperAdmin() {
    return rolActual === ROLES_USUARIO.SUPER_ADMIN
  }

  function esAdminTienda() {
    return rolActual === ROLES_USUARIO.ADMIN_TIENDA
  }

  function puedeVerTodasTiendas() {
    return esSuperAdmin()
  }

  function puedeGestionarTiendas() {
    return esSuperAdmin()
  }

  function puedeAnularVentas() {
    return tienePermiso("anular_ventas")
  }

  function puedeEliminarVentas() {
    return tienePermiso("eliminar_ventas")
  }

  function puedeEditarProductos() {
    return tienePermiso("editar_productos")
  }

  function puedeEliminarProductos() {
    return tienePermiso("eliminar_productos")
  }

  function puedeCrearProductos() {
    return tienePermiso("crear_productos")
  }

  function puedeEditarClientes() {
    return tienePermiso("editar_clientes")
  }

  function puedeEliminarClientes() {
    return tienePermiso("eliminar_clientes")
  }

  function puedeCrearClientes() {
    return tienePermiso("crear_clientes")
  }

  function puedeHacerTransferencias() {
    return tienePermiso("transferencias")
  }

  const value = {
    rolActual,
    cambiarRol,
    tienePermiso,
    esSuperAdmin,
    esAdminTienda,
    puedeVerTodasTiendas,
    puedeGestionarTiendas,
    puedeAnularVentas,
    puedeEliminarVentas,
    puedeEditarProductos,
    puedeEliminarProductos,
    puedeCrearProductos,
    puedeEditarClientes,
    puedeEliminarClientes,
    puedeCrearClientes,
    puedeHacerTransferencias,
  }

  return <RolContext.Provider value={value}>{children}</RolContext.Provider>
}
