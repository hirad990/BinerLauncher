const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const { Client } = require('minecraft-launcher-core')
const { ensureJava } = require('./java-manager')
const { installFabric, installForge, listInstalled } = require('./loader-manager')

const isDev = !app.isPackaged
let launcherProcess = null
let mainWindow = null
const dataPath = () => path.join(app.getPath('userData'), 'profile.json')
const minecraftRoot = () => path.join(app.getPath('userData'), 'minecraft')
function readProfile() { try { return JSON.parse(fs.readFileSync(dataPath(), 'utf8')) } catch { return null } }
function writeProfile(profile) { fs.mkdirSync(path.dirname(dataPath()), { recursive: true }); fs.writeFileSync(dataPath(), JSON.stringify(profile, null, 2), 'utf8'); return profile }
function offlineUuid(username) { const hex = crypto.createHash('md5').update(`OfflinePlayer:${username}`).digest('hex'); return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}` }
function send(channel, payload) { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload) }
async function fetchJson(url) { const r = await fetch(url, { headers: { 'User-Agent': 'BinerLauncher/0.2.0' } }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() }

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
  if (loader === 'fabric') {
    customVersion = profileId || listInstalled(root).find(v => v.startsWith(`${version}-fabric-`)) || ''
    if (!customVersion) { const r = await installFabric({ root, minecraftVersion: version, javaPath: java.path, onProgress: p => send('launcher:progress', { stage: 'loader', progress: p, message: `نصب Fabric ${p}%` }) }); customVersion = r.profileId }
  } else if (loader === 'forge') {
    customVersion = profileId || listInstalled(root).find(v => v.startsWith(`forge-${version}-`)) || ''
    if (!customVersion) { const r = await installForge({ root, minecraftVersion: version, javaPath: java.path, onProgress: p => send('launcher:progress', { stage: 'loader', progress: p, message: `نصب Forge ${p}%` }) }); customVersion = r.profileId }
  }

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
    launcher.on('progress', p => { const n = Number(p?.percent ?? p?.progress ?? 0); send('launcher:progress', { stage: 'minecraft', progress: Number.isFinite(n) ? Math.round(n) : 0, current: p?.type || p?.name || 'files', message: `دانلود ${p?.type || 'فایل‌ها'}...` }) })
    launcher.on('error', error => { launcherProcess = null; if (!started) reject(error instanceof Error ? error : new Error(String(error))) })
    launcher.on('close', code => { launcherProcess = null; send('launcher:progress', { stage: 'closed', progress: 100, code, message: 'Minecraft بسته شد.' }) })
    launcherProcess = launcher
    launcher.launch(options).then(() => { started = true; send('launcher:progress', { stage: 'launched', progress: 100, message: 'Minecraft اجرا شد 🚀' }); resolve({ ok: true, version, javaVersion: java.version, loader, profileId: customVersion }) }).catch(error => { launcherProcess = null; reject(error) })
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
  ipcMain.handle('profile:get', () => readProfile())
  ipcMain.handle('profile:save', (_, p) => writeProfile({ username: String(p.username || '').trim(), memory: Number(p.memory) || 4096, version: String(p.version || '1.21.11'), loader: String(p.loader || 'vanilla'), profileId: String(p.profileId || ''), serverHost: String(p.serverHost || 'Play.BinerCraft.ir'), serverPort: Number(p.serverPort) || 25565, developerMode: Boolean(p.developerMode), fullscreen: Boolean(p.fullscreen), width: Number(p.width) || 1280, height: Number(p.height) || 720, snapshots: Boolean(p.snapshots), customArgs: Array.isArray(p.customArgs) ? p.customArgs : [] }))
  ipcMain.handle('minecraft:status', () => ({ running: Boolean(launcherProcess) }))
  ipcMain.handle('minecraft:versions', async (_, snapshots = false) => { const data = await fetchJson('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'); return data.versions.filter(v => snapshots || v.type === 'release').map(v => ({ id: v.id, type: v.type, releaseTime: v.releaseTime })).slice(0, snapshots ? 150 : 100) })
  ipcMain.handle('minecraft:install-loader', async (_, { loader, version }) => { const java = await ensureJava(app.getPath('userData'), p => send('launcher:progress', { stage: 'java', progress: p, message: `Java ${p}%` })); if (loader === 'fabric') return installFabric({ root: minecraftRoot(), minecraftVersion: version, javaPath: java.path, onProgress: p => send('launcher:progress', { stage: 'loader', progress: p, message: `Fabric ${p}%` }) }); if (loader === 'forge') return installForge({ root: minecraftRoot(), minecraftVersion: version, javaPath: java.path, onProgress: p => send('launcher:progress', { stage: 'loader', progress: p, message: `Forge ${p}%` }) }); throw new Error('Loader ناشناخته است.') })
  ipcMain.handle('minecraft:import-optifine', async () => { const result = await dialog.showOpenDialog(mainWindow, { title: 'انتخاب OptiFine JAR', filters: [{ name: 'OptiFine', extensions: ['jar'] }], properties: ['openFile'] }); if (result.canceled) return null; const dir = path.join(minecraftRoot(), 'optifine'); fs.mkdirSync(dir, { recursive: true }); const target = path.join(dir, path.basename(result.filePaths[0])); fs.copyFileSync(result.filePaths[0], target); return target })
  ipcMain.handle('minecraft:folders', () => ({ root: minecraftRoot(), userData: app.getPath('userData'), runtime: path.join(app.getPath('userData'), 'runtime') }))
  ipcMain.handle('minecraft:launch', (_, payload) => launchMinecraft(payload))
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
