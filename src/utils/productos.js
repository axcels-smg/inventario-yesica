export const MIN_CARACTERES_BUSQUEDA = 2
export const MAX_RESULTADOS_VENTAS = 30
export const PRODUCTOS_POR_PAGINA = 25

export function textoBusquedaProducto(producto) {
  return [
    producto.codigo,
    producto.marca,
    producto.modelo,
    producto.categoria,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}

export function filtrarProductos(
  productos,
  { busqueda = "", marca = "", categoria = "" } = {}
) {
  let lista = productos

  if (marca) {
    lista = lista.filter((p) => p.marca === marca)
  }

  if (categoria) {
    lista = lista.filter((p) => p.categoria === categoria)
  }

  const terminos = busqueda.toLowerCase().trim().split(/\s+/).filter(Boolean)

  if (terminos.length > 0) {
    lista = lista.filter((p) => {
      const texto = textoBusquedaProducto(p)
      return terminos.every((termino) => texto.includes(termino))
    })
  }

  return lista
}

export function obtenerValoresUnicos(productos, campo) {
  return [...new Set(productos.map((p) => p[campo]).filter(Boolean))].sort(
    (a, b) => String(a).localeCompare(String(b), "es")
  )
}

/** Normaliza texto para comparar modelos (sin mayúsculas ni espacios de más). */
export function normalizarModelo(modelo) {
  return String(modelo || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
}

export function claveModeloProducto(producto) {
  const marca = String(producto?.marca || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
  const modelo = normalizarModelo(producto?.modelo)
  return `${marca}||${modelo}`
}

/**
 * Busca otro producto de la misma tienda con la misma marca + modelo.
 * excludeId: al editar, ignora el producto actual.
 */
export function buscarProductoDuplicado(
  productos,
  { marca, modelo, excludeId = null } = {}
) {
  const clave = claveModeloProducto({ marca, modelo })
  if (!clave || clave === "||") return null

  return (
    productos.find((p) => {
      if (excludeId && p.id === excludeId) return false
      return claveModeloProducto(p) === clave
    }) || null
  )
}

/** Modelos que aparecen más de una vez (no borra nada, solo informa). */
export function obtenerModelosDuplicados(productos) {
  const conteo = new Map()

  productos.forEach((p) => {
    const clave = claveModeloProducto(p)
    if (!clave || clave === "||") return

    const actual = conteo.get(clave) || {
      marca: p.marca,
      modelo: p.modelo,
      cantidad: 0,
      ids: [],
    }
    actual.cantidad += 1
    actual.ids.push(p.id)
    conteo.set(clave, actual)
  })

  return [...conteo.values()]
    .filter((item) => item.cantidad > 1)
    .sort((a, b) =>
      String(a.modelo).localeCompare(String(b.modelo), "es")
    )
}

export function conteoPorClaveModelo(productos) {
  const mapa = new Map()
  productos.forEach((p) => {
    const clave = claveModeloProducto(p)
    if (!clave || clave === "||") return
    mapa.set(clave, (mapa.get(clave) || 0) + 1)
  })
  return mapa
}
