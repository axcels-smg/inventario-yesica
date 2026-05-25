import { useEffect, useState } from "react"
import { collection, getDocs, query, where } from "firebase/firestore"
import { db } from "../firebase"
import { STOCK_BAJO_UMBRAL } from "../constants/inventario"

export function useStockBajo() {
  const [cantidad, setCantidad] = useState(0)
  const [productos, setProductos] = useState([])
  const [cargando, setCargando] = useState(true)

  async function recargar() {
    try {
      setCargando(true)

      const q = query(
        collection(db, "productos"),
        where("stock", "<=", STOCK_BAJO_UMBRAL)
      )

      const snap = await getDocs(q)
      const lista = []

      snap.forEach((docu) => {
        lista.push({ id: docu.id, ...docu.data() })
      })

      lista.sort((a, b) => Number(a.stock) - Number(b.stock))

      setProductos(lista)
      setCantidad(lista.length)
    } catch {
      setProductos([])
      setCantidad(0)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    recargar()
  }, [])

  return { cantidad, productos, cargando, recargar }
}
