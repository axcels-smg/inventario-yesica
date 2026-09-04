import { STOCK_BAJO_UMBRAL } from "../constants/inventario"
import { lineaDetalleStock, resumenStockBajo } from "./stock"

const CLAVE_WHATSAPP = "inventario_whatsapp"

export function obtenerTelefonoWhatsApp() {
  return localStorage.getItem(CLAVE_WHATSAPP) || ""
}

export function guardarTelefonoWhatsApp(telefono) {
  localStorage.setItem(CLAVE_WHATSAPP, telefono.replace(/\D/g, ""))
}

function textoAlertaStock(productos, nombreTienda) {
  const { lista, total, agotados, poco } = resumenStockBajo(productos)
  const tienda = nombreTienda ? ` — ${nombreTienda}` : ""
  const limite = 40
  const visibles = lista.slice(0, limite)
  const resto = lista.length - visibles.length

  const lineas = visibles.map((p) => `• ${lineaDetalleStock(p)}`).join("\n")
  const extra = resto > 0 ? `\n…y ${resto} más` : ""

  return (
    `⚠️ *Poco stock* (≤ ${STOCK_BAJO_UMBRAL} u.)${tienda}\n` +
    `Agotados: ${agotados} · Poco stock: ${poco} · Total: ${total}\n\n` +
    `${lineas}${extra}\n\n` +
    `Reponer inventario pronto.`
  )
}

export function enlaceWhatsAppStockBajo(productos, telefono, nombreTienda = "") {
  const numero = (telefono || obtenerTelefonoWhatsApp()).replace(/\D/g, "")
  const texto = textoAlertaStock(productos, nombreTienda)

  if (!numero) {
    return `https://wa.me/?text=${encodeURIComponent(texto)}`
  }

  return `https://wa.me/51${numero}?text=${encodeURIComponent(texto)}`
}

export function enlaceEmailStockBajo(productos, correo = "", nombreTienda = "") {
  const tienda = nombreTienda ? ` - ${nombreTienda}` : ""
  const asunto = encodeURIComponent(`Poco stock${tienda} - Inventario G.R.L.`)
  const cuerpo = encodeURIComponent(textoAlertaStock(productos, nombreTienda))

  return `mailto:${correo}?subject=${asunto}&body=${cuerpo}`
}
