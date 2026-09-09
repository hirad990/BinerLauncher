const fs = require('fs')
const path = require('path')
const { execFile } = require('child_process')
const https = require('https')
const { pipeline } = require('stream/promises')
const { createWriteStream } = require('fs')
const AdmZip = require('adm-zip')

const DEFAULT_JAVA = 21

function requiredJavaForMinecraft(version) {
  const value = String(version || '')
  const match = value.match(/^1\.(\d+)(?:\.(\d+))?$/)
  if (!match) return DEFAULT_JAVA
  const minor = Number(match[1])
  const patch = Number(match[2] || 0)
  // Minecraft 1.20.5+ and all 1.21.x require Java 21.
  // 1.20.4 and older modern releases use Java 17.
  if (minor < 20) return 17
  if (minor === 20 && patch <= 4) return 17
  return 21
}

function execVersion(javaPath) {
  return new Promise(resolve => {
    execFile(javaPath, ['-version'], { windowsHide: true }, (error, stdout, stderr) => {
      if (error) return resolve(null)
      const text = `${stdout || ''}\n${stderr || ''}`
      const match = text.match(/version\s+"(\d+)(?:\.(\d+))?/) || text.match(/openjdk\s+(\d+)(?:\.(\d+))?/)
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
    candidates.push(`C:\\Program Files\\Eclipse Adoptium\\jdk-${requiredJava}\\*\\bin\\java.exe`)
  }
  candidates.push(process.platform === 'win32' ? 'java.exe' : 'java')
  return [...new Set(candidates)]
}

async function findSuitableJava(requiredJava) {
  for (const candidate of existingCandidates(requiredJava)) {
    if (candidate.includes('*')) continue
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
      if (response.statusCode !== 200) return reject(new Error(`Java download failed: HTTP ${response.statusCode}`))
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
  if (process.platform !== 'win32' || process.arch !== 'x64') {
    throw new Error('Automatic Java installation currently supports Windows x64 only.')
  }
  const root = managedJavaRoot(userData, requiredJava)
  fs.mkdirSync(root, { recursive: true })
  const archive = path.join(root, `temurin${requiredJava}.zip`)
  const url = `https://api.adoptium.net/v3/binary/latest/${requiredJava}/ga/windows/x64/jre/hotspot/normal/eclipse`
  await download(url, archive, onProgress)
  const zip = new AdmZip(archive)
  zip.extractAllTo(root, true)
  fs.unlinkSync(archive)
  const runtime = await findManagedJava(userData, requiredJava)
  if (!runtime) throw new Error(`Java ${requiredJava} نصب شد اما فایل java.exe پیدا نشد.`)
  return runtime
}

async function ensureJava(userData, onProgress, minecraftVersion) {
  const requiredJava = requiredJavaForMinecraft(minecraftVersion)
  const managed = await findManagedJava(userData, requiredJava)
  if (managed) return managed
  const system = await findSuitableJava(requiredJava)
  if (system) return system
  return installManagedJava(userData, requiredJava, onProgress)
}

module.exports = { ensureJava, requiredJavaForMinecraft, DEFAULT_JAVA }
