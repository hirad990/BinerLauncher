const { contextBridge, ipcRenderer } = require('electron')

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args)

contextBridge.exposeInMainWorld('biner', {
  appVersion: () => invoke('app:get-version'), openExternal: url => invoke('app:open-external', url), openFolder: target => invoke('app:open-folder', target),
  toggleDevTools: open => invoke('app:toggle-devtools', open), clearCache: () => invoke('app:clear-cache'), getProfile: () => invoke('profile:get'), saveProfile: profile => invoke('profile:save', profile),
  getVersions: snapshots => invoke('minecraft:versions', snapshots), installLoader: options => invoke('minecraft:install-loader', options), importOptifine: () => invoke('minecraft:import-optifine'), folders: () => invoke('minecraft:folders'),
  launchMinecraft: options => invoke('minecraft:launch', options), minecraftStatus: () => invoke('minecraft:status'), serverStatus: options => invoke('server:status', options), checkForUpdates: () => invoke('app:check-updates'),
  getCrashReports: () => invoke('app:crash-reports'), openCrashReports: () => invoke('app:open-crash-reports'), setZoom: value => invoke('ui:set-zoom', value), getZoom: () => invoke('ui:get-zoom'),
  onProgress: callback => ipcRenderer.on('launcher:progress', (_, data) => callback(data)), onLog: callback => ipcRenderer.on('launcher:log', (_, data) => callback(data)), onCrash: callback => ipcRenderer.on('launcher:crash', (_, data) => callback(data)),
  window: { minimize: () => ipcRenderer.send('window:minimize'), maximize: () => ipcRenderer.send('window:maximize'), close: () => ipcRenderer.send('window:close') }
})

contextBridge.exposeInMainWorld('binerCore', {
  instances: { list: () => invoke('biner:instances:list'), create: options => invoke('biner:instances:create', options), delete: id => invoke('biner:instances:delete', id), open: id => invoke('biner:instances:open', id) },
  mods: { list: instanceId => invoke('biner:mods:list', instanceId), search: query => invoke('biner:mods:search', query), install: options => invoke('biner:mods:install', options) },
  worlds: { list: instanceId => invoke('biner:worlds:list', instanceId), delete: options => invoke('biner:worlds:delete', options) },
  backups: { create: options => invoke('biner:backups:create', options), list: () => invoke('biner:backups:list'), restore: options => invoke('biner:backups:restore', options) },
  resources: { list: options => invoke('biner:resources:list', options) }, storageStats: () => invoke('biner:storage:stats'), diagnostics: () => invoke('biner:diagnostics'), fileHash: file => invoke('biner:file-hash', file)
})

window.addEventListener('DOMContentLoaded', () => {
  const grid = document.querySelector('.loader-grid')
  if (grid && !grid.querySelector('[data-loader="neoforge"]')) {
    const card = document.createElement('article')
    card.className = 'loader-card neoforge'
    card.innerHTML = '<div class="loader-logo">N</div><b>NEOFORGE</b><h3>NeoForge</h3><p>مدرن، سریع و مناسب مودهای نسل جدید Minecraft.</p><button class="primary loader-install" data-loader="neoforge">نصب NeoForge</button>'
    grid.appendChild(card)
  }

  const launcherPanel = document.querySelector('.setting-panel[data-panel="launcher"]')
  if (launcherPanel && !document.querySelector('#guiScaleControl')) {
    const control = document.createElement('div'); control.id = 'guiScaleControl'; control.style.cssText = 'margin-top:18px;padding:18px 20px;border:1px solid #ffffff12;border-radius:17px;background:#ffffff04'
    control.innerHTML = '<b>GUI SCALE</b><div style="display:flex;gap:12px;align-items:center;margin-top:12px"><span>70%</span><input id="guiScaleInput" type="range" min="70" max="140" step="5" value="100" style="flex:1"><span>140%</span></div><strong id="guiScaleValue" style="display:block;margin-top:8px">100%</strong>'
    launcherPanel.appendChild(control)
    const input = control.querySelector('#guiScaleInput'); const value = control.querySelector('#guiScaleValue')
    const apply = async percent => { const safe = Math.max(70, Math.min(140, Number(percent) || 100)); input.value = safe; value.textContent = `${safe}%`; await invoke('ui:set-zoom', safe / 100) }
    invoke('ui:get-zoom').then(z => apply(Math.round((Number(z) || 1) * 100))); input.addEventListener('input', () => apply(input.value))
  }

  const fastModeObserver = new MutationObserver(() => {
    const row = [...document.querySelectorAll('.toggle-row')].find(x => x.textContent.includes('Fast Launch'))
    if (!row || row.querySelector('#fastModeInput')) return
    const input = document.createElement('input'); input.type = 'checkbox'; input.id = 'fastModeInput'; input.style.cssText = 'width:18px;height:18px;cursor:pointer;accent-color:#7c5cff;margin-inline-start:12px;'
    row.appendChild(input)
    invoke('profile:get').then(profile => { input.checked = profile?.fastMode !== false })
    input.addEventListener('change', async () => { const profile = await invoke('profile:get') || {}; profile.fastMode = input.checked; await invoke('profile:save', profile) })
  })
  fastModeObserver.observe(document.documentElement, { childList: true, subtree: true })
})
