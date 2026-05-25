import * as XLSX from "xlsx"
import { formatearFecha } from "./fechas"
import { formatearNumeroBoleta } from "./boleta"
import { filtrarVentasActivas } from "./ventas"

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
    `contabilidad-ventas-${new Date().toISOString().slice(0, 10)}.xlsx`
  )
}

export { COLUMNAS_PRODUCTOS }
