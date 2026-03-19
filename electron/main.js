const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage } = require('electron')
const path = require('path')

// ─── Config ───
const PORT = 3300 // use a different port to avoid conflicts with dev server
process.env.PORT = String(PORT)

// Set resource path for packaged app (extraResources go to process.resourcesPath)
const isPacked = app.isPackaged
process.env.RESOURCE_PATH = isPacked ? process.resourcesPath : path.join(__dirname, '..')

// ─── Single Instance ───
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) { app.quit(); process.exit(0) }

let mainWin = null
let desktopMode = false
let tray = null

// ─── Start Express API server ───
function startServer() {
  // server.js reads process.env.PORT
  require('../server.js')
}

// ─── Create Window ───
function createWindow() {
  const winOptions = {
    width: 1280,
    height: 800,
    frame: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
  }

  Menu.setApplicationMenu(null)
  mainWin = new BrowserWindow(winOptions)
  mainWin.loadURL(`http://localhost:${PORT}`)

  mainWin.once('ready-to-show', () => {
    mainWin.show()
  })

  mainWin.on('closed', () => { mainWin = null })
}

// ─── System Tray ───
function createTray() {
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.png')
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  tray = new Tray(icon)
  tray.setToolTip('NaviMusic')
  updateTrayMenu()

  tray.on('click', () => {
    if (!mainWin) return
    if (desktopMode) return // In desktop mode, don't restore on click
    if (mainWin.isVisible()) {
      mainWin.focus()
    } else {
      mainWin.show()
    }
  })
}

function updateTrayMenu() {
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示窗口',
      click: () => {
        if (!mainWin) return
        if (desktopMode) {
          // Exit desktop mode first, then show
          setDesktopMode(false)
        }
        mainWin.show()
        mainWin.focus()
      }
    },
    { type: 'separator' },
    ...(desktopMode ? [{
      label: '退出壁纸模式',
      click: () => { setDesktopMode(false) }
    }] : [{
      label: '进入壁纸模式',
      click: () => { setDesktopMode(true) }
    }]),
    { type: 'separator' },
    {
      label: '退出 NaviMusic',
      click: () => {
        if (desktopMode && mainWin) {
          // Clean up desktop mode before quitting
          try { setDesktopModeWin32(mainWin, false) } catch {}
        }
        app.quit()
      }
    }
  ])
  tray.setContextMenu(contextMenu)
}

// ─── Desktop Mode Controller ───
function setDesktopMode(enable) {
  desktopMode = enable
  if (!mainWin) return

  if (process.platform === 'win32') {
    setDesktopModeWin32(mainWin, enable)
  } else if (process.platform === 'linux') {
    setDesktopModeLinux(mainWin, enable)
  }

  // Notify renderer of state change
  if (mainWin.webContents) {
    mainWin.webContents.send('desktop-mode-changed', enable)
  }
  updateTrayMenu()
}

// ─── Windows WorkerW Desktop Mode ───
// Sets the Electron window as a child of the WorkerW behind desktop icons.
// Same technique used by Wallpaper Engine.
function setDesktopModeWin32(win, enable) {
  let ffi, ref, user32
  try {
    ffi = require('ffi-napi')
    ref = require('ref-napi')
  } catch (err) {
    console.warn('[Desktop Mode] ffi-napi not available:', err.message)
    console.warn('[Desktop Mode] Please run: npm install && npm run electron:rebuild')
    // Fallback: at least do skip-taskbar + fullscreen
    if (enable) {
      win.setSkipTaskbar(true)
      win.setFullScreen(true)
    } else {
      win.setSkipTaskbar(false)
      win.setFullScreen(false)
    }
    return false
  }

  const voidPtr = ref.refType(ref.types.void)
  user32 = ffi.Library('user32', {
    FindWindowW: ['pointer', ['string', 'pointer']],
    SendMessageTimeoutW: ['long', ['pointer', 'uint32', 'long', 'long', 'uint32', 'uint32', voidPtr]],
    EnumWindows: ['bool', ['pointer', 'long']],
    FindWindowExW: ['pointer', ['pointer', 'pointer', 'string', 'pointer']],
    SetParent: ['pointer', ['pointer', 'pointer']],
    ShowWindow: ['bool', ['pointer', 'int']],
    SetWindowPos: ['bool', ['pointer', 'pointer', 'int', 'int', 'int', 'int', 'uint32']],
  })

  if (enable) {
    // 1. Find Progman window
    const progman = user32.FindWindowW('Progman', null)
    if (progman.isNull()) { console.warn('Progman not found'); return false }

    // 2. Send undocumented message 0x052C to spawn a WorkerW behind desktop icons
    const resultBuf = ref.alloc(ref.types.void)
    user32.SendMessageTimeoutW(progman, 0x052C, 0xD, 0, 0x0000, 1000, resultBuf)
    user32.SendMessageTimeoutW(progman, 0x052C, 0xD, 1, 0x0000, 1000, resultBuf)

    // 3. Enumerate windows to find the right WorkerW
    let workerW = null
    const enumCallback = ffi.Callback('bool', ['pointer', 'long'], (hwnd) => {
      const shell = user32.FindWindowExW(hwnd, null, 'SHELLDLL_DefView', null)
      if (!shell.isNull()) {
        workerW = hwnd
      }
      return true
    })
    user32.EnumWindows(enumCallback, 0)

    // Re-enumerate to find the WorkerW sibling AFTER SHELLDLL_DefView
    let foundShell = false
    workerW = null
    const enumCallback2 = ffi.Callback('bool', ['pointer', 'long'], (hwnd) => {
      if (foundShell) {
        workerW = hwnd
        return false
      }
      const shell = user32.FindWindowExW(hwnd, null, 'SHELLDLL_DefView', null)
      if (!shell.isNull()) foundShell = true
      return true
    })
    user32.EnumWindows(enumCallback2, 0)

    if (!workerW) { console.warn('WorkerW not found'); return false }

    // 4. Set our Electron window as a child of WorkerW
    const hwnd = win.getNativeWindowHandle()
    user32.SetParent(hwnd, workerW)

    // 5. Make fullscreen, skip taskbar (tray still visible)
    win.setFullScreen(true)
    win.setSkipTaskbar(true)

    console.log('[Desktop Mode] Window embedded in WorkerW')
    return true
  } else {
    // Restore: detach from WorkerW
    const hwnd = win.getNativeWindowHandle()
    user32.SetParent(hwnd, null) // null = desktop
    win.setFullScreen(false)
    win.setSkipTaskbar(false)
    console.log('[Desktop Mode] Window detached from WorkerW')
    return true
  }
}

// ─── Linux Desktop Mode ───
function setDesktopModeLinux(win, enable) {
  console.log(`[Desktop Mode] Linux mode ${enable ? 'on' : 'off'} (requires restart)`)
  return false
}

// ─── IPC Handlers ───
function setupIPC() {
  ipcMain.on('set-desktop-mode', (_, enable) => {
    setDesktopMode(enable)
  })

  ipcMain.handle('get-platform', () => process.platform)
  ipcMain.handle('is-desktop-mode', () => desktopMode)

  // Window control IPC
  ipcMain.on('window-minimize', () => { if (mainWin) mainWin.minimize() })
  ipcMain.on('window-maximize', () => {
    if (!mainWin) return
    if (mainWin.isMaximized()) mainWin.unmaximize()
    else mainWin.maximize()
  })
  ipcMain.on('window-close', () => { if (mainWin) mainWin.close() })
  ipcMain.handle('window-is-maximized', () => mainWin ? mainWin.isMaximized() : false)
}

// ─── App Lifecycle ───
app.on('ready', () => {
  startServer()
  setupIPC()
  createTray()

  // Wait a moment for server to start
  setTimeout(createWindow, 800)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
  if (mainWin) {
    if (mainWin.isMinimized()) mainWin.restore()
    mainWin.focus()
  }
})

app.on('activate', () => {
  if (!mainWin) createWindow()
})
