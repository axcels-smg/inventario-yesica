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

  const tiempo = obtenerTiempoFecha(fecha)

  if (!tiempo) {
    return String(fecha).includes(hoy)
  }

  return new Date(tiempo).toLocaleDateString("es-PE") === hoy
}

export function obtenerTiempoFecha(fecha) {
  if (!fecha) return 0

  if (typeof fecha?.toDate === "function") {
    return fecha.toDate().getTime()
  }

  const texto = String(fecha)
  const directo = Date.parse(texto)

  if (!Number.isNaN(directo)) {
    return directo
  }

  const partes = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)

  if (!partes) return 0

  const [, dia, mes, anio] = partes
  return new Date(Number(anio), Number(mes) - 1, Number(dia)).getTime()
}
