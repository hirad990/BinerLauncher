const fs = require('fs')
const path = require('path')

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function safeTarget(baseDir, filename) {
  const clean = path.basename(String(filename || 'download.bin'))
  const target = path.resolve(baseDir, clean)
  const root = path.resolve(baseDir)
  if (!target.startsWith(root + path.sep)) throw new Error('مسیر دانلود غیرمجاز است.')
  return target
}

async function downloadFile(url, targetDir, filename, { retries = 3, onProgress } = {}) {
  ensureDir(targetDir)
  const target = safeTarget(targetDir, filename)
  const temp = `${target}.part`
  let lastError

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': 'BinerLauncher/0.3.0' } })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      if (!response.body) throw new Error('Download stream unavailable.')

      const total = Number(response.headers.get('content-length')) || 0
      let received = 0
      const file = fs.createWriteStream(temp)
      const reader = response.body.getReader()

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          received += value.byteLength
          if (!file.write(Buffer.from(value))) await new Promise(resolve => file.once('drain', resolve))
          if (onProgress) onProgress({ received, total, attempt })
        }
        await new Promise((resolve, reject) => {
          file.end(error => error ? reject(error) : resolve())
        })
      } catch (error) {
        file.destroy()
        throw error
      }

      fs.renameSync(temp, target)
      return { path: target, received, total, attempts: attempt }
    } catch (error) {
      lastError = error
      try { fs.rmSync(temp, { force: true }) } catch {}
      if (attempt < retries) await new Promise(resolve => setTimeout(resolve, 500 * attempt))
    }
  }

  throw lastError || new Error('Download failed.')
}

module.exports = { downloadFile }
