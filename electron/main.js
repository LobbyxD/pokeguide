const { app, BrowserWindow, ipcMain, globalShortcut, shell, dialog } = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('path')
const { spawn, spawnSync } = require('child_process')
const fs = require('fs')
const https = require('https')
const os = require('os')

app.setAppUserModelId('com.pokeguide.app')

autoUpdater.autoDownload = false

let win = null
let installerWin = null
let installerMode = 'fresh'

// ── First-run / updated markers ───────────────────────────────────────────────
// Written by the NSIS customInstall macro:
//   .first-run → fresh install staged to TEMP → show wizard (fresh mode)
//   .repair    → repair reinstall to existing dir → show wizard (repair mode)
//   .updated   → silent auto-update → show toast in main app
function consumeMarker(name) {
  const p = path.join(app.getPath('appData'), 'PokeGuide', name)
  if (fs.existsSync(p)) { try { fs.unlinkSync(p) } catch {} ; return true }
  return false
}

// ── Shortcut helpers (PowerShell WScript.Shell) ────────────────────────────────
function psCreateShortcut(linkPath, targetPath) {
  const lp = linkPath.replace(/'/g, "''")
  const tp = targetPath.replace(/'/g, "''")
  const cmd = `$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('${lp}'); $s.TargetPath = '${tp}'; $s.Save()`
  spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', cmd])
}

function createDesktopShortcut(exePath) {
  psCreateShortcut(path.join(os.homedir(), 'Desktop', 'PokeGuide.lnk'), exePath)
}

function createStartMenuShortcut(exePath) {
  const dir = path.join(process.env.APPDATA || os.homedir(), 'Microsoft', 'Windows', 'Start Menu', 'Programs')
  try { fs.mkdirSync(dir, { recursive: true }) } catch {}
  psCreateShortcut(path.join(dir, 'PokeGuide.lnk'), exePath)
}

// ── Update registry after fresh install moves files to final dir ──────────────
const UNINSTALL_KEY = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\cab503a4-4e38-568d-a337-d606e4e27110'

function updateInstallRegistry(finalDir) {
  const uninstaller = path.join(finalDir, 'Uninstall PokeGuide.exe').replace(/'/g, "''")
  const exePath = path.join(finalDir, 'PokeGuide.exe').replace(/'/g, "''")
  const dir = finalDir.replace(/'/g, "''")
  const ps = [
    `$k = '${UNINSTALL_KEY}'`,
    `if (Test-Path $k) {`,
    `  Set-ItemProperty -Path $k -Name InstallLocation -Value '${dir}'`,
    `  Set-ItemProperty -Path $k -Name UninstallString -Value '"${uninstaller}"'`,
    `  Set-ItemProperty -Path $k -Name DisplayIcon -Value '${exePath}'`,
    `}`,
  ].join(' ')
  spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps])
}

// ── Copy directory recursively, yielding progress ─────────────────────────────
function collectFiles(dir) {
  const results = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) results.push(...collectFiles(full))
    else results.push(full)
  }
  return results
}

// ── Installer window ───────────────────────────────────────────────────────────
function showInstallerWizard(mode) {
  installerMode = mode
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

  let iconPath = path.join(__dirname, '../resources/icon.ico')
  if (!fs.existsSync(iconPath)) iconPath = undefined

  installerWin = new BrowserWindow({
    width: 520,
    height: 400,
    resizable: false,
    frame: false,
    transparent: false,
    center: true,
    icon: iconPath,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload-installer.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  installerWin.once('ready-to-show', () => installerWin.show())

  if (isDev) {
    installerWin.loadURL(`http://localhost:5173/installer.html?mode=${mode}`)
  } else {
    installerWin.loadFile(path.join(__dirname, '../dist/installer.html'), { query: { mode } })
  }

  installerWin.on('closed', () => { installerWin = null })
}

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

// ── User data layout ──────────────────────────────────────────────────────────
// All user-facing files live under userData/data/ so users only see one clean
// folder instead of Electron's internal Cache/IndexedDB/etc. directories.
//
// New layout:
//   userData/data/presets/   ← saved .pgpreset files
//   userData/data/pokedex/   ← pokédex JSON files
//
// On first launch after upgrade the migration below moves files from the old
// flat locations (pokemon-data/, presets/) into the new structure.
// ─────────────────────────────────────────────────────────────────────────────

function getUserDataDir() {
  const dir = path.join(app.getPath('userData'), 'data')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

function getPokedexDir() {
  const dir = path.join(getUserDataDir(), 'pokedex')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

function migrateUserData() {
  const userData = app.getPath('userData')

  // pokemon-data/ → data/pokedex/
  const oldPokedex = path.join(userData, 'pokemon-data')
  if (fs.existsSync(oldPokedex)) {
    const newPokedex = getPokedexDir()
    for (const file of fs.readdirSync(oldPokedex).filter(f => f.endsWith('.json'))) {
      const dest = path.join(newPokedex, file)
      if (!fs.existsSync(dest)) fs.renameSync(path.join(oldPokedex, file), dest)
      else fs.unlinkSync(path.join(oldPokedex, file))
    }
    if (fs.readdirSync(oldPokedex).length === 0) fs.rmdirSync(oldPokedex)
  }

  // presets/ → data/presets/  (only if it's still the old top-level location)
  const oldPresets = path.join(userData, 'presets')
  if (fs.existsSync(oldPresets)) {
    const newPresets = getPresetsDir()
    for (const file of fs.readdirSync(oldPresets).filter(f => f.endsWith('.pgpreset'))) {
      const dest = path.join(newPresets, file)
      if (!fs.existsSync(dest)) fs.renameSync(path.join(oldPresets, file), dest)
      else fs.unlinkSync(path.join(oldPresets, file))
    }
    try {
      if (fs.readdirSync(oldPresets).length === 0) fs.rmdirSync(oldPresets)
    } catch {}
  }
}

app.whenReady().then(() => {
  migrateUserData()

  // Check for post-install markers written by the NSIS customInstall macro
  const isFirstRun = consumeMarker('.first-run')
  const isRepair   = consumeMarker('.repair')
  const wasUpdated = consumeMarker('.updated')

  if (isFirstRun) {
    showInstallerWizard('fresh')
  } else if (isRepair) {
    showInstallerWizard('repair')
  } else {
    createWindow()

    if (wasUpdated) {
      // Notify the main window once it's ready
      if (win) {
        win.webContents.once('did-finish-load', () => {
          win.webContents.send('app-updated', app.getVersion())
        })
      }
    }

    if (app.isPackaged) {
      try { autoUpdater.checkForUpdates() } catch (e) {
        console.log('Update check failed:', e.message)
      }
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
  return getPokedexDir()
})

// ── Installer wizard IPC ───────────────────────────────────────────────────────

// Returns info the wizard needs to bootstrap
ipcMain.handle('installer-get-info', () => {
  const stagingDir = path.dirname(app.getPath('exe'))
  const defaultInstallDir = process.env.SystemDrive
    ? path.join(process.env.SystemDrive + path.sep, 'PokeGuide')
    : 'C:\\PokeGuide'
  return {
    mode: installerMode,
    stagingDir,
    defaultInstallDir,
    version: app.getVersion(),
  }
})

// Browse for install directory
ipcMain.handle('installer-browse-dir', async () => {
  const result = await dialog.showOpenDialog(installerWin, {
    properties: ['openDirectory'],
    buttonLabel: 'Select Folder',
    title: 'Choose Install Location',
  })
  if (result.canceled || !result.filePaths.length) return null
  return result.filePaths[0]
})

// Copy files from staging → final dir, update registry, create shortcuts
ipcMain.handle('installer-do-install', async (event, { finalDir, desktop, startMenu }) => {
  const stagingDir = path.dirname(app.getPath('exe'))

  // Ensure final dir exists
  fs.mkdirSync(finalDir, { recursive: true })

  // Collect all files
  const files = collectFiles(stagingDir)
  let copied = 0

  for (const src of files) {
    const rel = path.relative(stagingDir, src)
    const dest = path.join(finalDir, rel)
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    try { fs.copyFileSync(src, dest) } catch { /* skip locked files (e.g. running exe) */ }
    copied++
    event.sender.send('installer-progress', Math.round(copied / files.length * 70))
  }

  // Update registry to point to final location (70→80%)
  event.sender.send('installer-progress', 72)
  updateInstallRegistry(finalDir)

  // Create shortcuts (80→95%)
  event.sender.send('installer-progress', 80)
  const exePath = path.join(finalDir, 'PokeGuide.exe')
  if (desktop) createDesktopShortcut(exePath)
  event.sender.send('installer-progress', 88)
  if (startMenu) createStartMenuShortcut(exePath)
  event.sender.send('installer-progress', 98)

  return { success: true }
})

// Repair mode: just create/update shortcuts for existing install
ipcMain.handle('installer-do-repair', (event, { desktop, startMenu }) => {
  const exePath = app.getPath('exe')
  if (desktop) createDesktopShortcut(exePath)
  if (startMenu) createStartMenuShortcut(exePath)
  return { success: true }
})

// Uninstall: optionally delete appdata, then run uninstaller silently
ipcMain.handle('installer-do-uninstall', async (event, { deleteData }) => {
  const installDir = path.dirname(app.getPath('exe'))
  const uninstallerPath = path.join(installDir, 'Uninstall PokeGuide.exe')

  if (deleteData) {
    const dataPath = path.join(app.getPath('appData'), 'PokeGuide')
    try { fs.rmSync(dataPath, { recursive: true, force: true }) } catch {}
  }

  if (fs.existsSync(uninstallerPath)) {
    spawn(uninstallerPath, ['/S'], { detached: true, stdio: 'ignore' }).unref()
  }
  app.quit()
})

// Launch the final installed exe and close wizard
ipcMain.handle('installer-launch-final', async (event, finalDir) => {
  const exePath = path.join(finalDir, 'PokeGuide.exe')
  if (fs.existsSync(exePath)) {
    spawn(exePath, [], { detached: true, stdio: 'ignore' }).unref()
  }
  app.quit()
})

// Launch the already-installed app (repair/done with no move needed)
ipcMain.handle('installer-finish', (event, launch) => {
  if (launch) {
    createWindow()
    if (app.isPackaged) {
      try { autoUpdater.checkForUpdates() } catch {}
    }
  }
  if (installerWin) installerWin.close()
  if (!launch) app.quit()
})

ipcMain.on('installer-close', () => {
  if (installerWin) installerWin.close()
  app.quit()
})

ipcMain.on('installer-minimize', () => {
  installerWin?.minimize()
})

ipcMain.handle('open-external', (event, url) => {
  shell.openExternal(url)
})

ipcMain.handle('open-data-folder', () => {
  shell.openPath(getUserDataDir())
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

// Preset helpers
function getPresetsDir() {
  const dir = path.join(getUserDataDir(), 'presets')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

ipcMain.handle('get-presets-dir', () => getPresetsDir())

ipcMain.handle('list-presets', () => {
  const dir = getPresetsDir()
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.pgpreset'))
    .map(f => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
        return { filename: f, name: data.name || f.replace('.pgpreset', ''), type: data.type, title: data.game?.title }
      } catch { return null }
    })
    .filter(Boolean)
})

ipcMain.handle('save-preset', (event, { name, data }) => {
  try {
    const dir = getPresetsDir()
    const safeName = name.replace(/[^a-z0-9_\-]/gi, '_')
    fs.writeFileSync(path.join(dir, `${safeName}.pgpreset`), JSON.stringify(data, null, 2))
    return { success: true }
  } catch (e) { return { success: false, error: e.message } }
})

ipcMain.handle('export-preset', async (event, { data, defaultName }) => {
  const dir = getPresetsDir()
  const result = await dialog.showSaveDialog(win, {
    defaultPath: path.join(dir, `${defaultName}.pgpreset`),
    filters: [{ name: 'PokeGuide Preset', extensions: ['pgpreset'] }],
  })
  if (result.canceled || !result.filePath) return { success: false }
  try {
    fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2))
    return { success: true }
  } catch (e) { return { success: false, error: e.message } }
})

ipcMain.handle('import-preset', async () => {
  const result = await dialog.showOpenDialog(win, {
    filters: [{ name: 'PokeGuide Preset', extensions: ['pgpreset'] }],
    properties: ['openFile'],
  })
  if (result.canceled || !result.filePaths.length) return null
  try {
    return JSON.parse(fs.readFileSync(result.filePaths[0], 'utf8'))
  } catch { return null }
})

ipcMain.handle('read-preset', (event, filename) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(getPresetsDir(), filename), 'utf8'))
  } catch { return null }
})

ipcMain.handle('delete-preset', (event, filename) => {
  try {
    fs.unlinkSync(path.join(getPresetsDir(), filename))
    return { success: true }
  } catch (e) { return { success: false, error: e.message } }
})

ipcMain.handle('write-file', (event, { filePath, content }) => {
  try {
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(filePath, content)
    return { success: true }
  } catch (e) { return { success: false, error: e.message } }
})

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
