const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

async function json(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'BinerLauncher/0.2.0' } })
  if (!res.ok) throw new Error(`HTTP ${res.status} while requesting ${url}`)
  return res.json()
}

async function download(url, target, onProgress = () => {}) {
  const res = await fetch(url, { headers: { 'User-Agent': 'BinerLauncher/0.2.0' } })
  if (!res.ok) throw new Error(`HTTP ${res.status} while downloading ${url}`)
  const total = Number(res.headers.get('content-length')) || 0
  const file = fs.createWriteStream(target)
  let received = 0
  for await (const chunk of res.body) {
    received += chunk.length
    file.write(chunk)
    onProgress(total ? Math.round(received / total * 100) : 0, received, total)
  }
  file.end()
  await new Promise((resolve, reject) => { file.on('finish', resolve); file.on('error', reject) })
}

function runJava(javaPath, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(javaPath, args, { cwd, windowsHide: true })
    let stderr = ''
    child.stdout?.on('data', d => console.log('[Loader]', d.toString()))
    child.stderr?.on('data', d => { stderr += d.toString(); console.error('[Loader]', d.toString()) })
    child.on('error', reject)
    child.on('close', code => code === 0 ? resolve() : reject(new Error(stderr.trim() || `Installer exited with code ${code}`)))
  })
}

async function installFabric({ root, minecraftVersion, javaPath, onProgress = () => {} }) {
  const versions = await json(`https://meta.fabricmc.net/v2/versions/loader/${encodeURIComponent(minecraftVersion)}`)
  const stable = versions.find(v => v.loader?.stable) || versions[0]
  if (!stable) throw new Error(`Fabric برای Minecraft ${minecraftVersion} پیدا نشد.`)
  const loaderVersion = stable.loader.version
  const profileId = `${minecraftVersion}-fabric-${loaderVersion}`
  const profileUrl = `https://meta.fabricmc.net/v2/versions/loader/${encodeURIComponent(minecraftVersion)}/${encodeURIComponent(loaderVersion)}/profile/json`
  const profile = await json(profileUrl)
  const dir = path.join(root, 'versions', profileId)
  fs.mkdirSync(dir, { recursive: true })
  const out = path.join(dir, `${profileId}.json`)
  fs.writeFileSync(out, JSON.stringify({ ...profile, id: profileId }, null, 2), 'utf8')
  onProgress(100, 1, 1)
  return { loader: 'fabric', loaderVersion, profileId }
}

async function installForge({ root, minecraftVersion, javaPath, onProgress = () => {} }) {
  const promos = await json('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json')
  const forgeVersion = promos.promos?.[`${minecraftVersion}-recommended`] || promos.promos?.[`${minecraftVersion}-latest`]
  if (!forgeVersion) throw new Error(`Forge برای Minecraft ${minecraftVersion} پیدا نشد.`)
  const installerUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${minecraftVersion}-${forgeVersion}/forge-${minecraftVersion}-${forgeVersion}-installer.jar`
  const cache = path.join(root, 'cache')
  fs.mkdirSync(cache, { recursive: true })
  const installer = path.join(cache, `forge-${minecraftVersion}-${forgeVersion}-installer.jar`)
  if (!fs.existsSync(installer)) await download(installerUrl, installer, onProgress)
  await runJava(javaPath, ['-jar', installer, '--installClient', root], root)
  return { loader: 'forge', loaderVersion: forgeVersion, profileId: `forge-${minecraftVersion}-${forgeVersion}` }
}

function listInstalled(root) {
  const dir = path.join(root, 'versions')
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).filter(x => x.isDirectory()).map(x => x.name)
}

module.exports = { installFabric, installForge, listInstalled, download }
