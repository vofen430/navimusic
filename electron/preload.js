const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,

  // Desktop mode (always-on-bottom wallpaper)
  setDesktopMode: (enable) => ipcRenderer.send('set-desktop-mode', enable),
  isDesktopMode: () => ipcRenderer.invoke('is-desktop-mode'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  onDesktopModeChanged: (callback) => {
    ipcRenderer.on('desktop-mode-changed', (_, enabled) => callback(enabled))
  },

  // Window controls
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
})
