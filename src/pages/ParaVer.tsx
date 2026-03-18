import { useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  EyeOff,
  ImagePlus,
  Pencil,
  PlayCircle,
  PlusCircle,
  Trash2,
  Tv,
  X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

type ParaVerStatus = 'no_visto' | 'viendo' | 'visto'

type ParaVerCreator = {
  display_name: string | null
  avatar_url: string | null
}

type ParaVerItem = {
  id: string
  title: string
  image_url: string | null
  status: ParaVerStatus
  notes: string | null
  created_at: string
  created_by: string | null
  creator?: ParaVerCreator | ParaVerCreator[] | null
}

const getCreator = (item: ParaVerItem): ParaVerCreator | null => {
  const raw = item.creator
  if (!raw) return null
  const one = Array.isArray(raw) ? raw[0] : raw
  return one ?? null
}

const statusMeta: Record<
  ParaVerStatus,
  {
    label: string
    icon: typeof EyeOff
    pillClass: string
  }
> = {
  no_visto: {
    label: 'No se ha visto',
    icon: EyeOff,
    pillClass:
      'bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
  },
  viendo: {
    label: 'Actualmente viendo',
    icon: PlayCircle,
    pillClass:
      'bg-amber-100 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:ring-amber-600/30',
  },
  visto: {
    label: 'Ya se ha visto',
    icon: CheckCircle2,
    pillClass:
      'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:ring-emerald-600/30',
  },
}

type FormState = {
  title: string
  status: ParaVerStatus
  notes: string
  imageFile: File | null
  imagePreview: string | null
}

const emptyForm: FormState = {
  title: '',
  status: 'no_visto',
  notes: '',
  imageFile: null,
  imagePreview: null,
}

const statusOrder: ParaVerStatus[] = ['no_visto', 'viendo', 'visto']

const getCardFallback = (title: string) => {
  const initials = title
    .split(' ')
    .map((word) => word.trim()[0] ?? '')
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return initials || 'PV'
}

export function ParaVer() {
  const [items, setItems] = useState<ParaVerItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ParaVerItem | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const sortedItems = useMemo(
    () =>
      [...items].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [items],
  )

  useEffect(() => {
    const fetchItems = async () => {
      setIsLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('para_ver_items')
        .select(
          `
          id,
          title,
          image_url,
          status,
          notes,
          created_at,
          created_by,
          creator:created_by(display_name, avatar_url)
        `,
        )
        .order('created_at', { ascending: false })

      if (error) {
        setError('No se pudo cargar la lista de Para ver.')
      } else {
        setItems((data as ParaVerItem[]) || [])
      }

      setIsLoading(false)
    }

    void fetchItems()

    const channel = supabase
      .channel('realtime-para-ver-page')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'para_ver_items' },
        async (payload) => {
          const inserted = payload.new as { id: string }
          const { data } = await supabase
            .from('para_ver_items')
            .select(
              `
              id, title, image_url, status, notes, created_at, created_by,
              creator:created_by(display_name, avatar_url)
            `,
            )
            .eq('id', inserted.id)
            .single()
          if (data) {
            setItems((prev) => {
              if (prev.some((item) => item.id === (data as ParaVerItem).id)) return prev
              return [data as ParaVerItem, ...prev]
            })
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'para_ver_items' },
        (payload) => {
          const updated = payload.new as ParaVerItem
          setItems((prev) =>
            prev.map((item) =>
              item.id === updated.id
                ? { ...item, ...updated, creator: (updated as ParaVerItem).creator ?? item.creator }
                : item,
            ),
          )
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'para_ver_items' },
        (payload) => {
          const removed = payload.old as { id: string }
          setItems((prev) => prev.filter((item) => item.id !== removed.id))
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const openCreateModal = () => {
    setEditingItem(null)
    setForm(emptyForm)
    setError(null)
    setMessage(null)
    setIsModalOpen(true)
  }

  const openEditModal = (item: ParaVerItem) => {
    setEditingItem(item)
    setForm({
      title: item.title,
      status: item.status,
      notes: item.notes ?? '',
      imageFile: null,
      imagePreview: item.image_url,
    })
    setError(null)
    setMessage(null)
    setIsModalOpen(true)
  }

  const closeModal = () => {
    if (isSaving) return
    setIsModalOpen(false)
  }

  const handleFileChange = (file: File | null) => {
    if (!file) {
      setForm((prev) => ({ ...prev, imageFile: null }))
      return
    }

    const previewUrl = URL.createObjectURL(file)
    setForm((prev) => ({
      ...prev,
      imageFile: file,
      imagePreview: previewUrl,
    }))
  }

  const uploadImageIfNeeded = async (): Promise<string | null> => {
    if (!form.imageFile) return editingItem?.image_url ?? form.imagePreview ?? null

    const {
      data: { user },
    } = await supabase.auth.getUser()
    const owner = user?.id ?? 'shared'
    const ext = form.imageFile.name.split('.').pop() || 'jpg'
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const path = `para-ver/${owner}/${fileName}`

    const { error: uploadError } = await supabase.storage.from('para-ver').upload(path, form.imageFile, {
      upsert: true,
    })

    if (uploadError) {
      throw new Error('No se pudo subir la imagen.')
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('para-ver').getPublicUrl(path)

    return publicUrl
  }

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return

    setIsSaving(true)
    setError(null)
    setMessage(null)

    try {
      const imageUrl = await uploadImageIfNeeded()

      if (editingItem) {
        const { data, error } = await supabase
          .from('para_ver_items')
          .update({
            title: form.title.trim(),
            status: form.status,
            notes: form.notes.trim() || null,
            image_url: imageUrl,
          })
          .eq('id', editingItem.id)
          .select(
            `
            id, title, image_url, status, notes, created_at, created_by,
            creator:created_by(display_name, avatar_url)
          `,
          )
          .single()

        if (error) {
          setError('No se pudo actualizar el contenido.')
          return
        }

        if (data) {
          setItems((prev) => prev.map((item) => (item.id === editingItem.id ? (data as ParaVerItem) : item)))
          setMessage('Contenido actualizado.')
        }
      } else {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user) {
          setError('Necesitas iniciar sesión para agregar contenido.')
          return
        }

        const { data, error } = await supabase
          .from('para_ver_items')
          .insert({
            title: form.title.trim(),
            status: form.status,
            notes: form.notes.trim() || null,
            image_url: imageUrl,
            created_by: user.id,
          })
          .select(
            `
            id, title, image_url, status, notes, created_at, created_by,
            creator:created_by(display_name, avatar_url)
          `,
          )
          .single()

        if (error) {
          setError('No se pudo agregar el contenido.')
          return
        }

        if (data) {
          setItems((prev) => [data as ParaVerItem, ...prev])
          setMessage('Agregado a Para ver.')
        }
      }

      setIsModalOpen(false)
    } catch (saveError) {
      const text = saveError instanceof Error ? saveError.message : 'No se pudo guardar el contenido.'
      setError(text)
    } finally {
      setIsSaving(false)
    }
  }

  const handleChangeStatus = async (item: ParaVerItem, nextStatus: ParaVerStatus) => {
    if (item.status === nextStatus) return
    const previousItems = items
    setUpdatingStatusId(item.id)
    setItems((prev) => prev.map((entry) => (entry.id === item.id ? { ...entry, status: nextStatus } : entry)))

    const { error } = await supabase.from('para_ver_items').update({ status: nextStatus }).eq('id', item.id)

    if (error) {
      setItems(previousItems)
      setError('No se pudo cambiar el estado.')
    } else {
      setMessage('Estado actualizado.')
    }
    setUpdatingStatusId(null)
  }

  const handleRemoveItem = async (item: ParaVerItem) => {
    const accepted = window.confirm(`¿Quitar "${item.title}" de Para ver?`)
    if (!accepted) return

    setDeletingId(item.id)
    setError(null)
    setMessage(null)
    const previousItems = items
    setItems((prev) => prev.filter((entry) => entry.id !== item.id))

    const { error } = await supabase.from('para_ver_items').delete().eq('id', item.id)
    if (error) {
      setItems(previousItems)
      setError('No se pudo eliminar el contenido.')
    } else {
      setMessage('Elemento eliminado.')
    }
    setDeletingId(null)
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="rounded-2xl bg-white/90 p-5 shadow-lg shadow-pink-500/10 backdrop-blur-md dark:bg-slate-900/80 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-600 dark:bg-rose-500/20 dark:text-rose-300">
              <Tv className="h-3.5 w-3.5" />
              Para ver
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100 md:text-3xl">
              Nuestra lista para maratones y películas
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Agrega series, películas y shows para ver juntos con notas de dónde se quedaron.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-pink-400 to-rose-400 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-pink-500/30 transition-transform duration-200 hover:-translate-y-0.5 active:scale-95"
          >
            <PlusCircle className="h-4 w-4" />
            Agregar para ver
          </button>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/70">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Leyenda de estado
        </p>
        <div className="flex flex-wrap gap-2">
          {statusOrder.map((status) => {
            const meta = statusMeta[status]
            const Icon = meta.icon
            return (
              <span
                key={status}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${meta.pillClass}`}
              >
                <Icon className="h-3.5 w-3.5" />
                {meta.label}
              </span>
            )
          })}
        </div>
      </section>

      {(error || message) && (
        <div className="text-xs">
          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-red-500 dark:bg-red-500/10">{error}</div>
          )}
          {message && (
            <div className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
              {message}
            </div>
          )}
        </div>
      )}

      <section>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-7 w-7 animate-spin rounded-full border-4 border-pink-200 border-t-pink-500" />
          </div>
        ) : sortedItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-pink-200 bg-white/75 p-8 text-center dark:border-slate-700 dark:bg-slate-900/70">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Todavía no hay nada en Para ver. Agrega la primera serie o película.
            </p>
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-3 text-sm font-semibold text-pink-500 transition-colors hover:text-pink-600"
            >
              Agregar el primero
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {sortedItems.map((item) => {
              const meta = statusMeta[item.status]
              const StatusIcon = meta.icon
              return (
                <article
                  key={item.id}
                  className="group animate-in fade-in slide-in-from-bottom-2 duration-300 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-md shadow-pink-500/5 transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-pink-500/15 dark:border-slate-700 dark:bg-slate-900/80"
                >
                  <div className="relative h-40 overflow-hidden bg-gradient-to-br from-pink-200 via-rose-200 to-orange-100 dark:from-slate-800 dark:via-slate-700 dark:to-slate-800">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-3xl font-semibold tracking-widest text-white/85">
                        {getCardFallback(item.title)}
                      </div>
                    )}
                    <div className="absolute right-2 top-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium ${meta.pillClass}`}
                      >
                        <StatusIcon className="h-3.5 w-3.5" />
                        {meta.label}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3 p-4">
                    <h3 className="line-clamp-2 text-base font-semibold text-slate-800 dark:text-slate-100">
                      {item.title}
                    </h3>

                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        Estado
                      </label>
                      <select
                        value={item.status}
                        onChange={(event) => handleChangeStatus(item, event.target.value as ParaVerStatus)}
                        disabled={updatingStatusId === item.id}
                        className="w-full rounded-lg border border-slate-200 bg-white/80 px-2.5 py-2 text-xs text-slate-700 outline-none transition-colors focus:border-pink-500 focus:ring-1 focus:ring-pink-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100 dark:focus:border-pink-400 dark:focus:ring-pink-400"
                      >
                        {statusOrder.map((status) => (
                          <option key={status} value={status}>
                            {statusMeta[status].label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
                      <p className="mb-1 font-semibold text-slate-500 dark:text-slate-400">Notas</p>
                      <p className="line-clamp-3">
                        {item.notes?.trim() || 'Sin notas todavía. Puedes agregar temporada o minuto exacto.'}
                      </p>
                    </div>

                    {item.created_by && (() => {
                      const creator = getCreator(item)
                      const name = creator?.display_name?.trim() || 'Tu amorcito'
                      return (
                        <div className="flex items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-700/80">
                          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            Añadido por
                          </span>
                          <div className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                            {creator?.avatar_url ? (
                              <img src={creator.avatar_url} alt={name} className="h-full w-full object-cover" />
                            ) : (
                              <span>{name.charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                          <span className="text-xs text-slate-700 dark:text-slate-200">{name}</span>
                        </div>
                      )
                    })()}

                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(item)}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleRemoveItem(item)}
                        disabled={deletingId === item.id}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-red-950/30"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Quitar
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {isModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/55 px-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={closeModal} />
          <section className="relative z-50 w-full max-w-xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 rounded-2xl bg-white/95 p-6 shadow-2xl shadow-pink-500/20 ring-1 ring-slate-200/80 dark:bg-slate-900/95 dark:ring-slate-700/80">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                  {editingItem ? 'Editar contenido' : 'Agregar para ver'}
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Sube una imagen, define estado y deja notas como temporada o minuto.
                </p>
              </div>
              <button
                type="button"
                disabled={isSaving}
                onClick={closeModal}
                className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="Cerrar modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="md:col-span-2">
                  <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                    Título
                  </span>
                  <input
                    autoFocus
                    type="text"
                    placeholder="Breaking Bad, The Office, Interstellar..."
                    value={form.title}
                    onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:border-pink-400 dark:focus:ring-pink-400"
                  />
                </label>

                <label>
                  <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                    Estado
                  </span>
                  <select
                    value={form.status}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, status: event.target.value as ParaVerStatus }))
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition-colors focus:border-pink-500 focus:ring-1 focus:ring-pink-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:border-pink-400 dark:focus:ring-pink-400"
                  >
                    {statusOrder.map((status) => (
                      <option key={status} value={status}>
                        {statusMeta[status].label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                    Imagen
                  </span>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white/70 px-3 py-2 text-xs text-slate-600 transition-colors hover:border-pink-300 hover:bg-pink-50 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:border-pink-500/40 dark:hover:bg-pink-500/10">
                    <ImagePlus className="h-4 w-4" />
                    {form.imageFile ? form.imageFile.name : 'Subir portada'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
                    />
                  </label>
                </label>

                <label className="md:col-span-2">
                  <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                    Notas
                  </span>
                  <textarea
                    rows={3}
                    value={form.notes}
                    onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                    placeholder="Nos quedamos en la temporada 1, minuto 40:40..."
                    className="w-full resize-none rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:border-pink-400 dark:focus:ring-pink-400"
                  />
                </label>
              </div>

              {form.imagePreview && (
                <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                  <img src={form.imagePreview} alt="Vista previa" className="h-36 w-full object-cover" />
                </div>
              )}

              <div className="flex items-center justify-between gap-3">
                <div className="text-xs">
                  {error && <span className="text-red-500">{error}</span>}
                  {message && <span className="text-emerald-500">{message}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={closeModal}
                    className="rounded-lg px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || !form.title.trim()}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-pink-400 to-rose-400 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-pink-500/30 transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSaving ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    ) : (
                      <PlusCircle className="h-4 w-4" />
                    )}
                    {editingItem ? 'Guardar cambios' : 'Guardar'}
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

