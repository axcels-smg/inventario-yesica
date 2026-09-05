import { doc, increment, updateDoc } from "firebase/firestore"
import { db } from "../firebase"
import { esErrorCuota } from "./cuotaFirebase"

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

function encolarAjuste(productoId, delta) {
  const cola = leerCola()
  const i = cola.findIndex((item) => item.id === productoId)
  if (i >= 0) {
    cola[i].delta += delta
    if (cola[i].delta === 0) cola.splice(i, 1)
  } else {
    cola.push({ id: productoId, delta })
  }
  guardarCola(cola)
}

async function enviarIncremento(productoId, delta) {
  await updateDoc(doc(db, "productos", productoId), {
    stock: increment(delta),
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

  const stockAntes = Number(producto.stock)
  const stockDespues = stockAntes + cambio

  if (!Number.isFinite(stockAntes) || stockDespues < 0) {
    throw new Error(
      `No se puede dejar el stock en ${stockDespues}. Hay ${stockAntes} u.`
    )
  }

  try {
    await enviarIncremento(producto.id, cambio)
  } catch (error) {
    if (esErrorCuota(error)) {
      encolarAjuste(producto.id, cambio)
      return { stockAntes, stockDespues, cambio, diferido: true }
    }
    throw error
  }

  return { stockAntes, stockDespues, cambio, diferido: false }
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
        await enviarIncremento(item.id, item.delta)
      } catch (error) {
        if (esErrorCuota(error)) resto.push(item)
      }
    }
    guardarCola(resto)
  }

  vaciarCola()
  window.setInterval(vaciarCola, REINTENTO_MS)
}
