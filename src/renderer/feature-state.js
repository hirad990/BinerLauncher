window.__binerState = {}
window.biner?.getProfile?.().then(profile => { window.__binerState = profile || {} }).catch(() => {})
