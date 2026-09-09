const fs = require('fs')
const path = require('path')
const { execFile } = require('child_process')
const https = require('https')
const { pipeline } = require('stream/promises')
const { createWriteStream } = require('fs')
const AdmZip = require('adm-zip')

const DEFAULT_JAVA = 21
const SUPPORTED_JAVA = [8, 17, 21, 25]
const JAVA_PREF_PREFIX = '--biner-java='

function logJava(level, message, error = null, extra = null) {
  const prefix = '[BinerLauncher][Java]'
  const details = extra ? ` ${JSON.stringify(extra)}` : ''
  if (level === 'error') console.error(`${prefix} ${message}${details}`, error?.stack || error || '')
  else if (level === 'warn') console.warn(`${prefix} ${message}${details}`, error?.message || error || '')
  else console.log(`${prefix} ${message}${details}`)
}

function normalizeJavaSelection(selectedJava) {
  if (selectedJava === undefined || selectedJava === null || String(selectedJava).trim() === '' || String(selectedJava).toLowerCase() === 'auto') return null
  const value = Number(selectedJava)
  if (!SUPPORTED_JAVA.includes(value)) throw new Error(`نسخه Java انتخاب‌شده پشتیبانی نمی‌شود: ${selectedJava}`)
  return value
}

function requiredJavaForMinecraft(version) {
  const value = String(version || '').trim()
  const modern = value.match(/^1\.(\d+)(?:\.(\d+))?$/)
  if (!modern) {
    if (/^(?:2[6-9]|[3-9]\d)\./.test(value)) return 25
    return DEFAULT_JAVA
  }
  const minor = Number(modern[1])
  const patch = Number(modern[2] || 0)
  if (minor <= 16) return 8
  if (minor < 20 || (minor === 20 && patch <= 4)) return 17
  if (minor <= 21) return 21
  return 25
}

function readSelectedJava(userData) {
  try {
    const profile = JSON.parse(fs.readFileSync(path.join(userData, 'profile.json'), 'utf8'))
    const args = Array.isArray(profile?.customArgs) ? profile.customArgs : []
    const marker = args.find(arg => String(arg).startsWith(JAVA_PREF_PREFIX))
    return normalizeJavaSelection(marker ? String(marker).slice(JAVA_PREF_PREFIX.length) : 'auto')
  } catch {
    return null
  }
}

function execVersion(javaPath) {
  return new Promise(resolve => {
    execFile(javaPath, ['-version'], { windowsHide: true }, (error, stdout, stderr) => {
      if (error) return resolve(null)
      const text = `${stdout || ''}\n${stderr || ''}`
      const match = text.match(/version\s+["'](\d+)(?:\.(\d+))?/) || text.match(/openjdk\s+(\d+)(?:\.(\d+))?/)
      resolve(match ? Number(match[1]) : null)
    })
  })
}

function existingCandidates(requiredJava) {
  const candidates = []
  if (process.env.JAVA_HOME) candidates.push(path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java'))
  if (process.platform === 'win32') {
    candidates.push(`C:\\Program Files\\Java\\jdk-${requiredJava}\\bin\\java.exe`)
    candidates.push(`C:\\Program Files\\Eclipse Adoptium\\jdk-${requiredJava}\\bin\\java.exe`)
    candidates.push(`C:\\Program Files\\Eclipse Adoptium\\jre-${requiredJava}\\bin\\java.exe`)
  }
  candidates.push(process.platform === 'win32' ? 'java.exe' : 'java')
  return [...new Set(candidates)]
}

async function findSuitableJava(requiredJava) {
  for (const candidate of existingCandidates(requiredJava)) {
    const version = await execVersion(candidate)
    if (version === requiredJava) return { path: candidate, version, managed: false }
  }
  return null
}

function managedJavaRoot(userData, requiredJava) {
  return path.join(userData, 'runtime', `java-${requiredJava}`)
}

async function findManagedJava(userData, requiredJava) {
  const root = managedJavaRoot(userData, requiredJava)
  if (!fs.existsSync(root)) return null
  const entries = fs.readdirSync(root, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const java = process.platform === 'win32'
      ? path.join(root, entry.name, 'bin', 'java.exe')
      : path.join(root, entry.name, 'bin', 'java')
    if (fs.existsSync(java) && (await execVersion(java)) === requiredJava) return { path: java, version: requiredJava, managed: true }
  }
  return null
}

function download(url, destination, onProgress) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, response => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume()
        return download(new URL(response.headers.location, url).toString(), destination, onProgress).then(resolve, reject)
      }
      if (response.statusCode !== 200) {
        response.resume()
        return reject(new Error(`Java download failed: HTTP ${response.statusCode}`))
      }
      const total = Number(response.headers['content-length'] || 0)
      let received = 0
      const file = createWriteStream(destination)
      response.on('data', chunk => {
        received += chunk.length
        if (onProgress && total) onProgress(Math.round(received / total * 100), received, total)
      })
      pipeline(response, file).then(resolve).catch(reject)
    })
    request.on('error', reject)
  })
}

async function installManagedJava(userData, requiredJava, onProgress) {
  if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('Automatic Java installation currently supports Windows x64 only.')
  const root = managedJavaRoot(userData, requiredJava)
  fs.mkdirSync(root, { recursive: true })
  const archive = path.join(root, `temurin${requiredJava}.zip`)
  const url = `https://api.adoptium.net/v3/binary/latest/${requiredJava}/ga/windows/x64/jre/hotspot/normal/eclipse`
  logJava('info', `Installing Java ${requiredJava} from Adoptium`, null, { url, destination: root })
  try {
    await download(url, archive, onProgress)
    const zip = new AdmZip(archive)
    zip.extractAllTo(root, true)
    fs.unlinkSync(archive)
    const runtime = await findManagedJava(userData, requiredJava)
    if (!runtime) throw new Error(`Java ${requiredJava} نصب شد اما فایل java.exe پیدا نشد.`)
    logJava('info', `Java ${requiredJava} installed successfully`, null, { path: runtime.path })
    return runtime
  } catch (error) {
    logJava('error', `Java ${requiredJava} installation failed`, error, { url, archive })
    try { if (fs.existsSync(archive)) fs.unlinkSync(archive) } catch {}
    throw error
  }
}

async function ensureJava(userData, onProgress, minecraftVersion, selectedJava = 'auto') {
  const autoJava = requiredJavaForMinecraft(minecraftVersion)
  const profileJava = readSelectedJava(userData)
  const requestedJava = normalizeJavaSelection(selectedJava) ?? profileJava
  const requiredJava = requestedJava || autoJava
  logJava('info', `Checking Java runtime`, null, { minecraftVersion, mode: requestedJava ? 'manual' : 'auto', requiredJava, autoJava })
  if (requestedJava && requestedJava !== autoJava) logJava('warn', `Manual Java ${requestedJava} selected for Minecraft ${minecraftVersion}; recommended Java is ${autoJava}`)
  try {
    const managed = await findManagedJava(userData, requiredJava)
    if (managed) {
      logJava('info', `Using managed Java ${requiredJava}`, null, { path: managed.path })
      return managed
    }
    const system = await findSuitableJava(requiredJava)
    if (system) {
      logJava('info', `Using system Java ${requiredJava}`, null, { path: system.path })
      return system
    }
    logJava('warn', `Java ${requiredJava} was not found; installing managed runtime`)
    return installManagedJava(userData, requiredJava, onProgress)
  } catch (error) {
    logJava('error', `Java check failed for Minecraft ${minecraftVersion}`, error, { requiredJava })
    throw error
  }
}

module.exports = { ensureJava, requiredJavaForMinecraft, normalizeJavaSelection, DEFAULT_JAVA, SUPPORTED_JAVA, JAVA_PREF_PREFIX }
