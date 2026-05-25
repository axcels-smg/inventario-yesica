import { useState, useRef, useEffect } from "react"
import { Shield, ChevronDown } from "lucide-react"
import { useRol } from "../context/RolContext"
import { ROLES_USUARIO, ETIQUETAS_ROLES } from "../constants/inventario"

function SelectorRol() {
  const { rolActual, cambiarRol } = useRol()
  const [abierto, setAbierto] = useState(false)
  const buttonRef = useRef(null)
  const dropdownRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) && !buttonRef.current.contains(event.target)) {
        setAbierto(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const buttonRect = buttonRef.current ? buttonRef.current.getBoundingClientRect() : null

  return (
    <div className="relative w-full">
      <button
        ref={buttonRef}
        onClick={() => setAbierto(!abierto)}
        className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition w-full"
      >
        <Shield size={18} className="text-slate-700 dark:text-blue-400 shrink-0" />
        <span className="text-sm font-medium dark:text-white truncate flex-1">
          {ETIQUETAS_ROLES[rolActual]}
        </span>
        <ChevronDown
          size={16}
          className={`text-slate-400 dark:text-slate-300 transition-transform shrink-0 ${abierto ? "rotate-180" : ""}`}
        />
      </button>

      {abierto && buttonRect && (
        <div
          ref={dropdownRef}
          className="fixed bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl shadow-2xl z-[99999]"
          style={{
            top: buttonRect.bottom + 8,
            left: Math.max(8, Math.min(buttonRect.left, window.innerWidth - 260)),
            width: '250px',
          }}
        >
          {Object.values(ROLES_USUARIO).map((rol) => (
            <button
              key={rol}
              onClick={() => {
                cambiarRol(rol)
                setAbierto(false)
              }}
              className={`w-full px-4 py-3 text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition border-b dark:border-slate-700 last:border-0 ${
                rolActual === rol ? "bg-blue-50 dark:bg-blue-950" : ""
              }`}
            >
              <span className="text-sm dark:text-white font-medium">
                {ETIQUETAS_ROLES[rol]}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default SelectorRol
