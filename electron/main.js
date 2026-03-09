const { app, BrowserWindow, ipcMain, globalShortcut, shell } = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('path')
const { spawn } = require('child_process')
const fs = require('fs')
const https = require('https')

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

  if (app.isPackaged) {
    try {
      autoUpdater.checkForUpdates()
    } catch (e) {
      console.log('Update check failed:', e.message)
    }
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
  if (!app.isPackaged) return
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
let pendingUpdateInfo = null

autoUpdater.on('update-available', (info) => {
  pendingUpdateInfo = info
  win && win.webContents.send('update-available', info)
})

autoUpdater.on('update-not-available', () => {
  win && win.webContents.send('update-not-available')
})

autoUpdater.on('download-progress', (progress) => {
  win && win.webContents.send('update-progress', progress)
})

autoUpdater.on('update-downloaded', () => {
  autoUpdater.quitAndInstall(true, true)
})

autoUpdater.on('error', (err) => {
  console.error('Auto-updater error:', err.message)
})

// Replay pending update info if renderer asks after the event already fired
ipcMain.handle('get-pending-update', () => pendingUpdateInfo)

// AI text generation via DuckDuckGo AI Chat (free, no auth)
ipcMain.handle('generate-ai-text', (event, prompt) => {
  return new Promise((resolve, reject) => {
    // Step 1: get VQD token
    const statusReq = https.request({
      hostname: 'duckduckgo.com',
      path: '/duckchat/v1/status',
      method: 'GET',
      headers: {
        'x-vqd-accept': '1',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
      }
    }, (res) => {
      const vqd = res.headers['x-vqd-4']
      res.resume() // drain response body
      if (!vqd) { reject(new Error('Could not get AI session token')); return }

      // Step 2: send chat request
      const body = JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }]
      })
      const chatReq = https.request({
        hostname: 'duckduckgo.com',
        path: '/duckchat/v1/chat',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'x-vqd-4': vqd,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/event-stream',
          'Origin': 'https://duckduckgo.com',
          'Referer': 'https://duckduckgo.com/',
        }
      }, (res) => {
        let result = ''
        res.on('data', (chunk) => {
          for (const line of chunk.toString().split('\n')) {
            if (!line.startsWith('data: ')) continue
            const payload = line.slice(6).trim()
            if (payload === '[DONE]') continue
            try { result += JSON.parse(payload).message ?? '' } catch {}
          }
        })
        res.on('end', () => {
          if (!result) reject(new Error('Empty response from AI'))
          else resolve(result)
        })
      })
      chatReq.on('error', reject)
      chatReq.write(body)
      chatReq.end()
    })
    statusReq.on('error', reject)
    statusReq.end()
  })
})
