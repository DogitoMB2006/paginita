import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { requestNotificationPermission, showBrowserNotification } from '../../lib/notifications'
import { RightSidebar } from './RightSidebar'

type ProfileNotificationState = {
  last_seen_todos_at: string | null
  last_seen_plans_at: string | null
}

type Toast = {
  id: string
  message: string
  avatar_url: string | null
}

export function DashboardLayout() {
  const location = useLocation()
  const [userId, setUserId] = useState<string | null>(null)
  const [notifState, setNotifState] = useState<ProfileNotificationState | null>(null)
  const [todoBadge, setTodoBadge] = useState(0)
  const [planesBadge, setPlanesBadge] = useState(0)
  const [toasts, setToasts] = useState<Toast[]>([])
  const currentPathRef = useRef(location.pathname)

  useEffect(() => {
    currentPathRef.current = location.pathname
  }, [location.pathname])

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      const currentUserId = user.id
      setUserId(currentUserId)

      const { data } = await supabase
        .from('profiles')
        .select('last_seen_todos_at, last_seen_plans_at')
        .eq('id', user.id)
        .single()

      const profileNotif: ProfileNotificationState = {
        last_seen_todos_at: data?.last_seen_todos_at ?? null,
        last_seen_plans_at: data?.last_seen_plans_at ?? null,
      }
      setNotifState(profileNotif)

      const lastTodos = profileNotif.last_seen_todos_at
      const lastPlans = profileNotif.last_seen_plans_at

      if (lastTodos) {
        const { count: todosCount } = await supabase
          .from('todos')
          .select('id', { count: 'exact', head: true })
          .gt('created_at', lastTodos)
          .neq('created_by', currentUserId)
        setTodoBadge(todosCount ?? 0)
      } else {
        const { count: todosCount } = await supabase
          .from('todos')
          .select('id', { count: 'exact', head: true })
          .neq('created_by', currentUserId)
        setTodoBadge(todosCount ?? 0)
      }

      if (lastPlans) {
        const { count: plansCount } = await supabase
          .from('plans')
          .select('id', { count: 'exact', head: true })
          .gt('created_at', lastPlans)
          .neq('created_by', currentUserId)
        setPlanesBadge(plansCount ?? 0)
      } else {
        const { count: plansCount } = await supabase
          .from('plans')
          .select('id', { count: 'exact', head: true })
          .neq('created_by', currentUserId)
        setPlanesBadge(plansCount ?? 0)
      }

      requestNotificationPermission()

      const channel = supabase
        .channel('realtime-notifications')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'todos' },
          async (payload: any) => {
            const newRow = payload.new

            const { data: profile } = await supabase
              .from('profiles')
              .select('display_name, avatar_url')
              .eq('id', newRow.created_by)
              .single()

            const displayName = profile?.display_name || 'Tu amorcito'
            if (!currentPathRef.current.startsWith('/dashboard/todo')) {
              showBrowserNotification(
                `${displayName} ha creado una nueva cosa para hacer`,
                profile?.avatar_url ?? null,
              )
              setToasts((prev) => [
                ...prev,
                {
                  id: `todo-${newRow.id}`,
                  message: `${displayName} ha creado una nueva cosa para hacer`,
                  avatar_url: profile?.avatar_url ?? null,
                },
              ])
              setTodoBadge((prev) => prev + 1)
            }
          },
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'plans' },
          async (payload: any) => {
            const newRow = payload.new

            const { data: profile } = await supabase
              .from('profiles')
              .select('display_name, avatar_url')
              .eq('id', newRow.created_by)
              .single()

            const displayName = profile?.display_name || 'Tu amorcito'
            if (!currentPathRef.current.startsWith('/dashboard/planes')) {
              showBrowserNotification(
                `${displayName} ha creado un nuevo plan`,
                profile?.avatar_url ?? null,
              )
              setToasts((prev) => [
                ...prev,
                {
                  id: `plan-${newRow.id}`,
                  message: `${displayName} ha creado un nuevo plan`,
                  avatar_url: profile?.avatar_url ?? null,
                },
              ])
              setPlanesBadge((prev) => prev + 1)
            }
          },
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }

    void init()
  }, [])

  useEffect(() => {
    if (!userId) return

    const markTodosSeen = async () => {
      const now = new Date().toISOString()
      setTodoBadge(0)
      await supabase.from('profiles').update({ last_seen_todos_at: now }).eq('id', userId)
    }

    const markPlansSeen = async () => {
      const now = new Date().toISOString()
      setPlanesBadge(0)
      await supabase.from('profiles').update({ last_seen_plans_at: now }).eq('id', userId)
    }

    if (location.pathname.startsWith('/dashboard/todo')) {
      void markTodosSeen()
    } else if (location.pathname.startsWith('/dashboard/planes')) {
      void markPlansSeen()
    }
  }, [location.pathname, userId])

  useEffect(() => {
    if (toasts.length === 0) return
    const timer = setTimeout(() => {
      setToasts((prev) => prev.slice(1))
    }, 5000)
    return () => clearTimeout(timer)
  }, [toasts])

  return (
    <div className="flex min-h-screen bg-rose-50/30 dark:bg-slate-950">
      {/* Main Content Area */}
      <main className="flex-1 pb-16 md:pb-0 md:pr-20">
        <div className="mx-auto max-w-5xl px-4 py-8 md:px-8 md:py-12">
          {toasts.length > 0 && (
            <div className="pointer-events-none fixed inset-x-0 top-4 z-40 flex justify-center px-4">
              <div className="flex max-w-md flex-col gap-2">
                {toasts.map((toast) => (
                  <div
                    key={toast.id}
                    className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-white/90 px-4 py-3 text-sm shadow-lg shadow-pink-500/20 backdrop-blur-md ring-1 ring-slate-200 dark:bg-slate-900/90 dark:ring-slate-700"
                  >
                    <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-pink-100 text-xs font-semibold text-pink-600 dark:bg-pink-500/20 dark:text-pink-300">
                      {toast.avatar_url ? (
                        <img
                          src={toast.avatar_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span>💌</span>
                      )}
                    </div>
                    <span className="text-slate-800 dark:text-slate-100">{toast.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <Outlet />
        </div>
      </main>

      {/* Navigation */}
      <div className="group fixed inset-y-0 right-0 z-50">
        <RightSidebar todoBadge={todoBadge} planesBadge={planesBadge} />
      </div>
    </div>
  )
}
