import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckSquare, Heart, PlusCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

type NextPlan = {
  id: string
  title: string
  plan_date: string
}

type TodoProfile = {
  display_name: string | null
  avatar_url: string | null
}

type TodoPreview = {
  id: string
  title: string
  is_completed: boolean
  created_at: string
  profiles?: TodoProfile | TodoProfile[] | null
}

export function Dashboard() {
  const [todosPreview, setTodosPreview] = useState<TodoPreview[]>([])
  const [isLoadingTodos, setIsLoadingTodos] = useState(true)
  const [todoError, setTodoError] = useState<string | null>(null)
  const [nextPlan, setNextPlan] = useState<NextPlan | null>(null)
  const [isLoadingPlan, setIsLoadingPlan] = useState(true)
  const [planError, setPlanError] = useState<string | null>(null)

  useEffect(() => {
    const fetchTodosPreview = async () => {
      setIsLoadingTodos(true)
      setTodoError(null)

      const { data, error } = await supabase
        .from('todos')
        .select(
          `
          id,
          title,
          is_completed,
          created_at,
          profiles:created_by (
            display_name,
            avatar_url
          )
        `,
        )
        .order('created_at', { ascending: false })
        .limit(4)

      if (error) {
        setTodoError('No pudimos cargar las cosas que hacer.')
      } else {
        setTodosPreview((data as TodoPreview[]) || [])
      }

      setIsLoadingTodos(false)
    }

    const fetchNextPlan = async () => {
      setIsLoadingPlan(true)
      setPlanError(null)

      const { data, error } = await supabase
        .from('plans')
        .select('id, title, plan_date')
        .gte('plan_date', new Date().toISOString())
        .order('plan_date', { ascending: true })
        .limit(1)

      if (error) {
        setPlanError('No pudimos cargar el próximo plan.')
        setNextPlan(null)
      } else {
        setNextPlan((data?.[0] as NextPlan) || null)
      }

      setIsLoadingPlan(false)
    }

    fetchTodosPreview()
    fetchNextPlan()
  }, [])

  const formattedNextPlanDate = useMemo(() => {
    if (!nextPlan) return 'Sin fecha todavia'
    const raw = new Date(nextPlan.plan_date).toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
    return raw.charAt(0).toUpperCase() + raw.slice(1)
  }, [nextPlan])

  const countdownText = useMemo(() => {
    if (!nextPlan) return 'Crear plan'
    const diffMs = new Date(nextPlan.plan_date).getTime() - Date.now()
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
    if (days <= 0) return 'Es hoy'
    if (days === 1) return 'Falta 1 día'
    return `Faltan ${days} días`
  }, [nextPlan])

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Section */}
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-100 md:text-4xl">
          Nuestra Paginita
        </h1>
        <p className="text-lg text-slate-500 dark:text-slate-400">
          Un espacio solo para nosotros dos 💖
        </p>
      </header>

      {/* Grid of Sections */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Cosas que hacer Card */}
        <div className="rounded-2xl border-none bg-white/80 shadow-md backdrop-blur-sm transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-pink-500/10 dark:bg-slate-900/80">
          <div className="flex justify-between px-6 pt-6 pb-0">
            <h2 className="text-xl font-semibold text-slate-800 dark:text-white">
              Cosas que hacer
            </h2>
            <div className="rounded-full bg-pink-100 p-2 text-pink-500 dark:bg-pink-500/20">
              <CheckSquare className="h-5 w-5" />
            </div>
          </div>
          <div className="px-6 py-4">
            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
              Ideas y listas de cosas divertidas para hacer juntos este mes.
            </p>
            {isLoadingTodos ? (
              <div className="space-y-3">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="h-7 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
                ))}
              </div>
            ) : todoError ? (
              <p className="text-sm text-red-500">{todoError}</p>
            ) : todosPreview.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Aún no hay ideas guardadas. Crea la primera para ustedes.
              </p>
            ) : (
              <div className="space-y-3">
                {todosPreview.map((todo) => {
                  const rawProfile = todo.profiles
                  const profile = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile
                  const name = profile?.display_name || 'Anónimo'

                  return (
                    <div
                      key={todo.id}
                      className="flex items-start gap-3 rounded-xl border border-slate-100 bg-white/80 px-3 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-900/70"
                    >
                      <div
                        className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-md border text-[10px] ${
                          todo.is_completed
                            ? 'border-emerald-400 bg-emerald-400 text-white'
                            : 'border-pink-200 bg-pink-50 dark:border-slate-700 dark:bg-slate-800'
                        }`}
                      >
                        {todo.is_completed ? '✓' : ''}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <span
                          className={`truncate text-sm font-medium ${
                            todo.is_completed
                              ? 'text-slate-400 line-through dark:text-slate-500'
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {todo.title}
                        </span>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                          <div className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-[9px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                            {profile?.avatar_url ? (
                              <img src={profile.avatar_url} alt={name} className="h-full w-full object-cover" />
                            ) : (
                              <span>{name.charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                          <span>Por {name}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <Link
              to="/dashboard/todo"
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-pink-500 transition-colors hover:text-pink-600"
            >
              <PlusCircle className="h-4 w-4" />
              Ver y agregar ideas
            </Link>
          </div>
        </div>

        {/* Planes Card */}
        <div className="rounded-2xl border-none bg-gradient-to-br from-rose-400 to-pink-500 shadow-xl shadow-pink-500/20 transition-all hover:-translate-y-1 relative overflow-hidden">
          <div className="px-6 pt-6 pb-0 relative z-10">
            <h2 className="text-xl font-semibold text-white">Próximo Plan</h2>
          </div>
          <div className="flex flex-col justify-between px-6 py-4 text-white relative z-10">
            {isLoadingPlan ? (
              <div className="py-6">
                <div className="h-5 w-40 animate-pulse rounded bg-white/30" />
                <div className="mt-3 h-8 w-64 animate-pulse rounded bg-white/40" />
              </div>
            ) : (
              <>
                <div>
                  <p className="text-sm font-medium text-pink-100 mb-1">{formattedNextPlanDate}</p>
                  <p className="text-2xl font-bold leading-tight">
                    {planError
                      ? 'No pudimos cargar el próximo plan'
                      : nextPlan?.title || 'Planeemos nuestro próximo momento especial'}
                  </p>
                </div>
                <div className="mt-8 flex items-center gap-2 rounded-xl bg-white/20 px-4 py-2 backdrop-blur-md self-start">
                  <Heart fill="currentColor" className="h-4 w-4 text-rose-200" />
                  <span className="text-sm font-medium">{countdownText}</span>
                </div>
                <Link
                  to="/dashboard/planes"
                  className="mt-3 inline-flex self-start text-sm font-semibold text-white/95 underline decoration-white/50 underline-offset-4 hover:text-white"
                >
                  Ver planes
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Cartitas Placeholder */}
        <div className="rounded-2xl border border-dashed border-rose-200 bg-transparent shadow-none dark:border-slate-800">
          <div className="flex flex-col items-center justify-center gap-4 py-12 text-center text-slate-500 dark:text-slate-400">
            <div className="rounded-full bg-rose-100 p-4 text-rose-400 dark:bg-slate-800">
              <Heart className="h-8 w-8" />
            </div>
            <div>
              <p className="font-semibold text-slate-700 dark:text-slate-300">
                Cartitas
              </p>
              <p className="text-sm">Un lugar para dejarnos mensajes lindos.</p>
            </div>
            <button className="mt-2 rounded-xl bg-rose-100 px-4 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-200 dark:bg-rose-500/20 dark:text-rose-400 dark:hover:bg-rose-500/30">
              Comenzar a escribir
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
