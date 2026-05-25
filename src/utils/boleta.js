import { doc, runTransaction } from "firebase/firestore"
import { db } from "../firebase"

export function formatearNumeroBoleta(numero) {
  return String(numero).padStart(6, "0")
}

export async function obtenerSiguienteNumeroBoleta() {
  const ref = doc(db, "config", "contadores")

  const numero = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref)
    const actual = snap.exists()
      ? Number(snap.data().numeroBoleta || 0) + 1
      : 1

    transaction.set(ref, { numeroBoleta: actual }, { merge: true })
    return actual
  })

  return numero
}
