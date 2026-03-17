import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, Lock, Mail } from 'lucide-react'
import { supabase } from '../lib/supabase'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error
      navigate('/dashboard')
    } catch (error: any) {
      setError(error.message || 'Error al iniciar sesión')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-rose-50/50 p-4 dark:bg-slate-950 relative overflow-hidden">
      <div className="absolute inset-0 z-0 overflow-hidden">
        {/* Cute background decoration elements */}
        <div className="absolute -left-10 top-10 h-72 w-72 rounded-full bg-pink-300/20 blur-3xl" />
        <div className="absolute -right-10 bottom-10 h-72 w-72 rounded-full bg-rose-300/20 blur-3xl" />
      </div>

      <div className="z-10 w-full max-w-md rounded-2xl bg-white/80 p-8 shadow-2xl shadow-rose-500/10 backdrop-blur-xl dark:bg-slate-900/80">
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-500/20">
            <Heart className="h-8 w-8 text-rose-500" fill="currentColor" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
            Bienvenido, mi amor
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Ingresa a nuestra paginita
          </p>
        </div>
        
        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">
              Correo
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Mail className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="email"
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                className="block w-full rounded-xl border border-slate-200 bg-white/50 pl-10 pr-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition-all focus:border-pink-500 focus:ring-2 focus:ring-pink-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-pink-400 dark:focus:ring-pink-500/30"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">
              Contraseña
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Lock className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="block w-full rounded-xl border border-slate-200 bg-white/50 pl-10 pr-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition-all focus:border-pink-500 focus:ring-2 focus:ring-pink-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-pink-400 dark:focus:ring-pink-500/30"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-500 dark:bg-red-500/10">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 w-full flex items-center justify-center rounded-xl bg-gradient-to-r from-pink-400 to-rose-400 py-3 font-semibold text-white shadow-lg shadow-pink-500/30 transition-transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
          >
           {isLoading ? (
             <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
           ) : (
             'Entrar'
           )}
          </button>
        </form>
      </div>
    </div>
  )
}
