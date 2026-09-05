const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const net = require('net')
const { Client } = require('minecraft-launcher-core')
const { ensureJava } = require('./java-manager')
const { installFabric, installForge, listInstalled } = require('./loader-manager')

const isDev = !app.isPackaged
let launcherProcess = null
let mainWindow = null
const dataPath = () => path.join(app.getPath('userData'), 'profile.json')
const minecraftRoot = () => path.join(app.getPath('userData'), 'minecraft')
const crashRoot = () => path.join(app.getPath('userData'), 'crash-reports')
function readProfile() { try { return JSON.parse(fs.readFileSync(dataPath(), 'utf8')) } catch { return null } }
function writeProfile(profile) { fs.mkdirSync(path.dirname(dataPath()), { recursive: true }); fs.writeFileSync(dataPath(), JSON.stringify(profile, null, 2), 'utf8'); return profile }
function offlineUuid(username) { const hex = crypto.createHash('md5').update(`OfflinePlayer:${username}`).digest('hex'); return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}` }
function send(channel, payload) { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload) }
async function fetchJson(url) { const r = await fetch(url, { headers: { 'User-Agent': 'BinerLauncher/0.3.0' } }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() }
function writeCrashReport(error, extra = {}) { try { fs.mkdirSync(crashRoot(), { recursive: true }); const stamp = new Date().toISOString().replace(/[:.]/g, '-'); const file = path.join(crashRoot(), `biner-crash-${stamp}.log`); const text = [`BinerLauncher Crash Report`, `Time: ${new Date().toISOString()}`, `Platform: ${process.platform}`, `Electron: ${process.versions.electron}`, `Node: ${process.versions.node}`, `Error: ${error?.stack || error}`, JSON.stringify(extra, null, 2)].join('\n\n'); fs.writeFileSync(file, text, 'utf8'); return file } catch { return null } }
function pingServer(host, port, timeout = 3000) { return new Promise(resolve => { const started = Date.now(); const socket = new net.Socket(); let done = false; const finish = result => { if (done) return; done = true; socket.destroy(); resolve(result) }; socket.setTimeout(timeout); socket.once('connect', () => finish({ online: true, ping: Date.now() - started, host, port })); socket.once('timeout', () => finish({ online: false, ping: null, host, port, error: 'timeout' })); socket.once('error', e => finish({ online: false, ping: null, host, port, error: e.code || e.message })); socket.connect(Number(port) || 25565, String(host)) }) }

function createWindow() {
  mainWindow = new BrowserWindow({ width: 1440, height: 900, minWidth: 1100, minHeight: 700, frame: false, backgroundColor: '#070b14', show: false, webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } })
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'))
  mainWindow.once('ready-to-show', () => mainWindow.show())
  if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' })
}

async function launchMinecraft({ username, version, memory, serverHost, serverPort, loader = 'vanilla', profileId = '', width = 1280, height = 720, fullscreen = false, customArgs = [] }) {
  if (launcherProcess) throw new Error('Minecraft is already running.')
  username = String(username || '').trim(); version = String(version || '1.21.11')
  if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) throw new Error('نام کاربری باید 3 تا 16 کاراکتر باشد.')
  const root = minecraftRoot(); const maxMemory = Math.max(1024, Number(memory) || 4096)
  send('launcher:progress', { stage: 'checking', progress: 0, message: 'در حال بررسی Java...' })
  const java = await ensureJava(app.getPath('userData'), (progress, received, total) => send('launcher:progress', { stage: 'java', progress, received, total, message: `در حال نصب Java... ${progress}%` }))
  send('launcher:progress', { stage: 'java-ready', progress: 100, message: `Java ${java.version} آماده است.` })
  let customVersion = ''
  if (loader === 'fabric') { customVersion = profileId || listInstalled(root).find(v => v.startsWith(`${version}-fabric-`)) || ''; if (!customVersion) { const r = await installFabric({ root, minecraftVersion: version, javaPath: java.path, onProgress: p => send('launcher:progress', { stage: 'loader', progress: p, message: `نصب Fabric ${p}%` }) }); customVersion = r.profileId } }
  else if (loader === 'forge') { customVersion = profileId || listInstalled(root).find(v => v.startsWith(`forge-${version}-`)) || ''; if (!customVersion) { const r = await installForge({ root, minecraftVersion: version, javaPath: java.path, onProgress: p => send('launcher:progress', { stage: 'loader', progress: p, message: `نصب Forge ${p}%` }) }); customVersion = r.profileId } }
  else if (loader === 'optifine') { const installed = listInstalled(root).find(v => v.startsWith(`optifine-${version}-`)); if (installed) customVersion = installed }
  const uuid = offlineUuid(username)
  const authorization = { access_token: '0', client_token: uuid.replaceAll('-', ''), uuid, name: username }
  const options = { authorization, root, version: { number: version, type: 'release', ...(customVersion ? { custom: customVersion } : {}) }, memory: { max: `${maxMemory}M`, min: '1024M' }, javaPath: java.path, window: { width: String(width), height: String(height), fullscreen: Boolean(fullscreen) }, customArgs: Array.isArray(customArgs) ? customArgs : [] }
  if (serverHost) options.server = { host: String(serverHost), port: Number(serverPort) || 25565 }
  send('launcher:progress', { stage: 'minecraft', progress: 0, message: `در حال دانلود Minecraft ${version}...` })
  const launcher = new Client()
  return new Promise((resolve, reject) => {
    let started = false
    launcher.on('debug', msg => { console.log('[Minecraft]', msg); send('launcher:log', String(msg)) })
    launcher.on('data', msg => { console.log('[Minecraft]', msg); send('launcher:log', String(msg)) })
    launcher.on('download', msg => send('launcher:download', { file: String(msg) }))
    launcher.on('download-status', s => send('launcher:download-status', s || {}))
    launcher.on('progress', p => { const current = Number(p?.current ?? p?.progress ?? p?.downloaded ?? 0); const total = Number(p?.total ?? 0); const percent = total > 0 ? Math.round(current / total * 100) : Number(p?.percent ?? p?.progress ?? 0); send('launcher:progress', { stage: 'minecraft', progress: Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0, current: p?.type || p?.name || 'files', received: current, total, message: `دانلود ${p?.type || 'فایل‌ها'}...` }) })
    launcher.on('error', error => { launcherProcess = null; const report = writeCrashReport(error, { username, version, loader }); send('launcher:crash', { message: error?.message || String(error), report }); if (!started) reject(error instanceof Error ? error : new Error(String(error))) })
    launcher.on('close', code => { launcherProcess = null; if (code && code !== 0) { const report = writeCrashReport(new Error(`Minecraft exited with code ${code}`), { username, version, loader, code }); send('launcher:crash', { message: `Minecraft با کد ${code} بسته شد.`, report }) } send('launcher:progress', { stage: 'closed', progress: 100, code, message: 'Minecraft بسته شد.' }) })
    launcherProcess = launcher
    launcher.launch(options).then(() => { started = true; send('launcher:progress', { stage: 'launched', progress: 100, message: 'Minecraft اجرا شد 🚀' }); resolve({ ok: true, version, javaVersion: java.version, loader, profileId: customVersion }) }).catch(error => { launcherProcess = null; const report = writeCrashReport(error, { username, version, loader }); send('launcher:crash', { message: error?.message || String(error), report }); reject(error) })
  })
}

app.whenReady().then(() => {
  createWindow()
  ipcMain.on('window:minimize', e => BrowserWindow.fromWebContents(e.sender)?.minimize())
  ipcMain.on('window:maximize', e => { const w = BrowserWindow.fromWebContents(e.sender); if (w) w.isMaximized() ? w.unmaximize() : w.maximize() })
  ipcMain.on('window:close', e => BrowserWindow.fromWebContents(e.sender)?.close())
  ipcMain.handle('app:get-version', () => app.getVersion())
  ipcMain.handle('app:open-external', (_, url) => shell.openExternal(url))
  ipcMain.handle('app:open-folder', (_, target) => shell.openPath(target || app.getPath('userData')))
  ipcMain.handle('app:toggle-devtools', (_, open) => { if (!mainWindow) return false; open ? mainWindow.webContents.openDevTools({ mode: 'detach' }) : mainWindow.webContents.closeDevTools(); return true })
  ipcMain.handle('app:clear-cache', () => { try { fs.rmSync(path.join(minecraftRoot(), 'cache'), { recursive: true, force: true }); return true } catch { return false } })
  ipcMain.handle('app:crash-reports', () => { try { fs.mkdirSync(crashRoot(), { recursive: true }); return fs.readdirSync(crashRoot()).filter(x => x.endsWith('.log')).sort().reverse() } catch { return [] } })
  ipcMain.handle('app:open-crash-reports', () => shell.openPath(crashRoot()))
  ipcMain.handle('app:check-updates', async () => { try { const latest = await fetchJson('https://api.github.com/repos/hirad990/BinerLauncher/releases/latest'); return { update: latest.tag_name !== `v${app.getVersion()}` && latest.tag_name !== app.getVersion(), version: latest.tag_name, name: latest.name, url: latest.html_url, notes: latest.body || '' } } catch (e) { return { update: false, error: e.message } } })
  ipcMain.handle('server:status', async (_, { host = 'Play.BinerCraft.ir', port = 25565 } = {}) => pingServer(host, port))
  ipcMain.handle('profile:get', () => readProfile())
  ipcMain.handle('profile:save', (_, p) => writeProfile({ username: String(p.username || '').trim(), memory: Number(p.memory) || 4096, version: String(p.version || '1.21.11'), loader: String(p.loader || 'vanilla'), profileId: String(p.profileId || ''), serverHost: String(p.serverHost || 'Play.BinerCraft.ir'), serverPort: Number(p.serverPort) || 25565, developerMode: Boolean(p.developerMode), fullscreen: Boolean(p.fullscreen), width: Number(p.width) || 1280, height: Number(p.height) || 720, snapshots: Boolean(p.snapshots), customArgs: Array.isArray(p.customArgs) ? p.customArgs : [] }))
  ipcMain.handle('minecraft:status', () => ({ running: Boolean(launcherProcess) }))
  ipcMain.handle('minecraft:versions', async (_, snapshots = false) => { const data = await fetchJson('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'); return data.versions.filter(v => snapshots || v.type === 'release').map(v => ({ id: v.id, type: v.type, releaseTime: v.releaseTime })).slice(0, snapshots ? 150 : 100) })
  ipcMain.handle('minecraft:install-loader', async (_, { loader, version }) => { const java = await ensureJava(app.getPath('userData'), p => send('launcher:progress', { stage: 'java', progress: p, message: `Java ${p}%` })); if (loader === 'fabric') return installFabric({ root: minecraftRoot(), minecraftVersion: version, javaPath: java.path, onProgress: p => send('launcher:progress', { stage: 'loader', progress: p, message: `Fabric ${p}%` }) }); if (loader === 'forge') return installForge({ root: minecraftRoot(), minecraftVersion: version, javaPath: java.path, onProgress: p => send('launcher:progress', { stage: 'loader', progress: p, message: `Forge ${p}%` }) }); throw new Error('Loader ناشناخته است.') })
  ipcMain.handle('minecraft:import-optifine', async () => { const result = await dialog.showOpenDialog(mainWindow, { title: 'انتخاب OptiFine JAR یا Installer', filters: [{ name: 'OptiFine', extensions: ['jar'] }], properties: ['openFile'] }); if (result.canceled) return null; const dir = path.join(minecraftRoot(), 'optifine'); fs.mkdirSync(dir, { recursive: true }); const source = result.filePaths[0]; const target = path.join(dir, path.basename(source)); fs.copyFileSync(source, target); try { send('launcher:progress', { stage: 'optifine', progress: 10, message: 'در حال نصب OptiFine...' }); const { spawn } = require('child_process'); await new Promise((resolve, reject) => { const p = spawn((readProfile()?.javaPath) || process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME || '', 'bin', process.platform === 'win32' ? 'java.exe' : 'java') : 'java', ['-jar', target, '--installClient', minecraftRoot()], { windowsHide: true }); p.on('error', reject); p.on('close', code => code === 0 ? resolve() : reject(new Error(`OptiFine installer exited with code ${code}`))) }); send('launcher:progress', { stage: 'optifine', progress: 100, message: 'OptiFine نصب شد.' }); return target } catch (e) { send('launcher:crash', { message: `OptiFine: ${e.message}` }); return target } })
  ipcMain.handle('minecraft:folders', () => ({ root: minecraftRoot(), userData: app.getPath('userData'), runtime: path.join(app.getPath('userData'), 'runtime'), crashes: crashRoot() }))
  ipcMain.handle('minecraft:launch', (_, payload) => launchMinecraft(payload))
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
