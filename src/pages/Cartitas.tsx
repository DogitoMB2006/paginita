import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Heart, ImagePlus, MailOpen, Send } from 'lucide-react'
import { supabase } from '../lib/supabase'

type LetterSender = {
  display_name: string | null
  avatar_url: string | null
}

type Letter = {
  id: string
  title: string
  content: string
  image_url: string | null
  is_read: boolean
  read_at: string | null
  created_at: string
  created_by: string
  recipient_id: string
  sender?: LetterSender | LetterSender[] | null
}

type PartnerProfile = {
  id: string
  display_name: string | null
}

const getSender = (letter: Letter): LetterSender | null => {
  const raw = letter.sender
  return (Array.isArray(raw) ? raw[0] : raw) ?? null
}

export function Cartitas() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [partner, setPartner] = useState<PartnerProfile | null>(null)
  const [letters, setLetters] = useState<Letter[]>([])
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [openLetter, setOpenLetter] = useState<Letter | null>(null)
  const [typedContent, setTypedContent] = useState('')
  const [showCloseButton, setShowCloseButton] = useState(false)
  const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null)

  const unreadLetters = useMemo(() => letters.filter((l) => !l.is_read), [letters])
  const readLetters = useMemo(() => letters.filter((l) => l.is_read), [letters])

  useEffect(() => {
    const init = async () => {
      setIsLoading(true)
      setError(null)

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setError('No se pudo detectar el usuario actual.')
        setIsLoading(false)
        return
      }

      setCurrentUserId(user.id)

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name')
        .neq('id', user.id)
        .limit(1)

      setPartner((profiles?.[0] as PartnerProfile) || null)

      const loadLetters = async () => {
        const { data, error } = await supabase
          .from('letters')
          .select(
            `
            id,
            title,
            content,
            image_url,
            is_read,
            read_at,
            created_at,
            created_by,
            recipient_id,
            sender:created_by (
              display_name,
              avatar_url
            )
          `,
          )
          .eq('recipient_id', user.id)
          .order('created_at', { ascending: false })

        if (error) {
          setError('No se pudieron cargar tus cartitas.')
        } else {
          setLetters((data as Letter[]) || [])
        }
      }

      await loadLetters()
      setIsLoading(false)

      const channel = supabase
        .channel('realtime-cartitas-page')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'letters' }, async () => {
          await loadLetters()
        })
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }

    void init()
  }, [])

  useEffect(() => {
    if (!openLetter) return
    setTypedContent('')
    setShowCloseButton(false)
    let index = 0
    const timer = setInterval(() => {
      index += 1
      setTypedContent(openLetter.content.slice(0, index))
      if (index >= openLetter.content.length) {
        clearInterval(timer)
        setShowCloseButton(true)
      }
    }, 25)

    return () => clearInterval(timer)
  }, [openLetter])

  useEffect(() => {
    const openId = searchParams.get('open')
    if (!openId || letters.length === 0) return
    const target = letters.find((l) => l.id === openId)
    if (!target) return
    void handleOpenLetter(target)
    setSearchParams((prev) => {
      prev.delete('open')
      return prev
    })
  }, [letters, searchParams, setSearchParams])

  const handleSendLetter = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUserId || !partner || !title.trim() || !content.trim()) return

    setIsSending(true)
    setError(null)
    setMessage(null)

    let imageUrl: string | null = null

    if (imageFile) {
      const ext = imageFile.name.split('.').pop() || 'jpg'
      const path = `letters/${currentUserId}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('fotos').upload(path, imageFile, {
        upsert: true,
      })

      if (uploadError) {
        setError('No se pudo subir la imagen de la carta.')
        setIsSending(false)
        return
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('fotos').getPublicUrl(path)
      imageUrl = publicUrl
    }

    const { error } = await supabase.from('letters').insert({
      title: title.trim(),
      content: content.trim(),
      image_url: imageUrl,
      created_by: currentUserId,
      recipient_id: partner.id,
    })

    if (error) {
      setError('No se pudo enviar la cartita.')
    } else {
      setTitle('')
      setContent('')
      setImageFile(null)
      setMessage('Cartita enviada con éxito.')
    }

    setIsSending(false)
  }

  const handleOpenLetter = async (letter: Letter) => {
    setOpenLetter(letter)

    if (!letter.is_read) {
      const now = new Date().toISOString()
      setLetters((prev) =>
        prev.map((l) => (l.id === letter.id ? { ...l, is_read: true, read_at: now } : l)),
      )
      await supabase.from('letters').update({ is_read: true, read_at: now }).eq('id', letter.id)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100 md:text-3xl">
          Cartitas
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Mensajes bonitos para sorprenderse en cualquier momento.
        </p>
      </header>

      <section className="rounded-2xl bg-white/90 p-5 shadow-lg shadow-pink-500/10 backdrop-blur-md dark:bg-slate-900/80 md:p-6">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Enviar cartita</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Esta carta se enviará automáticamente a {partner?.display_name || 'tu pareja'}.
        </p>

        <form onSubmit={handleSendLetter} className="mt-4 space-y-4">
          <input
            type="text"
            placeholder="Título de la carta"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:border-pink-400 dark:focus:ring-pink-400"
          />
          <textarea
            rows={4}
            placeholder="Escribe tu cartita..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full resize-none rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:border-pink-400 dark:focus:ring-pink-400"
          />
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-pink-300 px-3 py-2 text-xs text-pink-600 dark:border-pink-500/40 dark:text-pink-300">
            <ImagePlus className="h-4 w-4" />
            <span>{imageFile ? imageFile.name : 'Agregar imagen (opcional)'}</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
            />
          </label>

          {(error || message) && (
            <div className="text-xs">
              {error && <span className="text-red-500">{error}</span>}
              {message && <span className="text-emerald-500">{message}</span>}
            </div>
          )}

          <button
            type="submit"
            disabled={isSending || !title.trim() || !content.trim() || !partner}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-pink-400 to-rose-400 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-pink-500/30 transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSending ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Enviar cartita
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Cartitas que has recibido</h2>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <div className="h-6 w-6 animate-spin rounded-full border-3 border-pink-200 border-t-pink-500" />
          </div>
        ) : unreadLetters.length === 0 ? (
          <div className="rounded-xl border border-dashed border-pink-200 bg-white/70 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
            No tienes cartitas nuevas ahora mismo.
          </div>
        ) : (
          <div className="space-y-3">
            {unreadLetters.map((letter) => {
              const sender = getSender(letter)
              return (
                <article
                  key={letter.id}
                  className="rounded-xl bg-gradient-to-r from-rose-400 to-pink-500 p-4 text-white shadow-lg shadow-pink-500/20"
                >
                  <p className="text-xs text-pink-100">De {sender?.display_name || 'Tu amorcito'}</p>
                  <h3 className="mt-1 text-lg font-bold">{letter.title}</h3>
                  <button
                    type="button"
                    onClick={() => void handleOpenLetter(letter)}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm"
                  >
                    <MailOpen className="h-4 w-4" />
                    Abrir
                  </button>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Ver cartas anteriores</h2>
        {readLetters.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white/70 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
            Aún no has leído cartitas anteriores.
          </div>
        ) : (
          <div className="space-y-3">
            {readLetters.map((letter) => {
              const sender = getSender(letter)
              return (
                <article
                  key={letter.id}
                  className="rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/70"
                >
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    De {sender?.display_name || 'Tu amorcito'}
                  </p>
                  <h3 className="mt-1 text-base font-semibold text-slate-800 dark:text-slate-100">
                    {letter.title}
                  </h3>
                  <button
                    type="button"
                    onClick={() => void handleOpenLetter(letter)}
                    className="mt-2 text-xs font-medium text-pink-500 hover:text-pink-600"
                  >
                    Volver a leer
                  </button>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {openLetter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md">
          <div className="absolute inset-0" onClick={() => setOpenLetter(null)} />
          <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl bg-white/95 shadow-2xl shadow-pink-500/20 dark:bg-slate-900/95">
            <div className="h-2 w-full bg-gradient-to-r from-rose-400 to-pink-500" />
            <div className="p-6">
              <div className="mb-4 flex items-center gap-2 text-pink-500">
                <Heart className="h-5 w-5 animate-pulse" fill="currentColor" />
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                  {openLetter.title}
                </h3>
              </div>
              {openLetter.image_url && (
                <img
                  src={openLetter.image_url}
                  alt={openLetter.title}
                  className="mb-4 h-52 w-full cursor-zoom-in rounded-xl object-contain bg-slate-900/40"
                  onClick={() => setZoomedImageUrl(openLetter.image_url)}
                />
              )}
              <div className="min-h-[140px] max-h-64 overflow-y-auto rounded-xl bg-rose-50/70 p-4 text-sm leading-7 text-slate-700 break-words whitespace-pre-wrap dark:bg-slate-800/70 dark:text-slate-200">
                {typedContent}
                {!showCloseButton && <span className="animate-pulse">|</span>}
              </div>

              {showCloseButton && (
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setOpenLetter(null)}
                    className="rounded-lg bg-gradient-to-r from-pink-400 to-rose-400 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-pink-500/30"
                  >
                    Cerrar cartita
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {zoomedImageUrl && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/75 backdrop-blur-md">
          <button
            type="button"
            className="absolute inset-0 cursor-zoom-out"
            onClick={() => setZoomedImageUrl(null)}
          />
          <div className="relative z-10 max-h-[85vh] max-w-[90vw]">
            <img
              src={zoomedImageUrl}
              alt="Carta"
              className="max-h-[85vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl shadow-pink-500/30"
            />
          </div>
        </div>
      )}
    </div>
  )
}

