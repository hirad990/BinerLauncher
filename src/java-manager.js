const fs = require('fs')
const path = require('path')
const { spawn, execFile } = require('child_process')
const https = require('https')
const { pipeline } = require('stream/promises')
const { createWriteStream } = require('fs')
const AdmZip = require('adm-zip')

const REQUIRED_JAVA = 21

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

function existingCandidates() {
  const candidates = []
  if (process.env.JAVA_HOME) candidates.push(path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java'))
  if (process.platform === 'win32') {
    candidates.push('C:\\Program Files\\Java\\jdk-21\\bin\\java.exe')
    candidates.push('C:\\Program Files\\Java\\jdk-17\\bin\\java.exe')
    candidates.push('C:\\Program Files\\Eclipse Adoptium\\jdk-21\\bin\\java.exe')
    candidates.push('C:\\Program Files\\Eclipse Adoptium\\jdk-17\\bin\\java.exe')
  }
  candidates.push(process.platform === 'win32' ? 'java.exe' : 'java')
  return [...new Set(candidates)]
}

async function findSuitableJava() {
  for (const candidate of existingCandidates()) {
    const version = await execVersion(candidate)
    if (version && version >= REQUIRED_JAVA) return { path: candidate, version, managed: false }
  }
  return null
}

function managedJavaRoot(userData) {
  return path.join(userData, 'runtime', `java-${REQUIRED_JAVA}`)
}

async function findManagedJava(userData) {
  const root = managedJavaRoot(userData)
  if (!fs.existsSync(root)) return null
  const entries = fs.readdirSync(root, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const java = process.platform === 'win32'
      ? path.join(root, entry.name, 'bin', 'java.exe')
      : path.join(root, entry.name, 'bin', 'java')
    if (fs.existsSync(java) && (await execVersion(java)) >= REQUIRED_JAVA) return { path: java, version: REQUIRED_JAVA, managed: true }
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
      response.on('data', chunk => {
        received += chunk.length
        if (onProgress && total) onProgress(Math.round(received / total * 100), received, total)
      })
      const file = createWriteStream(destination)
      pipeline(response, file).then(resolve).catch(reject)
    })
    request.on('error', reject)
  })
}

async function installManagedJava(userData, onProgress) {
  if (process.platform !== 'win32' || process.arch !== 'x64') {
    throw new Error('Automatic Java installation currently supports Windows x64 only.')
  }
  const root = managedJavaRoot(userData)
  fs.mkdirSync(root, { recursive: true })
  const archive = path.join(root, 'temurin21.zip')
  const url = 'https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jre/hotspot/normal/eclipse'
  await download(url, archive, onProgress)
  const zip = new AdmZip(archive)
  zip.extractAllTo(root, true)
  fs.unlinkSync(archive)
  const runtime = await findManagedJava(userData)
  if (!runtime) throw new Error('Java 21 نصب شد اما فایل java.exe پیدا نشد.')
  return runtime
}

async function ensureJava(userData, onProgress) {
  const managed = await findManagedJava(userData)
  if (managed) return managed
  const system = await findSuitableJava()
  if (system) return system
  return installManagedJava(userData, onProgress)
}

module.exports = { ensureJava, REQUIRED_JAVA }
