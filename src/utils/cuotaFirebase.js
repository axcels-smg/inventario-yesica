export function esErrorCuota(error) {
  const texto = `${error?.code || ""} ${error?.message || ""}`.toLowerCase()
  return (
    texto.includes("resource-exhausted") ||
    texto.includes("quota exceeded") ||
    texto.includes("exceeded quota")
  )
}
