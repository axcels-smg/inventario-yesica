import {
  Moon,
  Sun,
} from "lucide-react"

import {
  useTheme,
} from "../context/ThemeContext"

function ThemeButton() {

  const {
    darkMode,
    toggleTheme,
  } = useTheme()

  return (

    <button
      onClick={toggleTheme}
      className="
        p-3
        rounded-xl
        bg-slate-200
        dark:bg-slate-800
        transition
      "
    >

      {darkMode ? (

        <Sun className="text-yellow-400" />

      ) : (

        <Moon className="text-slate-700" />

      )}

    </button>
  )
}

export default ThemeButton