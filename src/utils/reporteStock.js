import { etiquetaEstadoStock, stockNumero, filtrarProductosPorEstadoStock } from "./stock"

export function compararInventario(a, b) {
  return String(a || "").localeCompare(String(b || ""), "es", {
    numeric: true,
    sensitivity: "base",
  })
}

export function fichaProductoStock(producto, nombreTienda = "") {
  const precio = Number(producto.precio) || 0
  const stock = stockNumero(producto.stock)
  return {
    id: producto.id,
    tienda: nombreTienda || producto.tiendaNombre || "",
    tiendaId: producto.tiendaId || "",
    categoria: String(producto.categoria || "").trim() || "Sin categoría",
    marca: String(producto.marca || "").trim() || "Sin marca",
    modelo: String(producto.modelo || "").trim() || "Sin modelo",
    codigo: producto.codigo ? String(producto.codigo).trim() : "",
    precio,
    stock,
    estado: etiquetaEstadoStock(producto.stock),
    valor: Math.round(precio * stock * 100) / 100,
  }
}

function resumenGrupo(modelos) {
  return {
    cantidad: modelos.length,
    noHay: modelos.filter((m) => m.estado === "No hay").length,
    poco: modelos.filter((m) => m.estado === "Poco stock").length,
    stock: modelos.reduce((s, m) => s + m.stock, 0),
  }
}

export function agruparPorCategoriaMarcaModelo(productos, nombreTienda = "") {
  const fichas = productos
    .map((p) => fichaProductoStock(p, nombreTienda))
    .sort(
      (a, b) =>
        compararInventario(a.categoria, b.categoria) ||
        compararInventario(a.marca, b.marca) ||
        compararInventario(a.modelo, b.modelo)
    )

  const categorias = []
  const mapaCat = new Map()

  fichas.forEach((ficha) => {
    if (!mapaCat.has(ficha.categoria)) {
      const grupo = { categoria: ficha.categoria, marcas: [], _marcas: new Map() }
      mapaCat.set(ficha.categoria, grupo)
      categorias.push(grupo)
    }
    const cat = mapaCat.get(ficha.categoria)
    if (!cat._marcas.has(ficha.marca)) {
      const marca = { marca: ficha.marca, modelos: [] }
      cat._marcas.set(ficha.marca, marca)
      cat.marcas.push(marca)
    }
    cat._marcas.get(ficha.marca).modelos.push(ficha)
  })

  return categorias.map(({ categoria, marcas }) => {
    const modelos = marcas.flatMap((m) => m.modelos)
    return {
      categoria,
      marcas,
      ...resumenGrupo(modelos),
    }
  })
}

export function agruparPocoStockPorTienda(
  productos,
  tiendas = [],
  { estadoStock = "bajo" } = {}
) {
  const mapaNombres = {}
  tiendas.forEach((t) => {
    if (t?.id) mapaNombres[t.id] = t.nombre || t.id
  })

  const porTienda = new Map()
  productos.forEach((p) => {
    const id = p.tiendaId || "sin-tienda"
    if (!porTienda.has(id)) porTienda.set(id, [])
    porTienda.get(id).push(p)
  })

  return [...porTienda.entries()]
    .map(([id, lista]) => {
      const nombre = mapaNombres[id] || lista[0]?.tiendaNombre || "Sin tienda"
      const filtrada = filtrarProductosPorEstadoStock(lista, estadoStock)

      return {
        tiendaId: id,
        nombre,
        grupos: agruparPorCategoriaMarcaModelo(filtrada, nombre),
        total: filtrada.length,
      }
    })
    .filter((t) => t.total > 0)
    .sort((a, b) => compararInventario(a.nombre, b.nombre))
}

export function textoStockPorCategoriaMarca(productos, nombreTienda = "", limite = 80) {
  const grupos = agruparPorCategoriaMarcaModelo(productos, nombreTienda)
  const lineas = []
  let contador = 0

  for (const cat of grupos) {
    if (contador >= limite) break
    lineas.push(`\n*${cat.categoria}* (${cat.cantidad})`)
    for (const marca of cat.marcas) {
      if (contador >= limite) break
      lineas.push(`${marca.marca}`)
      for (const m of marca.modelos) {
        if (contador >= limite) break
        const codigo = m.codigo ? ` [${m.codigo}]` : ""
        lineas.push(
          `• ${m.modelo}${codigo} · S/ ${m.precio} · ${m.stock} u. · ${m.estado}`
        )
        contador += 1
      }
    }
  }

  const extra = productos.length > contador ? `\n…y ${productos.length - contador} más` : ""
  const titulo = nombreTienda ? ` — ${nombreTienda}` : ""

  return (
    `Poco stock / no hay${titulo}\n` +
    `Agrupado: categoría → marca → modelo\n` +
    lineas.join("\n") +
    extra
  )
}
