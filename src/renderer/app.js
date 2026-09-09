(() => {
  'use strict'

  const $ = selector => document.querySelector(selector)
  const $$ = selector => [...document.querySelectorAll(selector)]
  const text = (selector, value) => { const el = $(selector); if (el) el.textContent = String(value ?? '') }
  const on = (selector, event, handler) => { const el = $(selector); if (el) el.addEventListener(event, handler) }
  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c])

  const defaults = {
    username: '', version: '1.21.11', memory: 4096, loader: 'vanilla', profileId: '',
    serverHost: 'Play.BinerCraft.ir', serverPort: 25565, width: 1280, height: 720,
    fullscreen: false, snapshots: false, developerMode: false, fastMode: true,
    customArgs: [], language: 'fa'
  }
  let state = { ...defaults }
  let versionFilter = 'release'

  function toast(message) {
    const el = $('#toast')
    if (!el) return
    el.textContent = String(message)
    el.classList.add('show')
    clearTimeout(window.__binerToastTimer)
    window.__binerToastTimer = setTimeout(() => el.classList.remove('show'), 3000)
  }

  function setSection(id) {
    $$('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.section === id))
    $$('.section').forEach(section => section.classList.toggle('hidden-section', section.id !== id))
    if (id === 'versions') loadVersions()
    if (id === 'instances') loadInstances()
    if (id === 'modloaders') updateLoaderStatus()
  }

  async function saveProfile() {
    const saved = await window.biner.saveProfile({ ...state })
    state = { ...state, ...saved }
    text('#saveState', 'SAVED')
    return saved
  }

  function render() {
    const name = state.username || (state.language === 'en' ? 'Guest Player' : 'بازیکن مهمان')
    text('#username', name)
    text('#avatar', name.charAt(0).toUpperCase() || 'G')
    text('#accountStatus', state.username ? (state.language === 'en' ? 'Local account • Ready' : 'حساب محلی • آماده اجرا') : (state.language === 'en' ? 'Local account • Not signed in' : 'حساب محلی • وارد نشده'))
    const values = {
      '#nameInput': state.username, '#localNameInput': state.username, '#memoryInput': state.memory,
      '#memorySlider': state.memory, '#serverInput': state.serverHost, '#portInput': state.serverPort,
      '#widthInput': state.width, '#heightInput': state.height, '#jvmArgs': (state.customArgs || []).join(' ')
    }
    Object.entries(values).forEach(([selector, value]) => { const el = $(selector); if (el) el.value = value })
    const checks = { '#fullscreenInput': state.fullscreen, '#snapshots': state.snapshots, '#developerToggle': state.developerMode, '#fastModeInput': state.fastMode !== false }
    Object.entries(checks).forEach(([selector, value]) => { const el = $(selector); if (el) el.checked = Boolean(value) })
    text('#ramValue', `${state.memory} MB`)
    text('#memoryLabel', `${state.memory} MB`)
    text('#selectedVersionLabel', state.version)
    text('#selectedLoaderLabel', String(state.loader).toUpperCase())
    text('#homeVersion', state.version)
    text('#settingsVersion', state.version)
    text('#settingsLoader', String(state.loader).toUpperCase())
    text('#settingsJava', 'Auto Runtime')
    text('#sideJava', 'AUTO')
    text('#previewTitle', `${state.version} • ${state.loader === 'vanilla' ? 'Vanilla' : state.loader}`)
    text('#playVersion', `${state.version} • ${state.loader === 'vanilla' ? 'Vanilla' : state.loader}`)
    const fastStatus = $('#fastModeStatus'); if (fastStatus) fastStatus.textContent = state.fastMode === false ? 'OFF' : 'ON'
    updateLoaderStatus()
  }

  function showProgress(data = {}) {
    const overlay = $('#progressOverlay')
    if (!overlay) return
    overlay.classList.remove('hidden')
    const percent = Math.max(0, Math.min(100, Number(data.progress) || 0))
    text('#progressStage', String(data.stage || 'PREPARING').toUpperCase())
    text('#progressPercent', `${percent}%`)
    const bar = $('#progressBar'); if (bar) bar.style.width = `${percent}%`
    text('#progressMessage', data.message || (state.language === 'en' ? 'Preparing...' : 'در حال آماده‌سازی...'))
    text('#progressCurrent', data.current || 'BinerLauncher')
    text('#progressBytes', data.received && data.total ? `${(data.received / 1048576).toFixed(1)} / ${(data.total / 1048576).toFixed(1)} MB` : '—')
    if (data.stage === 'launched' || data.stage === 'closed') setTimeout(() => overlay.classList.add('hidden'), 1200)
  }

  async function launch() {
    if (!state.username) {
      $('#accountModal')?.classList.remove('hidden')
      $('#localNameInput')?.focus()
      return
    }
    const play = $('#playBtn'), preview = $('#previewPlay')
    if (play) play.disabled = true
    if (preview) preview.disabled = true
    try {
      await saveProfile()
      await window.biner.launchMinecraft({ ...state, fastMode: state.fastMode !== false })
    } catch (error) {
      toast(`${state.language === 'en' ? 'Error' : 'خطا'}: ${error?.message || error}`)
    } finally {
      if (play) play.disabled = false
      if (preview) preview.disabled = false
    }
  }

  async function loginLocal() {
    const input = $('#localNameInput')
    const username = String(input?.value || '').trim()
    if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) {
      toast(state.language === 'en' ? 'Username must be 3–16 characters.' : 'نام کاربری باید ۳ تا ۱۶ کاراکتر باشد.')
      return
    }
    try {
      const account = await window.biner.accounts.addLocal(username)
      state.username = account.username
      await saveProfile()
      $('#accountModal')?.classList.add('hidden')
      render()
      toast(state.language === 'en' ? 'Local account added.' : 'حساب محلی اضافه شد.')
    } catch (error) { toast(error?.message || String(error)) }
  }

  async function loadVersions() {
    const box = $('#versionList')
    if (!box) return
    box.innerHTML = `<div class="loading">${state.language === 'en' ? 'Loading Minecraft versions...' : 'در حال دریافت نسخه‌های Minecraft...'}</div>`
    try {
      const list = await window.biner.getVersions(Boolean(state.snapshots))
      const filtered = list.filter(v => versionFilter === 'all' || v.type === 'release')
      text('#versionCount', filtered.length)
      text('#featuredTitle', filtered[0]?.id || state.version)
      box.innerHTML = filtered.map(v => `<button class="version-item ${v.id === state.version ? 'selected' : ''}" data-version="${safe(v.id)}"><b>${safe(v.id)}</b><small>${safe(String(v.type).toUpperCase())} • ${new Date(v.releaseTime).toLocaleDateString(state.language === 'en' ? 'en-US' : 'fa-IR')}</small>${v.id === state.version ? '<span class="badge">SELECTED</span>' : ''}</button>`).join('') || `<div class="loading">${state.language === 'en' ? 'No versions found.' : 'نسخه‌ای پیدا نشد.'}</div>`
      $$('.version-item').forEach(button => button.addEventListener('click', () => selectVersion(button.dataset.version)))
    } catch (error) {
      box.innerHTML = `<div class="loading">${state.language === 'en' ? 'Version service unavailable:' : 'دریافت نسخه‌ها ناموفق بود:'} ${safe(error?.message || error)}</div>`
    }
  }

  async function selectVersion(version) {
    state.version = version
    state.loader = 'vanilla'
    state.profileId = ''
    await saveProfile()
    render()
    await loadVersions()
    toast(state.language === 'en' ? `Minecraft ${version} selected.` : `Minecraft ${version} انتخاب شد.`)
  }

  async function installLoader(loader) {
    try {
      toast(state.language === 'en' ? `Installing ${loader}...` : `در حال نصب ${loader}...`)
      const result = await window.biner.installLoader({ loader, version: state.version })
      state.loader = loader
      state.profileId = result?.profileId || ''
      await saveProfile()
      render()
      toast(state.language === 'en' ? `${loader} installed successfully.` : `${loader} با موفقیت نصب شد.`)
    } catch (error) { toast(`${state.language === 'en' ? 'Error' : 'خطا'}: ${error?.message || error}`) }
  }

  async function loadInstances() {
    const box = $('#instanceGrid')
    if (!box || !window.binerCore?.instances) return
    try {
      const instances = await window.binerCore.instances.list()
      if (!instances.length) {
        box.innerHTML = `<div class="instance-card"><div class="instance-top"><div class="instance-icon">B</div><small>DEFAULT</small></div><h3>BinerCraft Main</h3><p>${state.language === 'en' ? 'Main launcher profile.' : 'پروفایل اصلی لانچر.'}</p><button class="primary" id="defaultInstance">${state.language === 'en' ? 'Use Main Profile' : 'استفاده از پروفایل اصلی'}</button></div>`
        $('#defaultInstance')?.addEventListener('click', launch)
        return
      }
      box.innerHTML = instances.map((item, index) => `<article class="instance-card"><div class="instance-top"><div class="instance-icon">${safe((item.name || item.id || 'B').charAt(0).toUpperCase())}</div><small>INSTANCE ${index + 1}</small></div><h3>${safe(item.name || item.id)}</h3><p>${safe(item.version || 'Unknown')} • ${safe(item.loader || 'vanilla')}</p><button class="primary" data-instance-launch="${safe(item.id)}">${state.language === 'en' ? 'Launch Profile' : 'اجرای پروفایل'}</button></article>`).join('')
      $$('[data-instance-launch]').forEach(button => button.addEventListener('click', async () => {
        const item = instances.find(x => x.id === button.dataset.instanceLaunch)
        if (!item) return
        state = { ...state, version: item.version || state.version, loader: item.loader || 'vanilla', memory: item.memory || state.memory }
        render(); await launch()
      }))
    } catch (error) { box.innerHTML = `<div class="loading">${safe(error?.message || error)}</div>` }
  }

  function updateLoaderStatus() {
    text('#installedLoaders', `${state.language === 'en' ? 'Active profile' : 'پروفایل فعال'}: ${String(state.loader).toUpperCase()} • ${state.version}`)
  }

  async function saveSettings() {
    state = {
      ...state,
      username: String($('#nameInput')?.value || '').trim(),
      memory: Number($('#memoryInput')?.value || state.memory),
      serverHost: String($('#serverInput')?.value || '').trim() || 'Play.BinerCraft.ir',
      serverPort: Number($('#portInput')?.value || 25565),
      width: Number($('#widthInput')?.value || 1280), height: Number($('#heightInput')?.value || 720),
      fullscreen: Boolean($('#fullscreenInput')?.checked), developerMode: Boolean($('#developerToggle')?.checked),
      fastMode: $('#fastModeInput') ? Boolean($('#fastModeInput').checked) : state.fastMode,
      customArgs: String($('#jvmArgs')?.value || '').split(/\s+/).filter(Boolean)
    }
    await saveProfile(); render(); toast(state.language === 'en' ? 'Settings saved.' : 'تنظیمات ذخیره شد.')
  }

  async function refreshServer() {
    try {
      const result = await window.biner.serverStatus({ host: state.serverHost, port: state.serverPort })
      text('#homePing', result.online ? `${result.ping}ms` : 'OFFLINE')
      text('#homePlayers', result.online ? 'ONLINE' : 'OFFLINE')
      text('#topServerStatus', result.online ? 'ONLINE' : 'OFFLINE')
      return result
    } catch { return null }
  }

  function bindEvents() {
    $$('.nav-item').forEach(item => item.addEventListener('click', () => setSection(item.dataset.section)))
    on('#versionQuick', 'click', () => setSection('versions'))
    on('#playBtn', 'click', launch); on('#previewPlay', 'click', launch)
    on('#storeBtn', 'click', () => window.biner.openExternal('https://binercraft.ir'))
    on('#accountBtn', 'click', () => $('#accountModal')?.classList.remove('hidden'))
    on('#accountClose', 'click', () => $('#accountModal')?.classList.add('hidden'))
    on('#localLogin', 'click', loginLocal)
    on('#saveSettings', 'click', saveSettings)
    on('#refreshVersions', 'click', loadVersions)
    on('#featuredSelect', 'click', () => selectVersion($('#featuredTitle')?.textContent || state.version))
    on('#openGameFolder', 'click', async () => window.biner.openFolder((await window.biner.folders()).root))
    on('#gameFolderBtn', 'click', async () => window.biner.openFolder((await window.biner.folders()).root))
    on('#runtimeFolderBtn', 'click', async () => window.biner.openFolder((await window.biner.folders()).runtime))
    on('#clearCacheBtn', 'click', async () => toast(await window.biner.clearCache() ? 'Cache cleared.' : 'Cache cleanup failed.'))
    on('#devtoolsBtn', 'click', () => window.biner.toggleDevTools(true))
    on('#logsBtn', 'click', () => $('#consoleBox')?.scrollIntoView({ behavior: 'smooth' }))
    on('#exportLogsBtn', 'click', async () => { try { await navigator.clipboard.writeText($('#consoleBox')?.textContent || ''); toast('Logs copied.') } catch { toast('Clipboard unavailable.') } })
    on('#checkUpdates', 'click', async () => { const result = await window.biner.checkForUpdates(); if (result.update && result.url) { toast(`New version ${result.version} found.`); window.biner.openExternal(result.url) } else toast(result.error || 'You have the latest version.') })
    on('#newsRefresh', 'click', async () => { const result = await refreshServer(); toast(result?.online ? `BinerCraft Online • ${result.ping}ms` : 'Server unavailable.') })
    on('#newsServer', 'click', () => setSection('home'))
    on('#snapshots', 'change', async event => { state.snapshots = event.target.checked; await saveProfile(); loadVersions() })
    on('#versionSearch', 'input', event => $$('.version-item').forEach(item => { item.hidden = !item.dataset.version.toLowerCase().includes(event.target.value.toLowerCase()) }))
    $$('.filter').forEach(button => button.addEventListener('click', () => { $$('.filter').forEach(x => x.classList.remove('active')); button.classList.add('active'); versionFilter = button.dataset.filter; loadVersions() }))
    $$('.loader-install').forEach(button => button.addEventListener('click', () => installLoader(button.dataset.loader)))
    on('#optifineImport', 'click', async () => { try { const result = await window.biner.importOptifine(); if (result) { state.loader = 'optifine'; state.profileId = ''; await saveProfile(); render(); toast('OptiFine imported.') } } catch (error) { toast(error?.message || String(error)) } })
    $$('.setting-tab').forEach(button => button.addEventListener('click', () => { $$('.setting-tab').forEach(x => x.classList.remove('active')); $$('.setting-panel').forEach(x => x.classList.remove('active')); button.classList.add('active'); $(`.setting-panel[data-panel="${button.dataset.tab}"]`)?.classList.add('active') }))
    on('#memorySlider', 'input', event => { const value = Number(event.target.value); if ($('#memoryInput')) $('#memoryInput').value = value; state.memory = value; text('#ramValue', `${value} MB`) })
    on('#memoryInput', 'change', event => { const value = Number(event.target.value); state.memory = value; if ($('#memorySlider')) $('#memorySlider').value = value; text('#ramValue', `${value} MB`) })
    on('#resolutionPreset', 'change', event => { if (event.target.value !== 'custom') { const [w, h] = event.target.value.split('x').map(Number); if ($('#widthInput')) $('#widthInput').value = w; if ($('#heightInput')) $('#heightInput').value = h } })
    on('#newInstance', 'click', () => $('#instanceModal')?.classList.remove('hidden'))
    on('#instanceClose', 'click', () => $('#instanceModal')?.classList.add('hidden'))
    on('#createInstance', 'click', async () => { const name = String($('#instanceName')?.value || '').trim(); if (!name) return toast('Instance name is required.'); try { await window.binerCore.instances.create({ name, version: state.version, loader: state.loader, memory: state.memory }); $('#instanceName').value = ''; $('#instanceModal')?.classList.add('hidden'); await loadInstances(); toast('Instance created.') } catch (error) { toast(error?.message || String(error)) } })
    on('#minimize', 'click', () => window.biner.window.minimize())
    on('#maximize', 'click', () => window.biner.window.maximize())
    on('#close', 'click', () => window.biner.window.close())
    window.biner.onProgress(showProgress)
    window.biner.onLog(message => { const box = $('#consoleBox'); if (!box) return; box.textContent += `\n${message}`; box.scrollTop = box.scrollHeight })
    window.biner.onCrash(data => { toast(`Crash: ${data?.message || 'Minecraft error'}`); const box = $('#consoleBox'); if (box && data?.report) box.textContent += `\n[CRASH REPORT] ${data.report}` })
  }

  async function boot() {
    bindEvents()
    try {
      const profile = await window.biner.getProfile()
      if (profile) state = { ...state, ...profile }
    } catch (error) { console.error('[BinerLauncher] profile load failed', error) }
    render()
    try {
      const version = await window.biner.appVersion()
      text('#launcherVersion', version)
      document.title = `Biner Launcher v${version}`
    } catch (error) { console.error('[BinerLauncher] version load failed', error) }
    refreshServer()
    loadVersions()
    loadInstances()
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true })
  else boot()
})()
