import { onSnapshot } from "firebase/firestore"
import { esErrorCuota } from "./cuotaFirebase"

export function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function conReintentoCuota(fn, { intentos = 4, baseMs = 700 } = {}) {
  let ultimo
  for (let i = 0; i < intentos; i++) {
    try {
      return await fn()
    } catch (error) {
      ultimo = error
      if (!esErrorCuota(error) || i === intentos - 1) throw error
      await esperar(baseMs * (i + 1) + Math.random() * 400)
    }
  }
  throw ultimo
}

export function escucharQuery(consulta, alDato, alError) {
  let desuscribir = null
  let timer = null
  let delay = 1200
  let parado = false

  function conectar() {
    if (parado) return
    desuscribir = onSnapshot(
      consulta,
      (snap) => {
        delay = 1200
        alDato(snap)
      },
      (error) => {
        if (desuscribir) {
          desuscribir()
          desuscribir = null
        }
        if (typeof alError === "function") alError(error)
        else if (!esErrorCuota(error)) console.error(error)
        timer = setTimeout(() => {
          delay = Math.min(delay * 2, 20000)
          conectar()
        }, delay)
      }
    )
  }

  conectar()

  return () => {
    parado = true
    if (timer) clearTimeout(timer)
    if (desuscribir) desuscribir()
  }
}
