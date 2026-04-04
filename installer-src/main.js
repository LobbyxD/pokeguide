'use strict'
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path  = require('path')
const fs    = require('fs')
const os    = require('os')
const { spawnSync, spawn } = require('child_process')

// ── Registry key written by electron-builder's NSIS ───────────────────────────
const UNINSTALL_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\cab503a4-4e38-568d-a337-d606e4e27110'
const UNINSTALL_KEY_PS = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\cab503a4-4e38-568d-a337-d606e4e27110'

// Auto-update silent mode: installer run with /S or --silent by electron-updater
const isSilent = process.argv.some(a => a === '/S' || a === '--silent' || a === '-s')

// ── Helpers ───────────────────────────────────────────────────────────────────
function readReg(hive, subkey, name) {
  const r = spawnSync('reg', ['query', `${hive}\\${subkey}`, '/v', name], { encoding: 'utf8' })
  if (r.status !== 0) return ''
  const m = r.stdout.match(/REG_SZ\s+(.+)/)
  return m ? m[1].trim() : ''
}

function detectExisting() {
  const keys = [
    ['HKCU', 'Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\cab503a4-4e38-568d-a337-d606e4e27110'],
    ['HKLM', 'Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\cab503a4-4e38-568d-a337-d606e4e27110'],
    ['HKLM', 'Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\cab503a4-4e38-568d-a337-d606e4e27110'],
  ]
  for (const [hive, sub] of keys) {
    const loc = readReg(hive, sub, 'InstallLocation')
    if (loc && fs.existsSync(path.join(loc, 'PokeGuide.exe'))) {
      return {
        installPath: loc,
        version:     readReg(hive, sub, 'DisplayVersion') || '',
        uninstaller: readReg(hive, sub, 'UninstallString').replace(/^"|"$/g, '') || '',
      }
    }
  }
  return null
}

function psRun(cmd) {
  spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', cmd])
}

function createShortcut(linkPath, targetPath) {
  const lp = linkPath.replace(/'/g, "''")
  const tp = targetPath.replace(/'/g, "''")
  psRun(`$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('${lp}'); $s.TargetPath = '${tp}'; $s.Save()`)
}

function updateRegistry(finalDir) {
  const uninstaller = path.join(finalDir, 'Uninstall PokeGuide.exe')
  const exePath     = path.join(finalDir, 'PokeGuide.exe')
  const esc = s => s.replace(/'/g, "''")
  psRun([
    `$k = '${UNINSTALL_KEY_PS}'`,
    `if (Test-Path $k) {`,
    `  Set-ItemProperty -Path $k -Name InstallLocation -Value '${esc(finalDir)}'`,
    `  Set-ItemProperty -Path $k -Name UninstallString -Value '"${esc(uninstaller)}"'`,
    `  Set-ItemProperty -Path $k -Name DisplayIcon -Value '${esc(exePath)}'`,
    `}`,
  ].join(' '))
}

function collectFiles(dir) {
  const out = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...collectFiles(full))
    else out.push(full)
  }
  return out
}

// bundled-app is in extraResources → process.resourcesPath/bundled-app
const BUNDLED_APP = path.join(process.resourcesPath || path.join(__dirname, '../release/win-unpacked'), 'bundled-app')

// ── Silent auto-update path ───────────────────────────────────────────────────
async function runSilentUpdate() {
  const existing = detectExisting()
  const dest = existing?.installPath || path.join(process.env.SystemDrive || 'C:', 'PokeGuide')
  const files = collectFiles(BUNDLED_APP)
  fs.mkdirSync(dest, { recursive: true })
  for (const src of files) {
    const rel  = path.relative(BUNDLED_APP, src)
    const d    = path.join(dest, rel)
    fs.mkdirSync(path.dirname(d), { recursive: true })
    try { fs.copyFileSync(src, d) } catch {}
  }
  updateRegistry(dest)
  // write .updated marker so main app shows toast
  const markerDir = path.join(app.getPath('appData'), 'PokeGuide')
  fs.mkdirSync(markerDir, { recursive: true })
  fs.writeFileSync(path.join(markerDir, '.updated'), '')
  app.quit()
}

// ── Installer window ──────────────────────────────────────────────────────────
let win = null

function createWindow() {
  const iconPath = path.join(__dirname, '../resources/icon.ico')

  win = new BrowserWindow({
    width: 520, height: 460,
    resizable: false, frame: false, center: true,
    show: false,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.once('ready-to-show', () => win.show())
  // Load the installer UI built by Vite (dist/installer.html)
  win.loadFile(path.join(__dirname, '../dist/installer.html'))
  win.on('closed', () => { win = null })
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  if (isSilent) {
    runSilentUpdate().catch(() => app.quit())
  } else {
    createWindow()
  }
})

app.on('window-all-closed', () => app.quit())

// ── IPC ───────────────────────────────────────────────────────────────────────

// Info needed by the wizard to boot
ipcMain.handle('installer-get-info', () => {
  const existing = detectExisting()
  const defaultDir = path.join((process.env.SystemDrive || 'C:') + path.sep, 'PokeGuide')
  return {
    mode:       existing ? 'existing' : 'fresh',
    existing,
    defaultDir,
    bundledApp: BUNDLED_APP,
    version:    app.getVersion(),
  }
})

// Open folder picker
ipcMain.handle('installer-browse-dir', async () => {
  const r = await dialog.showOpenDialog(win, {
    properties: ['openDirectory'],
    buttonLabel: 'Select',
    title: 'Choose Install Location',
  })
  return r.canceled ? null : r.filePaths[0]
})

// Copy bundled app → finalDir, write registry + shortcuts
ipcMain.handle('installer-do-install', async (event, { finalDir, desktop, startMenu }) => {
  fs.mkdirSync(finalDir, { recursive: true })
  const files = collectFiles(BUNDLED_APP)
  for (let i = 0; i < files.length; i++) {
    const rel  = path.relative(BUNDLED_APP, files[i])
    const dest = path.join(finalDir, rel)
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    try { fs.copyFileSync(files[i], dest) } catch {}
    event.sender.send('installer-progress', Math.round((i + 1) / files.length * 70))
  }
  event.sender.send('installer-progress', 75)
  updateRegistry(finalDir)

  const exe = path.join(finalDir, 'PokeGuide.exe')
  event.sender.send('installer-progress', 80)
  if (desktop)   createShortcut(path.join(os.homedir(), 'Desktop', 'PokeGuide.lnk'), exe)
  event.sender.send('installer-progress', 90)
  if (startMenu) {
    const smDir = path.join(process.env.APPDATA || os.homedir(), 'Microsoft', 'Windows', 'Start Menu', 'Programs')
    fs.mkdirSync(smDir, { recursive: true })
    createShortcut(path.join(smDir, 'PokeGuide.lnk'), exe)
  }
  event.sender.send('installer-progress', 100)
  return { success: true }
})

// Repair: overwrite bundled files into existing install dir
ipcMain.handle('installer-do-repair', async (event, { installPath, desktop, startMenu }) => {
  const files = collectFiles(BUNDLED_APP)
  for (let i = 0; i < files.length; i++) {
    const rel  = path.relative(BUNDLED_APP, files[i])
    const dest = path.join(installPath, rel)
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    try { fs.copyFileSync(files[i], dest) } catch {}
    event.sender.send('installer-progress', Math.round((i + 1) / files.length * 85))
  }
  const exe = path.join(installPath, 'PokeGuide.exe')
  if (desktop)   createShortcut(path.join(os.homedir(), 'Desktop', 'PokeGuide.lnk'), exe)
  if (startMenu) {
    const smDir = path.join(process.env.APPDATA || os.homedir(), 'Microsoft', 'Windows', 'Start Menu', 'Programs')
    fs.mkdirSync(smDir, { recursive: true })
    createShortcut(path.join(smDir, 'PokeGuide.lnk'), exe)
  }
  event.sender.send('installer-progress', 100)
  return { success: true }
})

// Uninstall: optionally delete appdata, run uninstaller silently
ipcMain.handle('installer-do-uninstall', async (event, { installPath, uninstaller, deleteData }) => {
  if (deleteData) {
    const data = path.join(app.getPath('appData'), 'PokeGuide')
    try { fs.rmSync(data, { recursive: true, force: true }) } catch {}
  }
  if (uninstaller && fs.existsSync(uninstaller)) {
    spawn(uninstaller, ['/S'], { detached: true, stdio: 'ignore' }).unref()
  } else {
    // Fallback: delete files manually
    try { fs.rmSync(installPath, { recursive: true, force: true }) } catch {}
    // Remove registry key
    spawnSync('reg', ['delete', UNINSTALL_KEY, '/f'])
  }
  return { success: true }
})

// Launch installed app and close installer
ipcMain.handle('installer-launch', (event, exePath) => {
  if (fs.existsSync(exePath)) {
    spawn(exePath, [], { detached: true, stdio: 'ignore' }).unref()
  }
  app.quit()
})

ipcMain.handle('installer-finish', () => { app.quit() })
ipcMain.on('installer-close',    () => app.quit())
ipcMain.on('installer-minimize', () => win?.minimize())
