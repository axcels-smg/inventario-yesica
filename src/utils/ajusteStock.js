import { doc, runTransaction } from "firebase/firestore"
import { db } from "../firebase"
import { registrarMovimiento } from "./movimientos"
import { TIPOS_MOVIMIENTO } from "../constants/inventario"

export async function aplicarAjusteStock(producto, delta, tiendaId) {
  const cambio = Number(delta)

  if (!producto?.id || !tiendaId) {
    throw new Error("Producto o tienda no válidos")
  }

  if (!Number.isInteger(cambio) || cambio === 0) {
    throw new Error("Indica cuánto sumar o restar (ej. +2 o -4)")
  }

  let stockAntes = Number(producto.stock)
  let stockDespues = stockAntes + cambio

  await runTransaction(db, async (transaction) => {
    const productoRef = doc(db, "productos", producto.id)
    const productoSnap = await transaction.get(productoRef)

    if (!productoSnap.exists()) {
      throw new Error("El producto ya no existe")
    }

    stockAntes = Number(productoSnap.data().stock)

    if (!Number.isFinite(stockAntes) || stockAntes < 0) {
      throw new Error("Stock inválido en el producto")
    }

    stockDespues = stockAntes + cambio

    if (stockDespues < 0) {
      throw new Error(`No se puede dejar el stock en ${stockDespues}. Hay ${stockAntes} u.`)
    }

    transaction.update(productoRef, {
      stock: stockDespues,
    })
  })

  const signo = cambio > 0 ? "+" : ""

  await registrarMovimiento({
    tipo: TIPOS_MOVIMIENTO.AJUSTE_STOCK,
    productoId: producto.id,
    productoNombre: `${producto.marca || ""} ${producto.modelo || ""}`.trim(),
    cantidad: cambio,
    stockAntes,
    stockDespues,
    detalle: `Ajuste ${signo}${cambio} unidades`,
    tiendaId,
  })

  return { stockAntes, stockDespues, cambio }
}
