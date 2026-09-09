const { app } = require('electron')
const { runAutoUpdater } = require('./auto-updater')

let started = false

async function boot() {
  if (started) return
  started = true

  try {
    const result = await runAutoUpdater()
    if (result?.installed) return
  } catch (error) {
    console.warn('[BinerBoot] Auto updater failed:', error?.message || error)
  }

  require('./main')
}

if (app.isReady()) {
  boot()
} else {
  app.whenReady().then(boot)
}
