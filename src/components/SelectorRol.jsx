import { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
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

  const dropdownPosition = buttonRect ? (() => {
    const dropdownWidth = 300
    const spaceOnRight = window.innerWidth - buttonRect.right

    let position = {
      top: buttonRect.bottom + 8,
    }

    if (spaceOnRight >= dropdownWidth) {
      position.left = buttonRect.left
    } else {
      position.left = Math.max(8, window.innerWidth - dropdownWidth - 8)
    }

    return position
  })() : null

  const dropdownContent = abierto && buttonRect && dropdownPosition && (
    <div
      ref={dropdownRef}
      className="fixed bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-[99999] overflow-y-auto"
      style={{
        ...dropdownPosition,
        width: '300px',
      }}
    >
      {Object.values(ROLES_USUARIO).map((rol) => (
        <button
          key={rol}
          onClick={() => {
            cambiarRol(rol)
            setAbierto(false)
          }}
          className={`w-full px-4 py-3 text-left hover:bg-slate-800 transition border-b border-slate-700 last:border-0 ${
            rolActual === rol ? "bg-blue-950" : ""
          }`}
        >
          <span className="text-sm text-white font-medium">
            {ETIQUETAS_ROLES[rol]}
          </span>
        </button>
      ))}
    </div>
  )

  return (
    <div className="relative w-full">
      <button
        ref={buttonRef}
        onClick={() => setAbierto(!abierto)}
        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl transition w-full border border-slate-700"
      >
        <Shield size={18} className="text-blue-400 shrink-0" />
        <span className="text-sm font-medium text-white truncate flex-1">
          {ETIQUETAS_ROLES[rolActual]}
        </span>
        <ChevronDown
          size={16}
          className={`text-slate-300 transition-transform shrink-0 ${abierto ? "rotate-180" : ""}`}
        />
      </button>
      {dropdownContent && createPortal(dropdownContent, document.body)}
    </div>
  )
}

export default SelectorRol
