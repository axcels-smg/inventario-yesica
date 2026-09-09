import { useEffect, useRef } from "react"

function Modal({ isOpen, onClose, children }) {
  const panelRef = useRef(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!isOpen) return

    const panel = panelRef.current
    if (!panel) return

    const focusables = () =>
      panel.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )

    const lista = focusables()
    const input = panel.querySelector("input, textarea, select")
    ;(input || lista[0])?.focus({ preventScroll: true })

    function handleKeyDown(e) {
      if (e.key === "Escape") {
        onCloseRef.current?.()
        return
      }
      if (e.key !== "Tab") return

      const items = [...focusables()]
      if (items.length === 0) return

      const primero = items[0]
      const ultimo = items[items.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === primero) {
          e.preventDefault()
          ultimo.focus({ preventScroll: true })
        }
      } else if (document.activeElement === ultimo) {
        e.preventDefault()
        primero.focus({ preventScroll: true })
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={() => onCloseRef.current?.()}
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 w-full max-w-lg max-h-[92dvh] overflow-y-auto shadow-2xl transition-all duration-200"
      >
        <div className="flex justify-end mb-4">
          <button
            type="button"
            onClick={() => onCloseRef.current?.()}
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
