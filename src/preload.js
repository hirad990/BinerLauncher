const { contextBridge, ipcRenderer } = require('electron')
const path = require('path')
const { pathToFileURL } = require('url')

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args)
const listen = (channel, callback) => {
  if (typeof callback !== 'function') return () => {}
  const handler = (_event, data) => callback(data)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

contextBridge.exposeInMainWorld('biner', {
  appVersion: () => invoke('app:get-version'),
  openExternal: url => invoke('app:open-external', url),
  openFolder: target => invoke('app:open-folder', target),
  toggleDevTools: open => invoke('app:toggle-devtools', open),
  clearCache: () => invoke('app:clear-cache'),
  getProfile: () => invoke('profile:get'),
  saveProfile: profile => invoke('profile:save', profile),
  getVersions: snapshots => invoke('minecraft:versions', snapshots),
  installLoader: options => invoke('minecraft:install-loader', options),
  importOptifine: () => invoke('minecraft:import-optifine'),
  folders: () => invoke('minecraft:folders'),
  launchMinecraft: options => invoke('minecraft:launch', options),
  smartPlay: options => invoke('biner:smart-play', options),
  minecraftStatus: () => invoke('minecraft:status'),
  serverStatus: options => invoke('server:status', options),
  checkForUpdates: () => invoke('app:check-updates'),
  getCrashReports: () => invoke('app:crash-reports'),
  openCrashReports: () => invoke('app:open-crash-reports'),
  analyzeCrash: input => invoke('biner:crash:analyze', input),
  repairScan: () => invoke('biner:repair:scan'),
  repairFix: () => invoke('biner:repair:fix'),
  compatibleLoaders: version => invoke('biner:loaders:compatible', version),
  fastPresets: options => invoke('biner:fast-mode:presets', options),
  downloadStart: options => invoke('biner:download:start', options),
  downloadCancel: id => invoke('biner:download:cancel', id),
  activeDownloads: () => invoke('biner:download:active'),
  accounts: {
    list: () => invoke('biner:accounts:list'),
    addLocal: username => invoke('biner:accounts:add-local', username),
    activate: id => invoke('biner:accounts:activate', id),
    delete: id => invoke('biner:accounts:delete', id)
  },
  setZoom: value => invoke('ui:set-zoom', value),
  getZoom: () => invoke('ui:get-zoom'),
  onProgress: callback => listen('launcher:progress', callback),
  onLog: callback => listen('launcher:log', callback),
  onCrash: callback => listen('launcher:crash', callback),
  onSmartStep: callback => listen('smart-play:step', callback),
  onDownloadProgress: callback => listen('download:progress', callback),
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close')
  }
})

contextBridge.exposeInMainWorld('binerCore', {
  instances: {
    list: () => invoke('biner:instances:list'),
    create: options => invoke('biner:instances:create', options),
    delete: id => invoke('biner:instances:delete', id),
    open: id => invoke('biner:instances:open', id)
  },
  mods: {
    list: id => invoke('biner:mods:list', id),
    search: query => invoke('biner:mods:search', query),
    install: options => invoke('biner:mods:install', options)
  },
  worlds: {
    list: id => invoke('biner:worlds:list', id),
    delete: options => invoke('biner:worlds:delete', options)
  },
  backups: {
    create: options => invoke('biner:backups:create', options),
    list: () => invoke('biner:backups:list'),
    restore: options => invoke('biner:backups:restore', options)
  },
  resources: { list: options => invoke('biner:resources:list', options) },
  storageStats: () => invoke('biner:storage:stats'),
  diagnostics: () => invoke('biner:diagnostics'),
  fileHash: file => invoke('biner:file-hash', file)
})

window.addEventListener('DOMContentLoaded', () => {
  try {
    const cssPath = require.resolve('@fortawesome/fontawesome-free/css/all.min.css')
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = pathToFileURL(cssPath).href
    document.head.appendChild(link)
  } catch (error) {
    console.warn('[BinerLauncher] Font Awesome unavailable:', error)
  }
})
