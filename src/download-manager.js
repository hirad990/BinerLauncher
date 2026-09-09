const fs = require('fs')
const path = require('path')

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }) }
function safeTarget(baseDir, filename) {
  const clean = path.basename(String(filename || 'download.bin'))
  const target = path.resolve(baseDir, clean); const root = path.resolve(baseDir)
  if (!target.startsWith(root + path.sep)) throw new Error('مسیر دانلود غیرمجاز است.')
  return target
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

async function downloadFile(url, targetDir, filename, { retries = 4, onProgress, resume = true, signalProvider } = {}) {
  ensureDir(targetDir); const target = safeTarget(targetDir, filename); const temp = `${target}.part`; let lastError
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const signal = signalProvider?.(); const existing = resume && fs.existsSync(temp) ? fs.statSync(temp).size : 0
      const headers = { 'User-Agent': 'BinerLauncher/0.4.0' }; if (existing > 0) headers.Range = `bytes=${existing}-`
      const response = await fetch(url, { headers, signal })
      if (!(response.ok || response.status === 206)) throw new Error(`HTTP ${response.status}`)
      if (!response.body) throw new Error('Download stream unavailable.')
      const resumed = existing > 0 && response.status === 206
      const start = resumed ? existing : 0
      if (!resumed && existing > 0) fs.rmSync(temp, { force: true })
      const totalHeader = Number(response.headers.get('content-length')) || 0
      const total = resumed ? start + totalHeader : totalHeader
      let received = start
      const file = fs.createWriteStream(temp, { flags: resumed ? 'a' : 'w' }); const reader = response.body.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read(); if (done) break
          if (signalProvider?.()?.aborted) throw new Error('Download cancelled.')
          received += value.byteLength
          if (!file.write(Buffer.from(value))) await new Promise(resolve => file.once('drain', resolve))
          onProgress?.({ received, total, attempt, resumed })
        }
        await new Promise((resolve, reject) => file.end(error => error ? reject(error) : resolve()))
      } catch (e) { file.destroy(); throw e }
      fs.renameSync(temp, target)
      return { path: target, received, total, attempts: attempt, resumed }
    } catch (error) {
      lastError = error
      if (signalProvider?.()?.aborted) throw error
      if (attempt < retries) await sleep(600 * attempt)
    }
  }
  throw lastError || new Error('Download failed.')
}

module.exports = { downloadFile, safeTarget }
