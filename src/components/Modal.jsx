import { useEffect, useRef } from "react"

function Modal({ isOpen, onClose, children }) {
  const panelRef = useRef(null)

  // Focus trap: mantener el foco dentro del modal
  useEffect(() => {
    if (!isOpen) return

    const panel = panelRef.current
    if (!panel) return

    const focusables = panel.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const primero = focusables[0]
    const ultimo = focusables[focusables.length - 1]

    primero?.focus()

    function handleKeyDown(e) {
      if (e.key === "Escape") {
        onClose()
        return
      }
      if (e.key !== "Tab") return

      if (e.shiftKey) {
        if (document.activeElement === primero) {
          e.preventDefault()
          ultimo?.focus()
        }
      } else {
        if (document.activeElement === ultimo) {
          e.preventDefault()
          primero?.focus()
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-lg shadow-2xl transition-all duration-200"
      >
        <div className="flex justify-end mb-4">
          <button
            onClick={onClose}
            aria-label="Cerrar modal"
            className="text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        <div>{children}</div>
      </div>
    </div>
  )
}

export default Modal
