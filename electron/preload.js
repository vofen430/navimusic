const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,

  // Desktop mode (always-on-bottom wallpaper)
  setDesktopMode: (enable) => ipcRenderer.send('set-desktop-mode', enable),
  isDesktopMode: () => ipcRenderer.invoke('is-desktop-mode'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),
})
