import { collection, doc, setDoc, getDocs, query, where, Timestamp, deleteDoc } from "firebase/firestore"
import { db } from "../firebase"
import { STOCK_BAJO_UMBRAL } from "../constants/inventario"
import { esErrorCuota } from "./cuotaFirebase"

export const DIAS_CICLO_ALERTAS = 3

export function obtenerFechaKey(fecha = new Date()) {
  const year = fecha.getFullYear()
  const month = String(fecha.getMonth() + 1).padStart(2, "0")
  const day = String(fecha.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function formatearFechaKey(fechaKey) {
  const [year, month, day] = String(fechaKey || "").split("-")
  if (!year || !month || !day) return fechaKey || "—"
  return `${day}/${month}/${year}`
}

export function clavesUltimosDias(dias = DIAS_CICLO_ALERTAS) {
  const keys = []
  const hoy = new Date()
  for (let i = 0; i < dias; i += 1) {
    const d = new Date(hoy)
    d.setDate(hoy.getDate() - i)
    keys.push(obtenerFechaKey(d))
  }
  return keys
}

export function filtrarAlertasDelCiclo(alertas, dias = DIAS_CICLO_ALERTAS) {
  const permitidas = new Set(clavesUltimosDias(dias))
  return (alertas || [])
    .filter((a) => permitidas.has(a.fechaKey))
    .sort((a, b) => String(a.fechaKey).localeCompare(String(b.fechaKey)))
}

/**
 * Guarda el poco stock de hoy. El ciclo es de 3 días: al cuarto se borra el más viejo.
 */
export async function registrarAlertaDiaria(productos, tiendaId) {
  if (!tiendaId) return null

  const productosBajoStock = (productos || []).filter(
    (p) => Number(p.stock) <= STOCK_BAJO_UMBRAL
  )

  const hoy = new Date()
  const fechaKey = obtenerFechaKey(hoy)
  const docId = `${tiendaId}_${fechaKey}`
  const alertaRef = doc(db, "alertas_stock", docId)

  try {
    await setDoc(alertaRef, {
      fecha: Timestamp.fromDate(hoy),
      fechaKey,
      tiendaId,
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
  } catch (error) {
    if (esErrorCuota(error)) return null
    throw error
  }

  return docId
}

export async function limpiarAlertasFueraDeCiclo(tiendaId, dias = DIAS_CICLO_ALERTAS) {
  if (!tiendaId) return
  const permitidas = new Set(clavesUltimosDias(dias))
  const historial = await obtenerHistorialAlertas(tiendaId)

  await Promise.all(
    historial
      .filter((a) => a.id && !permitidas.has(a.fechaKey))
      .map((a) =>
        deleteDoc(doc(db, "alertas_stock", a.id)).catch((error) => {
          if (!esErrorCuota(error)) throw error
        })
      )
  )
}

export async function registrarCicloDiarioTienda(productos, tiendaId) {
  await registrarAlertaDiaria(productos, tiendaId)
  await limpiarAlertasFueraDeCiclo(tiendaId)
}

export async function registrarCicloDiarioTodasLasTiendas(productos, tiendas = []) {
  const porTienda = new Map()
  ;(productos || []).forEach((p) => {
    const id = p.tiendaId
    if (!id) return
    if (!porTienda.has(id)) porTienda.set(id, [])
    porTienda.get(id).push(p)
  })

  const ids = new Set([
    ...porTienda.keys(),
    ...tiendas.map((t) => t.id).filter(Boolean),
  ])

  for (const id of ids) {
    await registrarCicloDiarioTienda(porTienda.get(id) || [], id)
  }
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

  try {
    const snapshot = await getDocs(q)

    const alertas = []
    snapshot.forEach((docu) => {
      alertas.push({ id: docu.id, ...docu.data() })
    })

    alertas.sort((a, b) => {
      const fechaA = a.fecha?.toDate?.() || new Date(a.fechaKey)
      const fechaB = b.fecha?.toDate?.() || new Date(b.fechaKey)
      return fechaB - fechaA
    })

    return alertas
  } catch (error) {
    if (esErrorCuota(error)) return []
    throw error
  }
}

/**
 * Genera una lista acumulativa de productos sin stock
 */
export function generarListaAcumulativa(alertas) {
  const productosUnicos = new Map()

  alertas.forEach((alerta) => {
    (alerta.productos || []).forEach((producto) => {
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

export async function existeAlertaHoy(tiendaId) {
  const hoy = new Date()
  const fechaKey = obtenerFechaKey(hoy)
  const docId = tiendaId ? `${tiendaId}_${fechaKey}` : fechaKey

  const q = query(
    collection(db, "alertas_stock"),
    where("fechaKey", "==", fechaKey),
    where("tiendaId", "==", tiendaId || null)
  )

  try {
    const snapshot = await getDocs(q)
    return !snapshot.empty
  } catch (error) {
    if (esErrorCuota(error)) return true
    throw error
  }
}
