import { app, BrowserWindow, ipcMain, Notification, nativeImage, Tray, Menu } from 'electron'
import pkg from 'electron-updater'
import { randomUUID } from 'node:crypto'
import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const { autoUpdater } = pkg

const APP_ID = 'com.paginita.desktop'
const APP_TITLE = 'Nuestra paginita'
const DEV_URL = 'http://localhost:5173'
const isDev = !app.isPackaged
const iconCache = new Map()
let mainWindow = null
let tray = null
let isQuitting = false

app.setAppUserModelId(APP_ID)

const getAppIcon = (forTray = false) => {
  // Try ICO first (included in package); fall back to PNG. For tray, use 16x16 so Windows shows it.
  const icoPath = path.join(__dirname, '..', 'public', 'icono.ico')
  const pngPath = path.join(__dirname, '..', 'public', 'icono.png')
  for (const iconPath of [icoPath, pngPath]) {
    try {
      const image = nativeImage.createFromPath(iconPath)
      if (!image.isEmpty()) {
        if (forTray && (image.getSize().width > 32 || image.getSize().height > 32)) {
          return image.resize({ width: 16, height: 16 })
        }
        return image
      }
    } catch {
      // try next path
    }
  }
  return undefined
}

const sendUpdaterStatus = (payload) => {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send('updater:status', payload)
}

const createAvatarIcon = async (avatarUrl) => {
  if (!avatarUrl) return null
  if (iconCache.has(avatarUrl)) return iconCache.get(avatarUrl)

  try {
    const response = await fetch(avatarUrl)
    if (!response.ok) return null

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const iconDirectory = path.join(os.tmpdir(), 'paginita-notifications')
    await mkdir(iconDirectory, { recursive: true })

    const iconPath = path.join(iconDirectory, `${randomUUID()}.png`)
    await writeFile(iconPath, buffer)
    iconCache.set(avatarUrl, iconPath)

    return iconPath
  } catch {
    return null
  }
}

const showNativeNotification = async (message, avatarUrl) => {
  const iconPath = await createAvatarIcon(avatarUrl)
  const icon = iconPath ? nativeImage.createFromPath(iconPath) : undefined

  const notification = new Notification({
    title: APP_TITLE,
    body: message,
    icon,
  })

  notification.show()
}

const setupUpdater = () => {
  const getVersionPayload = (latestVersion) => {
    const currentVersion = app.getVersion()
    return {
      currentVersion,
      latestVersion: latestVersion || currentVersion,
    }
  }

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    sendUpdaterStatus({
      type: 'checking-for-update',
      ...getVersionPayload(),
    })
  })

  autoUpdater.on('update-available', (info) => {
    sendUpdaterStatus({
      type: 'update-available',
      version: info.version,
      message: 'Se ha recibido una nueva actualización. ¿Quieres descargarla?',
      ...getVersionPayload(info.version),
    })
    // Notify user even when app is in background
    const notif = new Notification({
      title: 'Nueva actualización disponible',
      body: 'Se ha recibido una nueva actualización. Abre la app y elige Sí para descargar.',
      icon: getAppIcon() ?? undefined,
    })
    notif.show()
  })

  autoUpdater.on('update-not-available', (info) => {
    sendUpdaterStatus({
      type: 'update-not-available',
      version: info?.version,
      ...getVersionPayload(info?.version),
    })
  })

  autoUpdater.on('download-progress', (progress) => {
    sendUpdaterStatus({
      type: 'download-progress',
      percent: Math.round(progress.percent),
    })
  })

  autoUpdater.on('update-downloaded', () => {
    sendUpdaterStatus({
      type: 'update-downloaded',
      message: 'Se actualizará la app',
      ...getVersionPayload(),
    })
  })

  autoUpdater.on('error', (error) => {
    const message = String(error?.message ?? '')

    // If there are no GitHub releases yet or GitHub returns 404,
    // treat it as "no updates" instead of surfacing a loud error.
    if (message.includes('404') || message.includes('releases.atom')) {
      sendUpdaterStatus({
        type: 'update-not-available',
        ...getVersionPayload(),
      })
      return
    }

    sendUpdaterStatus({
      type: 'error',
      message: message || 'No se pudo completar la actualización',
      ...getVersionPayload(),
    })
  })
}

const createMainWindow = async () => {
  const preloadPath = path.join(__dirname, 'preload.cjs')
  const winOpts = {
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    frame: false,
    icon: getAppIcon(false),
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
    },
  }
  // We use a completely custom title bar, so always hide the native frame.
  const window = new BrowserWindow(winOpts)

  window.once('ready-to-show', () => {
    window.show()
  })

  if (isDev) {
    await window.loadURL(DEV_URL)
  } else {
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  return window
}

ipcMain.handle('notifications:permission', () => 'granted')
ipcMain.handle('notifications:show', async (_event, payload) => {
  await showNativeNotification(payload?.message ?? '', payload?.avatarUrl ?? null)
  return { ok: true }
})

ipcMain.handle('updater:check', async () => {
  if (isDev) return { ok: false, reason: 'dev-mode' }
  console.log('[updater] IPC updater:check invoked')
  try {
    await autoUpdater.checkForUpdates()
    console.log('[updater] checkForUpdates() resolved')
    return { ok: true }
  } catch (err) {
    const message = String(err?.message ?? err ?? '')
    console.error('[updater] checkForUpdates() error:', message)
    // Private repo or no releases: GitHub returns 404 for releases.atom. Treat as "no update" so the UI doesn't show an error.
    if (message.includes('404') || message.includes('releases.atom')) {
      console.warn('[updater] 404 / releases.atom – treating as no update')
      sendUpdaterStatus({ type: 'update-not-available' })
      return { ok: true }
    }
    sendUpdaterStatus({ type: 'error', message: message || 'No se pudo comprobar actualizaciones' })
    throw err
  }
})

ipcMain.handle('updater:download', async () => {
  if (isDev) return { ok: false, reason: 'dev-mode' }
  await autoUpdater.downloadUpdate()
  return { ok: true }
})

ipcMain.on('updater:quit-and-install', () => {
  if (!isDev) {
    autoUpdater.quitAndInstall()
  }
})

ipcMain.on('window:minimize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.minimize()
  }
})

ipcMain.on('window:toggle-maximize', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow.maximize()
  }
})

ipcMain.on('window:close', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return
  // Respect existing close behavior (hide to tray instead of quitting).
  mainWindow.close()
})

const singleInstanceLock = app.requestSingleInstanceLock()
if (!singleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(async () => {
    setupUpdater()
    mainWindow = await createMainWindow()

    const icon = getAppIcon(true)
    tray = new Tray(icon || nativeImage.createEmpty())
    tray.setToolTip('Paginita')
    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: 'Abrir Paginita',
          click: () => {
            if (!mainWindow) return
            if (mainWindow.isMinimized()) mainWindow.restore()
            mainWindow.show()
            mainWindow.focus()
          },
        },
        {
          label: 'Salir',
          click: () => {
            isQuitting = true
            app.quit()
          },
        },
      ]),
    )

    mainWindow.on('close', (event) => {
      if (isQuitting) return
      event.preventDefault()
      mainWindow.hide()
    })

    tray.on('double-click', () => {
      if (!mainWindow) return
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    })

    if (!isDev) {
      // Check for updates as soon as the window is ready
      setTimeout(() => {
        void autoUpdater.checkForUpdates()
      }, 2000)
      setInterval(() => {
        void autoUpdater.checkForUpdates()
      }, 30 * 60 * 1000)
    }

    app.on('activate', async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = await createMainWindow()
      }
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
