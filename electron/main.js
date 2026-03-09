const { app, BrowserWindow, ipcMain, globalShortcut, shell } = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('path')
const { spawn } = require('child_process')
const fs = require('fs')

app.setAppUserModelId('com.pokeguide.app')

autoUpdater.autoDownload = false

let win = null

function createWindow() {
  let iconPath = path.join(__dirname, '../resources/icon.ico')
  let iconExists = fs.existsSync(iconPath)

  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    icon: iconExists ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

  if (isDev) {
    win.loadURL('http://localhost:5173')
    // win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  win.on('maximize', () => {
    win.webContents.send('window-maximized-state', true)
  })
  win.on('unmaximize', () => {
    win.webContents.send('window-maximized-state', false)
  })
}

app.whenReady().then(() => {
  createWindow()

  try {
    autoUpdater.checkForUpdates()
  } catch (e) {
    console.log('Update check failed:', e.message)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// IPC Handlers
ipcMain.on('window-minimize', () => {
  win && win.minimize()
})

ipcMain.on('window-maximize', () => {
  if (!win) return
  if (win.isMaximized()) {
    win.unmaximize()
  } else {
    win.maximize()
  }
})

ipcMain.on('window-close', () => {
  win && win.close()
})

ipcMain.handle('window-is-maximized', () => {
  return win ? win.isMaximized() : false
})

ipcMain.handle('get-pokemon-data-dir', () => {
  return path.join(app.getPath('userData'), 'pokemon-data')
})

ipcMain.handle('open-external', (event, url) => {
  shell.openExternal(url)
})

ipcMain.handle('open-data-folder', () => {
  shell.openPath(app.getPath('userData'))
})

ipcMain.handle('open-path', (event, p) => {
  shell.openPath(p)
})

ipcMain.handle('read-pokemon-file', (event, dir, filename) => {
  try {
    const filePath = path.join(dir, filename)
    if (!fs.existsSync(filePath)) return null
    const data = fs.readFileSync(filePath, 'utf8')
    return JSON.parse(data)
  } catch {
    return null
  }
})

ipcMain.handle('delete-pokemon-file', (event, dir, filename) => {
  try {
    const filePath = path.join(dir, filename)
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

ipcMain.on('start-update', () => {
  autoUpdater.downloadUpdate()
})

ipcMain.on('restart-app', () => {
  autoUpdater.quitAndInstall()
})

ipcMain.on('check-for-updates', () => {
  try {
    autoUpdater.checkForUpdates()
  } catch (e) {
    console.log('Update check failed:', e.message)
  }
})

// Pokemon generation IPC
ipcMain.handle('generate-pokemon', (event, { versionSlug, pokedexFile, totalPokemon, outputDir }) => {
  return new Promise((resolve, reject) => {
    // Ensure output dir exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    const scriptPath = path.join(__dirname, '../scripts/fetchPokemon.js')
    const child = spawn(process.execPath, [scriptPath, versionSlug, pokedexFile, totalPokemon], {
      env: { ...process.env, POKEMON_DATA_DIR: outputDir },
    })

    child.stdout.on('data', (data) => {
      const text = data.toString()
      const lines = text.split('\n').filter(Boolean)
      lines.forEach((line) => {
        if (line.startsWith('PROGRESS:')) {
          const parts = line.split(':')
          const current = parseInt(parts[1])
          const total = parseInt(parts[2])
          win && win.webContents.send('pokemon-progress', { current, total })
        }
      })
    })

    child.stderr.on('data', (data) => {
      console.error('fetchPokemon stderr:', data.toString())
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true })
      } else {
        reject(new Error(`Script exited with code ${code}`))
      }
    })

    child.on('error', (err) => {
      reject(err)
    })
  })
})

// Auto-updater events
autoUpdater.on('update-available', (info) => {
  win && win.webContents.send('update-available', info)
})

autoUpdater.on('download-progress', (progress) => {
  win && win.webContents.send('update-progress', progress)
})

autoUpdater.on('update-downloaded', (info) => {
  win && win.webContents.send('update-downloaded', info)
})
