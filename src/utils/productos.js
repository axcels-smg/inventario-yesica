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
