export type UpdaterStatusPayload = {
  type:
    | 'checking-for-update'
    | 'update-available'
    | 'update-not-available'
    | 'download-progress'
    | 'update-downloaded'
    | 'error'
  version?: string
  message?: string
  percent?: number
}

export type ElectronAPI = {
  isElectron: boolean
  requestNativeNotificationPermission: () => Promise<'granted'>
  showNativeNotification: (payload: { message: string; avatarUrl: string | null }) => Promise<{ ok: boolean }>
  checkForUpdates: () => Promise<{ ok: boolean; reason?: string }>
  downloadUpdate: () => Promise<{ ok: boolean; reason?: string }>
  quitAndInstall: () => void
  onUpdaterStatus: (callback: (payload: UpdaterStatusPayload) => void) => () => void
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export function getElectronAPI(): ElectronAPI | undefined {
  if (typeof window === 'undefined') return undefined
  return window.electronAPI
}

export function isElectronRuntime(): boolean {
  return Boolean(getElectronAPI()?.isElectron)
}
