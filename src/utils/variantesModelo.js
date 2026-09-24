import { esCategoriaPantalla, stockNumero } from "./stock"

function sinAcentos(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function limpiarBorde(valor) {
  return sinAcentos(valor)
    .toUpperCase()
    .replace(/\s+/g, " ")
    .replace(/[\s.]+$/g, "")
    .trim()
}

const PALABRAS_MECANICO = new Set([
  "MECANICO",
  "MECANCICO",
  "MECNAICO",
  "AMM",
  "ASS",
  "AMP",
  "RE",
  "OP",
])

function palabrasModelo(modelo) {
  return limpiarBorde(modelo).split(/[^A-Z0-9]+/).filter(Boolean)
}

function esYiifix(palabra) {
  return /^YI{1,2}FIX$/.test(palabra)
}

function calidadDe(palabras) {
  if (palabras.includes("OLED") || palabras.includes("AMM")) return "oled"
  if (palabras.includes("INCELL") || palabras.includes("AMP")) return "incell"
  if (
    palabras.includes("ORIGINAL") ||
    palabras.includes("OP") ||
    palabras.includes("ASS") ||
    palabras.includes("RE")
  ) return "original"
  return ""
}

export function clasificarModelo(modelo) {
  const palabras = palabrasModelo(modelo)
  const tieneYiifix = palabras.some(esYiifix)
  const tieneMecanico = palabras.some((palabra) => PALABRAS_MECANICO.has(palabra))
  const base = palabras
    .filter((palabra) => !esYiifix(palabra) && !PALABRAS_MECANICO.has(palabra))
    .join(" ")

  const tipo = tieneYiifix ? "yiifix" : tieneMecanico ? "mecanico" : "normal"
  const baseFamilia = (tipo === "mecanico"
    ? palabras.filter((palabra) => palabra !== "ORIGINAL")
    : palabras
  )
    .filter((palabra) => !esYiifix(palabra) && !PALABRAS_MECANICO.has(palabra))
    .join(" ")

  return {
    tipo,
    calidad: calidadDe(palabras),
    alternativas: alternativasDe(modelo),
    base: baseFamilia || base || limpiarBorde(modelo),
  }
}

function alternativasDe(modelo) {
  return limpiarBorde(modelo)
    .split("/")
    .map((parte) => {
      const base = palabrasModelo(parte)
        .filter((palabra) => !esYiifix(palabra) && !PALABRAS_MECANICO.has(palabra) && palabra !== "ORIGINAL")
        .join(" ")
      return coreModelo(base)
    })
    .filter(Boolean)
}

function claveFamilia(producto, base) {
  return [
    limpiarBorde(producto?.marca),
    limpiarBorde(producto?.categoria),
    base,
  ].join("||")
}

function stockDe(lista) {
  return (lista || []).reduce((suma, p) => suma + stockNumero(p.stock), 0)
}

function coreModelo(base) {
  return String(base || "")
    .replace(/\bORIGINAL\b/g, " ")
    .replace(/\bOLED\b/g, " ")
    .replace(/\bINCELL\b/g, " ")
    .replace(/\b4G\b/g, " ")
    .replace(/\bCON MARCO\b/g, " ")
    .replace(/\bSIN MARCO\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function calidadBase(base) {
  const texto = ` ${base || ""} `
  if (texto.includes(" OLED ")) return "oled"
  if (texto.includes(" INCELL ")) return "incell"
  if (texto.includes(" ORIGINAL ")) return "original"
  return ""
}

function tipoMarco(base) {
  const texto = ` ${base || ""} `
  if (texto.includes(" SIN MARCO ")) return "sin"
  if (texto.includes(" CON MARCO ")) return "con"
  return ""
}

function unirVarianteSinMarco(grupos) {
  const pantallas = grupos.filter((grupo) => esCategoriaPantalla(grupo))

  function destino(origen, slot) {
    const core = coreModelo(origen.base)
    const marco = tipoMarco(origen.base)
    const calidad = origen.calidad || ""
    const pool = pantallas.filter((grupo) => {
      if (grupo === origen) return false
      if (limpiarBorde(grupo.marca) !== limpiarBorde(origen.marca)) return false
      const coreDestino = coreModelo(grupo.base)
      const alternativas = origen.alternativas || [core]
      if (coreDestino !== core && !alternativas.includes(coreDestino)) return false
      if (!grupo.normal.length) return false
      if (marco && tipoMarco(grupo.base) !== marco) return false
      const delNormal = calidadBase(grupo.base)
      if (calidad === "oled" || calidad === "incell") return delNormal === calidad || delNormal === ""
      if (calidad === "original") return delNormal === "original" || delNormal === ""
      return delNormal === "" || delNormal === "original"
    }).sort((a, b) => {
      const ordenMarco = { con: 0, sin: 1 }
      const marcoA = (ordenMarco[tipoMarco(a.base)] ?? 9) - (ordenMarco[tipoMarco(b.base)] ?? 9)
      if (!marco && marcoA) return marcoA
      const puesto = (grupo) => {
        const suyo = coreModelo(grupo.base)
        if (suyo === (origen.alternativas || [])[0]) return 0
        if (suyo === core) return 1
        return 2
      }
      const porNombre = puesto(a) - puesto(b)
      if (porNombre) return porNombre
      const exacto = (grupo) => (calidadBase(grupo.base) === calidad ? 0 : 1)
      return exacto(a) - exacto(b)
    })
    return pool.find((grupo) => grupo[slot].length === 0) || null
  }

  pantallas.forEach((origen) => {
    if (origen.normal.length) return
    ;["yiifix", "mecanico"].forEach((slot) => {
      if (!origen[slot].length) return
      const casa = destino(origen, slot)
      if (!casa) return
      casa[slot].push(...origen[slot])
      origen[slot] = []
    })
  })

  pantallas.forEach((origen) => {
    if (origen.normal.length) return
    ;["yiifix", "mecanico"].forEach((slot) => {
      if (!origen[slot].length) return
      const core = coreModelo(origen.base)
      const alternativas = origen.alternativas?.length ? origen.alternativas : [core]
      const casa = pantallas
        .filter((grupo) => {
          if (grupo === origen || grupo[slot].length) return false
          if (limpiarBorde(grupo.marca) !== limpiarBorde(origen.marca)) return false
          if (tipoMarco(origen.base) && tipoMarco(grupo.base) !== tipoMarco(origen.base)) return false
          const coreDestino = coreModelo(grupo.base)
          const delOtro = grupo.alternativas?.length ? grupo.alternativas : [coreDestino]
          const mismo = alternativas.includes(coreDestino) || delOtro.includes(core)
          if (!mismo) return false
          if (grupo.normal.length) {
            const delNormal = calidadBase(grupo.base)
            const calidad = origen.calidad || ""
            if ((calidad === "oled" || calidad === "incell") && delNormal && delNormal !== calidad) return false
          }
          return grupo.normal.length || grupo.yiifix.length || grupo.mecanico.length
        })
        .sort((a, b) => {
          const puesto = (grupo) => (coreModelo(grupo.base) === alternativas[0] ? 0 : 1)
          return puesto(a) - puesto(b)
        })[0]
      if (!casa) return
      casa[slot].push(...origen[slot])
      origen[slot] = []
    })
  })

  return grupos.filter(
    (grupo) =>
      grupo.normal.length || grupo.yiifix.length || grupo.mecanico.length || grupo.mixto.length
  )
}

export function agruparVariantes(productos) {
  const mapa = new Map()

  ;(productos || []).forEach((producto) => {
    const clase = esCategoriaPantalla(producto)
      ? clasificarModelo(producto?.modelo)
      : { tipo: "normal", calidad: "", alternativas: [], base: limpiarBorde(producto?.modelo) }
    const propio = clase.tipo === "mixto"
    const clave = propio
      ? `${claveFamilia(producto, clase.base)}||${limpiarBorde(producto?.modelo)}`
      : `${claveFamilia(producto, clase.base)}||${clase.calidad || ""}`

    if (!mapa.has(clave)) {
      mapa.set(clave, {
        clave,
        marca: producto?.marca || "",
        categoria: producto?.categoria || "",
        base: clase.base,
        calidad: clase.calidad || "",
        alternativas: clase.alternativas || [],
        normal: [],
        yiifix: [],
        mecanico: [],
        mixto: [],
      })
    }

    const grupo = mapa.get(clave)
    const casilla = propio ? "mixto" : clase.tipo
    grupo[casilla].push(producto)
  })

  return unirVarianteSinMarco([...mapa.values()])
    .map((grupo) => {
      const normal = stockDe(grupo.normal)
      const yiifix = stockDe(grupo.yiifix)
      const mecanico = stockDe(grupo.mecanico)
      const mixto = stockDe(grupo.mixto)
      return {
        ...grupo,
        stockNormal: grupo.normal.length ? normal : 0,
        stockYiifix: grupo.yiifix.length ? yiifix : 0,
        stockMecanico: grupo.mecanico.length ? mecanico : 0,
        stockMixto: mixto,
        total: normal + yiifix + mecanico + mixto,
        hayYiifix: grupo.yiifix.length > 0,
        hayMecanico: grupo.mecanico.length > 0,
        hayNormal: grupo.normal.length > 0,
      }
    })
    .sort((a, b) =>
      `${a.marca} ${a.base}`.localeCompare(`${b.marca} ${b.base}`, "es", {
        numeric: true,
      })
    )
}

export function stockEntraEnCorte(stock, corte) {
  const n = stockNumero(stock)
  if (corte === "no_hay") return n === 0
  if (corte === "menor3") return n < 3
  if (corte === "menor5") return n < 5
  return false
}

function separarReporteUnaTienda(productos, corte) {
  const idsPantalla = new Set()
  const familiasPantalla = agruparVariantes(productos).filter((familia) => {
    if (!esCategoriaPantalla(familia) || !stockEntraEnCorte(familia.total, corte)) return false
    ;[familia.normal, familia.yiifix, familia.mecanico, familia.mixto]
      .flat()
      .forEach((producto) => {
        if (producto?.id) idsPantalla.add(producto.id)
      })
    return true
  })
  const lista = (productos || []).filter((producto) =>
    esCategoriaPantalla(producto)
      ? idsPantalla.has(producto.id)
      : stockEntraEnCorte(producto.stock, corte)
  )
  return { lista, familiasPantalla }
}

export function separarReporteStock(productos, corte) {
  const porTienda = new Map()
  ;(productos || []).forEach((producto) => {
    const tienda = producto?.tiendaId || ""
    if (!porTienda.has(tienda)) porTienda.set(tienda, [])
    porTienda.get(tienda).push(producto)
  })
  const lista = []
  const familiasPantalla = []
  porTienda.forEach((grupo) => {
    const parte = separarReporteUnaTienda(grupo, corte)
    lista.push(...parte.lista)
    familiasPantalla.push(...parte.familiasPantalla)
  })
  return { lista, familiasPantalla }
}

export function idsPantallaConTotal(productos) {
  const porTienda = new Map()
  ;(productos || []).forEach((producto) => {
    const tienda = producto?.tiendaId || ""
    if (!porTienda.has(tienda)) porTienda.set(tienda, [])
    porTienda.get(tienda).push(producto)
  })

  const ids = new Set()
  porTienda.forEach((lista) => {
    agruparVariantes(lista).forEach((familia) => {
      if (!esCategoriaPantalla(familia) || familia.total <= 0) return
      ;[familia.normal, familia.yiifix, familia.mecanico, familia.mixto]
        .flat()
        .forEach((producto) => {
          if (producto?.id) ids.add(producto.id)
        })
    })
  })
  return ids
}

export function contarPantallasSinStock(productos) {
  return agruparVariantes(productos).filter(
    (familia) => esCategoriaPantalla(familia) && familia.total === 0
  ).length
}

export function etiquetaVariante(base, tipo) {
  if (tipo === "yiifix") return `${base} YIIFIX`
  if (tipo === "mecanico") return `${base} MECANICO`
  return base
}
