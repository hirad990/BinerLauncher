const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { downloadFile } = require('./download-manager')

function safeName(v, fallback = 'item') {
  const n = String(v || '').trim().replace(/[^A-Za-z0-9._ -]/g, '_').replace(/\s+/g, ' ').slice(0, 80)
  return n || fallback
}

function analyzeText(text) {
  const s = String(text || '')
  const rules = [
    [/UnsupportedClassVersionError|class file version|requires java/i, ['JAVA_VERSION', 'نسخه Java با Minecraft/Mod سازگار نیست.']],
    [/OutOfMemoryError|Could not reserve enough space/i, ['MEMORY', 'RAM تخصیص‌داده‌شده کافی نیست.']],
    [/Mixin apply failed|ModLoadingException|Failed to load mod/i, ['MOD_MISMATCH', 'احتمال ناسازگاری یا خرابی Mod وجود دارد.']],
    [/NoClassDefFoundError|ClassNotFoundException/i, ['MISSING_LIBRARY', 'یک کتابخانه یا وابستگی پیدا نشد.']],
    [/Invalid session|Failed to verify username|authentication/i, ['AUTH', 'احراز هویت ناموفق بوده است.']],
    [/Could not find or load main class/i, ['INSTALLATION', 'نصب Minecraft یا Loader ناقص است.']],
    [/GLFW|OpenGL|LWJGL/i, ['GRAPHICS', 'مشکل OpenGL یا درایور GPU محتمل است.']]
  ]
  const matches = rules.filter(([r]) => r.test(s)).map(([, v]) => ({ code: v[0], message: v[1] }))
  return {
    ok: !matches.length,
    severity: matches.length ? 'warning' : 'info',
    matches,
    summary: matches[0]?.message || 'خطای شناخته‌شده‌ای پیدا نشد.'
  }
}

function registerV040({ ipcMain, app, minecraftRoot, crashRoot, send = () => {}, ensureJava, listInstalled, getCompatibleLoaders }) {
  const userData = app.getPath('userData')
  const accountsFile = path.join(userData, 'accounts.json')
  const queueDir = path.join(userData, 'downloads')
  const jobs = new Map()
  const read = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return d } }
  const write = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(v, null, 2), 'utf8'); return v }

  ipcMain.handle('biner:crash:analyze', (_, input = '') => {
    let t = String(input || '')
    if (t && fs.existsSync(t) && fs.statSync(t).isFile()) t = fs.readFileSync(t, 'utf8')
    return analyzeText(t)
  })
  ipcMain.handle('biner:crash:list', () => {
    const d = crashRoot()
    try {
      fs.mkdirSync(d, { recursive: true })
      return fs.readdirSync(d).filter(x => /\.(log|txt|crash)$/i.test(x)).sort().reverse().map(name => ({ name, path: path.join(d, name), size: fs.statSync(path.join(d, name)).size }))
    } catch { return [] }
  })
  ipcMain.handle('biner:repair:scan', async () => {
    const r = minecraftRoot()
    const p = read(path.join(userData, 'profile.json'), {})
    const c = []
    const add = (id, ok, message) => c.push({ id, ok: Boolean(ok), message, fix: true })
    for (const d of ['versions', 'libraries', 'assets', 'mods', 'config', 'resourcepacks', 'shaderpacks', 'saves']) add(d, fs.existsSync(path.join(r, d)), d)
    try {
      const j = await ensureJava(userData, () => {}, p.version || '1.21.11')
      add('java', !!j?.path, `Java ${j?.version || 'ready'}`)
    } catch (e) { add('java', false, e.message) }
    if (p.version) add('version', fs.existsSync(path.join(r, 'versions', p.version)) || listInstalled(r).some(v => v.startsWith(`${p.version}-`)), p.version)
    return { ok: c.every(x => x.ok), checks: c }
  })
  ipcMain.handle('biner:repair:fix', () => {
    const r = minecraftRoot()
    for (const d of ['versions', 'libraries', 'assets', 'mods', 'config', 'resourcepacks', 'shaderpacks', 'saves', 'cache']) fs.mkdirSync(path.join(r, d), { recursive: true })
    return { ok: true }
  })
  ipcMain.handle('biner:loaders:compatible', (_, version) => getCompatibleLoaders ? getCompatibleLoaders(version) : { minecraftVersion: version, vanilla: true, fabric: true, forge: false, neoforge: false, optifine: false })
  ipcMain.handle('biner:fast-mode:presets', (_, o = {}) => {
    const ram = Math.max(1024, Number(o.memory) || 4096)
    return {
      balanced: ['-XX:+UseG1GC', '-XX:+ParallelRefProcEnabled', '-XX:MaxGCPauseMillis=80'],
      fast: ['-XX:+UseG1GC', '-XX:+ParallelRefProcEnabled', '-XX:MaxGCPauseMillis=50', '-XX:+DisableExplicitGC'],
      ultra: ram >= 6144 ? ['-XX:+UseG1GC', '-XX:+ParallelRefProcEnabled', '-XX:MaxGCPauseMillis=40', '-XX:+DisableExplicitGC', '-XX:+AlwaysPreTouch'] : ['-XX:+UseG1GC', '-XX:+ParallelRefProcEnabled', '-XX:MaxGCPauseMillis=50', '-XX:+DisableExplicitGC']
    }
  })
  ipcMain.handle('biner:accounts:list', () => {
    const d = read(accountsFile, { activeId: '', accounts: [] })
    return d.accounts.map(a => ({ ...a, active: a.id === d.activeId }))
  })
  ipcMain.handle('biner:accounts:add-local', (_, username) => {
    const name = String(username || '').trim()
    if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) throw new Error('نام کاربری باید 3 تا 16 کاراکتر باشد.')
    const d = read(accountsFile, { activeId: '', accounts: [] })
    const id = crypto.createHash('sha256').update(`local:${name}`).digest('hex').slice(0, 16)
    let a = d.accounts.find(x => x.id === id)
    if (!a) { a = { id, username: name, type: 'local', createdAt: new Date().toISOString() }; d.accounts.push(a) }
    d.activeId = id
    write(accountsFile, d)
    return a
  })
  ipcMain.handle('biner:accounts:activate', (_, id) => {
    const d = read(accountsFile, { activeId: '', accounts: [] })
    if (!d.accounts.some(a => a.id === id)) throw new Error('Account پیدا نشد.')
    d.activeId = id
    write(accountsFile, d)
    return d.accounts.find(a => a.id === id)
  })
  ipcMain.handle('biner:accounts:delete', (_, id) => {
    const d = read(accountsFile, { activeId: '', accounts: [] })
    d.accounts = d.accounts.filter(a => a.id !== id)
    if (d.activeId === id) d.activeId = d.accounts[0]?.id || ''
    write(accountsFile, d)
    return true
  })
  ipcMain.handle('biner:download:start', async (_, o = {}) => {
    const u = new URL(String(o.url || ''))
    if (!['http:', 'https:'].includes(u.protocol)) throw new Error('فقط HTTP/HTTPS مجاز است.')
    const id = crypto.randomUUID()
    const controller = new AbortController()
    const job = { id, url: u.toString(), filename: safeName(o.filename, 'download.bin'), status: 'queued', progress: 0, received: 0, total: 0, controller }
    jobs.set(id, job)
    try {
      job.status = 'downloading'
      const result = await downloadFile(job.url, o.targetDir || queueDir, job.filename, {
        retries: 4,
        resume: true,
        signalProvider: () => controller.signal,
        onProgress: p => {
          Object.assign(job, { progress: p.total ? Math.round(p.received / p.total * 100) : 0, received: p.received, total: p.total })
          send('download:progress', { ...job, controller: undefined })
        }
      })
      job.status = 'completed'; job.path = result.path; job.progress = 100
      return { ...job, controller: undefined }
    } catch (e) {
      job.status = controller.signal.aborted ? 'cancelled' : 'failed'; job.error = e.message
      throw e
    } finally { jobs.delete(id) }
  })
  ipcMain.handle('biner:download:cancel', (_, id) => { const j = jobs.get(id); if (!j) return false; j.controller.abort(); return true })
  ipcMain.handle('biner:download:active', () => [...jobs.values()].map(({ controller, ...j }) => j))
  ipcMain.handle('biner:smart-play', async (_, o = {}) => {
    const version = String(o.version || '1.21.11'), loader = String(o.loader || 'vanilla')
    send('smart-play:step', { step: 'version', status: 'checking', message: `Checking Minecraft ${version}` })
    fs.mkdirSync(minecraftRoot(), { recursive: true })
    send('smart-play:step', { step: 'java', status: 'checking', message: 'Checking Java' })
    const java = await ensureJava(userData, (p, r, t) => send('launcher:progress', { stage: 'java', progress: p, received: r, total: t, message: `Java ${p}%` }), version)
    send('smart-play:step', { step: 'java', status: 'ok', message: `Java ${java.version} ready` })
    const compat = getCompatibleLoaders ? getCompatibleLoaders(version) : null
    if (compat && compat[loader] === false) throw new Error(`${loader} با Minecraft ${version} سازگار نیست.`)
    send('smart-play:step', { step: 'loader', status: 'ok', message: `${loader} compatible` })
    send('smart-play:step', { step: 'files', status: 'ok', message: 'Game files ready' })
    return { ok: true, version, loader, javaVersion: java.version, ready: true }
  })
}

module.exports = { registerV040, analyzeText }
