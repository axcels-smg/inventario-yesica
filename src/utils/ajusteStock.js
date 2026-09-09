import { doc, runTransaction } from "firebase/firestore"
import { db } from "../firebase"
import { esErrorCuota } from "./cuotaFirebase"
import { registrarMovimiento } from "./movimientos"
import { TIPOS_MOVIMIENTO } from "../constants/inventario"

const COLA_KEY = "inventario_ajustes_pendientes"
const REINTENTO_MS = 45000

function leerCola() {
  try {
    const lista = JSON.parse(localStorage.getItem(COLA_KEY) || "[]")
    return Array.isArray(lista) ? lista : []
  } catch {
    return []
  }
}

function guardarCola(lista) {
  localStorage.setItem(COLA_KEY, JSON.stringify(lista))
}

function encolarAjuste(producto, delta) {
  const cola = leerCola()
  const i = cola.findIndex((item) => item.id === producto.id)
  if (i >= 0) {
    cola[i].delta += delta
    if (cola[i].delta === 0) cola.splice(i, 1)
  } else {
    cola.push({
      id: producto.id,
      delta,
      tiendaId: producto.tiendaId || "",
      productoNombre:
        `${producto.marca || ""} ${producto.modelo || ""}`.trim() ||
        "Producto",
    })
  }
  guardarCola(cola)
}

async function aplicarDeltaEnServidor(productoId, delta) {
  return runTransaction(db, async (transaction) => {
    const ref = doc(db, "productos", productoId)
    const snap = await transaction.get(ref)
    if (!snap.exists()) {
      throw new Error("El producto ya no existe")
    }
    const stockAntes = Number(snap.data().stock)
    if (!Number.isFinite(stockAntes)) {
      throw new Error("Stock inválido")
    }
    const stockDespues = stockAntes + delta
    if (stockDespues < 0) {
      throw new Error(
        `No se puede dejar el stock en ${stockDespues}. Hay ${stockAntes} u.`
      )
    }
    transaction.update(ref, { stock: stockDespues })
    return { stockAntes, stockDespues }
  })
}

export async function aplicarAjusteStock(producto, delta) {
  const cambio = Number(delta)

  if (!producto?.id) {
    throw new Error("Producto no válido")
  }

  if (!Number.isInteger(cambio) || cambio === 0) {
    throw new Error("Indica cuánto sumar o restar")
  }

  const stockLocal = Number(producto.stock)
  if (Number.isFinite(stockLocal) && stockLocal + cambio < 0) {
    throw new Error(
      `No se puede dejar el stock en ${stockLocal + cambio}. Hay ${stockLocal} u.`
    )
  }

  try {
    const { stockAntes, stockDespues } = await aplicarDeltaEnServidor(
      producto.id,
      cambio
    )
    return { stockAntes, stockDespues, cambio, diferido: false }
  } catch (error) {
    if (esErrorCuota(error)) {
      const stockAntes = Number.isFinite(stockLocal) ? stockLocal : 0
      encolarAjuste(producto, cambio)
      return {
        stockAntes,
        stockDespues: stockAntes + cambio,
        cambio,
        diferido: true,
      }
    }
    throw error
  }
}

let reintentoIniciado = false

export function iniciarReintentoAjustes() {
  if (reintentoIniciado || typeof window === "undefined") return
  reintentoIniciado = true

  async function vaciarCola() {
    const cola = leerCola()
    if (cola.length === 0) return

    const resto = []
    for (const item of cola) {
      if (!item.delta) continue
      try {
        await aplicarDeltaEnServidor(item.id, item.delta)
        await registrarMovimiento({
          tipo: TIPOS_MOVIMIENTO.AJUSTE_STOCK,
          productoId: item.id,
          productoNombre: item.productoNombre || "",
          cantidad: item.delta,
          detalle: `Ajuste diferido ${item.delta > 0 ? "+" : ""}${item.delta}`,
          tiendaId: item.tiendaId || "",
        })
      } catch {
        resto.push(item)
      }
    }
    guardarCola(resto)
  }

  vaciarCola()
  window.setInterval(vaciarCola, REINTENTO_MS)
}
