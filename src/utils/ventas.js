import { esCategoriaPantalla } from "./stock"
import { claveDiaLocal, obtenerTiempoFecha } from "./fechas"

export function esVentaActiva(venta) {
  return venta?.anulada !== true
}

export function esBoletaDePantallas(venta) {
  const lista = venta?.productos || []
  return lista.length > 0 && lista.every((producto) => esCategoriaPantalla(producto))
}

function claveCliente(venta) {
  return String(venta?.clienteId || venta?.cliente || "").trim().toUpperCase()
}

function sumarLineas(actuales, nuevas) {
  const productos = (actuales || []).map((producto) => ({ ...producto }))
  ;(nuevas || []).forEach((producto) => {
    const i = productos.findIndex(
      (item) => item.id === producto.id && Number(item.precio) === Number(producto.precio)
    )
    if (i >= 0) {
      productos[i] = {
        ...productos[i],
        cantidad: Number(productos[i].cantidad) + Number(producto.cantidad),
      }
      return
    }
    productos.push({ ...producto })
  })
  return productos
}

export function totalDeProductos(productos) {
  return (productos || []).reduce(
    (suma, producto) => suma + Number(producto.precio || 0) * Number(producto.cantidad || 0),
    0
  )
}

export function boletaPantallasDelDia(ventas, cliente, tiendaId, fecha = new Date()) {
  const dia = claveDiaLocal(fecha)
  const nombre = String(cliente?.nombre || "").trim().toUpperCase()
  const id = cliente?.id || ""
  return (ventas || [])
    .filter((venta) => {
      if (!esVentaActiva(venta) || !esBoletaDePantallas(venta)) return false
      if (tiendaId && venta.tiendaId && venta.tiendaId !== tiendaId) return false
      if (claveDiaLocal(venta.fecha || venta.fechaTexto) !== dia) return false
      if (id && venta.clienteId) return venta.clienteId === id
      return String(venta.cliente || "").trim().toUpperCase() === nombre
    })
    .sort(
      (a, b) =>
        obtenerTiempoFecha(a.fecha || a.fechaTexto) -
        obtenerTiempoFecha(b.fecha || b.fechaTexto)
    )[0] || null
}

export function juntarPantallasMismoDia(ventas) {
  const grupos = new Map()
  const sueltas = []

  ;(ventas || []).forEach((venta) => {
    const cliente = claveCliente(venta)
    if (!esVentaActiva(venta) || !esBoletaDePantallas(venta) || !cliente) {
      sueltas.push(venta)
      return
    }
    if (!grupos.has(cliente)) grupos.set(cliente, [])
    grupos.get(cliente).push(venta)
  })

  const juntas = []
  grupos.forEach((lista) => {
    const ordenadas = [...lista].sort(
      (a, b) =>
        obtenerTiempoFecha(a.fecha || a.fechaTexto) -
        obtenerTiempoFecha(b.fecha || b.fechaTexto)
    )
    if (ordenadas.length === 1) {
      juntas.push(ordenadas[0])
      return
    }
    const productos = ordenadas.flatMap((venta) =>
      (venta.productos || []).map((producto, indice) => ({
        ...producto,
        ventaId: venta.id,
        indice,
      }))
    )
    const primera = ordenadas[0]
    juntas.push({
      ...primera,
      id: ordenadas.map((venta) => venta.id).join("_"),
      origenes: ordenadas,
      productos,
      total: totalDeProductos(productos),
      boletaDelDia: true,
    })
  })

  return [...juntas, ...sueltas].sort(
    (a, b) =>
      obtenerTiempoFecha(a.fecha || a.fechaTexto) -
      obtenerTiempoFecha(b.fecha || b.fechaTexto)
  )
}

export { sumarLineas }

export function filtrarVentasActivas(ventas) {
  return ventas.filter(esVentaActiva)
}
