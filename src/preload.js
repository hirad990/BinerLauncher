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

// Keep the loader hub in sync with the backend without requiring a renderer rewrite.
window.addEventListener('DOMContentLoaded', () => {
  const grid = document.querySelector('.loader-grid')
  if (!grid || grid.querySelector('[data-loader="neoforge"]')) return
  const card = document.createElement('article')
  card.className = 'loader-card neoforge'
  card.innerHTML = '<div class="loader-logo">N</div><b>NEOFORGE</b><h3>NeoForge</h3><p>مدرن، سریع و مناسب مودهای نسل جدید Minecraft.</p><button class="primary loader-install" data-loader="neoforge">نصب NeoForge</button>'
  grid.appendChild(card)
})
