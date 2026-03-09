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

  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  openDataFolder: () => ipcRenderer.invoke('open-data-folder'),
  openPath: (p) => ipcRenderer.invoke('open-path', p),
})
