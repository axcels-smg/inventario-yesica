import { useTienda } from "../context/TiendaContext"

function AvisoOtraTienda({ modo = "banner" }) {
  const { tiendaActual, esTiendaPropia, volverAMiTienda } = useTienda()

  if (esTiendaPropia || !tiendaActual) return null

  if (modo === "bloqueo") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center p-8">
        <p className="text-2xl font-bold text-slate-700 dark:text-slate-200">
          Solo lectura
        </p>
        <p className="text-slate-500 dark:text-slate-400 max-w-md">
          Estás viendo <strong>{tiendaActual.nombre}</strong>. De otras tiendas solo puedes consultar productos, no vender ni modificar.
        </p>
        <button
          type="button"
          onClick={volverAMiTienda}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-blue-700"
        >
          Volver a mi tienda
        </button>
      </div>
    )
  }

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
      <p className="text-sm">
        Consultando <strong>{tiendaActual.nombre}</strong> — solo puedes ver productos, no modificar.
      </p>
      <button
        type="button"
        onClick={volverAMiTienda}
        className="text-sm font-semibold underline underline-offset-2"
      >
        Volver a mi tienda
      </button>
    </div>
  )
}

export default AvisoOtraTienda
