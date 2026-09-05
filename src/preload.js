const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('biner', {
  appVersion: () => ipcRenderer.invoke('app:get-version'),
  openExternal: url => ipcRenderer.invoke('app:open-external', url),
  getProfile: () => ipcRenderer.invoke('profile:get'),
  saveProfile: profile => ipcRenderer.invoke('profile:save', profile),
  launchMinecraft: options => ipcRenderer.invoke('minecraft:launch', options),
  minecraftStatus: () => ipcRenderer.invoke('minecraft:status'),
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close')
  }
})
