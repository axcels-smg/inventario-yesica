/**
 * Normaliza cualquier formato de fecha a un objeto Date
 * Soporta: Timestamp de Firebase (con toDate()), strings, Date objects, timestamps numéricos
 * @param {any} fecha - La fecha a normalizar
 * @returns {Date|null} - Objeto Date o null si no es válida
 */
export function normalizarFecha(fecha) {
  if (!fecha) return null

  // Firebase Timestamp
  if (typeof fecha?.toDate === "function") {
    return fecha.toDate()
  }

  // Timestamp serializado { seconds, nanoseconds }
  if (typeof fecha?.seconds === "number") {
    return new Date(fecha.seconds * 1000)
  }

  // Ya es un Date object
  if (fecha instanceof Date) {
    return Number.isNaN(fecha.getTime()) ? null : fecha
  }

  // Timestamp numérico
  if (typeof fecha === "number") {
    const d = new Date(fecha)
    return Number.isNaN(d.getTime()) ? null : d
  }

  // String: primero DD/MM/YYYY (es-PE), luego parseo genérico
  const texto = String(fecha)
  const partes = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (partes) {
    const [, dia, mes, anio] = partes
    const d = new Date(Number(anio), Number(mes) - 1, Number(dia))
    if (!Number.isNaN(d.getTime())) return d
  }

  const directo = Date.parse(texto)

  if (!Number.isNaN(directo)) {
    return new Date(directo)
  }

  return null
}

export function formatearFecha(fecha) {
  if (!fecha) return ""

  const fechaNormalizada = normalizarFecha(fecha)
  if (!fechaNormalizada) return String(fecha)

  return fechaNormalizada.toLocaleString("es-PE")
}

export function esFechaDeHoy(fecha) {
  if (!fecha) return false

  const fechaNormalizada = normalizarFecha(fecha)
  if (!fechaNormalizada) return false

  const hoy = new Date().toLocaleDateString("es-PE")
  return fechaNormalizada.toLocaleDateString("es-PE") === hoy
}

export function obtenerTiempoFecha(fecha) {
  const fechaNormalizada = normalizarFecha(fecha)
  if (!fechaNormalizada) return 0

  return fechaNormalizada.getTime()
}
