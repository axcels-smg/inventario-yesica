import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  Timestamp,
  deleteDoc,
} from "firebase/firestore"
import { db } from "../firebase"
import { esErrorCuota } from "./cuotaFirebase"
import { esCategoriaPantalla } from "./stock"
import { filtrarVentasActivas } from "./ventas"
import { obtenerFechaKey, clavesUltimosDias, formatearFechaKey } from "./alertasStock"
import { normalizarFecha } from "./fechas"
import { formatearNumeroBoleta } from "./boleta"
import { listarPorTienda } from "./consultasTienda"
import { ESTADOS_TRANSFERENCIA } from "../constants/inventario"

export const DIAS_CICLO_DESCUENTOS = 7
export const COLECCION_DESCUENTOS = "descuentos_diarios"

function fechaKeyDe(valor) {
  const fecha = normalizarFecha(valor)
  return fecha ? obtenerFechaKey(fecha) : null
}

function dinero(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}

export function esSalidaTransferencia(estado) {
  return (
    estado === ESTADOS_TRANSFERENCIA.EN_TRANSITO ||
    estado === ESTADOS_TRANSFERENCIA.COMPLETADA
  )
}

export function lineaVentaDescuento(venta, item, nombreTienda) {
  const cantidad = Number(item.cantidad) || 0
  const precio = Number(item.precio) || 0
  return {
    productoId: item.id || "",
    categoria: String(item.categoria || "").trim() || "Sin categoría",
    marca: String(item.marca || "").trim() || "—",
    modelo: String(item.modelo || item.nombre || "").trim() || "—",
    codigo: item.codigo || "",
    cantidad,
    precio,
    subtotal: dinero(cantidad * precio),
    tipo: "venta",
    cliente: venta.cliente || "",
    telefono: venta.telefono || "",
    boleta: venta.numeroBoleta != null ? formatearNumeroBoleta(venta.numeroBoleta) : "",
    ventaId: venta.id || "",
    destino: "",
    tienda: nombreTienda || "",
    pantalla: esCategoriaPantalla(item),
  }
}

export function lineaTransferenciaDescuento(transferencia, item, nombreTienda) {
  const cantidad = Number(item.cantidad) || 0
  const precio = Number(item.precio) || 0
  return {
    productoId: item.productoId || "",
    categoria: String(item.categoria || "").trim() || "Sin categoría",
    marca: String(item.marca || "").trim() || "—",
    modelo: String(item.modelo || "").trim() || "—",
    codigo: item.codigo || "",
    cantidad,
    precio,
    subtotal: dinero(cantidad * precio),
    tipo: "transferencia",
    cliente: "",
    telefono: "",
    boleta: "",
    ventaId: "",
    destino: transferencia.destinoTiendaNombre || "",
    tienda: nombreTienda || transferencia.origenTiendaNombre || "",
    pantalla: esCategoriaPantalla(item),
  }
}

export function extraerLineasDeVentas(ventas, nombreTienda) {
  const lineas = []
  filtrarVentasActivas(ventas || []).forEach((venta) => {
    const fechaKey = fechaKeyDe(venta.fecha || venta.fechaTexto)
    if (!fechaKey) return
    ;(venta.productos || []).forEach((item) => {
      if (!item) return
      const cantidad = Number(item.cantidad) || 0
      if (cantidad <= 0) return
      lineas.push({
        ...lineaVentaDescuento(venta, item, nombreTienda),
        fechaKey,
      })
    })
  })
  return lineas
}

export function extraerLineasDeTransferencias(transferencias, nombreTienda) {
  const lineas = []
  ;(transferencias || []).forEach((t) => {
    if (!esSalidaTransferencia(t.estado)) return
    const fechaKey = fechaKeyDe(t.fechaEnvio || t.fecha || t.fechaTexto)
    if (!fechaKey) return
    ;(t.productos || []).forEach((item) => {
      const cantidad = Number(item.cantidad) || 0
      if (cantidad <= 0) return
      lineas.push({
        ...lineaTransferenciaDescuento(t, item, nombreTienda),
        fechaKey,
      })
    })
  })
  return lineas
}

export function filtrarPantallas(lineas) {
  return (lineas || []).filter((l) => l.pantalla || esCategoriaPantalla(l))
}

export function resumenLineas(lineas) {
  const lista = lineas || []
  const pantallas = filtrarPantallas(lista)
  const clientes = [...new Set(lista.map((l) => l.cliente).filter(Boolean))]
  return {
    lineas: lista.length,
    unidades: lista.reduce((s, l) => s + (Number(l.cantidad) || 0), 0),
    total: dinero(lista.reduce((s, l) => s + (Number(l.subtotal) || 0), 0)),
    pantallasLineas: pantallas.length,
    unidadesPantallas: pantallas.reduce((s, l) => s + (Number(l.cantidad) || 0), 0),
    clientes,
  }
}

async function listarTransferenciasOrigen(tiendaId) {
  if (!tiendaId) return []
  try {
    const snap = await getDocs(
      query(collection(db, "transferencias"), where("origenTiendaId", "==", tiendaId))
    )
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  } catch (error) {
    if (esErrorCuota(error)) return []
    throw error
  }
}

export async function recolectarLineasDescuento(tiendaId, nombreTienda) {
  const [ventas, transferencias] = await Promise.all([
    listarPorTienda("ventas", tiendaId, { force: true }),
    listarTransferenciasOrigen(tiendaId),
  ])
  return [
    ...extraerLineasDeVentas(ventas, nombreTienda),
    ...extraerLineasDeTransferencias(transferencias, nombreTienda),
  ]
}

function payloadDia(tiendaId, nombreTienda, fechaKey, items) {
  const resumen = resumenLineas(items)
  const limpios = JSON.parse(JSON.stringify(items))
  return {
    tiendaId,
    tiendaNombre: nombreTienda || "",
    fechaKey,
    fecha: Timestamp.now(),
    items: limpios,
    ...resumen,
    pantallas: JSON.parse(JSON.stringify(filtrarPantallas(limpios))),
    updatedAt: Timestamp.now(),
  }
}

export async function sincronizarCicloDescuentos(tiendaId, nombreTienda = "") {
  if (!tiendaId) return []

  const permitidas = clavesUltimosDias(DIAS_CICLO_DESCUENTOS)
  const permitidasSet = new Set(permitidas)
  const lineas = (await recolectarLineasDescuento(tiendaId, nombreTienda)).filter((l) =>
    permitidasSet.has(l.fechaKey)
  )

  const porDia = new Map(permitidas.map((k) => [k, []]))
  lineas.forEach((l) => {
    if (!porDia.has(l.fechaKey)) porDia.set(l.fechaKey, [])
    porDia.get(l.fechaKey).push(l)
  })

  try {
    await Promise.all(
      [...porDia.entries()].map(([fechaKey, items]) =>
        setDoc(
          doc(db, COLECCION_DESCUENTOS, `${tiendaId}_${fechaKey}`),
          payloadDia(tiendaId, nombreTienda, fechaKey, items)
        )
      )
    )
  } catch (error) {
    if (esErrorCuota(error)) return []
    throw error
  }

  await limpiarDescuentosFueraDeCiclo(tiendaId)
  return obtenerHistorialDescuentos(tiendaId)
}

export async function limpiarDescuentosFueraDeCiclo(tiendaId) {
  if (!tiendaId) return
  const permitidas = new Set(clavesUltimosDias(DIAS_CICLO_DESCUENTOS))
  const historial = await obtenerHistorialDescuentos(tiendaId, false)

  await Promise.all(
    historial
      .filter((a) => a.id && !permitidas.has(a.fechaKey))
      .map((a) =>
        deleteDoc(doc(db, COLECCION_DESCUENTOS, a.id)).catch((error) => {
          if (!esErrorCuota(error)) throw error
        })
      )
  )
}

export async function obtenerHistorialDescuentos(tiendaId, filtrarCiclo = true) {
  if (!tiendaId) return []

  try {
    const snap = await getDocs(
      query(collection(db, COLECCION_DESCUENTOS), where("tiendaId", "==", tiendaId))
    )
    let lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    if (filtrarCiclo) {
      const permitidas = new Set(clavesUltimosDias(DIAS_CICLO_DESCUENTOS))
      lista = lista.filter((a) => permitidas.has(a.fechaKey))
    }
    lista.sort((a, b) => String(b.fechaKey).localeCompare(String(a.fechaKey)))
    return lista
  } catch (error) {
    if (esErrorCuota(error)) return []
    throw error
  }
}

export function filasExcelDescuentos(dias) {
  const filas = []
  ;(dias || []).forEach((dia) => {
    const items = dia.items || dia.pantallas || []
    items.forEach((item) => {
      filas.push({
        Fecha: formatearFechaKey(item.fechaKey || dia.fechaKey),
        fechaKey: item.fechaKey || dia.fechaKey,
        Tienda: item.tienda || dia.tiendaNombre || "",
        Tipo: item.tipo === "transferencia" ? "Transferencia" : "Venta",
        Categoria: item.categoria || "Sin categoría",
        Marca: item.marca || "—",
        Modelo: item.modelo || "—",
        Codigo: item.codigo || "—",
        Cantidad: Number(item.cantidad) || 0,
        "Precio unit.": Number(item.precio) || 0,
        Subtotal: Number(item.subtotal) || 0,
        Cliente: item.cliente || (item.tipo === "transferencia" ? "—" : "Sin cliente"),
        Telefono: item.telefono || "",
        Boleta: item.boleta || "",
        Destino: item.destino || "",
        EsPantalla: item.pantalla || esCategoriaPantalla(item) ? "Sí" : "No",
      })
    })
  })
  return filas
}
