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

  // Ya es un Date object
  if (fecha instanceof Date) {
    return fecha
  }

  // Timestamp numérico
  if (typeof fecha === "number") {
    return new Date(fecha)
  }

  // String
  const texto = String(fecha)
  const directo = Date.parse(texto)

  if (!Number.isNaN(directo)) {
    return new Date(directo)
  }

  // Formato DD/MM/YYYY
  const partes = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (partes) {
    const [, dia, mes, anio] = partes
    return new Date(Number(anio), Number(mes) - 1, Number(dia))
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
