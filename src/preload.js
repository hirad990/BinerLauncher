const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('biner', {
  appVersion: () => ipcRenderer.invoke('app:get-version'),
  openExternal: url => ipcRenderer.invoke('app:open-external', url),
  openFolder: target => ipcRenderer.invoke('app:open-folder', target),
  toggleDevTools: open => ipcRenderer.invoke('app:toggle-devtools', open),
  clearCache: () => ipcRenderer.invoke('app:clear-cache'),
  getProfile: () => ipcRenderer.invoke('profile:get'),
  saveProfile: profile => ipcRenderer.invoke('profile:save', profile),
  getVersions: snapshots => ipcRenderer.invoke('minecraft:versions', snapshots),
  installLoader: options => ipcRenderer.invoke('minecraft:install-loader', options),
  importOptifine: () => ipcRenderer.invoke('minecraft:import-optifine'),
  folders: () => ipcRenderer.invoke('minecraft:folders'),
  launchMinecraft: options => ipcRenderer.invoke('minecraft:launch', options),
  minecraftStatus: () => ipcRenderer.invoke('minecraft:status'),
  serverStatus: options => ipcRenderer.invoke('server:status', options),
  checkForUpdates: () => ipcRenderer.invoke('app:check-updates'),
  getCrashReports: () => ipcRenderer.invoke('app:crash-reports'),
  openCrashReports: () => ipcRenderer.invoke('app:open-crash-reports'),
  onProgress: callback => ipcRenderer.on('launcher:progress', (_, data) => callback(data)),
  onLog: callback => ipcRenderer.on('launcher:log', (_, data) => callback(data)),
  onCrash: callback => ipcRenderer.on('launcher:crash', (_, data) => callback(data)),
  window: { minimize: () => ipcRenderer.send('window:minimize'), maximize: () => ipcRenderer.send('window:maximize'), close: () => ipcRenderer.send('window:close') }
})
