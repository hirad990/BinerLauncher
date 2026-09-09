const { app, dialog } = require('electron')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { spawn } = require('child_process')
const https = require('https')
const http = require('http')

const UPDATE_MANIFEST_URL = 'https://binercraft.ir/cdn/latest.json'
const CDN_ORIGIN = 'https://binercraft.ir'

function normalizeVersion(value) {
  const match = String(value || '').trim().replace(/^v/i, '').match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/)
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null
}
function compareVersions(a, b) {
  const av = normalizeVersion(a); const bv = normalizeVersion(b)
  if (!av || !bv) return null
  for (let i = 0; i < 3; i++) if (av[i] !== bv[i]) return av[i] > bv[i] ? 1 : -1
  return 0
}
function validUpdateUrl(value) {
  try { const url = new URL(String(value || '')); return (url.protocol === 'https:' || url.protocol === 'http:') && url.origin === CDN_ORIGIN } catch { return false }
}
function requestJson(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 3) return reject(new Error('Too many redirects.'))
    const parsed = new URL(url); const client = parsed.protocol === 'https:' ? https : http
    const request = client.get(parsed, { headers: { 'User-Agent': `BinerLauncher/${app.getVersion()}`, Accept: 'application/json' } }, response => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) { response.resume(); return requestJson(new URL(response.headers.location, parsed).toString(), redirects + 1).then(resolve, reject) }
      if (response.statusCode !== 200) { response.resume(); return reject(new Error(`Update manifest HTTP ${response.statusCode}`)) }
      let body = ''; response.setEncoding('utf8'); response.on('data', chunk => { body += chunk })
      response.on('end', () => { try { resolve(JSON.parse(body)) } catch { reject(new Error('Invalid update manifest.')) } })
    })
    request.setTimeout(10000, () => request.destroy(new Error('Update manifest timeout.'))); request.on('error', reject)
  })
}
function downloadFile(url, destination, onProgress, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('Too many download redirects.'))
    const parsed = new URL(url); const client = parsed.protocol === 'https:' ? https : http
    const request = client.get(parsed, { headers: { 'User-Agent': `BinerLauncher/${app.getVersion()}` } }, response => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) { response.resume(); return downloadFile(new URL(response.headers.location, parsed).toString(), destination, onProgress, redirects + 1).then(resolve, reject) }
      if (response.statusCode !== 200) { response.resume(); return reject(new Error(`Installer HTTP ${response.statusCode}`)) }
      const total = Number(response.headers['content-length']) || 0; let received = 0
      fs.mkdirSync(path.dirname(destination), { recursive: true }); const file = fs.createWriteStream(destination)
      response.on('data', chunk => { received += chunk.length; onProgress?.({ received, total, progress: total ? Math.round(received / total * 100) : 0 }) }); response.pipe(file)
      file.on('finish', () => file.close(() => resolve(destination))); file.on('error', error => { file.destroy(); response.destroy(); reject(error) }); response.on('error', error => { file.destroy(); reject(error) })
    })
    request.setTimeout(30000, () => request.destroy(new Error('Installer download timeout.'))); request.on('error', reject)
  })
}
function sha256(file) {
  return new Promise((resolve, reject) => { const hash = crypto.createHash('sha256'); const stream = fs.createReadStream(file); stream.on('data', chunk => hash.update(chunk)); stream.on('error', reject); stream.on('end', () => resolve(hash.digest('hex'))) })
}
async function checkForUpdate() {
  const currentVersion = app.getVersion(); const manifest = await requestJson(UPDATE_MANIFEST_URL); const latestVersion = String(manifest.version || '').replace(/^v/i, '')
  const comparison = compareVersions(latestVersion, currentVersion); if (comparison === null) throw new Error('Invalid version in update manifest.')
  if (comparison <= 0) return { update: false, currentVersion, version: latestVersion, manifest }
  const url = manifest.download || manifest.url; if (!validUpdateUrl(url)) throw new Error('Update installer URL must point to binercraft.ir.')
  return { update: true, currentVersion, version: latestVersion, url, manifest }
}
async function installUpdate(update, onProgress) {
  if (!update?.update || !validUpdateUrl(update.url)) throw new Error('Invalid update package.')
  if (process.platform !== 'win32') throw new Error('BinerLauncher auto-update currently supports Windows only.')
  const filename = `Biner-Launcher-Setup-${update.version}.exe`; const destination = path.join(app.getPath('temp'), 'BinerLauncher', filename)
  try { fs.rmSync(destination, { force: true }) } catch {}
  await downloadFile(update.url, destination, onProgress)
  if (update.manifest.sha256) {
    const expected = String(update.manifest.sha256).trim().toLowerCase(); const actual = await sha256(destination)
    if (!/^[a-f0-9]{64}$/.test(expected) || actual !== expected) { fs.rmSync(destination, { force: true }); throw new Error('SHA-256 verification failed.') }
  }
  if (fs.statSync(destination).size < 1024 * 1024) { fs.rmSync(destination, { force: true }); throw new Error('Downloaded installer is unexpectedly small.') }
  const child = spawn(destination, [], { detached: true, stdio: 'ignore', windowsHide: false }); child.unref(); return destination
}
async function runAutoUpdater() {
  if (!app.isPackaged || process.platform !== 'win32') return { update: false, skipped: true }
  try {
    const update = await checkForUpdate(); if (!update.update) return update
    const choice = await dialog.showMessageBox({ type: 'info', title: 'Biner Launcher Update', message: `نسخه جدید Biner Launcher ${update.version} آماده است.`, detail: update.manifest.releaseNotes || update.manifest.notes || 'نسخه جدید را دانلود و نصب کنیم؟', buttons: ['Update', 'Later'], defaultId: 0, cancelId: 1, noLink: true })
    if (choice.response !== 0) return { ...update, deferred: true }
    const installer = await installUpdate(update, progress => { if (progress.progress % 10 === 0) console.log(`[BinerUpdater] ${progress.progress}%`) })
    await dialog.showMessageBox({ type: 'info', title: 'Biner Launcher', message: 'آپدیت دانلود شد. لانچر برای نصب بسته می‌شود.' }); app.quit()
    return { ...update, installed: true, installer }
  } catch (error) { console.warn('[BinerUpdater]', error?.message || error); return { update: false, error: error?.message || String(error) }
  }
}

module.exports = { UPDATE_MANIFEST_URL, checkForUpdate, installUpdate, runAutoUpdater, compareVersions }

if (require.main === module) {
  app.whenReady().then(async () => {
    const result = await runAutoUpdater()
    if (!result.installed) require('./main')
  })
}
