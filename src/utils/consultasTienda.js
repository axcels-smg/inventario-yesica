import { collection, getDocs, query, where } from "firebase/firestore"
import { db } from "../firebase"
import { esErrorCuota } from "./cuotaFirebase"

const cache = new Map()
const CACHE_MS = 3 * 60 * 1000

function claveCache(coleccion, tiendaId) {
  return `${coleccion}:${tiendaId}`
}

function claveSesion(clave) {
  return `inv_lista_${clave}`
}

function leerSesion(clave) {
  try {
    const raw = sessionStorage.getItem(claveSesion(clave))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function guardarSesion(clave, data) {
  try {
    sessionStorage.setItem(claveSesion(clave), JSON.stringify(data))
  } catch {
    /* ignore */
  }
}

function respaldo(clave) {
  const memoria = cache.get(clave)
  if (memoria?.data) return memoria.data
  return leerSesion(clave) || []
}

export function invalidarCacheTienda(coleccion, tiendaId) {
  if (!tiendaId) {
    cache.clear()
    return
  }
  if (coleccion) {
    cache.delete(claveCache(coleccion, tiendaId))
    return
  }
  for (const clave of [...cache.keys()]) {
    if (clave.endsWith(`:${tiendaId}`)) cache.delete(clave)
  }
}

export async function listarPorTienda(coleccion, tiendaId, { force } = {}) {
  if (!tiendaId) return []

  const clave = claveCache(coleccion, tiendaId)
  const hit = cache.get(clave)
  const usarCache = coleccion !== "productos" && !force && hit && Date.now() - hit.t < CACHE_MS
  if (usarCache) {
    return hit.data
  }

  try {
    const snap = await getDocs(
      query(collection(db, coleccion), where("tiendaId", "==", tiendaId))
    )

    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    cache.set(clave, { t: Date.now(), data })
    guardarSesion(clave, data)
    return data
  } catch (error) {
    if (esErrorCuota(error)) {
      return respaldo(clave)
    }
    throw error
  }
}

export function nombreVisibleProducto(producto) {
  return (
    `${producto?.marca || ""} ${producto?.modelo || ""}`.trim() ||
    producto?.nombre ||
    "Producto"
  )
}
