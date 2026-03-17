import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, Heart, PlusCircle, Trash2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Plan = {
  id: string
  title: string
  description: string | null
  plan_date: string
  created_at: string
}

const formatDate = (value: string) => {
  const date = new Date(value)
  const formatted = date.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

const formatTime = (value: string) => {
  return new Date(value).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const getRelativeLabel = (value: string) => {
  const diffMs = new Date(value).getTime() - Date.now()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays > 1) return `Faltan ${diffDays} días`
  if (diffDays === 1) return 'Falta 1 día'
  if (diffDays === 0) return 'Es hoy'
  if (diffDays === -1) return 'Fue ayer'
  return `Fue hace ${Math.abs(diffDays)} días`
}

export function Planes() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('19:00')
  const [description, setDescription] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const formRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchPlans = async () => {
      setIsLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('plans')
        .select('id, title, description, plan_date, created_at')
        .order('plan_date', { ascending: true })

      if (error) {
        setError('No se pudieron cargar los planes.')
      } else {
        setPlans((data as Plan[]) || [])
      }
      setIsLoading(false)
    }

    fetchPlans()
  }, [])

  const upcomingPlans = useMemo(() => {
    const now = Date.now()
    return plans.filter((plan) => new Date(plan.plan_date).getTime() >= now)
  }, [plans])

  const pastPlans = useMemo(() => {
    const now = Date.now()
    return plans.filter((plan) => new Date(plan.plan_date).getTime() < now).reverse()
  }, [plans])

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !date) return

    setIsSaving(true)
    setError(null)
    setMessage(null)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setError('Necesitas iniciar sesión para guardar planes.')
      setIsSaving(false)
      return
    }

    const planDate = new Date(`${date}T${time || '19:00'}`)
    if (Number.isNaN(planDate.getTime())) {
      setError('La fecha del plan no es válida.')
      setIsSaving(false)
      return
    }

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      plan_date: planDate.toISOString(),
      created_by: user.id,
    }

    const { data, error } = await supabase
      .from('plans')
      .insert(payload)
      .select('id, title, description, plan_date, created_at')
      .single()

    if (error) {
      setError('No se pudo guardar el plan.')
    } else if (data) {
      setPlans((prev) =>
        [...prev, data as Plan].sort(
          (a, b) => new Date(a.plan_date).getTime() - new Date(b.plan_date).getTime(),
        ),
      )
      setTitle('')
      setDate('')
      setTime('19:00')
      setDescription('')
      setMessage('Plan guardado con éxito.')
      setIsCreateModalOpen(false)
    }

    setIsSaving(false)
  }

  const handleDeletePlan = async (id: string) => {
    const currentPlans = plans
    setError(null)
    setMessage(null)
    setDeletingPlanId(id)
    setPlans((prev) => prev.filter((plan) => plan.id !== id))

    const { error } = await supabase.from('plans').delete().eq('id', id)

    if (error) {
      setPlans(currentPlans)
      setError('No se pudo borrar el plan.')
    } else {
      setMessage('Plan borrado.')
    }

    setDeletingPlanId(null)
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100 md:text-3xl">
          Nuestros Planes
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Cada cita, cada aventura y cada momento especial vive aqui.
        </p>
      </header>

      <section
        ref={formRef}
        className="rounded-2xl border-none bg-white/90 p-5 shadow-lg shadow-pink-500/10 backdrop-blur-md dark:bg-slate-900/80 md:p-6"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Crear un plan nuevo</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Organiza su próxima cita con una experiencia más bonita.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setError(null)
              setMessage(null)
              setIsCreateModalOpen(true)
            }}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-pink-400 to-rose-400 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-pink-500/30 transition-transform duration-200 hover:-translate-y-0.5 active:scale-95"
          >
            <PlusCircle className="h-4 w-4" />
            Crear plan
          </button>
        </div>
        {(error || message) && (
          <div className="mt-3 text-xs">
            {error && <span className="text-red-500">{error}</span>}
            {message && <span className="text-emerald-500">{message}</span>}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Proximos planes</h2>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <div className="h-6 w-6 animate-spin rounded-full border-3 border-pink-200 border-t-pink-500" />
          </div>
        ) : upcomingPlans.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-pink-200 bg-white/70 p-6 text-center dark:border-slate-700 dark:bg-slate-900/60">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Aun no tenemos planes. Planeamos algo bonito?
            </p>
            <button
              type="button"
              onClick={() => {
                setError(null)
                setMessage(null)
                setIsCreateModalOpen(true)
              }}
              className="mt-3 text-sm font-medium text-pink-500 hover:text-pink-600"
            >
              Crear nuestro primer plan
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {upcomingPlans.map((plan) => (
              <article
                key={plan.id}
                className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-400 to-pink-500 p-5 text-white shadow-xl shadow-pink-500/20 transition-all hover:-translate-y-1 hover:shadow-2xl"
              >
                <div className="relative z-10 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 text-pink-100">
                      <CalendarDays className="h-4 w-4" />
                      <span className="text-xs font-medium">
                        {formatDate(plan.plan_date)} · {formatTime(plan.plan_date)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeletePlan(plan.id)}
                      disabled={deletingPlanId === plan.id}
                      className="rounded-full p-1.5 text-pink-100/90 transition-colors hover:bg-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label="Borrar plan"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <h3 className="text-xl font-bold leading-tight">{plan.title}</h3>
                  {plan.description && <p className="text-sm text-pink-100">{plan.description}</p>}
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                    <Heart className="h-3.5 w-3.5" />
                    {getRelativeLabel(plan.plan_date)}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Planes pasados</h2>
        {pastPlans.length === 0 ? (
          <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
            Todos nuestros recuerdos estan por venir.
          </div>
        ) : (
          <div className="space-y-3">
            {pastPlans.map((plan) => (
              <article
                key={plan.id}
                className="rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/70"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatDate(plan.plan_date)} · {formatTime(plan.plan_date)}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleDeletePlan(plan.id)}
                    disabled={deletingPlanId === plan.id}
                    className="rounded-full p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                    aria-label="Borrar plan"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <h3 className="mt-1 text-base font-semibold text-slate-800 dark:text-slate-100">
                  {plan.title}
                </h3>
                {plan.description && (
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{plan.description}</p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {isCreateModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="absolute inset-0"
            onClick={() => {
              if (!isSaving) setIsCreateModalOpen(false)
            }}
          />
          <section className="relative z-50 w-full max-w-xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 rounded-2xl bg-white/95 p-6 shadow-2xl shadow-pink-500/20 ring-1 ring-slate-200/80 dark:bg-slate-900/95 dark:ring-slate-700/80">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                  Crear plan especial
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Elige fecha, hora y agrega una nota linda para que no se escape ningún detalle.
                </p>
              </div>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="Cerrar modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePlan} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                    Titulo del plan
                  </label>
                  <input
                    autoFocus
                    type="text"
                    placeholder="Aniversario en el restaurante especial"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:border-pink-400 dark:focus:ring-pink-400"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                    Fecha
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition-colors focus:border-pink-500 focus:ring-1 focus:ring-pink-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:border-pink-400 dark:focus:ring-pink-400"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                    Hora
                  </label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition-colors focus:border-pink-500 focus:ring-1 focus:ring-pink-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:border-pink-400 dark:focus:ring-pink-400"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Nota bonita (opcional)
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Reserva hecha, llevar flores, pedir mesa junto a la ventana..."
                  className="w-full resize-none rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:border-pink-400 dark:focus:ring-pink-400"
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="text-xs">
                  {error && <span className="text-red-500">{error}</span>}
                  {message && <span className="text-emerald-500">{message}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => setIsCreateModalOpen(false)}
                    className="rounded-lg px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || !title.trim() || !date}
                    className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-pink-400 to-rose-400 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-pink-500/30 transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSaving ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    ) : (
                      <PlusCircle className="h-4 w-4" />
                    )}
                    Guardar plan
                  </button>
                </div>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}
