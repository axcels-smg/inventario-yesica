import { Moon, Sun } from "lucide-react"
import { useTheme } from "../context/ThemeContext"

function ThemeButton() {
  const { darkMode, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      aria-label="Cambiar tema"
      className="
        p-3
        rounded-xl
        bg-slate-200
        dark:bg-slate-800
        transition
        hover:scale-105
        active:scale-95
      "
    >
      {darkMode ? (
        <Sun className="text-yellow-400 transition-all duration-200" />
      ) : (
        <Moon className="text-slate-700 transition-all duration-200" />
      )}
    </button>
  )
}

export default ThemeButton