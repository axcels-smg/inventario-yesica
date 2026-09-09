import * as XLSX from "xlsx"
import { formatearFecha } from "./fechas"
import { formatearNumeroBoleta } from "./boleta"
import { filtrarVentasActivas } from "./ventas"
import { etiquetaEstadoStock, stockNumero } from "./stock"
import {
  agruparPorCategoriaMarcaModelo,
  agruparPocoStockPorTienda,
} from "./reporteStock"

const COLUMNAS_PRODUCTOS = [
  "codigo",
  "marca",
  "categoria",
  "modelo",
  "precio",
  "stock",
]

function normalizarClave(clave) {
  return String(clave || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
}

function mapearFilaProducto(fila) {
  const mapa = {}

  Object.entries(fila).forEach(([clave, valor]) => {
    mapa[normalizarClave(clave)] = valor
  })

  const leer = (...alias) => {
    for (const a of alias) {
      const v = mapa[normalizarClave(a)]
      if (v !== undefined && v !== null && v !== "") return String(v).trim()
    }
    return ""
  }

  return {
    codigo: leer("codigo", "sku", "code"),
    marca: leer("marca", "brand"),
    categoria: leer("categoria", "category"),
    modelo: leer("modelo", "model"),
    precio: Number(leer("precio", "price")) || 0,
    stock: Number.parseInt(leer("stock", "inventario"), 10) || 0,
  }
}

export function exportarProductosExcel(productos) {
  const filas = productos.map((p) => ({
    Codigo: p.codigo || "",
    Marca: p.marca || "",
    Categoria: p.categoria || "",
    Modelo: p.modelo || "",
    Precio: Number(p.precio) || 0,
    Stock: Number(p.stock) || 0,
  }))

  const hoja = XLSX.utils.json_to_sheet(filas)
  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(libro, hoja, "Inventario")

  hoja["!cols"] = [
    { wch: 14 },
    { wch: 16 },
    { wch: 14 },
    { wch: 22 },
    { wch: 10 },
    { wch: 8 },
  ]

  XLSX.writeFile(
    libro,
    `inventario-${new Date().toISOString().slice(0, 10)}.xlsx`
  )
}

export function exportarPlantillaExcel() {
  const ejemplo = [
    {
      Codigo: "SKU-001",
      Marca: "Nike",
      Categoria: "Zapatillas",
      Modelo: "Air Max",
      Precio: 250,
      Stock: 10,
    },
  ]

  const hoja = XLSX.utils.json_to_sheet(ejemplo)
  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(libro, hoja, "Plantilla")
  XLSX.writeFile(libro, "plantilla-inventario.xlsx")
}

export function leerProductosDesdeExcel(archivo) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const libro = XLSX.read(data, { type: "array" })
        const hoja = libro.Sheets[libro.SheetNames[0]]
        const filas = XLSX.utils.sheet_to_json(hoja)

        const productos = filas
          .map(mapearFilaProducto)
          .filter((p) => p.marca && p.modelo && p.categoria)

        resolve(productos)
      } catch (error) {
        reject(error)
      }
    }

    reader.onerror = reject
    reader.readAsArrayBuffer(archivo)
  })
}

export function exportarReporteContable(ventas) {
  const activas = filtrarVentasActivas(ventas)
  const filas = []

  activas.forEach((venta) => {
    const numero =
      venta.numeroBoleta != null
        ? formatearNumeroBoleta(venta.numeroBoleta)
        : ""

    const fecha = formatearFecha(venta.fecha || venta.fechaTexto)

    if (!venta.productos?.length) {
      filas.push({
        Fecha: fecha,
        Boleta: numero,
        Cliente: venta.cliente || "",
        Telefono: venta.telefono || "",
        Producto: "—",
        Cantidad: 0,
        PrecioUnit: 0,
        Subtotal: 0,
        TotalVenta: Number(venta.total) || 0,
      })
      return
    }

    venta.productos.forEach((p, index) => {
      const sub = Number(p.precio) * Number(p.cantidad)
      filas.push({
        Fecha: fecha,
        Boleta: numero,
        Cliente: venta.cliente || "",
        Telefono: venta.telefono || "",
        Producto: `${p.marca || ""} ${p.modelo || ""}`.trim(),
        Codigo: p.codigo || "",
        Cantidad: Number(p.cantidad) || 0,
        PrecioUnit: Number(p.precio) || 0,
        Subtotal: sub,
        TotalVenta: index === 0 ? Number(venta.total) || 0 : "",
      })
    })
  })

  const hoja = XLSX.utils.json_to_sheet(filas)
  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(libro, hoja, "Ventas contables")

  hoja["!cols"] = [
    { wch: 18 },
    { wch: 10 },
    { wch: 20 },
    { wch: 12 },
    { wch: 28 },
    { wch: 12 },
    { wch: 8 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
  ]

  XLSX.writeFile(
    libro,
    `contabilidad-ventas-${fechaArchivoLocal()}.xlsx`
  )
}

function fechaArchivoLocal() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function slugArchivo(nombre) {
  return String(nombre || "tienda")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 40) || "tienda"
}

function nombreHojaExcel(texto, usados) {
  let base = String(texto || "Hoja")
    .replace(/[\\/?*[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 31)
  if (!base) base = "Hoja"

  let nombre = base
  let i = 2
  while (usados.has(nombre.toLowerCase())) {
    const sufijo = ` (${i})`
    nombre = `${base.slice(0, Math.max(1, 31 - sufijo.length))}${sufijo}`
    i += 1
  }
  usados.add(nombre.toLowerCase())
  return nombre
}

function nombreTiendaDeProducto(producto, mapaTiendas) {
  if (producto?.tiendaNombre) return producto.tiendaNombre
  const id = producto?.tiendaId
  if (id && mapaTiendas[id]) return mapaTiendas[id]
  return "Sin tienda"
}

function filaInventarioDetallada(producto, nombreTienda) {
  const precio = Number(producto.precio) || 0
  const stock = stockNumero(producto.stock)
  return {
    Tienda: nombreTienda || "",
    Codigo: producto.codigo || "",
    Marca: producto.marca || "",
    Categoria: String(producto.categoria || "").trim() || "Sin categoria",
    Modelo: producto.modelo || "",
    Precio: precio,
    Stock: stock,
    Estado: etiquetaEstadoStock(producto.stock),
    Valor: Math.round(precio * stock * 100) / 100,
  }
}

function compararTexto(a, b) {
  return String(a || "").localeCompare(String(b || ""), "es", {
    numeric: true,
    sensitivity: "base",
  })
}

function ordenarFilasInventario(filas) {
  return [...filas].sort((a, b) => {
    const c = compararTexto(a.Categoria, b.Categoria)
    if (c !== 0) return c
    const m = compararTexto(a.Marca, b.Marca)
    if (m !== 0) return m
    const mo = compararTexto(a.Modelo, b.Modelo)
    if (mo !== 0) return mo
    const t = compararTexto(a.Tienda, b.Tienda)
    if (t !== 0) return t
    return compararTexto(a.Codigo, b.Codigo)
  })
}

function agruparFilasPorCategoria(filas) {
  const mapa = new Map()
  filas.forEach((fila) => {
    const cat = fila.Categoria || "Sin categoria"
    if (!mapa.has(cat)) mapa.set(cat, [])
    mapa.get(cat).push(fila)
  })
  return [...mapa.entries()].sort((a, b) => compararTexto(a[0], b[0]))
}

function claveModelo(fila, incluirTienda) {
  const base = [
    String(fila.Marca || "").trim().toLowerCase(),
    String(fila.Categoria || "").trim().toLowerCase(),
    String(fila.Modelo || "").trim().toLowerCase(),
  ].join("||")
  return incluirTienda ? `${String(fila.Tienda || "").toLowerCase()}||${base}` : base
}

function consolidarPorModelo(filas, incluirTienda) {
  const mapa = new Map()

  filas.forEach((fila) => {
    const clave = claveModelo(fila, incluirTienda)
    if (!mapa.has(clave)) {
      mapa.set(clave, {
        Tienda: fila.Tienda,
        Modelo: fila.Modelo || "—",
        Marca: fila.Marca || "—",
        Categoria: fila.Categoria || "Sin categoria",
        Codigos: [],
        Precios: [],
        Stock: 0,
        Valor: 0,
        Lineas: 0,
      })
    }
    const g = mapa.get(clave)
    g.Lineas += 1
    g.Stock += Number(fila.Stock) || 0
    g.Valor += Number(fila.Valor) || 0
    if (fila.Codigo && !g.Codigos.includes(fila.Codigo)) g.Codigos.push(fila.Codigo)
    if (!g.Precios.includes(fila.Precio)) g.Precios.push(fila.Precio)
  })

  return ordenarFilasInventario(
    [...mapa.values()].map((g) => ({
      Tienda: g.Tienda,
      Modelo: g.Modelo,
      Marca: g.Marca,
      Categoria: g.Categoria,
      Codigo: g.Codigos.join(" / ") || "—",
      "Precio unit.": g.Precios.length === 1 ? g.Precios[0] : "Varios",
      Stock: g.Stock,
      Estado: etiquetaEstadoStock(g.Stock),
      Valor: Math.round(g.Valor * 100) / 100,
      Lineas: g.Lineas,
    }))
  )
}

function consolidarModeloTodasLasTiendas(filas, nombresTiendas) {
  const mapa = new Map()

  filas.forEach((fila) => {
    const clave = claveModelo(fila, false)
    if (!mapa.has(clave)) {
      const stockPorTienda = {}
      nombresTiendas.forEach((t) => {
        stockPorTienda[t] = 0
      })
      mapa.set(clave, {
        Modelo: fila.Modelo || "—",
        Marca: fila.Marca || "—",
        Categoria: fila.Categoria || "Sin categoria",
        Codigos: [],
        Precios: [],
        stockPorTienda,
      })
    }
    const g = mapa.get(clave)
    const tienda = fila.Tienda || "Sin tienda"
    if (g.stockPorTienda[tienda] == null) g.stockPorTienda[tienda] = 0
    g.stockPorTienda[tienda] += Number(fila.Stock) || 0
    if (fila.Codigo && !g.Codigos.includes(fila.Codigo)) g.Codigos.push(fila.Codigo)
    if (!g.Precios.includes(fila.Precio)) g.Precios.push(fila.Precio)
  })

  return [...mapa.values()]
    .map((g) => {
      const total = Object.values(g.stockPorTienda).reduce((s, n) => s + n, 0)
      const precio = g.Precios.length === 1 ? g.Precios[0] : "Varios"
      const valor =
        typeof precio === "number"
          ? Math.round(precio * total * 100) / 100
          : ""
      const fila = {
        Modelo: g.Modelo,
        Marca: g.Marca,
        Categoria: g.Categoria,
        Codigo: g.Codigos.join(" / ") || "—",
        "Precio unit.": precio,
      }
      nombresTiendas.forEach((t) => {
        fila[t] = g.stockPorTienda[t] || 0
      })
      fila["Stock total"] = total
      fila.Estado = etiquetaEstadoStock(total)
      fila.Valor = valor
      return fila
    })
    .sort((a, b) => {
      const c = compararTexto(a.Categoria, b.Categoria)
      if (c !== 0) return c
      const m = compararTexto(a.Marca, b.Marca)
      if (m !== 0) return m
      return compararTexto(a.Modelo, b.Modelo)
    })
}

function resumenDeFilas(filas, tienda, categoria) {
  const modelos = new Set(
    filas.map((f) =>
      `${String(f.Marca).toLowerCase()}|${String(f.Categoria).toLowerCase()}|${String(f.Modelo).toLowerCase()}`
    )
  )
  return {
    Tienda: tienda,
    Categoria: categoria,
    Modelos: modelos.size,
    Lineas: filas.length,
    "Stock total": filas.reduce((s, f) => s + (Number(f.Stock) || 0), 0),
    "No hay": filas.filter((f) => f.Estado === "No hay").length,
    "Poco stock": filas.filter((f) => f.Estado === "Poco stock").length,
    "Con stock": filas.filter((f) => f.Estado === "OK").length,
    "Valor inventario": Math.round(
      filas.reduce((s, f) => s + (Number(f.Valor) || 0), 0) * 100
    ) / 100,
  }
}

function columnasDetalle(incluirTienda) {
  const cols = [
    "N°",
    "Modelo",
    "Marca",
    "Categoria",
    "Codigo",
    "Precio unit.",
    "Stock",
    "Estado",
    "Valor",
  ]
  if (incluirTienda) cols.push("Tienda")
  return cols
}

function mapearFilaDetalle(fila, indice, incluirTienda) {
  const row = {
    "N°": indice,
    Modelo: fila.Modelo || "—",
    Marca: fila.Marca || "—",
    Categoria: fila.Categoria || "—",
    Codigo: fila.Codigo || "—",
    "Precio unit.": fila["Precio unit."] ?? fila.Precio ?? 0,
    Stock: fila.Stock,
    Estado: fila.Estado,
    Valor: fila.Valor,
  }
  if (incluirTienda) row.Tienda = fila.Tienda || ""
  return row
}

function anchosColumnas(columnas) {
  return columnas.map((col) => {
    if (col === "Modelo") return { wch: 38 }
    if (col === "Tienda" || col === "Categoria" || col === "Codigo") return { wch: 18 }
    if (col === "Marca") return { wch: 14 }
    if (col === "Estado") return { wch: 12 }
    if (col === "N°") return { wch: 6 }
    return { wch: 13 }
  })
}

function aplicarFiltroYCongelar(hoja, numCols, filasDatos) {
  if (filasDatos <= 0) return
  const lastCol = XLSX.utils.encode_col(numCols - 1)
  hoja["!autofilter"] = { ref: `A1:${lastCol}${filasDatos + 1}` }
  hoja["!views"] = [
    {
      state: "frozen",
      ySplit: 1,
      topLeftCell: "A2",
      activePane: "bottomLeft",
    },
  ]
}

function hojaTablaProfesional(filas, columnas, { totales } = {}) {
  const hoja = filas.length
    ? XLSX.utils.json_to_sheet(filas, { header: columnas })
    : XLSX.utils.aoa_to_sheet([columnas])

  aplicarFiltroYCongelar(hoja, columnas.length, filas.length)

  if (totales && filas.length) {
    XLSX.utils.sheet_add_aoa(hoja, [[], totales], { origin: -1 })
  }

  hoja["!cols"] = anchosColumnas(columnas)
  return hoja
}

function hojaDesdeFilas(filas, incluirTienda) {
  const columnas = columnasDetalle(incluirTienda)
  const data = filas.map((fila, i) => mapearFilaDetalle(fila, i + 1, incluirTienda))
  const stockTotal = filas.reduce((s, f) => s + (Number(f.Stock) || 0), 0)
  const valorTotal = Math.round(filas.reduce((s, f) => s + (Number(f.Valor) || 0), 0) * 100) / 100
  const noHay = filas.filter((f) => f.Estado === "No hay").length
  const poco = filas.filter((f) => f.Estado === "Poco stock").length
  const modelos = new Set(filas.map((f) => claveModelo(f, false))).size

  const totales = columnas.map((col, i) => {
    if (i === 0) return "TOTALES"
    if (col === "Modelo") return `${modelos} modelos · ${filas.length} líneas`
    if (col === "Stock") return stockTotal
    if (col === "Estado") return `${noHay} no hay · ${poco} poco`
    if (col === "Valor") return valorTotal
    return ""
  })

  return hojaTablaProfesional(data, columnas, { totales })
}

function hojaPorModelo(filas, incluirTienda) {
  const consolidadas = consolidarPorModelo(filas, incluirTienda)
  const columnas = [
    "N°",
    "Modelo",
    "Marca",
    "Categoria",
    "Codigo",
    "Precio unit.",
    "Stock",
    "Estado",
    "Valor",
  ]
  if (incluirTienda) columnas.push("Tienda")
  columnas.push("Lineas")

  const data = consolidadas.map((fila, i) => {
    const row = mapearFilaDetalle(fila, i + 1, incluirTienda)
    row.Lineas = fila.Lineas
    return row
  })

  const stockTotal = consolidadas.reduce((s, f) => s + (Number(f.Stock) || 0), 0)
  const valorTotal = Math.round(consolidadas.reduce((s, f) => s + (Number(f.Valor) || 0), 0) * 100) / 100
  const noHay = consolidadas.filter((f) => f.Estado === "No hay").length

  const totales = columnas.map((col, i) => {
    if (i === 0) return "TOTALES"
    if (col === "Modelo") return `${consolidadas.length} modelos únicos`
    if (col === "Stock") return stockTotal
    if (col === "Estado") return `${noHay} sin stock`
    if (col === "Valor") return valorTotal
    return ""
  })

  return hojaTablaProfesional(data, columnas, { totales })
}

function hojaModeloPorTienda(filas, nombresTiendas) {
  const data = consolidarModeloTodasLasTiendas(filas, nombresTiendas).map((fila, i) => ({
    "N°": i + 1,
    ...fila,
  }))
  const columnas = data[0]
    ? Object.keys(data[0])
    : ["N°", "Modelo", "Marca", "Categoria", "Codigo", "Precio unit.", "Stock total", "Estado", "Valor"]

  const stockTotal = data.reduce((s, f) => s + (Number(f["Stock total"]) || 0), 0)
  const noHay = data.filter((f) => f.Estado === "No hay").length
  const totales = columnas.map((col, i) => {
    if (i === 0) return "TOTALES"
    if (col === "Modelo") return `${data.length} modelos`
    if (col === "Stock total") return stockTotal
    if (col === "Estado") return `${noHay} sin stock`
    return ""
  })

  const hoja = hojaTablaProfesional(data, columnas, { totales })
  hoja["!cols"] = columnas.map((col) => {
    if (col === "Modelo") return { wch: 38 }
    if (col === "N°") return { wch: 6 }
    if (col === "Categoria" || col === "Codigo") return { wch: 16 }
    return { wch: 12 }
  })
  return hoja
}

function armarLibroInventarioDetallado(filas, { incluirTienda, tituloResumen }) {
  const libro = XLSX.utils.book_new()
  const usados = new Set()
  const grupos = agruparFilasPorCategoria(filas)
  const nombresTiendas = [...new Set(filas.map((f) => f.Tienda).filter(Boolean))].sort(compararTexto)

  const resumenCategorias = grupos.map(([categoria, lista]) =>
    resumenDeFilas(lista, tituloResumen, categoria)
  )
  const resumenTiendas = []
  const porTienda = new Map()
  filas.forEach((fila) => {
    const t = fila.Tienda || tituloResumen
    if (!porTienda.has(t)) porTienda.set(t, [])
    porTienda.get(t).push(fila)
  })
  ;[...porTienda.entries()]
    .sort((a, b) => compararTexto(a[0], b[0]))
    .forEach(([tienda, lista]) => {
      resumenTiendas.push(resumenDeFilas(lista, tienda, "TODAS"))
      agruparFilasPorCategoria(lista).forEach(([categoria, deCat]) => {
        resumenTiendas.push(resumenDeFilas(deCat, tienda, categoria))
      })
    })

  const filasResumen = incluirTienda ? resumenTiendas : resumenCategorias
  const hojaResumen = XLSX.utils.json_to_sheet(
    filasResumen.length
      ? filasResumen
      : [
          {
            Tienda: tituloResumen,
            Categoria: "—",
            Modelos: 0,
            Lineas: 0,
            "Stock total": 0,
            "No hay": 0,
            "Poco stock": 0,
            "Con stock": 0,
            "Valor inventario": 0,
          },
        ]
  )
  hojaResumen["!cols"] = [
    { wch: 24 },
    { wch: 18 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
    { wch: 16 },
  ]
  aplicarFiltroYCongelar(hojaResumen, 9, filasResumen.length)
  XLSX.utils.book_append_sheet(libro, hojaResumen, nombreHojaExcel("Resumen", usados))

  if (incluirTienda && nombresTiendas.length > 1) {
    XLSX.utils.book_append_sheet(
      libro,
      hojaModeloPorTienda(filas, nombresTiendas),
      nombreHojaExcel("Por modelo", usados)
    )
  } else {
    XLSX.utils.book_append_sheet(
      libro,
      hojaPorModelo(filas, incluirTienda),
      nombreHojaExcel("Por modelo", usados)
    )
  }

  const sinStock = consolidarPorModelo(filas, incluirTienda).filter((f) => f.Estado === "No hay")
  XLSX.utils.book_append_sheet(
    libro,
    hojaDesdeFilas(sinStock, incluirTienda),
    nombreHojaExcel("Sin stock", usados)
  )

  XLSX.utils.book_append_sheet(
    libro,
    hojaDesdeFilas(filas, incluirTienda),
    nombreHojaExcel("Detalle", usados)
  )

  grupos.forEach(([categoria, lista]) => {
    const hoja =
      incluirTienda && nombresTiendas.length > 1
        ? hojaModeloPorTienda(lista, nombresTiendas)
        : hojaPorModelo(lista, incluirTienda)
    XLSX.utils.book_append_sheet(
      libro,
      hoja,
      nombreHojaExcel(categoria, usados)
    )
  })

  return libro
}

export function exportarInventarioDetalladoTienda(productos, nombreTienda = "Tienda") {
  const filas = ordenarFilasInventario(
    productos.map((p) => filaInventarioDetallada(p, nombreTienda))
  )
  const libro = armarLibroInventarioDetallado(filas, {
    incluirTienda: false,
    tituloResumen: nombreTienda,
  })
  XLSX.writeFile(
    libro,
    `inventario-${slugArchivo(nombreTienda)}-${fechaArchivoLocal()}.xlsx`
  )
  return {
    productos: filas.length,
    modelos: new Set(filas.map((f) => claveModelo(f, false))).size,
    categorias: agruparFilasPorCategoria(filas).length,
  }
}

export function exportarInventarioDetalladoTodasLasTiendas(productos, tiendas = []) {
  const mapaTiendas = {}
  tiendas.forEach((t) => {
    if (t?.id) mapaTiendas[t.id] = t.nombre || t.id
  })

  const filas = ordenarFilasInventario(
    productos.map((p) =>
      filaInventarioDetallada(p, nombreTiendaDeProducto(p, mapaTiendas))
    )
  )
  const libro = armarLibroInventarioDetallado(filas, {
    incluirTienda: true,
    tituloResumen: "Todas las tiendas",
  })
  XLSX.writeFile(
    libro,
    `inventario-todas-las-tiendas-${fechaArchivoLocal()}.xlsx`
  )
  return {
    productos: filas.length,
    modelos: new Set(filas.map((f) => claveModelo(f, false))).size,
    categorias: agruparFilasPorCategoria(filas).length,
    tiendas: new Set(filas.map((f) => f.Tienda)).size,
  }
}

export function exportarPocoStockEstructurado({
  productos,
  nombreTienda = "Tienda",
  tiendas = [],
  todas = false,
  estadoStock = "bajo",
} = {}) {
  const columnas = [
    "Tienda",
    "Categoria",
    "Marca",
    "Modelo",
    "Codigo",
    "Precio unit.",
    "Stock",
    "Estado",
    "Valor",
  ]

  function filasDeGrupos(grupos, tienda) {
    const filas = []
    grupos.forEach((cat) => {
      cat.marcas.forEach((marca) => {
        marca.modelos.forEach((m) => {
          filas.push({
            Tienda: tienda || m.tienda || nombreTienda,
            Categoria: cat.categoria,
            Marca: marca.marca,
            Modelo: m.modelo,
            Codigo: m.codigo || "—",
            "Precio unit.": m.precio,
            Stock: m.stock,
            Estado: m.estado,
            Valor: m.valor,
          })
        })
      })
    })
    return filas
  }

  const libro = XLSX.utils.book_new()
  const usados = new Set()
  let todasLasFilas = []

  if (todas) {
    const porTienda = agruparPocoStockPorTienda(productos, tiendas, { estadoStock })
    porTienda.forEach((t) => {
      todasLasFilas = todasLasFilas.concat(filasDeGrupos(t.grupos, t.nombre))
    })
  } else {
    const grupos = agruparPorCategoriaMarcaModelo(productos, nombreTienda)
    todasLasFilas = filasDeGrupos(grupos, nombreTienda)
  }

  const hojaTodo = todasLasFilas.length
    ? XLSX.utils.json_to_sheet(todasLasFilas, { header: columnas })
    : XLSX.utils.aoa_to_sheet([columnas])
  hojaTodo["!cols"] = columnas.map((c) => ({ wch: c === "Modelo" ? 32 : 14 }))
  if (todasLasFilas.length) {
    hojaTodo["!autofilter"] = {
      ref: `A1:I${todasLasFilas.length + 1}`,
    }
  }
  XLSX.utils.book_append_sheet(libro, hojaTodo, nombreHojaExcel("Por modelo", usados))

  const porCategoria = new Map()
  todasLasFilas.forEach((fila) => {
    if (!porCategoria.has(fila.Categoria)) porCategoria.set(fila.Categoria, [])
    porCategoria.get(fila.Categoria).push(fila)
  })

  ;[...porCategoria.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "es"))
    .forEach(([categoria, lista]) => {
      const hoja = XLSX.utils.json_to_sheet(lista, { header: columnas })
      hoja["!cols"] = columnas.map((c) => ({ wch: c === "Modelo" ? 32 : 14 }))
      if (lista.length) {
        hoja["!autofilter"] = { ref: `A1:I${lista.length + 1}` }
      }
      XLSX.utils.book_append_sheet(libro, hoja, nombreHojaExcel(categoria, usados))
    })

  const nombre = todas
    ? `poco-stock-todas-las-tiendas-${fechaArchivoLocal()}.xlsx`
    : `poco-stock-${slugArchivo(nombreTienda)}-${fechaArchivoLocal()}.xlsx`

  XLSX.writeFile(libro, nombre)
  return {
    productos: todasLasFilas.length,
    categorias: porCategoria.size,
  }
}

export { COLUMNAS_PRODUCTOS }
