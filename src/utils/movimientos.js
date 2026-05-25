import { collection, addDoc, serverTimestamp } from "firebase/firestore"
import { db } from "../firebase"

export async function registrarMovimiento({
  tipo,
  productoId = "",
  productoNombre = "",
  cantidad = 0,
  stockAntes = null,
  stockDespues = null,
  ventaId = "",
  numeroBoleta = "",
  cliente = "",
  detalle = "",
  tiendaId = "",
}) {
  await addDoc(collection(db, "movimientos"), {
    tipo,
    productoId,
    productoNombre,
    cantidad: Number(cantidad) || 0,
    stockAntes,
    stockDespues,
    ventaId,
    numeroBoleta: numeroBoleta ? String(numeroBoleta) : "",
    cliente,
    detalle,
    tiendaId,
    fecha: serverTimestamp(),
    fechaTexto: new Date().toLocaleString("es-PE"),
  })
}
