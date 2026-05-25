import { collection, doc, setDoc, getDocs, query, where, Timestamp } from "firebase/firestore"
import { db } from "../firebase"
import { STOCK_BAJO_UMBRAL } from "../constants/inventario"

/**
 * Registra los productos con stock bajo (0-2) para un día específico
 * Solo guarda si hay productos con stock bajo
 */
export async function registrarAlertaDiaria(productos) {
  const productosBajoStock = productos.filter(
    (p) => Number(p.stock) <= STOCK_BAJO_UMBRAL
  )

  if (productosBajoStock.length === 0) {
    return null // No hay productos con stock bajo, no registrar
  }

  const hoy = new Date()
  const fechaKey = obtenerFechaKey(hoy)

  const alertaRef = doc(db, "alertas_stock", fechaKey)

  await setDoc(alertaRef, {
    fecha: Timestamp.fromDate(hoy),
    fechaKey,
    productos: productosBajoStock.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      stock: p.stock,
      precio: p.precio,
    })),
    cantidad: productosBajoStock.length,
    createdAt: Timestamp.now(),
  })

  return fechaKey
}

/**
 * Obtiene el historial de alertas acumuladas
 * Solo incluye días donde hubo productos con stock bajo
 */
export async function obtenerHistorialAlertas() {
  const alertasRef = collection(db, "alertas_stock")
  const snapshot = await getDocs(alertasRef)

  const alertas = []
  snapshot.forEach((doc) => {
    alertas.push({ id: doc.id, ...doc.data() })
  })

  // Ordenar por fecha (más reciente primero)
  alertas.sort((a, b) => {
    const fechaA = a.fecha?.toDate?.() || new Date(a.fechaKey)
    const fechaB = b.fecha?.toDate?.() || new Date(b.fechaKey)
    return fechaB - fechaA
  })

  return alertas
}

/**
 * Genera una lista acumulativa de productos sin stock
 * Combina todos los días donde hubo alertas
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
 * Verifica si ya existe una alerta para el día de hoy
 */
export async function existeAlertaHoy() {
  const hoy = new Date()
  const fechaKey = obtenerFechaKey(hoy)

  const q = query(
    collection(db, "alertas_stock"),
    where("fechaKey", "==", fechaKey)
  )

  const snapshot = await getDocs(q)
  return !snapshot.empty
}
