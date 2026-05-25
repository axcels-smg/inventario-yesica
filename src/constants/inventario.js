export const STOCK_BAJO_UMBRAL = 2

export const DATOS_NEGOCIO = {
  nombre: "INVENTARIO YESICA",
  ruc: "20600000000",
  direccion: "Av. Principal 123, Lima",
  telefono: "+51 999 888 777",
  email: "contacto@inventarioyesica.com",
  sitioWeb: "www.inventarioyesica.com",
}

export const ROLES_USUARIO = {
  SUPER_ADMIN: "super_admin",
  ADMIN_TIENDA: "admin_tienda",
  VENDEDOR: "vendedor",
  LECTOR: "lector",
}

export const ETIQUETAS_ROLES = {
  super_admin: "Super Admin",
  admin_tienda: "Admin Tienda",
  vendedor: "Vendedor",
  lector: "Lector",
}

export const ESTADOS_TRANSFERENCIA = {
  PENDIENTE: "pendiente",
  APROBADA: "aprobada",
  EN_TRANSITO: "en_transito",
  COMPLETADA: "completada",
  RECHAZADA: "rechazada",
  CANCELADA: "cancelada",
}

export const ETIQUETAS_ESTADOS_TRANSFERENCIA = {
  pendiente: "Pendiente",
  aprobada: "Aprobada",
  en_transito: "En Tránsito",
  completada: "Completada",
  rechazada: "Rechazada",
  cancelada: "Cancelada",
}

export const TIPOS_MOVIMIENTO = {
  VENTA: "venta",
  ANULACION: "anulacion",
  REPOSICION: "reposicion",
  EDICION_STOCK: "edicion_stock",
  IMPORTACION: "importacion",
  TRANSFERENCIA_SALIDA: "transferencia_salida",
  TRANSFERENCIA_ENTRADA: "transferencia_entrada",
}

export const ETIQUETAS_MOVIMIENTO = {
  venta: "Venta",
  anulacion: "Anulación",
  reposicion: "Reposición",
  edicion_stock: "Edición stock",
  importacion: "Importación Excel",
  transferencia_salida: "Transferencia Salida",
  transferencia_entrada: "Transferencia Entrada",
}
