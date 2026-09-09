const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { spawn } = require('child_process')
const { downloadFile } = require('./download-manager')

function safeName(value, fallback = 'item') {
  const name = String(value || '').trim().replace(/[^A-Za-z0-9._ -]/g, '_').replace(/\s+/g, ' ').slice(0, 80)
  return name || fallback
}

function registerV040({ ipcMain, app, minecraftRoot, crashRoot, fetchJson, send, ensureJava, listInstalled, getCompatibleLoaders, launchMinecraft }) {
  const userData = app.getPath('userData')
  const accountsFile = path.join(userData, 'accounts.json')
  const queueDir = path.join(userData, 'downloads')
  const jobs = new Map()
  const readJson = (file, fallback) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return fallback } }
  const writeJson = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8'); return value }

  function analyzeText(text) {
    const s = String(text || '')
    const rules = [
      [/UnsupportedClassVersionError|class file version/i, ['JAVA_VERSION', 'نسخه Java با Minecraft/Mod سازگار نیست.']],
      [/requires java (?:version )?(\d+)/i, ['JAVA_VERSION', 'نسخه Java موردنیاز این بازی نصب نیست.']],
      [/OutOfMemoryError|Could not reserve enough space/i, ['MEMORY', 'حافظه RAM تخصیص‌داده‌شده کافی نیست یا فشار حافظه بالاست.']],
      [/Mixin apply failed|Mixin.*failed/i, ['MOD_MISMATCH', 'احتمال ناسازگاری یا نسخه اشتباه Mod وجود دارد.']],
      [/ModLoadingException|Failed to load mod/i, ['MOD_LOAD', 'یکی از Modها هنگام بارگذاری خطا داده است.']],
      [/NoClassDefFoundError|ClassNotFoundException/i, ['MISSING_LIBRARY', 'یک کتابخانه یا وابستگی موردنیاز پیدا نشد.']],
      [/Invalid session|Failed to verify username|authentication/i, ['AUTH', 'احراز هویت Minecraft ناموفق بوده است.']],
      [/Could not find or load main class/i, ['INSTALLATION', 'نصب Minecraft یا Loader ناقص است.']],
      [/GLFW|OpenGL|LWJGL/i, ['GRAPHICS', 'مشکل گرافیک/OpenGL یا درایور GPU محتمل است.']]
    ]
    const matches = rules.filter(([re]) => re.test(s)).map(([, value]) => ({ code: value[0], message: value[1] }))
    return { ok: matches.length === 0, severity: matches.length ? 'warning' : 'info', matches, summary: matches[0]?.message || 'خطای مشخصی از الگوهای شناخته‌شده پیدا نشد.' }
  }

  ipcMain.handle('biner:crash:analyze', (_, input = '') => {
    let text = String(input || '')
    if (text && fs.existsSync(text) && fs.statSync(text).isFile()) text = fs.readFileSync(text, 'utf8')
    return analyzeText(text)
  })
  ipcMain.handle('biner:crash:list', () => {
    const dir = crashRoot(); try { fs.mkdirSync(dir, { recursive: true }); return fs.readdirSync(dir).filter(x => /\\.(log|txt|crash)$/i.test(x)).sort().reverse().map(name => ({ name, path: path.join(dir, name), size: fs.statSync(path.join(dir, name)).size })) } catch { return [] }
  })

  ipcMain.handle('biner:repair:scan', async () => {
    const root = minecraftRoot(); const profile = readJson(path.join(userData, 'profile.json'), {})
    const checks = []; const add = (id, ok, message, fix = false) => checks.push({ id, ok: Boolean(ok), message, fix })
    add('minecraft-root', fs.existsSync(root), 'Minecraft data directory', true)
    add('versions', fs.existsSync(path.join(root, 'versions')), 'Versions directory', true)
    if (profile.version) add('selected-version', fs.existsSync(path.join(root, 'versions', profile.version)) || listInstalled(root).some(v => v.startsWith(`${profile.version}-`)), `Selected version: ${profile.version}`, true)
    try { const java = await ensureJava(userData, () => {}, profile.version || '1.21.11'); add('java', Boolean(java?.path), `Java ${java?.version || 'ready'}`, true) } catch (e) { add('java', false, e.message, true) }
    if (profile.loader && profile.loader !== 'vanilla') add('loader', listInstalled(root).some(v => String(v).includes(profile.loader)), `${profile.loader.toUpperCase()} profile`, true)
    add('mods-dir', fs.existsSync(path.join(root, 'mods')), 'Mods directory', true)
    add('libraries', fs.existsSync(path.join(root, 'libraries')), 'Libraries directory', true)
    return { ok: checks.every(x => x.ok), checks, repaired: false }
  })
  ipcMain.handle('biner:repair:fix', async () => {
    const root = minecraftRoot(); for (const dir of ['versions', 'libraries', 'assets', 'mods', 'config', 'resourcepacks', 'shaderpacks', 'saves', 'cache']) fs.mkdirSync(path.join(root, dir), { recursive: true })
    return { ok: true, message: 'ساختار پوشه‌های ضروری تعمیر شد.' }
  })

  ipcMain.handle('biner:loaders:compatible', async (_, version) => getCompatibleLoaders ? getCompatibleLoaders(version) : { minecraftVersion: version, vanilla: true, fabric: true, forge: false, neoforge: false, optifine: false })

  ipcMain.handle('biner:fast-mode:presets', (_, { memory = 4096 } = {}) => {
    const ram = Math.max(1024, Number(memory) || 4096)
    return { balanced: ['-XX:+UseG1GC', '-XX:+ParallelRefProcEnabled', '-XX:MaxGCPauseMillis=80'], fast: ['-XX:+UseG1GC', '-XX:+ParallelRefProcEnabled', '-XX:MaxGCPauseMillis=50', '-XX:+DisableExplicitGC'], ultra: ram >= 6144 ? ['-XX:+UseG1GC', '-XX:+ParallelRefProcEnabled', '-XX:MaxGCPauseMillis=40', '-XX:+DisableExplicitGC', '-XX:+AlwaysPreTouch'] : ['-XX:+UseG1GC', '-XX:+ParallelRefProcEnabled', '-XX:MaxGCPauseMillis=50', '-XX:+DisableExplicitGC'] }
  })

  ipcMain.handle('biner:accounts:list', () => {
    const data = readJson(accountsFile, { activeId: '', accounts: [] }); return data.accounts.map(a => ({ id: a.id, username: a.username, type: a.type, createdAt: a.createdAt, active: a.id === data.activeId }))
  })
  ipcMain.handle('biner:accounts:add-local', (_, username) => {
    if (!/^[A-Za-z0-9_]{3,16}$/.test(String(username || '').trim())) throw new Error('نام کاربری باید 3 تا 16 کاراکتر باشد.')
    const data = readJson(accountsFile, { activeId: '', accounts: [] }); const name = String(username).trim(); let id = crypto.createHash('sha256').update(`local:${name}`).digest('hex').slice(0, 16)
    if (data.accounts.some(a => a.id === id)) { data.activeId = id; writeJson(accountsFile, data); return data.accounts.find(a => a.id === id) }
    const account = { id, username: name, type: 'local', createdAt: new Date().toISOString() }; data.accounts.push(account); data.activeId = id; writeJson(accountsFile, data); return account
  })
  ipcMain.handle('biner:accounts:activate', (_, id) => { const data = readJson(accountsFile, { activeId: '', accounts: [] }); if (!data.accounts.some(a => a.id === id)) throw new Error('Account پیدا نشد.'); data.activeId = id; writeJson(accountsFile, data); return data.accounts.find(a => a.id === id) })
  ipcMain.handle('biner:accounts:delete', (_, id) => { const data = readJson(accountsFile, { activeId: '', accounts: [] }); data.accounts = data.accounts.filter(a => a.id !== id); if (data.activeId === id) data.activeId = data.accounts[0]?.id || ''; writeJson(accountsFile, data); return true })

  ipcMain.handle('biner:download:start', async (_, { url, filename, targetDir } = {}) => {
    if (!/^https?:$/i.test(new URL(String(url)).protocol)) throw new Error('فقط HTTP/HTTPS مجاز است.')
    const id = crypto.randomUUID(); const dir = targetDir || queueDir; const job = { id, url: String(url), filename: safeName(filename, 'download.bin'), status: 'queued', progress: 0, received: 0, total: 0 }
    jobs.set(id, job); send('download:queue', job)
    job.status = 'downloading'; jobs.set(id, job)
    try {
      const result = await downloadFile(job.url, dir, job.filename, { retries: 4, resume: true, signalProvider: () => jobs.get(id)?.controller?.signal, onProgress: p => { job.progress = p.total ? Math.round(p.received / p.total * 100) : 0; job.received = p.received; job.total = p.total; send('download:progress', { ...job }) } })
      job.status = 'completed'; job.path = result.path; job.progress = 100; send('download:completed', { ...job }); return { ...job }
    } catch (e) { job.status = job.controller?.signal?.aborted ? 'cancelled' : 'failed'; job.error = e.message; send('download:failed', { ...job }); throw e } finally { jobs.delete(id) }
  })
  ipcMain.handle('biner:download:cancel', (_, id) => { const job = jobs.get(id); if (!job) return false; job.controller?.abort(); job.status = 'cancelled'; return true })
  ipcMain.handle('biner:download:active', () => [...jobs.values()].map(({ controller, ...job }) => job))

  ipcMain.handle('biner:smart-play', async (_, options = {}) => {
    const version = String(options.version || '1.21.11'); const loader = String(options.loader || 'vanilla')
    send('smart-play:step', { step: 'version', status: 'checking', message: `Checking Minecraft ${version}` })
    const root = minecraftRoot(); fs.mkdirSync(root, { recursive: true })
    send('smart-play:step', { step: 'java', status: 'checking', message: 'Checking Java runtime' })
    const java = await ensureJava(userData, (progress, received, total) => send('launcher:progress', { stage: 'java', progress, received, total, message: `Java ${progress}%` }), version)
    send('smart-play:step', { step: 'java', status: 'ok', message: `Java ${java.version} ready` })
    if (loader !== 'vanilla') send('smart-play:step', { step: 'loader', status: 'checking', message: `Checking ${loader}` })
    send('smart-play:step', { step: 'files', status: 'ok', message: 'Checking game files' })
    const result = await launchMinecraft({ ...options, version, loader })
    send('smart-play:step', { step: 'launch', status: 'ok', message: 'Minecraft launched' })
    return result
  })
}

module.exports = { registerV040, analyzeText }
