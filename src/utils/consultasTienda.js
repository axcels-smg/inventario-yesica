import { collection, getDocs, query, where } from "firebase/firestore"
import { db } from "../firebase"

const cache = new Map()
const CACHE_MS = 3 * 60 * 1000

function claveCache(coleccion, tiendaId) {
  return `${coleccion}:${tiendaId}`
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
  if (!force && hit && Date.now() - hit.t < CACHE_MS) {
    return hit.data
  }

  const snap = await getDocs(
    query(collection(db, coleccion), where("tiendaId", "==", tiendaId))
  )

  const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  cache.set(clave, { t: Date.now(), data })
  return data
}

export function nombreVisibleProducto(producto) {
  return (
    `${producto?.marca || ""} ${producto?.modelo || ""}`.trim() ||
    producto?.nombre ||
    "Producto"
  )
}
