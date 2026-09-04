import { collection, doc, setDoc, getDocs, query, where, Timestamp } from "firebase/firestore"
import { db } from "../firebase"
import { STOCK_BAJO_UMBRAL } from "../constants/inventario"

/**
 * Registra los productos con stock bajo (0-3) para un día y tienda específicos
 * Solo guarda si hay productos con stock bajo
 */
export async function registrarAlertaDiaria(productos, tiendaId) {
  const productosBajoStock = productos.filter(
    (p) => Number(p.stock) <= STOCK_BAJO_UMBRAL
  )

  if (productosBajoStock.length === 0) {
    return null
  }

  const hoy = new Date()
  const fechaKey = obtenerFechaKey(hoy)
  const docId = tiendaId ? `${tiendaId}_${fechaKey}` : fechaKey

  const alertaRef = doc(db, "alertas_stock", docId)

  await setDoc(alertaRef, {
    fecha: Timestamp.fromDate(hoy),
    fechaKey,
    tiendaId: tiendaId || null,
    productos: productosBajoStock.map((p) => ({
      id: p.id,
      nombre: `${p.marca || ""} ${p.modelo || ""}`.trim(),
      marca: p.marca || "",
      modelo: p.modelo || "",
      codigo: p.codigo || "",
      categoria: p.categoria || "",
      stock: p.stock,
      precio: p.precio,
    })),
    cantidad: productosBajoStock.length,
    createdAt: Timestamp.now(),
  })

  return docId
}

/**
 * Obtiene el historial de alertas acumuladas para una tienda específica
 */
export async function obtenerHistorialAlertas(tiendaId) {
  let q
  if (tiendaId) {
    q = query(
      collection(db, "alertas_stock"),
      where("tiendaId", "==", tiendaId)
    )
  } else {
    q = collection(db, "alertas_stock")
  }

  const snapshot = await getDocs(q)

  const alertas = []
  snapshot.forEach((doc) => {
    alertas.push({ id: doc.id, ...doc.data() })
  })

  alertas.sort((a, b) => {
    const fechaA = a.fecha?.toDate?.() || new Date(a.fechaKey)
    const fechaB = b.fecha?.toDate?.() || new Date(b.fechaKey)
    return fechaB - fechaA
  })

  return alertas
}

/**
 * Genera una lista acumulativa de productos sin stock
 */
export function generarListaAcumulativa(alertas) {
  const productosUnicos = new Map()

  alertas.forEach((alerta) => {
    alerta.productos.forEach((producto) => {
      if (!productosUnicos.has(producto.id)) {
        productosUnicos.set(producto.id, {
          ...producto,
          diasConAlerta: [],
        })
      }
      const prod = productosUnicos.get(producto.id)
      prod.diasConAlerta.push(alerta.fechaKey)
    })
  })

  return Array.from(productosUnicos.values())
}

/**
 * Formatea la fecha key (YYYY-MM-DD)
 */
function obtenerFechaKey(fecha) {
  const year = fecha.getFullYear()
  const month = String(fecha.getMonth() + 1).padStart(2, "0")
  const day = String(fecha.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * Verifica si ya existe una alerta para el día de hoy y una tienda
 */
export async function existeAlertaHoy(tiendaId) {
  const hoy = new Date()
  const fechaKey = obtenerFechaKey(hoy)
  const docId = tiendaId ? `${tiendaId}_${fechaKey}` : fechaKey

  const q = query(
    collection(db, "alertas_stock"),
    where("fechaKey", "==", fechaKey),
    where("tiendaId", "==", tiendaId || null)
  )

  const snapshot = await getDocs(q)
  return !snapshot.empty
}
