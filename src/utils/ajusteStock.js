import { doc, increment, serverTimestamp, updateDoc } from "firebase/firestore"
import { db } from "../firebase"
import { esErrorCuota } from "./cuotaFirebase"
import { registrarMovimiento } from "./movimientos"
import { TIPOS_MOVIMIENTO } from "../constants/inventario"
import { conReintentoCuota } from "./firestoreLive"

const COLA_KEY = "inventario_ajustes_pendientes"
const COLA_EVENTO = "inventario-cola-stock"
const REINTENTO_MS = 5000

function avisarCola() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(COLA_EVENTO))
}

export function leerAjustesPendientes() {
  try {
    const lista = JSON.parse(localStorage.getItem(COLA_KEY) || "[]")
    return Array.isArray(lista) ? lista.filter((item) => item?.id && item.delta) : []
  } catch {
    return []
  }
}

export function suscribirAjustesPendientes(callback) {
  if (typeof window === "undefined") return () => {}
  const emitir = () => callback(leerAjustesPendientes())
  emitir()
  window.addEventListener(COLA_EVENTO, emitir)
  window.addEventListener("storage", emitir)
  return () => {
    window.removeEventListener(COLA_EVENTO, emitir)
    window.removeEventListener("storage", emitir)
  }
}

export function aplicarAjustesPendientesALista(lista) {
  const cola = leerAjustesPendientes()
  if (!cola.length) return lista
  const mapa = new Map(cola.map((item) => [item.id, Number(item.delta) || 0]))
  return lista.map((p) => {
    const delta = mapa.get(p.id)
    if (!delta) return p
    return {
      ...p,
      stock: Math.max(0, Number(p.stock || 0) + delta),
      syncPendiente: true,
    }
  })
}

export function marcaStockNube(stock) {
  const datos = { actualizado: serverTimestamp() }
  if (stock != null) datos.stock = stock
  return datos
}

function guardarCola(lista) {
  localStorage.setItem(COLA_KEY, JSON.stringify(lista))
  avisarCola()
}

function encolarAjuste(producto, delta) {
  const cola = leerAjustesPendientes()
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
  const ref = doc(db, "productos", productoId)
  await updateDoc(ref, {
    stock: increment(delta),
    actualizado: serverTimestamp(),
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

  const stockAntes = Number.isFinite(stockLocal) ? stockLocal : 0
  const stockDespues = stockAntes + cambio

  try {
    await conReintentoCuota(
      () => aplicarDeltaEnServidor(producto.id, cambio),
      { intentos: 6, baseMs: 400 }
    )
    return { stockAntes, stockDespues, cambio, diferido: false }
  } catch (error) {
    if (esErrorCuota(error)) {
      encolarAjuste(producto, cambio)
      return { stockAntes, stockDespues, cambio, diferido: true }
    }
    throw error
  }
}

let reintentoIniciado = false

export function iniciarReintentoAjustes() {
  if (reintentoIniciado || typeof window === "undefined") return
  reintentoIniciado = true

  async function vaciarCola() {
    const cola = leerAjustesPendientes()
    if (cola.length === 0) return

    const resto = []
    for (const item of cola) {
      if (!item.delta) continue
      try {
        await conReintentoCuota(
          () => aplicarDeltaEnServidor(item.id, item.delta),
          { intentos: 4, baseMs: 400 }
        )
        await registrarMovimiento({
          tipo: TIPOS_MOVIMIENTO.AJUSTE_STOCK,
          productoId: item.id,
          productoNombre: item.productoNombre || "",
          cantidad: item.delta,
          detalle: `Ajuste ${item.delta > 0 ? "+" : ""}${item.delta}`,
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
  window.addEventListener("online", vaciarCola)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") vaciarCola()
  })
}
