import { STOCK_BAJO_UMBRAL } from "../constants/inventario"
import { resumenStockBajo } from "./stock"
import { textoStockPorCategoriaMarca } from "./reporteStock"

const CLAVE_WHATSAPP = "inventario_whatsapp"

export function obtenerTelefonoWhatsApp() {
  return localStorage.getItem(CLAVE_WHATSAPP) || ""
}

export function guardarTelefonoWhatsApp(telefono) {
  localStorage.setItem(CLAVE_WHATSAPP, telefono.replace(/\D/g, ""))
}

function textoAlertaStock(productos, nombreTienda) {
  const { total, agotados, poco } = resumenStockBajo(productos)
  const cuerpo = textoStockPorCategoriaMarca(productos, nombreTienda, 70)

  return (
    `⚠️ *Poco stock* (≤ ${STOCK_BAJO_UMBRAL} u.)\n` +
    `No hay (0): ${agotados} · Poco stock: ${poco} · Total: ${total}\n` +
    `${cuerpo}\n\n` +
    `Reponer inventario pronto.`
  )
}

function numeroWhatsAppPeru(telefono) {
  const numero = String(telefono || "").replace(/\D/g, "")
  if (!numero) return ""
  if (numero.startsWith("51") && numero.length >= 11) return numero
  return `51${numero}`
}

export function enlaceWhatsAppStockBajo(productos, telefono, nombreTienda = "") {
  const numero = numeroWhatsAppPeru(telefono || obtenerTelefonoWhatsApp())
  const texto = textoAlertaStock(productos, nombreTienda)

  if (!numero) {
    return `https://wa.me/?text=${encodeURIComponent(texto)}`
  }

  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`
}

export function enlaceEmailStockBajo(productos, correo = "", nombreTienda = "") {
  const tienda = nombreTienda ? ` - ${nombreTienda}` : ""
  const asunto = encodeURIComponent(`Poco stock${tienda} - Inventario G.R.L.`)
  const cuerpo = encodeURIComponent(textoAlertaStock(productos, nombreTienda))

  return `mailto:${correo}?subject=${asunto}&body=${cuerpo}`
}
