(() => {
  'use strict'

  const API = 'https://binercraft.ir/launchAPI'
  const HEARTBEAT_MS = 10000
  const ANIMATION_MS = 2600
  const STORAGE_KEY = 'binerLauncherInstallationId'
  let lastOnline = null
  let timer = null
  let active = true

  const makeId = () => {
    try {
      if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID().replace(/-/g, '')
    } catch {}
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
  }

  const getInstallationId = () => {
    try {
      let id = localStorage.getItem(STORAGE_KEY)
      if (!id) {
        id = makeId()
        localStorage.setItem(STORAGE_KEY, id)
      }
      return id
    } catch {
      return makeId()
    }
  }

  const installationId = getInstallationId()

  const loadProfessionalUI = () => {
    try {
      if (document.querySelector('script[data-biner-professional]')) return
      const script = document.createElement('script')
      script.src = './professional.js'
      script.dataset.binerProfessional = '1'
      script.async = false
      script.onerror = () => console.warn('[BinerLauncher] professional.js unavailable')
      ;(document.head || document.documentElement).appendChild(script)
    } catch (error) {
      console.warn('[BinerLauncher] professional UI loader failed', error)
    }
  }

  // Keep navigation usable even if the async renderer initialization is slow.
  const installNavigationFallback = () => {
    const bind = () => {
      document.querySelectorAll('.nav-item').forEach(item => {
        if (item.dataset.binerNavBound === '1') return
        item.dataset.binerNavBound = '1'
        item.addEventListener('click', event => {
          event.preventDefault()
          event.stopPropagation()
          const id = item.dataset.section
          if (!id) return
          document.querySelectorAll('.nav-item').forEach(x => x.classList.toggle('active', x === item))
          document.querySelectorAll('.section').forEach(section => section.classList.toggle('hidden-section', section.id !== id))
          const content = document.querySelector('.content')
          if (content) content.scrollTop = 0
          window.dispatchEvent(new CustomEvent('biner:navigate', { detail: { section: id } }))
        }, true)
      })
    }
    bind()
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true })
  }

  const injectUI = () => {
    try {
      const metrics = document.querySelector('.metrics')
      if (!metrics || document.getElementById('launcherUsersMetric')) return Boolean(metrics)
      const card = document.createElement('div')
      card.id = 'launcherUsersMetric'
      card.className = 'launcher-presence-metric'
      card.innerHTML = '<strong id="launcherUsers">—</strong><small>LAUNCHER USERS</small><span id="launcherPresenceChange" class="launcher-presence-change"></span>'
      metrics.appendChild(card)
      const style = document.createElement('style')
      style.id = 'launcherPresenceStyles'
      style.textContent = `
        #launcherUsersMetric{position:relative;overflow:visible;transition:transform .25s ease,box-shadow .25s ease,border-color .25s ease}
        #launcherUsersMetric.presence-up{animation:binerPresenceUp ${ANIMATION_MS}ms ease both}
        #launcherUsersMetric.presence-down{animation:binerPresenceDown ${ANIMATION_MS}ms ease both}
        .launcher-presence-change{position:absolute;top:7px;left:8px;opacity:0;transform:translateY(5px);font:700 10px/1 Arial,sans-serif;letter-spacing:.5px;pointer-events:none}
        #launcherUsersMetric.presence-up .launcher-presence-change{color:#43ff91;animation:binerPresenceBadge ${ANIMATION_MS}ms ease both}
        #launcherUsersMetric.presence-down .launcher-presence-change{color:#ff6262;animation:binerPresenceBadge ${ANIMATION_MS}ms ease both}
        @keyframes binerPresenceUp{0%,100%{box-shadow:0 0 0 rgba(67,255,145,0);border-color:rgba(255,255,255,.08)}15%{transform:translateY(-2px);box-shadow:0 0 28px rgba(67,255,145,.35);border-color:rgba(67,255,145,.75)}35%{box-shadow:0 0 16px rgba(67,255,145,.2);border-color:rgba(67,255,145,.42)}}
        @keyframes binerPresenceDown{0%,100%{box-shadow:0 0 0 rgba(255,98,98,0);border-color:rgba(255,255,255,.08)}15%{transform:translateY(-2px);box-shadow:0 0 28px rgba(255,98,98,.35);border-color:rgba(255,98,98,.75)}35%{box-shadow:0 0 16px rgba(255,98,98,.2);border-color:rgba(255,98,98,.42)}}
        @keyframes binerPresenceBadge{0%{opacity:0;transform:translateY(5px)}18%{opacity:1;transform:translateY(0)}72%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(-4px)}}
      `
      document.head.appendChild(style)
      return true
    } catch { return false }
  }

  const showChange = (online, previous) => {
    try {
      const card = document.getElementById('launcherUsersMetric')
      const badge = document.getElementById('launcherPresenceChange')
      if (!card || previous === null || online === previous) return
      card.classList.remove('presence-up', 'presence-down')
      void card.offsetWidth
      const delta = online - previous
      card.classList.add(delta > 0 ? 'presence-up' : 'presence-down')
      if (badge) badge.textContent = delta > 0 ? `JOINED +${delta}` : `LEFT ${delta}`
      setTimeout(() => card.classList.remove('presence-up', 'presence-down'), ANIMATION_MS + 50)
    } catch {}
  }

  const render = online => {
    try {
      const value = Math.max(0, Number(online) || 0)
      const el = document.getElementById('launcherUsers')
      if (el) el.textContent = String(value)
      showChange(value, lastOnline)
      lastOnline = value
    } catch {}
  }

  const payload = () => JSON.stringify({ installationId, launcherVersion: '1.1.0', platform: 'windows' })

  const heartbeat = async () => {
    if (!active) return
    try {
      const response = await fetch(`${API}/heartbeat.php`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: payload(), cache: 'no-store' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      if (data?.ok) render(data.online)
      else throw new Error(data?.error || 'heartbeat_failed')
    } catch {
      try {
        const response = await fetch(`${API}/online.php?t=${Date.now()}`, { cache: 'no-store', headers: { 'Accept': 'application/json' } })
        const data = await response.json()
        if (data?.ok) render(data.online)
      } catch {}
    }
  }

  const leave = () => {
    if (!active) return
    active = false
    try {
      const body = new Blob([payload()], { type: 'application/json' })
      navigator.sendBeacon(`${API}/leave.php`, body)
    } catch {}
  }

  const start = () => {
    try {
      loadProfessionalUI()
      installNavigationFallback()
      injectUI()
      heartbeat().catch(() => {})
      timer = setInterval(() => heartbeat().catch(() => {}), HEARTBEAT_MS)
      window.addEventListener('beforeunload', leave, { once: true })
      window.addEventListener('pagehide', leave, { once: true })
    } catch {
      if (timer) clearInterval(timer)
      timer = null
    }
  }

  try {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true })
    else start()
  } catch {}
})()
