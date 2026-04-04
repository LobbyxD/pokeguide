const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('installerAPI', {
  getSetupInfo:  ()       => ipcRenderer.invoke('installer-get-info'),
  browseDir:     ()       => ipcRenderer.invoke('installer-browse-dir'),
  doInstall:     (opts)   => ipcRenderer.invoke('installer-do-install', opts),
  doRepair:      (opts)   => ipcRenderer.invoke('installer-do-repair', opts),
  doUninstall:   (opts)   => ipcRenderer.invoke('installer-do-uninstall', opts),
  launch:        (exe)    => ipcRenderer.invoke('installer-launch', exe),
  finish:        ()       => ipcRenderer.invoke('installer-finish'),
  onProgress:    (cb)     => ipcRenderer.on('installer-progress', (_, pct) => cb(pct)),
  closeWindow:   ()       => ipcRenderer.send('installer-close'),
  minimizeWindow:()       => ipcRenderer.send('installer-minimize'),
})
