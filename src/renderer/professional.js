(() => {
  'use strict'

  // BinerLauncher UX safety layer. It is intentionally independent from the
  // Minecraft renderer so a slow API/profile operation cannot freeze the UI.
  const $$ = selector => [...document.querySelectorAll(selector)]
  const $ = selector => document.querySelector(selector)

  const sectionNames = ['home', 'versions', 'instances', 'modloaders', 'news', 'settings', 'developer']

  const toast = message => {
    try {
      const el = $('#toast')
      if (!el) return
      el.textContent = String(message)
      el.classList.add('show')
      clearTimeout(window.__binerProfessionalToast)
      window.__binerProfessionalToast = setTimeout(() => el.classList.remove('show'), 2600)
    } catch {}
  }

  const navigate = id => {
    if (!sectionNames.includes(id)) return
    $$('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.section === id))
    $$('.section').forEach(section => section.classList.toggle('hidden-section', section.id !== id))
    const content = $('.content')
    if (content) content.scrollTop = 0
    window.dispatchEvent(new CustomEvent('biner:navigate', { detail: { section: id } }))
  }

  const bindNavigation = () => {
    $$('.nav-item').forEach(item => {
      if (item.dataset.proBound === '1') return
      item.dataset.proBound = '1'
      item.addEventListener('click', event => {
        event.preventDefault()
        event.stopImmediatePropagation()
        navigate(item.dataset.section)
      }, true)
    })
  }

  const bindWindowControls = () => {
    const controls = [
      ['#minimize', 'minimize'],
      ['#maximize', 'maximize'],
      ['#close', 'close']
    ]
    controls.forEach(([selector, action]) => {
      const button = $(selector)
      if (!button || button.dataset.proBound === '1') return
      button.dataset.proBound = '1'
      button.addEventListener('click', async event => {
        event.preventDefault()
        event.stopImmediatePropagation()
        try {
          const fn = window.biner?.window?.[action]
          if (typeof fn !== 'function') throw new Error('window_control_unavailable')
          await fn()
        } catch (error) {
          console.error(`[BinerLauncher] ${action} failed`, error)
          if (action !== 'close') toast('کنترل پنجره در دسترس نیست.')
        }
      }, true)
    })
  }

  const bindEscape = () => {
    if (window.__binerProfessionalEscape) return
    window.__binerProfessionalEscape = true
    window.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return
      const modal = $('#accountModal')
      if (modal && !modal.classList.contains('hidden')) modal.classList.add('hidden')
    })
  }

  const bindShortcuts = () => {
    if (window.__binerProfessionalShortcuts) return
    window.__binerProfessionalShortcuts = true
    window.addEventListener('keydown', event => {
      if (event.ctrlKey || event.altKey || event.metaKey) return
      const target = event.target
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      const key = Number(event.key)
      if (key >= 1 && key <= sectionNames.length) {
        event.preventDefault()
        navigate(sectionNames[key - 1])
      }
      if (event.key.toLowerCase() === 'p') {
        const play = $('#playBtn')
        if (play && !play.disabled) play.click()
      }
    })
  }

  const addButtonFeedback = () => {
    $$('.primary, .ghost, .quick-card, .nav-item, .setting-tab').forEach(button => {
      if (button.dataset.proFeedback === '1') return
      button.dataset.proFeedback = '1'
      button.addEventListener('pointerdown', () => button.classList.add('pro-pressed'))
      button.addEventListener('pointerup', () => button.classList.remove('pro-pressed'))
      button.addEventListener('pointercancel', () => button.classList.remove('pro-pressed'))
      button.addEventListener('pointerleave', () => button.classList.remove('pro-pressed'))
    })
  }

  const installStyles = () => {
    if ($('#binerProfessionalStyles')) return
    const style = document.createElement('style')
    style.id = 'binerProfessionalStyles'
    style.textContent = `
      .pro-pressed{transform:translateY(1px) scale(.985)!important;filter:brightness(.92);transition:transform .08s ease,filter .08s ease!important}
      .nav-item:focus-visible,.primary:focus-visible,.ghost:focus-visible,.quick-card:focus-visible,.setting-tab:focus-visible{outline:2px solid rgba(88,166,255,.85);outline-offset:2px}
      .nav-item,.primary,.ghost,.quick-card,.setting-tab{transition:transform .14s ease,filter .14s ease,background .18s ease,border-color .18s ease,box-shadow .18s ease}
      .window-actions button{transition:background .15s ease,transform .1s ease}
      .window-actions button:active{transform:scale(.9)}
    `
    document.head.appendChild(style)
  }

  const start = () => {
    try {
      installStyles()
      bindNavigation()
      bindWindowControls()
      bindEscape()
      bindShortcuts()
      addButtonFeedback()
      const observer = new MutationObserver(() => {
        try { bindNavigation(); bindWindowControls(); addButtonFeedback() } catch {}
      })
      observer.observe(document.body, { childList: true, subtree: true })
      window.__binerProfessionalObserver = observer
    } catch (error) {
      console.error('[BinerLauncher] professional UI failed', error)
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true })
  else start()
})()
