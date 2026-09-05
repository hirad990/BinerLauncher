const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const { Client } = require('minecraft-launcher-core')
const { ensureJava } = require('./java-manager')

const isDev = !app.isPackaged
let launcherProcess = null
let mainWindow = null

function dataPath() { return path.join(app.getPath('userData'), 'profile.json') }
function readProfile() {
  try { return JSON.parse(fs.readFileSync(dataPath(), 'utf8')) } catch { return null }
}
function writeProfile(profile) {
  fs.mkdirSync(path.dirname(dataPath()), { recursive: true })
  fs.writeFileSync(dataPath(), JSON.stringify(profile, null, 2), 'utf8')
  return profile
}
function offlineUuid(username) {
  const hex = crypto.createHash('md5').update(`OfflinePlayer:${username}`).digest('hex')
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`
}
function createWindow() {
  mainWindow = new BrowserWindow({ width: 1440, height: 900, minWidth: 1100, minHeight: 700, frame: false, backgroundColor: '#070b14', show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } })
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'))
  mainWindow.once('ready-to-show', () => mainWindow.show())
  if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' })
}

async function launchMinecraft({ username, version, memory, serverHost, serverPort }) {
  if (launcherProcess) throw new Error('Minecraft is already running.')
  username = String(username || '').trim()
  if (username.length < 3 || username.length > 16) throw new Error('نام کاربری باید بین 3 تا 16 کاراکتر باشد.')
  version = String(version || '1.21.11')
  const root = path.join(app.getPath('userData'), 'minecraft')
  const maxMemory = Math.max(1024, Number(memory) || 4096)

  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('java:status', { stage: 'checking', progress: 0, message: 'در حال بررسی Java...' })
  const java = await ensureJava(app.getPath('userData'), (progress, received, total) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('java:status', { stage: 'downloading', progress, received, total, message: `در حال نصب Java... ${progress}%` })
  })
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('java:status', { stage: 'ready', progress: 100, version: java.version, message: `Java ${java.version} آماده است.` })

  const uuid = offlineUuid(username)
  const authorization = { access_token: '0', client_token: uuid.replaceAll('-', ''), uuid, name: username }
  const options = {
    authorization, root,
    version: { number: version, type: 'release' },
    memory: { max: `${maxMemory}M`, min: '1024M' },
    javaPath: java.path
  }
  if (serverHost) options.server = { host: String(serverHost), port: Number(serverPort) || 25565 }
  const launcher = new Client()
  return new Promise((resolve, reject) => {
    let started = false
    launcher.on('debug', msg => console.log('[Minecraft]', msg))
    launcher.on('data', msg => console.log('[Minecraft]', msg))
    launcher.on('download', msg => console.log('[Minecraft download]', msg))
    launcher.on('error', error => { launcherProcess = null; if (!started) reject(error instanceof Error ? error : new Error(String(error))) })
    launcher.on('close', code => { launcherProcess = null; console.log('[Minecraft] exited', code) })
    launcherProcess = launcher
    launcher.launch(options)
      .then(() => { started = true; resolve({ ok: true, root, version, javaVersion: java.version }) })
      .catch(error => { launcherProcess = null; reject(error) })
  })
}

app.whenReady().then(() => {
  createWindow()
  ipcMain.on('window:minimize', event => BrowserWindow.fromWebContents(event.sender)?.minimize())
  ipcMain.on('window:maximize', event => { const win = BrowserWindow.fromWebContents(event.sender); if (win) win.isMaximized() ? win.unmaximize() : win.maximize() })
  ipcMain.on('window:close', event => BrowserWindow.fromWebContents(event.sender)?.close())
  ipcMain.handle('app:get-version', () => app.getVersion())
  ipcMain.handle('app:open-external', (_, url) => shell.openExternal(url))
  ipcMain.handle('profile:get', () => readProfile())
  ipcMain.handle('profile:save', (_, profile) => writeProfile({ username: String(profile.username || '').trim(), memory: Number(profile.memory) || 4096, version: String(profile.version || '1.21.11'), serverHost: String(profile.serverHost || 'Play.BinerCraft.ir'), serverPort: Number(profile.serverPort) || 25565 }))
  ipcMain.handle('minecraft:status', () => ({ running: Boolean(launcherProcess) }))
  ipcMain.handle('minecraft:launch', (_, payload) => launchMinecraft(payload))
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
