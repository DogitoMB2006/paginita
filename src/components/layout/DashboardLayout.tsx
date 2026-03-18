import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { requestNotificationPermission, showBrowserNotification } from '../../lib/notifications'
import { getElectronAPI, isElectronRuntime, type UpdaterStatusPayload } from '../../lib/runtime'
import { RightSidebar } from './RightSidebar'

type Toast = {
  id: string
  message: string
  avatar_url: string | null
}

type IncomingLetterModal = {
  letterId: string
  senderName: string
  senderAvatar: string | null
}

type UpdateModalState = {
  status: 'checking' | 'available' | 'downloading' | 'downloaded' | 'up-to-date' | 'error'
  version?: string
  message?: string
  percent?: number
  currentVersion?: string
  latestVersion?: string
}

const normalizeVersion = (version?: string) => String(version ?? '').replace(/^v/i, '')

const isNewerVersion = (latestVersion?: string, currentVersion?: string) => {
  if (!latestVersion || !currentVersion) return false

  const latestParts = normalizeVersion(latestVersion)
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0)
  const currentParts = normalizeVersion(currentVersion)
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0)
  const length = Math.max(latestParts.length, currentParts.length)

  for (let index = 0; index < length; index += 1) {
    const latestValue = latestParts[index] ?? 0
    const currentValue = currentParts[index] ?? 0

    if (latestValue > currentValue) return true
    if (latestValue < currentValue) return false
  }

  return false
}

export function DashboardLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [userId, setUserId] = useState<string | null>(null)
  const [todoBadge, setTodoBadge] = useState(0)
  const [planesBadge, setPlanesBadge] = useState(0)
  const [paraVerBadge, setParaVerBadge] = useState(0)
  const [lettersBadge, setLettersBadge] = useState(0)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [incomingLetterModal, setIncomingLetterModal] = useState<IncomingLetterModal | null>(null)
  const [updateModal, setUpdateModal] = useState<UpdateModalState | null>(null)
  const currentPathRef = useRef(location.pathname)

  useEffect(() => {
    currentPathRef.current = location.pathname
  }, [location.pathname])

  useEffect(() => {
    let isMounted = true
    let channel: ReturnType<typeof supabase.channel> | null = null

    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      const currentUserId = user.id
      if (!isMounted) return
      setUserId(currentUserId)

      const { data } = await supabase
        .from('profiles')
        .select('last_seen_todos_at, last_seen_plans_at, last_seen_para_ver_at, last_seen_letters_at')
        .eq('id', user.id)
        .single()

      const lastTodos = data?.last_seen_todos_at ?? null
      const lastPlans = data?.last_seen_plans_at ?? null
      const lastParaVer = data?.last_seen_para_ver_at ?? null
      const lastLetters = data?.last_seen_letters_at ?? null

      if (lastTodos) {
        const { count: todosCount } = await supabase
          .from('todos')
          .select('id', { count: 'exact', head: true })
          .gt('created_at', lastTodos)
          .neq('created_by', currentUserId)
        if (isMounted) setTodoBadge(todosCount ?? 0)
      } else {
        const { count: todosCount } = await supabase
          .from('todos')
          .select('id', { count: 'exact', head: true })
          .neq('created_by', currentUserId)
        if (isMounted) setTodoBadge(todosCount ?? 0)
      }

      if (lastPlans) {
        const { count: plansCount } = await supabase
          .from('plans')
          .select('id', { count: 'exact', head: true })
          .gt('created_at', lastPlans)
          .neq('created_by', currentUserId)
        if (isMounted) setPlanesBadge(plansCount ?? 0)
      } else {
        const { count: plansCount } = await supabase
          .from('plans')
          .select('id', { count: 'exact', head: true })
          .neq('created_by', currentUserId)
        if (isMounted) setPlanesBadge(plansCount ?? 0)
      }

      if (lastParaVer) {
        const { count: paraVerCount } = await supabase
          .from('para_ver_items')
          .select('id', { count: 'exact', head: true })
          .gt('created_at', lastParaVer)
          .neq('created_by', currentUserId)
        if (isMounted) setParaVerBadge(paraVerCount ?? 0)
      } else {
        const { count: paraVerCount } = await supabase
          .from('para_ver_items')
          .select('id', { count: 'exact', head: true })
          .neq('created_by', currentUserId)
        if (isMounted) setParaVerBadge(paraVerCount ?? 0)
      }

      let unreadLettersCount = 0

      if (lastLetters) {
        const { count: lettersCount } = await supabase
          .from('letters')
          .select('id', { count: 'exact', head: true })
          .eq('recipient_id', currentUserId)
          .gt('created_at', lastLetters)
        unreadLettersCount = lettersCount ?? 0
        if (isMounted) setLettersBadge(unreadLettersCount)
      } else {
        const { count: lettersCount } = await supabase
          .from('letters')
          .select('id', { count: 'exact', head: true })
          .eq('recipient_id', currentUserId)
        unreadLettersCount = lettersCount ?? 0
        if (isMounted) setLettersBadge(unreadLettersCount)
      }

      // If there are unread letters and user is entering the app (and not on cartitas),
      // show the incoming letter modal for the most recent unread letter.
      if (
        unreadLettersCount > 0 &&
        isMounted &&
        !currentPathRef.current.startsWith('/dashboard/cartitas')
      ) {
        const { data: latestLetter } = await supabase
          .from('letters')
          .select(
            `
            id,
            created_by,
            sender:created_by (
              display_name,
              avatar_url
            )
          `,
          )
          .eq('recipient_id', currentUserId)
          .eq('is_read', false)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (latestLetter) {
          const sender = (latestLetter as any).sender?.[0] ?? (latestLetter as any).sender ?? null
          const senderName = sender?.display_name || 'Tu amorcito'
          const senderAvatar = sender?.avatar_url ?? null
          setIncomingLetterModal({
            letterId: (latestLetter as any).id,
            senderName,
            senderAvatar,
          })
        }
      }

      requestNotificationPermission()

      channel = supabase
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
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'para_ver_items' },
          async (payload: any) => {
            const newRow = payload.new as { id: string; title: string; created_by: string | null }
            if (!newRow.created_by || newRow.created_by === currentUserId) return

            const { data: profile } = await supabase
              .from('profiles')
              .select('display_name, avatar_url')
              .eq('id', newRow.created_by)
              .single()

            const displayName = profile?.display_name || 'Tu amorcito'
            if (!currentPathRef.current.startsWith('/dashboard/para-ver')) {
              showBrowserNotification(
                `${displayName} agregó algo nuevo para ver: ${newRow.title}`,
                profile?.avatar_url ?? null,
              )
              setToasts((prev) => [
                ...prev,
                {
                  id: `para-ver-${newRow.id}`,
                  message: `${displayName} agregó "${newRow.title}" para ver`,
                  avatar_url: profile?.avatar_url ?? null,
                },
              ])
              setParaVerBadge((prev) => prev + 1)
            }
          },
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'letters' },
          async (payload: any) => {
            const newRow = payload.new as { id: string; recipient_id: string; created_by: string }
            if (newRow.recipient_id !== currentUserId) return

            const { data: profile } = await supabase
              .from('profiles')
              .select('display_name, avatar_url')
              .eq('id', newRow.created_by)
              .single()

            const displayName = profile?.display_name || 'Tu amorcito'
            showBrowserNotification(`${displayName} te ha enviado una carta`, profile?.avatar_url ?? null)
            setToasts((prev) => [
              ...prev,
              {
                id: `letter-${newRow.id}`,
                message: `${displayName} te ha enviado una carta`,
                avatar_url: profile?.avatar_url ?? null,
              },
            ])

            if (!currentPathRef.current.startsWith('/dashboard/cartitas')) {
              setLettersBadge((prev) => prev + 1)
              setIncomingLetterModal({
                letterId: newRow.id,
                senderName: displayName,
                senderAvatar: profile?.avatar_url ?? null,
              })
            }
          },
        )
        .subscribe()
    }

    void init()

    return () => {
      isMounted = false
      if (channel) supabase.removeChannel(channel)
    }
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

    const markParaVerSeen = async () => {
      const now = new Date().toISOString()
      setParaVerBadge(0)
      await supabase.from('profiles').update({ last_seen_para_ver_at: now }).eq('id', userId)
    }

    const markLettersSeen = async () => {
      const now = new Date().toISOString()
      setLettersBadge(0)
      await supabase.from('profiles').update({ last_seen_letters_at: now }).eq('id', userId)
    }

    if (location.pathname.startsWith('/dashboard/todo')) {
      void markTodosSeen()
    } else if (location.pathname.startsWith('/dashboard/planes')) {
      void markPlansSeen()
    } else if (location.pathname.startsWith('/dashboard/para-ver')) {
      void markParaVerSeen()
    } else if (location.pathname.startsWith('/dashboard/cartitas')) {
      void markLettersSeen()
    }
  }, [location.pathname, userId])

  useEffect(() => {
    if (toasts.length === 0) return
    const timer = setTimeout(() => {
      setToasts((prev) => prev.slice(1))
    }, 5000)
    return () => clearTimeout(timer)
  }, [toasts])

  useEffect(() => {
    if (!isElectronRuntime()) return

    const electronAPI = getElectronAPI()
    if (!electronAPI) return

    const unsubscribe = electronAPI.onUpdaterStatus((payload: UpdaterStatusPayload) => {
      if (payload.type === 'checking-for-update') {
        setUpdateModal({
          status: 'checking',
          version: payload.currentVersion ?? payload.version,
          currentVersion: payload.currentVersion,
          latestVersion: payload.latestVersion,
          message: 'Buscando actualizaciones...',
        })
      } else if (payload.type === 'update-available') {
        setUpdateModal({
          status: 'available',
          version: payload.latestVersion ?? payload.version,
          currentVersion: payload.currentVersion,
          latestVersion: payload.latestVersion ?? payload.version,
          message: payload.message ?? 'Se ha recibido una nueva actualización. ¿Quieres descargarla?',
        })
      } else if (payload.type === 'update-not-available') {
        setUpdateModal({
          status: 'up-to-date',
          version: payload.currentVersion ?? payload.version,
          currentVersion: payload.currentVersion,
          latestVersion: payload.latestVersion,
          message: 'Ya estás en la última versión disponible.',
        })
      } else if (payload.type === 'download-progress') {
        setUpdateModal((current) => ({
          status: 'downloading',
          version: current?.version ?? payload.latestVersion ?? payload.currentVersion,
          currentVersion: payload.currentVersion ?? current?.currentVersion,
          latestVersion: payload.latestVersion ?? current?.latestVersion,
          message: 'Descargando actualización...',
          percent: payload.percent ?? current?.percent ?? 0,
        }))
      } else if (payload.type === 'update-downloaded') {
        setUpdateModal((current) => ({
          status: 'downloaded',
          version: current?.version ?? payload.latestVersion ?? payload.currentVersion,
          currentVersion: payload.currentVersion ?? current?.currentVersion,
          latestVersion: payload.latestVersion ?? current?.latestVersion,
          message: payload.message ?? 'Se actualizará la app',
        }))
      } else if (payload.type === 'error') {
        setUpdateModal((current) => ({
          status: 'error',
          version: current?.version ?? payload.latestVersion ?? payload.currentVersion ?? payload.version,
          currentVersion: payload.currentVersion ?? current?.currentVersion,
          latestVersion: payload.latestVersion ?? current?.latestVersion,
          message: payload.message ?? 'No se pudo completar la actualización',
        }))
      }
    })

    void electronAPI.checkForUpdates()

    return unsubscribe
  }, [])

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
          {incomingLetterModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 px-4 backdrop-blur-md">
              <div className="relative z-10 w-full max-w-md animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 rounded-2xl bg-white/95 p-6 text-center shadow-2xl shadow-pink-500/20 ring-1 ring-slate-200/80 dark:bg-slate-900/95 dark:ring-slate-700/80">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-pink-100 text-pink-600 dark:bg-pink-500/20 dark:text-pink-300">
                  {incomingLetterModal.senderAvatar ? (
                    <img
                      src={incomingLetterModal.senderAvatar}
                      alt={incomingLetterModal.senderName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-xl">💌</span>
                  )}
                </div>
                <p className="text-base font-semibold text-slate-800 dark:text-slate-100">
                  Has recibido una carta de {incomingLetterModal.senderName}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Te está esperando una cartita especial.
                </p>
                <div className="mt-4 flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIncomingLetterModal(null)}
                    className="rounded-lg px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Después
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const letterId = incomingLetterModal.letterId
                      setIncomingLetterModal(null)
                      navigate(`/dashboard/cartitas?open=${letterId}`)
                    }}
                    className="rounded-lg bg-gradient-to-r from-pink-400 to-rose-400 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-pink-500/30"
                  >
                    Abrir
                  </button>
                </div>
              </div>
            </div>
          )}
          {updateModal && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/55 px-4 backdrop-blur-md">
              <div className="relative z-10 w-full max-w-md rounded-2xl bg-white/95 p-6 text-center shadow-2xl shadow-pink-500/20 ring-1 ring-slate-200/80 dark:bg-slate-900/95 dark:ring-slate-700/80">
                <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                  {updateModal.message ?? 'Se ha recibido una nueva actualización. ¿Quieres descargarla?'}
                </p>
            <div className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
              {updateModal.currentVersion && (
                <p>Versión actual instalada: {updateModal.currentVersion}</p>
              )}
              {isNewerVersion(updateModal.latestVersion, updateModal.currentVersion) && (
                <p>Versión disponible en GitHub: {updateModal.latestVersion}</p>
              )}
            </div>
                {updateModal.status === 'downloading' && (
                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                    Descargando: {updateModal.percent ?? 0}%
                  </p>
                )}
                {updateModal.status === 'downloaded' && (
                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                    Se actualizará la app al reiniciar.
                  </p>
                )}
                <div className="mt-5 flex justify-center gap-2">
              {updateModal.status === 'checking' && (
                <button
                  type="button"
                  disabled
                  className="cursor-not-allowed rounded-lg bg-slate-200 px-4 py-2 text-xs font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-300"
                >
                  Buscando actualizaciones…
                </button>
              )}
              {updateModal.status === 'available' && (
                    <>
                      <button
                        type="button"
                        onClick={() => setUpdateModal(null)}
                        className="rounded-lg px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        No
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setUpdateModal((current) =>
                            current
                              ? { ...current, status: 'downloading', message: 'Descargando actualización...' }
                              : current,
                          )
                          void getElectronAPI()?.downloadUpdate()
                        }}
                        className="rounded-lg bg-gradient-to-r from-pink-400 to-rose-400 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-pink-500/30"
                      >
                        Sí
                      </button>
                    </>
                  )}
                  {updateModal.status === 'downloading' && (
                    <button
                      type="button"
                      disabled
                      className="cursor-not-allowed rounded-lg bg-slate-200 px-4 py-2 text-xs font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-300"
                    >
                      Descargando...
                    </button>
                  )}
              {updateModal.status === 'downloaded' && (
                    <>
                      <button
                        type="button"
                        onClick={() => setUpdateModal(null)}
                        className="rounded-lg px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        Más tarde
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          getElectronAPI()?.quitAndInstall()
                        }}
                        className="rounded-lg bg-gradient-to-r from-pink-400 to-rose-400 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-pink-500/30"
                      >
                        Reiniciar y actualizar
                      </button>
                    </>
                  )}
              {updateModal.status === 'up-to-date' && (
                <button
                  type="button"
                  onClick={() => setUpdateModal(null)}
                  className="rounded-lg bg-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
                >
                  Cerrar
                </button>
              )}
              {updateModal.status === 'error' && (
                    <button
                      type="button"
                      onClick={() => setUpdateModal(null)}
                      className="rounded-lg bg-gradient-to-r from-pink-400 to-rose-400 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-pink-500/30"
                    >
                      Cerrar
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
          <Outlet />
        </div>
      </main>

      {/* Navigation */}
      <div className="group fixed inset-y-0 right-0 z-50">
        <RightSidebar
          todoBadge={todoBadge}
          planesBadge={planesBadge}
          paraVerBadge={paraVerBadge}
          lettersBadge={lettersBadge}
        />
      </div>
    </div>
  )
}
