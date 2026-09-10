import { doc, runTransaction, serverTimestamp } from "firebase/firestore"
import { db } from "../firebase"
import { formatearNumeroBoleta } from "./boleta"
import { registrarMovimiento } from "./movimientos"
import { TIPOS_MOVIMIENTO } from "../constants/inventario"
import { invalidarCacheTienda } from "./consultasTienda"
import { sincronizarCicloDescuentos } from "./reportePantallas"

export async function devolverStockYMarcarAnulada(ventaId) {
  const registrosMovimiento = []
  let metaAnulacion = { cliente: "", numeroBoleta: "" }

  await runTransaction(db, async (transaction) => {
    registrosMovimiento.length = 0
    const ventaRef = doc(db, "ventas", ventaId)
    const ventaSnap = await transaction.get(ventaRef)

    if (!ventaSnap.exists()) {
      throw new Error("La venta ya no existe")
    }

    const ventaActual = ventaSnap.data()

    if (ventaActual.anulada) {
      throw new Error("Esta venta ya fue anulada")
    }

    const productosVenta = ventaActual.productos || []

    if (productosVenta.length === 0) {
      throw new Error("La venta no tiene productos")
    }

    metaAnulacion = {
      cliente: ventaActual.cliente || "",
      numeroBoleta: ventaActual.numeroBoleta
        ? formatearNumeroBoleta(ventaActual.numeroBoleta)
        : "",
    }

    const porProducto = new Map()

    for (const item of productosVenta) {
      if (!item.id) {
        throw new Error("Un producto de la venta no tiene identificador")
      }

      const cantidad = Number(item.cantidad)
      if (!Number.isFinite(cantidad) || cantidad <= 0) {
        throw new Error(`Cantidad inválida en ${item.marca || item.id}`)
      }

      if (porProducto.has(item.id)) {
        const prev = porProducto.get(item.id)
        prev.cantidad += cantidad
        prev.stockDespues = prev.stockAntes + prev.cantidad
        continue
      }

      const productoRef = doc(db, "productos", item.id)
      const productoSnap = await transaction.get(productoRef)

      if (!productoSnap.exists()) {
        throw new Error(`El producto ${item.marca || item.id} ya no existe`)
      }

      const stockActual = Number(productoSnap.data().stock)
      if (!Number.isFinite(stockActual)) {
        throw new Error(`Stock inválido para ${item.marca || item.id}`)
      }

      porProducto.set(item.id, {
        ref: productoRef,
        productoId: item.id,
        productoNombre: `${item.marca || ""} ${item.modelo || ""}`.trim(),
        cantidad,
        stockAntes: stockActual,
        stockDespues: stockActual + cantidad,
      })
    }

    registrosMovimiento.push(...porProducto.values())

    registrosMovimiento.forEach((mov) => {
      transaction.update(mov.ref, {
        stock: mov.stockDespues,
        actualizado: serverTimestamp(),
      })
    })

    transaction.update(ventaRef, {
      anulada: true,
      fechaAnulacion: serverTimestamp(),
      fechaAnulacionTexto: new Date().toLocaleString("es-PE"),
    })
  })

  return { registrosMovimiento, metaAnulacion }
}

export async function anularVentaYDevolverStock({
  venta,
  tiendaActual,
  aplicarCambiosStock,
}) {
  if (!venta?.id) {
    throw new Error("Venta no válida")
  }

  const { registrosMovimiento, metaAnulacion } = await devolverStockYMarcarAnulada(
    venta.id
  )

  try {
    for (const mov of registrosMovimiento) {
      await registrarMovimiento({
        tipo: TIPOS_MOVIMIENTO.ANULACION,
        productoId: mov.productoId,
        productoNombre: mov.productoNombre,
        cantidad: mov.cantidad,
        stockAntes: mov.stockAntes,
        stockDespues: mov.stockDespues,
        ventaId: venta.id,
        numeroBoleta: metaAnulacion.numeroBoleta,
        cliente: metaAnulacion.cliente,
        detalle: `Anulación boleta #${metaAnulacion.numeroBoleta || venta.id.slice(0, 6)}`,
        tiendaId: tiendaActual.id,
      })
    }
  } catch (errorMov) {
    console.error(errorMov)
  }

  invalidarCacheTienda("ventas", tiendaActual.id)
  invalidarCacheTienda("productos", tiendaActual.id)
  aplicarCambiosStock(
    registrosMovimiento.map((mov) => ({
      id: mov.productoId,
      stock: mov.stockDespues,
    }))
  )
  sincronizarCicloDescuentos(tiendaActual.id, tiendaActual.nombre).catch(() => {})

  return { registrosMovimiento, metaAnulacion }
}
