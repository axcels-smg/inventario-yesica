import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import Swal from "sweetalert2"
import { Store, Lock, Mail, ArrowRight } from "lucide-react"

function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [cargando, setCargando] = useState(false)
  const { login, recuperarPassword } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    
    if (!email.trim() || !password.trim()) {
      return Swal.fire({
        icon: "warning",
        title: "Campos incompletos",
        text: "Por favor ingresa email y contraseña",
      })
    }

    setCargando(true)
    
    try {
      const resultado = await login(email, password)
      
      if (resultado.success) {
        if (!resultado.tienda) {
          await Swal.fire({
            icon: "warning",
            title: "Sesión iniciada, pero sin tienda",
            text: "Este usuario no tiene documento en Firestore (colección Tienda) con el mismo ID. El inventario no se verá hasta vincularlo.",
          })
          navigate("/dashboard")
        } else {
          Swal.fire({
            icon: "success",
            title: "Bienvenido",
            text: `Iniciaste sesión en ${resultado.tienda.nombre}`,
            timer: 1500,
            showConfirmButton: false,
          }).then(() => {
            navigate("/dashboard")
          })
        }
      } else {
        Swal.fire({
          icon: "error",
          title: "Error de autenticación",
          text: resultado.error,
        })
      }
    } catch (error) {
      console.error("Error en login:", error)
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Ocurrió un error al iniciar sesión",
      })
    } finally {
      setCargando(false)
    }
  }

  async function handleRecuperarPassword() {
    if (!email.trim()) {
      return Swal.fire({
        icon: "warning",
        title: "Email requerido",
        text: "Por favor ingresa tu email para recuperar la contraseña",
      })
    }

    const { value: confirmar } = await Swal.fire({
      title: "¿Enviar correo de recuperación?",
      text: `Se enviará un correo a ${email}`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Enviar",
      cancelButtonText: "Cancelar",
    })

    if (confirmar) {
      const resultado = await recuperarPassword(email)
      
      if (resultado.success) {
        Swal.fire({
          icon: "success",
          title: "Correo enviado",
          text: "Revisa tu bandeja de entrada para restablecer tu contraseña",
        })
      } else {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: resultado.error,
        })
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-8 border dark:border-slate-700">
          {/* Logo/Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
              <Store size={32} className="text-white" />
            </div>
            <h1 className="text-3xl font-black text-slate-800 dark:text-white mb-2">
              Inventario G.R.L.
            </h1>
            <p className="text-slate-500 dark:text-slate-400">
              Sistema de Gestión Multitienda
            </p>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-slate-600 dark:text-slate-400 block mb-2 font-medium">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  placeholder="tu@email.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-sm text-slate-600 dark:text-slate-400 block mb-2 font-medium">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={cargando}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cargando ? (
                "Iniciando sesión..."
              ) : (
                <>
                  Iniciar Sesión
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>

          {/* Recuperar contraseña */}
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={handleRecuperarPassword}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t dark:border-slate-700 text-center text-sm text-slate-500 dark:text-slate-400">
            <p>Ingresa con las credenciales de tu tienda</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login