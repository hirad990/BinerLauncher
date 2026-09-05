const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const { spawn } = require('child_process')
const crypto = require('crypto')
const { Client, Authenticator } = require('minecraft-launcher-core')

const isDev = !app.isPackaged
let launcherProcess = null

function dataPath() {
  return path.join(app.getPath('userData'), 'profile.json')
}

function readProfile() {
  try { return JSON.parse(fs.readFileSync(dataPath(), 'utf8')) } catch { return null }
}

function writeProfile(profile) {
  fs.mkdirSync(path.dirname(dataPath()), { recursive: true })
  fs.writeFileSync(dataPath(), JSON.stringify(profile, null, 2), 'utf8')
  return profile
}

function findJava() {
  const candidates = []
  if (process.env.JAVA_HOME) candidates.push(path.join(process.env.JAVA_HOME, 'bin', 'java.exe'))
  if (process.platform === 'win32') {
    candidates.push('C:\\Program Files\\Java\\jdk-21\\bin\\java.exe')
    candidates.push('C:\\Program Files\\Java\\jdk-17\\bin\\java.exe')
    candidates.push('C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.0.0-hotspot\\bin\\java.exe')
  }
  for (const p of candidates) if (fs.existsSync(p)) return p
  return process.platform === 'win32' ? 'java.exe' : 'java'
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1100, minHeight: 700,
    frame: false, backgroundColor: '#070b14', show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true
    }
  })
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'))
  win.once('ready-to-show', () => win.show())
  if (isDev) win.webContents.openDevTools({ mode: 'detach' })
}

async function launchMinecraft({ username, version, memory, server }) {
  if (launcherProcess) throw new Error('Minecraft is already running.')
  if (!username || username.trim().length < 3) throw new Error('یک نام کاربری معتبر وارد کنید.')

  const root = path.join(app.getPath('userData'), 'minecraft')
  const maxMemory = Math.max(1024, Number(memory) || 4096)
  const uuid = crypto.createHash('md5').update(`OfflinePlayer:${username}`).digest('hex')
  const auth = Authenticator.getAuth(username)
  auth.access_token = auth.access_token || '0'
  auth.client_token = auth.client_token || uuid
  auth.uuid = uuid
  auth.name = username

  const launcher = new Client()
  const options = {
    authorization: auth,
    root,
    version: { number: version, type: 'release' },
    memory: { max: `${maxMemory}M`, min: '1024M' },
    javaPath: findJava,
    overrides: { detached: false }
  }
  if (server?.host) options.server = { host: server.host, port: Number(server.port) || 25565 }

  return new Promise((resolve, reject) => {
    let settled = false
    const fail = error => { if (!settled) { settled = true; reject(error instanceof Error ? error : new Error(String(error))) } }
    launcher.on('debug', msg => console.log('[Minecraft]', msg))
    launcher.on('data', msg => console.log('[Minecraft]', msg))
    launcher.on('download', msg => console.log('[Minecraft download]', msg))
    launcher.on('error', fail)
    launcher.on('close', code => { launcherProcess = null; console.log('[Minecraft] exited', code) })
    launcherProcess = launcher
    launcher.launch(options)
      .then(() => { if (!settled) { settled = true; resolve({ ok: true, root, version }) } })
      .catch(fail)
  })
}

app.whenReady().then(() => {
  createWindow()

  ipcMain.on('window:minimize', event => BrowserWindow.fromWebContents(event.sender)?.minimize())
  ipcMain.on('window:maximize', event => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) win.isMaximized() ? win.unmaximize() : win.maximize()
  })
  ipcMain.on('window:close', event => BrowserWindow.fromWebContents(event.sender)?.close())

  ipcMain.handle('app:get-version', () => app.getVersion())
  ipcMain.handle('app:open-external', (_, url) => shell.openExternal(url))
  ipcMain.handle('profile:get', () => readProfile())
  ipcMain.handle('profile:save', (_, profile) => writeProfile({
    username: String(profile.username || '').trim(),
    memory: Number(profile.memory) || 4096,
    version: String(profile.version || '1.21.11'),
    serverHost: String(profile.serverHost || 'Play.BinerCraft.ir'),
    serverPort: Number(profile.serverPort) || 25565
  }))
  ipcMain.handle('minecraft:status', () => ({ running: Boolean(launcherProcess) }))
  ipcMain.handle('minecraft:launch', (_, payload) => launchMinecraft(payload))

  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
