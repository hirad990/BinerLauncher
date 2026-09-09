require('./preload.js')
const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('binerCore', {
  instances: { list: () => ipcRenderer.invoke('biner:instances:list'), create: options => ipcRenderer.invoke('biner:instances:create', options), delete: id => ipcRenderer.invoke('biner:instances:delete', id), open: id => ipcRenderer.invoke('biner:instances:open', id) },
  mods: { list: instanceId => ipcRenderer.invoke('biner:mods:list', instanceId), search: query => ipcRenderer.invoke('biner:mods:search', query), install: options => ipcRenderer.invoke('biner:mods:install', options) },
  worlds: { list: instanceId => ipcRenderer.invoke('biner:worlds:list', instanceId), delete: options => ipcRenderer.invoke('biner:worlds:delete', options) },
  backups: { create: options => ipcRenderer.invoke('biner:backups:create', options), list: () => ipcRenderer.invoke('biner:backups:list'), restore: options => ipcRenderer.invoke('biner:backups:restore', options) },
  resources: { list: options => ipcRenderer.invoke('biner:resources:list', options) },
  storageStats: () => ipcRenderer.invoke('biner:storage:stats'), diagnostics: () => ipcRenderer.invoke('biner:diagnostics'), fileHash: file => ipcRenderer.invoke('biner:file-hash', file)
})
