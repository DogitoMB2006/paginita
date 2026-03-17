import { useEffect, useState } from 'react'
import { CheckSquare, Trash2, PlusCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

type TodoProfile = {
  display_name: string | null
  avatar_url: string | null
}

type Todo = {
  id: string
  title: string
  is_completed: boolean
  created_at: string
  profiles?: TodoProfile | TodoProfile[] | null
}

export function CosasQueHacer() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [newTitle, setNewTitle] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  useEffect(() => {
    const fetchTodos = async () => {
      setIsLoading(true)
      setError(null)
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

      if (error) {
        setError('No se pudieron cargar las cosas que hacer.')
      } else {
        setTodos(data as Todo[])
      }
      setIsLoading(false)
    }

    fetchTodos()

    const channel = supabase
      .channel('realtime-todos-page')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'todos' },
        async (payload) => {
          const newRow = payload.new as { id: string }
          const { data } = await supabase
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
            .eq('id', newRow.id)
            .single()
          if (data) {
            setTodos((prev) => {
              if (prev.find((t) => t.id === data.id)) return prev
              return [data as Todo, ...prev]
            })
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'todos' },
        (payload) => {
          const updated = payload.new as Todo
          setTodos((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)))
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'todos' },
        (payload) => {
          const removed = payload.old as { id: string }
          setTodos((prev) => prev.filter((t) => t.id !== removed.id))
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const handleAddTodo = async () => {
    if (!newTitle.trim()) return
    setIsSaving(true)
    setError(null)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setError('Necesitas estar autenticado para agregar cosas.')
      setIsSaving(false)
      return
    }

    const { data, error } = await supabase
      .from('todos')
      .insert({
        title: newTitle.trim(),
        created_by: user.id,
      })
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
      `
      )
      .single()

    try {
      if (error) {
        setError('No se pudo agregar la nueva cosa.')
      } else if (data) {
        setTodos((prev) => [data as Todo, ...prev])
        setNewTitle('')
        setIsAddModalOpen(false)
      }
    } finally {
      setIsSaving(false)
    }
  }

  const toggleTodo = async (todo: Todo) => {
    const nextCompleted = !todo.is_completed
    setTodos((prev) =>
      prev.map((t) => (t.id === todo.id ? { ...t, is_completed: nextCompleted } : t)),
    )

    const { error } = await supabase
      .from('todos')
      .update({ is_completed: nextCompleted })
      .eq('id', todo.id)

    if (error) {
      setError('No se pudo actualizar el estado.')
      setTodos((prev) =>
        prev.map((t) => (t.id === todo.id ? { ...t, is_completed: todo.is_completed } : t)),
      )
    }
  }

  const deleteTodo = async (id: string) => {
    const current = todos
    setTodos((prev) => prev.filter((t) => t.id !== id))

    const { error } = await supabase.from('todos').delete().eq('id', id)
    if (error) {
      setError('No se pudo borrar la cosa.')
      setTodos(current)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100 md:text-3xl">
          Cosas que hacer
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Una lista compartida de cosas bonitas que queremos hacer juntos.
        </p>
      </header>

      <div className="rounded-2xl border-none bg-white/90 shadow-lg shadow-pink-500/5 backdrop-blur-md dark:bg-slate-900/80">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 pb-4 pt-4 dark:border-slate-800 md:flex-row md:items-center md:justify-between md:px-6">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-pink-100 p-2 text-pink-500 dark:bg-pink-500/20">
              <CheckSquare className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                Nuestra lista
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Marca lo que ya hicimos y agrega nuevas ideas cuando quieras.
              </p>
            </div>
          </div>

          <div className="flex w-full justify-end md:w-auto">
            <button
              type="button"
              onClick={() => {
                setNewTitle('')
                setIsAddModalOpen(true)
                setError(null)
              }}
              className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-pink-400 to-rose-400 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-pink-500/30 transition-transform active:scale-95"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Agregar</span>
            </button>
          </div>
        </div>

        <div className="px-4 py-4 md:px-6 md:py-5">
          {error && (
            <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-500 dark:bg-red-500/10">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-6">
              <div className="h-6 w-6 animate-spin rounded-full border-3 border-pink-200 border-t-pink-500" />
            </div>
          ) : todos.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-slate-500 dark:text-slate-400">
              <span className="text-sm">
                Aún no tenemos nada en la lista. ¿Agregamos el primer plan?
              </span>
            </div>
          ) : (
            <ul className="space-y-3">
              {todos.map((todo) => {
                const rawProfile = todo.profiles
                const profile = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile
                const name = profile?.display_name || 'Anónimo'

                return (
                  <li
                    key={todo.id}
                    className="group flex items-start gap-3 rounded-xl border border-slate-100 bg-white/80 px-3 py-3 text-sm shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:shadow-pink-500/5 dark:border-slate-800 dark:bg-slate-900/80"
                  >
                    <button
                      onClick={() => toggleTodo(todo)}
                      className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-md border text-[10px] transition-colors ${
                        todo.is_completed
                          ? 'border-emerald-400 bg-emerald-400 text-white'
                          : 'border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900'
                      }`}
                    >
                      {todo.is_completed && '✓'}
                    </button>

                    <div className="flex flex-1 flex-col gap-1">
                      <span
                        className={`font-medium text-slate-800 dark:text-slate-100 ${
                          todo.is_completed ? 'line-through text-slate-400 dark:text-slate-500' : ''
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
                        <span>Creado por {name}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => deleteTodo(todo.id)}
                      className="mt-0.5 rounded-full p-1 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {isAddModalOpen && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
            <div
              className="absolute inset-0"
              onClick={() => {
                if (!isSaving) setIsAddModalOpen(false)
              }}
            />
            <div className="relative z-50 w-full max-w-md rounded-2xl bg-white/95 p-6 shadow-2xl shadow-pink-500/20 ring-1 ring-slate-200/80 dark:bg-slate-900/95 dark:ring-slate-700/80">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                  Agregar nueva cosa linda
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Escribe un plan bonito que quieras hacer juntos.
                </p>
              </div>
              <div className="space-y-4">
                <input
                  autoFocus
                  type="text"
                  placeholder="Ir a ver el atardecer, cocinar algo rico..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddTodo()
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:border-pink-400 dark:focus:ring-pink-400"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => setIsAddModalOpen(false)}
                    className="rounded-lg px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleAddTodo}
                    disabled={isSaving || !newTitle.trim()}
                    className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-pink-400 to-rose-400 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-pink-500/30 transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSaving ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    ) : (
                      <PlusCircle className="h-4 w-4" />
                    )}
                    <span>Agregar</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

