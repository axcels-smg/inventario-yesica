export function formatearFecha(fecha) {
  if (!fecha) return ""

  if (typeof fecha?.toDate === "function") {
    return fecha.toDate().toLocaleString("es-PE")
  }

  return String(fecha)
}

export function esFechaDeHoy(fecha) {
  if (!fecha) return false

  const hoy = new Date().toLocaleDateString("es-PE")

  if (typeof fecha?.toDate === "function") {
    return fecha.toDate().toLocaleDateString("es-PE") === hoy
  }

  return String(fecha).includes(hoy)
}
