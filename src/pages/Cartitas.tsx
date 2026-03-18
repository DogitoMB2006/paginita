import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Heart, ImagePlus, MailOpen, Send, Sparkles, Star, X } from 'lucide-react'
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

const formatLetterDate = (value: string | null) => {
  if (!value) return 'Ahora mismo'

  try {
    return new Intl.DateTimeFormat('es-ES', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value))
  } catch {
    return 'Hace un momento'
  }
}

const getExcerpt = (value: string, length = 120) => {
  const trimmed = value.trim()
  if (trimmed.length <= length) return trimmed
  return `${trimmed.slice(0, length).trimEnd()}...`
}

export function Cartitas() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [partner, setPartner] = useState<PartnerProfile | null>(null)
  const [letters, setLetters] = useState<Letter[]>([])
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [openLetter, setOpenLetter] = useState<Letter | null>(null)
  const [typedContent, setTypedContent] = useState('')
  const [showCloseButton, setShowCloseButton] = useState(false)
  const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null)

  const unreadLetters = useMemo(() => letters.filter((letter) => !letter.is_read), [letters])
  const readLetters = useMemo(() => letters.filter((letter) => letter.is_read), [letters])
  const titleCount = title.trim().length
  const contentCount = content.trim().length

  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl(null)
      return
    }

    const objectUrl = URL.createObjectURL(imageFile)
    setImagePreviewUrl(objectUrl)

    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [imageFile])

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
        const { data, error: lettersError } = await supabase
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

        if (lettersError) {
          setError('No se pudieron cargar tus cartitas.')
          return
        }

        setLetters((data as Letter[]) || [])
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

  const handleOpenLetter = async (letter: Letter) => {
    setOpenLetter(letter)

    if (!letter.is_read) {
      const now = new Date().toISOString()
      setLetters((prev) =>
        prev.map((entry) => (entry.id === letter.id ? { ...entry, is_read: true, read_at: now } : entry)),
      )
      await supabase.from('letters').update({ is_read: true, read_at: now }).eq('id', letter.id)
    }
  }

  const resetComposer = () => {
    setTitle('')
    setContent('')
    setImageFile(null)
  }

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

    const { error: insertError } = await supabase.from('letters').insert({
      title: title.trim(),
      content: content.trim(),
      image_url: imageUrl,
      created_by: currentUserId,
      recipient_id: partner.id,
    })

    if (insertError) {
      setError('No se pudo enviar la cartita.')
    } else {
      resetComposer()
      setMessage('Cartita enviada con éxito.')
    }

    setIsSending(false)
  }

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

    const target = letters.find((letter) => letter.id === openId)
    if (!target) return

    void handleOpenLetter(target)
    setSearchParams((prev) => {
      prev.delete('open')
      return prev
    })
  }, [letters, searchParams, setSearchParams])

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <section className="relative overflow-hidden rounded-[2rem] border border-rose-200/60 bg-[radial-gradient(circle_at_top_left,_rgba(251,113,133,0.28),_transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.97),rgba(255,241,242,0.9)_58%,rgba(254,205,211,0.62))] p-6 shadow-[0_30px_80px_-40px_rgba(244,63,94,0.5)] dark:border-rose-500/20 dark:bg-[radial-gradient(circle_at_top_left,_rgba(244,114,182,0.18),_transparent_28%),linear-gradient(135deg,rgba(30,41,59,0.96),rgba(51,65,85,0.92)_60%,rgba(76,29,149,0.18))] md:p-8">
        <div className="absolute -right-10 top-0 h-36 w-36 rounded-full bg-white/35 blur-3xl dark:bg-pink-400/10" />
        <div className="absolute bottom-0 left-1/3 h-24 w-24 rounded-full bg-rose-300/30 blur-2xl dark:bg-rose-400/10" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-rose-500 backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-rose-200">
              <Sparkles className="h-3.5 w-3.5" />
              Cartitas bonitas
            </div>
            <div className="space-y-2">
              <h1 className="font-serif text-3xl tracking-tight text-slate-800 dark:text-rose-50 md:text-5xl">
                Escribe algo que se sienta especial desde el primer vistazo.
              </h1>
              <p className="max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300 md:text-base">
                Dale a cada carta un aire m&aacute;s rom&aacute;ntico con un t&iacute;tulo bonito, una foto linda y un mensaje que se abra como un regalo.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 rounded-3xl border border-white/60 bg-white/55 p-3 text-center shadow-inner shadow-white/40 backdrop-blur sm:grid-cols-3 dark:border-white/10 dark:bg-white/5 dark:shadow-none">
            <div className="min-w-0 overflow-hidden rounded-2xl bg-white/80 px-4 py-3 dark:bg-slate-800/70">
              <p className="text-center text-xs font-medium text-slate-500 md:text-sm">
                Nuevas
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-800 dark:text-slate-100">{unreadLetters.length}</p>
            </div>
            <div className="min-w-0 overflow-hidden rounded-2xl bg-white/80 px-4 py-3 dark:bg-slate-800/70">
              <p className="text-center text-xs font-medium text-slate-500 md:text-sm">
                Leidas
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-800 dark:text-slate-100">{readLetters.length}</p>
            </div>
            <div className="min-w-0 overflow-hidden rounded-2xl bg-white/80 px-4 py-3 dark:bg-slate-800/70">
              <p className="text-center text-xs font-medium text-slate-500 md:text-sm">
                Destino
              </p>
              <p className="mt-1 w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold leading-5 text-slate-800 dark:text-slate-100 md:text-base">
                {partner?.display_name || 'Tu pareja'}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.35fr_0.85fr]">
        <div className="overflow-hidden rounded-[2rem] border border-rose-200/70 bg-white/90 shadow-[0_30px_80px_-50px_rgba(244,63,94,0.45)] backdrop-blur dark:border-slate-700/80 dark:bg-slate-900/80">
          <div className="border-b border-rose-100/80 bg-gradient-to-r from-rose-50 via-white to-pink-50 px-6 py-5 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-400 to-pink-500 text-white shadow-lg shadow-pink-500/30">
                <Heart className="h-5 w-5" fill="currentColor" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Enviar cartita</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Esta carta llegar&aacute; autom&aacute;ticamente a {partner?.display_name || 'tu pareja'}.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSendLetter} className="space-y-6 p-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Titulo</label>
                <span className="text-xs text-slate-400">{titleCount}/60</span>
              </div>
              <input
                type="text"
                maxLength={60}
                placeholder="Ej. Para cuando te haga falta un abrazo"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-2xl border border-rose-200 bg-rose-50/60 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-rose-400 focus:bg-white focus:ring-4 focus:ring-rose-200/60 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100 dark:focus:border-rose-400 dark:focus:ring-rose-500/20"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Mensaje</label>
                <span className="text-xs text-slate-400">{contentCount}/800</span>
              </div>
              <textarea
                rows={8}
                maxLength={800}
                placeholder="Escribe algo que haga sonreir, que acompane o que se sienta como un abrazo lindo..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full resize-none rounded-[1.6rem] border border-rose-200 bg-white px-4 py-4 text-sm leading-7 text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-rose-400 focus:ring-4 focus:ring-rose-200/60 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100 dark:focus:border-rose-400 dark:focus:ring-rose-500/20"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
              <label className="group flex min-h-44 cursor-pointer flex-col justify-between rounded-[1.6rem] border border-dashed border-rose-300 bg-gradient-to-br from-rose-50 to-white p-4 transition-all hover:border-rose-400 hover:shadow-md hover:shadow-rose-200/40 dark:border-rose-500/30 dark:from-slate-900 dark:to-slate-800/80 dark:hover:border-rose-400/60 dark:hover:shadow-none">
                <div className="space-y-2">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-rose-500 shadow-sm dark:bg-slate-800 dark:text-rose-300">
                    <ImagePlus className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Agrega una imagen</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      Sube una foto linda para acompanar tu carta. Se ver&aacute; antes de enviarla.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 text-xs text-rose-500 dark:text-rose-300">
                  <span className="truncate">{imageFile ? imageFile.name : 'PNG, JPG o WEBP'}</span>
                  <span className="rounded-full bg-white px-3 py-1 font-medium dark:bg-slate-800">Elegir</span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                />
              </label>

              <div className="min-h-44 overflow-hidden rounded-[1.6rem] border border-rose-200/80 bg-gradient-to-br from-white to-rose-50/70 p-3 dark:border-slate-700 dark:from-slate-900 dark:to-slate-800/70">
                {imagePreviewUrl ? (
                  <div className="relative h-full overflow-hidden rounded-[1.2rem]">
                    <img
                      src={imagePreviewUrl}
                      alt="Vista previa de la carta"
                      className="h-full min-h-36 w-full rounded-[1.2rem] object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setImageFile(null)}
                      className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-900/70 text-white backdrop-blur transition hover:bg-slate-900"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <div className="absolute inset-x-3 bottom-3 rounded-2xl bg-white/88 px-3 py-2 text-xs text-slate-600 shadow-lg backdrop-blur dark:bg-slate-900/80 dark:text-slate-200">
                      As&iacute; se ver&aacute; la imagen cuando abras la cartita.
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full min-h-36 flex-col items-center justify-center rounded-[1.2rem] border border-dashed border-rose-200 bg-white/70 px-4 text-center dark:border-slate-700 dark:bg-slate-950/40">
                    <Star className="h-7 w-7 text-rose-300 dark:text-rose-400/70" />
                    <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">Vista previa de imagen</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      Cuando selecciones una foto aparecer&aacute; aqu&iacute; para que no env&iacute;es nada a ciegas.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {(error || message) && (
              <div
                className={`rounded-2xl border px-4 py-3 text-sm ${
                  error
                    ? 'border-red-200 bg-red-50 text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                }`}
              >
                {error || message}
              </div>
            )}

            <div className="flex flex-col gap-3 border-t border-rose-100 pt-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                Consejo: los t&iacute;tulos cortos y dulces se sienten m&aacute;s especiales cuando la carta se abre.
              </p>
              <button
                type="submit"
                disabled={isSending || !title.trim() || !content.trim() || !partner}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-rose-500 via-pink-500 to-fuchsia-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-pink-500/30 transition-transform hover:-translate-y-0.5 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSending ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Enviar cartita
              </button>
            </div>
          </form>
        </div>

        <aside className="space-y-4">
          <div className="rounded-[2rem] border border-amber-200/80 bg-gradient-to-br from-amber-50 to-rose-50 p-5 shadow-lg shadow-amber-100/40 dark:border-amber-400/20 dark:from-slate-900 dark:to-slate-800/80 dark:shadow-none">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-500">Ideas para tu cartita</p>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              <li>Empieza con un recuerdo bonito o algo que te haya hecho pensar en esa persona.</li>
              <li>Anade una imagen cuando quieras que la carta se sienta m&aacute;s viva y cercana.</li>
              <li>Usa un t&iacute;tulo con curiosidad para que abrirla se sienta como un regalito.</li>
            </ul>
          </div>

          <div className="rounded-[2rem] border border-rose-200/80 bg-white/90 p-5 shadow-lg shadow-rose-100/40 dark:border-slate-700 dark:bg-slate-900/80 dark:shadow-none">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-500">Vista previa del tono</p>
            <div className="mt-4 rounded-[1.6rem] bg-gradient-to-br from-rose-500 to-pink-500 p-4 text-white shadow-lg shadow-pink-500/20">
              <p className="text-xs uppercase tracking-[0.18em] text-pink-100">Para {partner?.display_name || 'tu pareja'}</p>
              <h3 className="mt-2 text-lg font-semibold">{title.trim() || 'Tu titulo aparecer&aacute; aqu&iacute;'}</h3>
              <p className="mt-3 text-sm leading-6 text-pink-50/90">
                {content.trim()
                  ? getExcerpt(content, 140)
                  : 'Tu mensaje tendr&aacute; una vista previa corta para que sientas el estilo antes de enviarlo.'}
              </p>
            </div>
          </div>
        </aside>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Cartitas que has recibido</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Abre primero las que todav&iacute;a est&aacute;n esperando por ti.</p>
          </div>
          <div className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
            {unreadLetters.length} nuevas
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-rose-200 border-t-rose-500" />
          </div>
        ) : unreadLetters.length === 0 ? (
          <div className="rounded-[1.6rem] border border-dashed border-rose-200 bg-white/70 p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
            No tienes cartitas nuevas ahora mismo.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {unreadLetters.map((letter) => {
              const sender = getSender(letter)

              return (
                <article
                  key={letter.id}
                  className="group overflow-hidden rounded-[1.8rem] bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-500 p-[1px] shadow-[0_24px_60px_-35px_rgba(236,72,153,0.9)]"
                >
                  <div className="flex h-full flex-col rounded-[1.7rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.18),rgba(255,255,255,0.08))] p-5 text-white backdrop-blur-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-pink-100">De {sender?.display_name || 'Tu amorcito'}</p>
                        <h3 className="mt-2 text-xl font-semibold leading-tight">{letter.title}</h3>
                      </div>
                      <Heart className="mt-1 h-5 w-5 text-pink-100 transition-transform group-hover:scale-110" fill="currentColor" />
                    </div>

                    <p className="mt-4 flex-1 text-sm leading-6 text-pink-50/90">{getExcerpt(letter.content, 105)}</p>

                    <div className="mt-5 flex items-center justify-between gap-3">
                      <span className="text-xs text-pink-100/90">{formatLetterDate(letter.created_at)}</span>
                      <button
                        type="button"
                        onClick={() => void handleOpenLetter(letter)}
                        className="inline-flex items-center gap-2 rounded-full bg-white/18 px-4 py-2 text-xs font-semibold text-white backdrop-blur transition hover:bg-white/24"
                      >
                        <MailOpen className="h-4 w-4" />
                        Abrir ahora
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Cartitas ya leidas</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Tu peque&ntilde;o archivo de mensajes bonitos para volver a leer cuando quieras.</p>
        </div>

        {readLetters.length === 0 ? (
          <div className="rounded-[1.6rem] border border-slate-200 bg-white/70 p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
            A&uacute;n no has le&iacute;do cartitas anteriores.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {readLetters.map((letter) => {
              const sender = getSender(letter)

              return (
                <article
                  key={letter.id}
                  className="overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white/85 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/70 dark:border-slate-700 dark:bg-slate-900/75 dark:hover:shadow-none"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs uppercase tracking-[0.18em] text-slate-400">
                        De {sender?.display_name || 'Tu amorcito'}
                      </p>
                      <h3 className="mt-2 break-words text-lg font-semibold text-slate-800 dark:text-slate-100">
                        {letter.title}
                      </h3>
                    </div>
                    <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                      Leida
                    </span>
                  </div>

                  <p className="mt-3 break-words text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {getExcerpt(letter.content, 110)}
                  </p>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs text-slate-400">{formatLetterDate(letter.read_at || letter.created_at)}</span>
                    <button
                      type="button"
                      onClick={() => void handleOpenLetter(letter)}
                      className="shrink-0 text-xs font-semibold text-rose-500 transition hover:text-rose-600 dark:text-rose-300 dark:hover:text-rose-200"
                    >
                      Volver a leer
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {openLetter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md">
          <button type="button" className="absolute inset-0" onClick={() => setOpenLetter(null)} />
          <div className="relative z-10 w-full max-w-3xl overflow-hidden rounded-[2rem] border border-white/40 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,245,247,0.96))] shadow-[0_40px_100px_-40px_rgba(244,63,94,0.65)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(30,41,59,0.98))]">
            <div className="h-2 w-full bg-gradient-to-r from-rose-400 via-pink-500 to-fuchsia-500" />
            <div className="space-y-5 p-6 md:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-rose-500 dark:bg-rose-500/10 dark:text-rose-200">
                    <Heart className="h-3.5 w-3.5" fill="currentColor" />
                    Cartita abierta
                  </div>
                  <h3 className="mt-3 font-serif text-2xl text-slate-800 dark:text-slate-100 md:text-3xl">{openLetter.title}</h3>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    {formatLetterDate(openLetter.created_at)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setOpenLetter(null)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-900/6 text-slate-500 transition hover:bg-slate-900/10 hover:text-slate-700 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {openLetter.image_url && (
                <button
                  type="button"
                  onClick={() => setZoomedImageUrl(openLetter.image_url)}
                  className="block w-full overflow-hidden rounded-[1.6rem] bg-slate-900/80"
                >
                  <img
                    src={openLetter.image_url}
                    alt={openLetter.title}
                    className="h-64 w-full object-contain transition duration-300 hover:scale-[1.01] md:h-80"
                  />
                </button>
              )}

              <div className="rounded-[1.6rem] border border-rose-100 bg-white/80 p-5 text-sm leading-8 text-slate-700 shadow-inner shadow-rose-100/50 break-words whitespace-pre-wrap dark:border-slate-700 dark:bg-slate-950/55 dark:text-slate-200 dark:shadow-none md:p-6 md:text-[15px]">
                {typedContent}
                {!showCloseButton && <span className="animate-pulse">|</span>}
              </div>

              {showCloseButton && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setOpenLetter(null)}
                    className="rounded-full bg-gradient-to-r from-rose-500 to-pink-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-pink-500/30"
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md">
          <button type="button" className="absolute inset-0 cursor-zoom-out" onClick={() => setZoomedImageUrl(null)} />
          <div className="relative z-10 max-h-[90vh] max-w-[92vw] overflow-hidden rounded-[2rem] border border-white/15 bg-slate-950/70 p-3 shadow-[0_30px_80px_-35px_rgba(236,72,153,0.8)]">
            <button
              type="button"
              onClick={() => setZoomedImageUrl(null)}
              className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-900/70 text-white backdrop-blur transition hover:bg-slate-900"
            >
              <X className="h-4 w-4" />
            </button>
            <img
              src={zoomedImageUrl}
              alt="Carta"
              className="max-h-[86vh] max-w-[90vw] rounded-[1.4rem] object-contain"
            />
          </div>
        </div>
      )}
    </div>
  )
}
