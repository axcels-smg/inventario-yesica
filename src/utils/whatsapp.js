const CLAVE_WHATSAPP = "inventario_whatsapp"

export function obtenerTelefonoWhatsApp() {
  return localStorage.getItem(CLAVE_WHATSAPP) || ""
}

export function guardarTelefonoWhatsApp(telefono) {
  localStorage.setItem(CLAVE_WHATSAPP, telefono.replace(/\D/g, ""))
}

export function enlaceWhatsAppStockBajo(productos, telefono) {
  const numero = (telefono || obtenerTelefonoWhatsApp()).replace(/\D/g, "")

  const lista = productos
    .slice(0, 25)
    .map(
      (p) =>
        `• ${p.codigo ? `[${p.codigo}] ` : ""}${p.marca} ${p.modelo}: ${p.stock} u.`
    )
    .join("\n")

  const texto = `⚠️ *Alerta stock bajo* — Inventario Yesica\n\n${lista}\n\nReponer inventario pronto.`

  if (!numero) {
    return `https://wa.me/?text=${encodeURIComponent(texto)}`
  }

  return `https://wa.me/51${numero}?text=${encodeURIComponent(texto)}`
}

export function enlaceEmailStockBajo(productos, correo = "") {
  const asunto = encodeURIComponent("Alerta stock bajo - Inventario Yesica")
  const cuerpo = encodeURIComponent(
    `Productos con stock bajo:\n\n${productos
      .map((p) => `• ${p.marca} ${p.modelo}: ${p.stock}`)
      .join("\n")}`
  )

  return `mailto:${correo}?subject=${asunto}&body=${cuerpo}`
}
