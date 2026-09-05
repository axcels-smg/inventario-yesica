import Swal from "sweetalert2"
import { esErrorCuota } from "./cuotaFirebase"

export function errorOperacion(error, titulo = "Error") {
  if (esErrorCuota(error)) return

  const texto = String(error?.message || error || "")
  if (esErrorCuota({ message: texto, code: error?.code })) return
  if (/quota|cuota|resource-exhausted/i.test(texto)) return

  Swal.fire({
    icon: "error",
    title: titulo,
    text: texto || undefined,
  })
}
