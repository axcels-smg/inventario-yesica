function Modal({ isOpen, onClose, children }) {
  if (!isOpen) return null

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-lg shadow-2xl transition-all duration-200"
      >
        {/* BOTÓN CERRAR */}
        <div className="flex justify-end mb-4">
          <button
            onClick={onClose}
            className="text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* CONTENIDO */}
        <div>{children}</div>
      </div>
    </div>
  )
}

export default Modal