const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const AdmZip = require('adm-zip')

function safeName(value, fallback = 'item') {
  const name = String(value || '').trim().replace(/[^A-Za-z0-9._ -]/g, '_').replace(/\s+/g, ' ').slice(0, 80)
  return name || fallback
}

function registerBinerCore({ ipcMain, app, minecraftRoot, fetchJson }) {
  const root = minecraftRoot()
  const instancesRoot = () => path.join(app.getPath('userData'), 'instances')
  const backupRoot = () => path.join(app.getPath('userData'), 'backups')
  const ensure = dir => fs.mkdirSync(dir, { recursive: true })
  const instanceDir = id => path.join(instancesRoot(), safeName(id, 'default'))
  const listDirectories = dir => { try { ensure(dir); return fs.readdirSync(dir, { withFileTypes: true }).filter(x => x.isDirectory()).map(x => x.name) } catch { return [] } }
  const listFiles = (dir, ext) => { try { ensure(dir); return fs.readdirSync(dir).filter(x => !ext || x.toLowerCase().endsWith(ext)).sort() } catch { return [] } }
  const dirSize = dir => { let total = 0; try { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) total += dirSize(p); else { try { total += fs.statSync(p).size } catch {} } } } catch {} return total }
  const removeSafe = (target, allowedRoot) => { const r = path.resolve(target); const b = path.resolve(allowedRoot); if (!r.startsWith(b + path.sep)) throw new Error('مسیر غیرمجاز است.'); fs.rmSync(r, { recursive: true, force: true }) }

  ipcMain.handle('biner:instances:list', () => listDirectories(instancesRoot()).map(id => ({ id, path: instanceDir(id), size: dirSize(instanceDir(id)) })))
  ipcMain.handle('biner:instances:create', (_, data = {}) => {
    const id = safeName(data.id || data.name, `instance-${Date.now()}`); const dir = instanceDir(id); ensure(dir)
    for (const folder of ['mods', 'config', 'resourcepacks', 'shaderpacks', 'saves', 'screenshots']) ensure(path.join(dir, folder))
    const meta = { id, name: String(data.name || id), version: String(data.version || '1.21.11'), loader: String(data.loader || 'vanilla'), memory: Number(data.memory) || 4096, createdAt: new Date().toISOString() }
    fs.writeFileSync(path.join(dir, 'instance.json'), JSON.stringify(meta, null, 2), 'utf8'); return meta
  })
  ipcMain.handle('biner:instances:delete', (_, id) => { removeSafe(instanceDir(id), instancesRoot()); return true })
  ipcMain.handle('biner:instances:open', (_, id) => require('electron').shell.openPath(instanceDir(id)))

  ipcMain.handle('biner:mods:list', (_, instanceId = '') => { const dir = instanceId ? path.join(instanceDir(instanceId), 'mods') : path.join(root, 'mods'); return listFiles(dir, '.jar').map(name => ({ name, path: path.join(dir, name), size: fs.statSync(path.join(dir, name)).size })) })
  ipcMain.handle('biner:mods:search', async (_, query = '') => {
    const q = encodeURIComponent(String(query).trim()); if (!q) return []
    const data = await fetchJson(`https://api.modrinth.com/v2/search?query=${q}&limit=20&index=relevance`)
    return (data.hits || []).map(x => ({ id: x.project_id, slug: x.slug, title: x.title, description: x.description, downloads: x.downloads, icon: x.icon_url, page: `https://modrinth.com/mod/${x.slug}` }))
  })
  ipcMain.handle('biner:mods:install', async (_, { projectId, versionId, instanceId = '', gameVersion = '1.21.11', loader = 'fabric' } = {}) => {
    if (!projectId) throw new Error('Mod مشخص نشده است.')
    const gv = encodeURIComponent(JSON.stringify(gameVersion)); const ld = encodeURIComponent(JSON.stringify(loader))
    const versions = await fetchJson(`https://api.modrinth.com/v2/project/${encodeURIComponent(projectId)}/version?game_versions=[${gv}]&loaders=[${ld}]`)
    const selected = versionId ? versions.find(v => v.id === versionId) : versions[0]; if (!selected?.files?.length) throw new Error('نسخه سازگار این Mod پیدا نشد.')
    const file = selected.files.find(f => f.primary) || selected.files[0]; const response = await fetch(file.url); if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`)
    const targetDir = instanceId ? path.join(instanceDir(instanceId), 'mods') : path.join(root, 'mods'); ensure(targetDir)
    const target = path.join(targetDir, path.basename(file.filename)); fs.writeFileSync(target, Buffer.from(await response.arrayBuffer())); return { ok: true, file: path.basename(target), path: target, version: selected.id }
  })

  ipcMain.handle('biner:worlds:list', (_, instanceId = '') => { const dir = instanceId ? path.join(instanceDir(instanceId), 'saves') : path.join(root, 'saves'); return listDirectories(dir).map(name => ({ name, path: path.join(dir, name), size: dirSize(path.join(dir, name)) })) })
  ipcMain.handle('biner:worlds:delete', (_, { name, instanceId = '' } = {}) => { const base = instanceId ? path.join(instanceDir(instanceId), 'saves') : path.join(root, 'saves'); removeSafe(path.join(base, safeName(name)), base); return true })

  ipcMain.handle('biner:backups:create', (_, { source = 'worlds', name = '', instanceId = '' } = {}) => {
    const base = instanceId ? instanceDir(instanceId) : root; const sourceDir = source === 'mods' ? path.join(base, 'mods') : source === 'resourcepacks' ? path.join(base, 'resourcepacks') : source === 'shaderpacks' ? path.join(base, 'shaderpacks') : path.join(base, 'saves')
    if (!fs.existsSync(sourceDir)) throw new Error('داده‌ای برای Backup وجود ندارد.')
    const id = `${safeName(name || source)}-${new Date().toISOString().replace(/[:.]/g, '-')}`; const zipPath = path.join(backupRoot(), `${id}.zip`); ensure(backupRoot()); const zip = new AdmZip(); zip.addLocalFolder(sourceDir, source); zip.writeZip(zipPath); return { name: path.basename(zipPath), path: zipPath, size: fs.statSync(zipPath).size }
  })
  ipcMain.handle('biner:backups:list', () => listFiles(backupRoot(), '.zip').map(name => ({ name, path: path.join(backupRoot(), name), size: fs.statSync(path.join(backupRoot(), name)).size })))
  ipcMain.handle('biner:backups:restore', (_, { file, instanceId = '' } = {}) => { const target = path.join(backupRoot(), path.basename(String(file || ''))); if (!fs.existsSync(target)) throw new Error('Backup پیدا نشد.'); const base = instanceId ? instanceDir(instanceId) : root; new AdmZip(target).extractAllTo(base, true); return true })

  ipcMain.handle('biner:resources:list', (_, { type = 'resourcepacks', instanceId = '' } = {}) => { const base = instanceId ? instanceDir(instanceId) : root; const dir = path.join(base, type === 'shaderpacks' ? 'shaderpacks' : 'resourcepacks'); return listFiles(dir).filter(x => !x.startsWith('.')).map(name => ({ name, path: path.join(dir, name), size: fs.statSync(path.join(dir, name)).size })) })
  ipcMain.handle('biner:storage:stats', () => ({ root: minecraftRoot(), totalBytes: dirSize(minecraftRoot()), mods: dirSize(path.join(minecraftRoot(), 'mods')), saves: dirSize(path.join(minecraftRoot(), 'saves')), resourcepacks: dirSize(path.join(minecraftRoot(), 'resourcepacks')), shaderpacks: dirSize(path.join(minecraftRoot(), 'shaderpacks')), instances: dirSize(instancesRoot()), backups: dirSize(backupRoot()) }))
  ipcMain.handle('biner:diagnostics', () => ({ electron: process.versions.electron, node: process.versions.node, platform: process.platform, arch: process.arch, launcherVersion: app.getVersion(), minecraftRoot: minecraftRoot(), instances: listDirectories(instancesRoot()).length, mods: listFiles(path.join(root, 'mods'), '.jar').length, worlds: listDirectories(path.join(root, 'saves')).length }))
  ipcMain.handle('biner:file-hash', async (_, file) => { const hash = crypto.createHash('sha256'); await new Promise((resolve, reject) => { const stream = fs.createReadStream(file); stream.on('data', chunk => hash.update(chunk)); stream.on('end', resolve); stream.on('error', reject) }); return hash.digest('hex') })
}

module.exports = { registerBinerCore }
