import { useState } from 'react'
import { getElectronAPI, isElectronRuntime } from '../lib/runtime'

const dragRegionStyle = { WebkitAppRegion: 'drag' } as any
const noDragStyle = { WebkitAppRegion: 'no-drag' } as any

export function ElectronTitleBar() {
  const [checking, setChecking] = useState(false)

  if (!isElectronRuntime()) return null

  const api = getElectronAPI()
  if (!api) return null

  const handleCheck = () => {
    setChecking(true)
    api.checkForUpdates().finally(() => setChecking(false))
  }

  return (
    <div
      className="fixed left-0 right-0 top-0 z-[100] flex h-10 items-center justify-between border-b border-rose-100/80 bg-rose-50/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95"
      style={{ height: 40 }}
    >
      <div className="flex flex-1 items-center px-3" style={dragRegionStyle}>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 select-none">
          Nuestra paginita
        </span>
      </div>
      <div className="flex items-center gap-2 pr-2" style={noDragStyle}>
        <button
          type="button"
          onClick={handleCheck}
          disabled={checking}
          className="mr-2 flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-rose-200/80 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200 disabled:opacity-60"
          title="Comprobar actualizaciones"
        >
          {checking ? (
            <>
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-pink-500" />
              Buscando...
            </>
          ) : (
            'Comprobar actualizaciones'
          )}
        </button>
        <button
          type="button"
          onClick={() => api.minimizeWindow()}
          className="flex h-8 w-8 items-center justify-center rounded hover:bg-rose-200/70 dark:hover:bg-slate-700"
          title="Minimizar"
        >
          <span className="text-sm text-slate-700 dark:text-slate-100">−</span>
        </button>
        <button
          type="button"
          onClick={() => api.toggleMaximizeWindow()}
          className="flex h-8 w-8 items-center justify-center rounded hover:bg-rose-200/70 dark:hover:bg-slate-700"
          title="Maximizar / Restaurar"
        >
          <span className="text-xs text-slate-700 dark:text-slate-100">▢</span>
        </button>
        <button
          type="button"
          onClick={() => api.closeWindow()}
          className="flex h-8 w-8 items-center justify-center rounded hover:bg-rose-300/80 hover:text-red-900 dark:hover:bg-red-600/80"
          title="Cerrar"
        >
          <span className="text-sm font-semibold text-red-600 dark:text-red-100">×</span>
        </button>
      </div>
    </div>
  )
}
