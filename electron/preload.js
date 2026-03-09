const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),

  getPokemonDataDir: () => ipcRenderer.invoke('get-pokemon-data-dir'),

  generatePokemon: (opts) => ipcRenderer.invoke('generate-pokemon', opts),
  readPokemonFile: (dir, filename) => ipcRenderer.invoke('read-pokemon-file', dir, filename),
  deletePokemonFile: (dir, filename) => ipcRenderer.invoke('delete-pokemon-file', dir, filename),

  onPokemonProgress: (cb) => {
    ipcRenderer.on('pokemon-progress', (event, data) => cb(data))
    return () => ipcRenderer.removeAllListeners('pokemon-progress')
  },

  onUpdateAvailable: (cb) => {
    ipcRenderer.on('update-available', (event, info) => cb(info))
  },
  onUpdateNotAvailable: (cb) => {
    ipcRenderer.on('update-not-available', () => cb())
  },
  onUpdateProgress: (cb) => {
    ipcRenderer.on('update-progress', (event, progress) => cb(progress))
  },
  onMaximizedState: (cb) => {
    ipcRenderer.on('window-maximized-state', (event, state) => cb(state))
  },

  startUpdate: () => ipcRenderer.send('start-update'),
  restartApp: () => ipcRenderer.send('restart-app'),
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),
  getPendingUpdate: () => ipcRenderer.invoke('get-pending-update'),

  generateAiText: (prompt) => ipcRenderer.invoke('generate-ai-text', prompt),

  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  openDataFolder: () => ipcRenderer.invoke('open-data-folder'),
  openPath: (p) => ipcRenderer.invoke('open-path', p),

  getPresetsDir: () => ipcRenderer.invoke('get-presets-dir'),
  listPresets: () => ipcRenderer.invoke('list-presets'),
  savePreset: (name, data) => ipcRenderer.invoke('save-preset', { name, data }),
  exportPreset: (data, defaultName) => ipcRenderer.invoke('export-preset', { data, defaultName }),
  importPreset: () => ipcRenderer.invoke('import-preset'),
  readPreset: (filename) => ipcRenderer.invoke('read-preset', filename),
  deletePreset: (filename) => ipcRenderer.invoke('delete-preset', filename),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', { filePath, content }),
})
