import { useEffect, useState, useRef, type ChangeEvent } from 'react'
import { Camera, Save, User as UserIcon } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Profile = {
  id: string
  display_name: string | null
  avatar_url: string | null
}

export function Perfil() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const loadProfile = async () => {
      setIsLoading(true)
      setError(null)

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        setError('No se pudo cargar el usuario actual.')
        setIsLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .eq('id', user.id)
        .single()

      if (error) {
        setError('No se pudo cargar tu perfil.')
      } else if (data) {
        setProfile(data as Profile)
        setDisplayName(data.display_name || '')
        setAvatarUrl(data.avatar_url)
      }

      setIsLoading(false)
    }

    loadProfile()
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    setIsSaving(true)
    setError(null)
    setMessage(null)

    const updates = {
      id: profile.id,
      display_name: displayName || null,
      avatar_url: avatarUrl,
    }

    const { error } = await supabase.from('profiles').upsert(updates)

    if (error) {
      setError('No se pudo guardar tu perfil.')
    } else {
      setMessage('Perfil actualizado con éxito 💖')
      // Auto-hide success message after 3 seconds
      setTimeout(() => setMessage(null), 3000)
    }

    setIsSaving(false)
  }

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !profile) return

    setIsSaving(true)
    setError(null)
    setMessage(null)

    const ext = file.name.split('.').pop()
    const path = `${profile.id}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage.from('fotos').upload(path, file, {
      upsert: true,
    })

    if (uploadError) {
      setError('No se pudo subir la foto.')
      setIsSaving(false)
      return
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('fotos').getPublicUrl(path)

    setAvatarUrl(publicUrl)
    setIsSaving(false)
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-pink-200 border-t-pink-500" />
      </div>
    )
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="w-full max-w-lg rounded-2xl bg-white/80 p-0 shadow-2xl shadow-pink-500/10 backdrop-blur-xl dark:bg-slate-900/80">
        <div className="flex flex-col items-center gap-6 pb-2 pt-10">
          
          {/* Avatar Upload Container */}
          <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <div className="relative">
              <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-pink-100 text-3xl font-medium text-pink-600 shadow-xl dark:border-slate-900 dark:bg-slate-800 dark:text-pink-400">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <span>{displayName ? displayName.charAt(0).toUpperCase() : 'A'}</span>
                )}
              </div>
              <div className="absolute bottom-0 right-0 rounded-full border-2 border-white bg-pink-500 p-1.5 text-white shadow-sm transition-transform duration-300 group-hover:scale-110 dark:border-slate-900">
                <Camera className="h-4 w-4" />
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          <div className="text-center px-4 space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-white">
              Tu Perfil
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
              Personaliza cómo te ves en nuestra paginita
            </p>
          </div>
        </div>
        
        <div className="my-2 h-px w-full bg-slate-200 opacity-50 dark:bg-slate-700 dark:opacity-20" />
        
        <div className="px-8 pb-10 pt-4">
          <form onSubmit={handleSave} className="flex flex-col gap-6">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">
                Nombre para mostrar
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <UserIcon className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  placeholder="Ej: Mi Amor, Princesa, etc."
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="block w-full rounded-xl border border-slate-200 bg-white/50 pl-10 pr-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition-all focus:border-pink-500 focus:ring-2 focus:ring-pink-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-pink-400 dark:focus:ring-pink-500/30"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-500/10 dark:text-red-400">
                {error}
              </div>
            )}
            
            {message && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-600 dark:border-emerald-900/50 dark:bg-emerald-500/10 dark:text-emerald-400 animate-in fade-in duration-300">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={isSaving || !profile}
              className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-400 to-rose-400 py-3 font-semibold text-white shadow-lg shadow-pink-500/30 transition-transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : (
                <>
                  <Save className="h-5 w-5" />
                  <span>Guardar cambios</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

