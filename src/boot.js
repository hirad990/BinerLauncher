const { app } = require('electron')

// Start the launcher first. The updater must never be able to block startup.
require('./main')

const { runAutoUpdater } = require('./auto-updater')

if (app.isReady()) {
  setTimeout(() => runAutoUpdater().catch(error => {
    console.warn('[BinerBoot] Auto updater failed:', error?.message || error)
  }), 1500)
} else {
  app.whenReady().then(() => {
    setTimeout(() => runAutoUpdater().catch(error => {
      console.warn('[BinerBoot] Auto updater failed:', error?.message || error)
    }), 1500)
  })
}
