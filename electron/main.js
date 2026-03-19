const { app, BrowserWindow, ipcMain, Menu } = require('electron')
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

// ─── Windows WorkerW Desktop Mode ───
// Sets the Electron window as a child of the WorkerW behind desktop icons.
// Same technique used by Wallpaper Engine.
function setDesktopModeWin32(win, enable) {
  let ffi, ref, user32
  try {
    ffi = require('ffi-napi')
    ref = require('ref-napi')
  } catch {
    console.warn('[Desktop Mode] ffi-napi not available, skipping WorkerW setup')
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
        // The WorkerW we want is the NEXT sibling enumerated
        workerW = hwnd
      }
      return true // continue enumeration
    })
    user32.EnumWindows(enumCallback, 0)

    // Actually we need the WorkerW that is a sibling AFTER the one containing SHELLDLL_DefView
    // Re-enumerate to find it
    let foundShell = false
    workerW = null
    const enumCallback2 = ffi.Callback('bool', ['pointer', 'long'], (hwnd) => {
      if (foundShell) {
        const className = 'WorkerW'
        // Check if this is a WorkerW
        workerW = hwnd
        return false // stop
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

    // 5. Make fullscreen, no border
    const { width, height } = require('electron').screen.getPrimaryDisplay().workAreaSize
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
  // Recreate window with type: 'desktop' isn't easily doable after creation
  // On Linux, this is best set at window creation time
  console.log(`[Desktop Mode] Linux mode ${enable ? 'on' : 'off'} (requires restart)`)
  return false
}

// ─── IPC Handlers ───
function setupIPC() {
  ipcMain.on('set-desktop-mode', (_, enable) => {
    desktopMode = enable
    if (!mainWin) return

    if (process.platform === 'win32') {
      setDesktopModeWin32(mainWin, enable)
    } else if (process.platform === 'linux') {
      setDesktopModeLinux(mainWin, enable)
    }
    // macOS: not implemented yet
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
