import { collection, getDocs, query, where } from "firebase/firestore"
import { db } from "../firebase"

export async function listarPorTienda(coleccion, tiendaId) {
  if (!tiendaId) return []

  const snap = await getDocs(
    query(collection(db, coleccion), where("tiendaId", "==", tiendaId))
  )

  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export function nombreVisibleProducto(producto) {
  return (
    `${producto?.marca || ""} ${producto?.modelo || ""}`.trim() ||
    producto?.nombre ||
    "Producto"
  )
}
