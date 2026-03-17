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

const getAppIcon = () => {
  // Use PNG for runtime window/tray icon (better support in tray),
  // while electron-builder uses the ICO for the EXE/installer.
  const iconPath = path.join(__dirname, '..', 'public', 'icono.png')
  try {
    const image = nativeImage.createFromPath(iconPath)
    if (!image.isEmpty()) return image
  } catch {
    // ignore, will fall back to default icon
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
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    sendUpdaterStatus({ type: 'checking-for-update' })
  })

  autoUpdater.on('update-available', (info) => {
    sendUpdaterStatus({
      type: 'update-available',
      version: info.version,
      message: 'Se ha encontrado nueva actualización',
    })
  })

  autoUpdater.on('update-not-available', () => {
    sendUpdaterStatus({ type: 'update-not-available' })
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
    })
  })

  autoUpdater.on('error', (error) => {
    const message = String(error?.message ?? '')

    // If there are no GitHub releases yet or GitHub returns 404,
    // treat it as "no updates" instead of surfacing a loud error.
    if (message.includes('404') || message.includes('releases.atom')) {
      sendUpdaterStatus({ type: 'update-not-available' })
      return
    }

    sendUpdaterStatus({
      type: 'error',
      message: message || 'No se pudo completar la actualización',
    })
  })
}

const createMainWindow = async () => {
  const preloadPath = path.join(__dirname, 'preload.cjs')
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    icon: getAppIcon(),
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  window.once('ready-to-show', () => window.show())

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
  await autoUpdater.checkForUpdates()
  return { ok: true }
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

    const icon = getAppIcon()
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
      setTimeout(() => {
        void autoUpdater.checkForUpdates()
      }, 5000)

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
