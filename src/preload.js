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
  setZoom: value => ipcRenderer.invoke('ui:set-zoom', value),
  getZoom: () => ipcRenderer.invoke('ui:get-zoom'),
  onProgress: callback => ipcRenderer.on('launcher:progress', (_, data) => callback(data)),
  onLog: callback => ipcRenderer.on('launcher:log', (_, data) => callback(data)),
  onCrash: callback => ipcRenderer.on('launcher:crash', (_, data) => callback(data)),
  window: { minimize: () => ipcRenderer.send('window:minimize'), maximize: () => ipcRenderer.send('window:maximize'), close: () => ipcRenderer.send('window:close') }
})

window.addEventListener('DOMContentLoaded', () => {
  const grid = document.querySelector('.loader-grid')
  if (grid && !grid.querySelector('[data-loader="neoforge"]')) {
    const card = document.createElement('article')
    card.className = 'loader-card neoforge'
    card.innerHTML = '<div class="loader-logo">N</div><b>NEOFORGE</b><h3>NeoForge</h3><p>مدرن، سریع و مناسب مودهای نسل جدید Minecraft.</p><button class="primary loader-install" data-loader="neoforge">نصب NeoForge</button>'
    grid.appendChild(card)
  }

  const icons = {
    '🧩': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3h3v3h2V3h3a2 2 0 0 1 2 2v3h3v3h-3v2h3v3h-3v3a2 2 0 0 1-2 2h-3v-3H9v3H6a2 2 0 0 1-2-2v-3H1v-3h3V9H1V6h3V5a2 2 0 0 1 2-2h2v3h0V3Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
    '⚙': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Zm8.2 3.8c0-.5-.1-1-.2-1.5l2-1.5-2-3.4-2.3 1a8.4 8.4 0 0 0-2.6-1.5L14.8 3h-4l-.3 2.1a8.4 8.4 0 0 0-2.6 1.5l-2.3-1-2 3.4 2 3.4 2.3-1a8.4 8.4 0 0 0 2.6 1.5l.3 2.1h4l.3-2.1a8.4 8.4 0 0 0 2.6-1.5l2.3 1 2-3.4-2-1.5c.1-.5.2-1 .2-1.5Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
    '📁': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.5A2.5 2.5 0 0 1 5.5 4H10l2 2h6.5A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-10Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
    '🛠': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6.5 3-3 3 3-3 3m-2-2-8.8 8.8a2.1 2.1 0 0 0 0 3l.1.1a2.1 2.1 0 0 0 3 0L18 10.5M5 5l3.5 3.5M4 20l3-3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    '☕': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h12v6a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5V8Zm12 2h1.5a2.5 2.5 0 0 1 0 5H17M8 4c0 1 1 1 1 2M12 4c0 1 1 1 1 2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    '♻': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 4 3 3-3 3M5 10a7 7 0 0 1 12-4l1 1M16 20l-3-3 3-3M19 14a7 7 0 0 1-12 4l-1-1" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  }

  const style = document.createElement('style')
  style.textContent = '.biner-svg-icon{display:inline-flex;width:16px;height:16px;flex:0 0 16px;align-items:center;justify-content:center;vertical-align:middle}.biner-svg-icon svg{display:block;width:16px;height:16px}.dev-card .biner-svg-icon{width:18px;height:18px;flex-basis:18px}.dev-card .biner-svg-icon svg{width:18px;height:18px}.nav-item .biner-svg-icon{width:17px;height:17px;flex-basis:17px}.nav-item .biner-svg-icon svg{width:17px;height:17px}'
  document.head.appendChild(style)

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const nodes = []
  while (walker.nextNode()) nodes.push(walker.currentNode)
  for (const node of nodes) {
    if (!node.nodeValue || !Object.keys(icons).some(key => node.nodeValue.includes(key))) continue
    const parent = node.parentElement
    if (!parent || parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE') continue
    let html = node.nodeValue.replace(/[🧩⚙📁🛠☕♻]/gu, match => `@@BINER_ICON_${encodeURIComponent(match)}@@`)
    html = html.replace(/@@BINER_ICON_([^@]+)@@/g, (_, encoded) => `<span class="biner-svg-icon">${icons[decodeURIComponent(encoded)]}</span>`)
    const holder = document.createElement('span')
    holder.innerHTML = html
    node.replaceWith(...holder.childNodes)
  }

  const launcherPanel = document.querySelector('.setting-panel[data-panel="launcher"]')
  if (launcherPanel && !document.querySelector('#guiScaleControl')) {
    const control = document.createElement('div')
    control.id = 'guiScaleControl'
    control.className = 'gui-scale-control'
    control.innerHTML = `
      <style>
        #guiScaleControl{margin-top:18px;padding:18px 20px;border:1px solid #ffffff12;border-radius:17px;background:linear-gradient(145deg,#ffffff07,#ffffff02);box-shadow:0 16px 45px #0005}
        #guiScaleControl .gui-scale-head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:15px}
        #guiScaleControl .gui-scale-head div{display:grid;gap:4px}
        #guiScaleControl .gui-scale-head b{font-size:10px;letter-spacing:2px;color:#dce7f7}
        #guiScaleControl .gui-scale-head small{font-size:8px;color:#687991}
        #guiScaleControl .gui-scale-head>strong{min-width:58px;text-align:center;padding:7px 9px;border-radius:9px;background:#32c9ff10;border:1px solid #32c9ff22;color:#68d4ff;font-size:12px}
        #guiScaleControl .gui-scale-slider-row{display:grid;grid-template-columns:36px 1fr 42px;align-items:center;gap:10px;color:#63738b;font-size:8px}
        #guiScaleControl input[type=range]{width:100%;accent-color:#6b72ff;cursor:pointer}
        #guiScaleControl .gui-scale-presets{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-top:13px}
        #guiScaleControl .gui-scale-presets button{border:1px solid #ffffff10;border-radius:8px;background:#ffffff04;color:#73839a;padding:7px 4px;font-size:8px;cursor:pointer;transition:.2s}
        #guiScaleControl .gui-scale-presets button:hover{background:#ffffff0a;color:#fff}
        #guiScaleControl .gui-scale-presets button.active{background:#32c9ff12;border-color:#32c9ff35;color:#7adfff;box-shadow:inset 0 0 0 1px #32c9ff08}
        #guiScaleControl .gui-scale-hint{margin:12px 0 0;color:#596a82;font-size:8px;line-height:1.8}
      </style>
      <div class="gui-scale-head"><div><b>GUI SCALE</b><small>اندازه رابط کاربری لانچر</small></div><strong id="guiScaleValue">100%</strong></div>
      <div class="gui-scale-slider-row"><span>70%</span><input id="guiScaleInput" type="range" min="70" max="140" step="5" value="100"><span>140%</span></div>
      <div class="gui-scale-presets"><button type="button" data-scale="80">80%</button><button type="button" data-scale="90">90%</button><button type="button" data-scale="100" class="active">100%</button><button type="button" data-scale="110">110%</button><button type="button" data-scale="120">120%</button><button type="button" data-scale="130">130%</button></div>
      <p class="gui-scale-hint">برای صفحه‌های کوچک‌تر مقدار پایین‌تر و برای نمایشگرهای بزرگ مقدار بالاتر را انتخاب کن.</p>`
    launcherPanel.appendChild(control)
    const input = control.querySelector('#guiScaleInput')
    const value = control.querySelector('#guiScaleValue')
    const presets = [...control.querySelectorAll('[data-scale]')]
    const apply = async percent => {
      const safe = Math.max(70, Math.min(140, Number(percent) || 100))
      input.value = safe
      value.textContent = `${safe}%`
      presets.forEach(b => b.classList.toggle('active', Number(b.dataset.scale) === safe))
      await ipcRenderer.invoke('ui:set-zoom', safe / 100)
    }
    ipcRenderer.invoke('ui:get-zoom').then(z => apply(Math.round((Number(z) || 1) * 100)))
    input.addEventListener('input', () => apply(input.value))
    presets.forEach(b => b.addEventListener('click', () => apply(b.dataset.scale)))
  }
})

const fastModeObserver = new MutationObserver(() => {
  const row = [...document.querySelectorAll('.toggle-row')].find(x => x.textContent.includes('Fast Launch'))
  if (!row || document.querySelector('#fastModeInput')) return
  const status = row.querySelector('.enabled')
  if (status) { status.id = 'fastModeStatus' }
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.id = 'fastModeInput'
  input.style.cssText = 'width:18px;height:18px;cursor:pointer;accent-color:#7c5cff;margin-inline-start:12px;'
  row.appendChild(input)
  ipcRenderer.invoke('profile:get').then(profile => { input.checked = profile?.fastMode !== false; if (status) status.textContent = input.checked ? 'ON' : 'OFF' })
  input.addEventListener('change', async () => {
    const profile = await ipcRenderer.invoke('profile:get') || {}
    profile.fastMode = input.checked
    await ipcRenderer.invoke('profile:save', profile)
    if (status) status.textContent = input.checked ? 'ON' : 'OFF'
  })
})
fastModeObserver.observe(document.documentElement, { childList: true, subtree: true })
