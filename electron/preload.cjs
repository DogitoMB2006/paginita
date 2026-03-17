const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  requestNativeNotificationPermission: () => ipcRenderer.invoke('notifications:permission'),
  showNativeNotification: (payload) => ipcRenderer.invoke('notifications:show', payload),
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  downloadUpdate: () => ipcRenderer.invoke('updater:download'),
  quitAndInstall: () => ipcRenderer.send('updater:quit-and-install'),
  onUpdaterStatus: (callback) => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('updater:status', listener)
    return () => ipcRenderer.removeListener('updater:status', listener)
  },
})

