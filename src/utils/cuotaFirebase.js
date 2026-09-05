export function esErrorCuota(error) {
  const texto = `${error?.code || ""} ${error?.message || ""} ${error?.name || ""}`.toLowerCase()
  return (
    error?.code === "resource-exhausted" ||
    texto.includes("resource-exhausted") ||
    texto.includes("resource_exhausted") ||
    texto.includes("quota exceeded") ||
    texto.includes("exceeded quota") ||
    texto.includes("quota-exceeded") ||
    texto.includes("cuota") ||
    (texto.includes("quota") && texto.includes("exceed"))
  )
}
