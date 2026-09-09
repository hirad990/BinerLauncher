(() => {
  'use strict'
  const $ = s => document.querySelector(s)
  const $$ = s => [...document.querySelectorAll(s)]
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c])
  const toast = message => { const e = $('#toast'); if (!e) return; e.textContent = String(message); e.classList.add('show'); setTimeout(() => e.classList.remove('show'), 2500) }
  const api = window.binerCore
  if (!api) return

  const style = document.createElement('style')
  style.textContent = `#v050{padding-bottom:30px}#v050 .vhead{display:flex;justify-content:space-between;align-items:center;gap:15px;padding:22px;border:1px solid #ffffff12;border-radius:20px;background:#0d1421;margin-bottom:16px}#v050 .vhead p{color:#8b9ab0;margin:6px 0 0}.vgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.vcard{background:#0d1421;border:1px solid #ffffff10;border-radius:17px;padding:17px}.vcard.wide{grid-column:1/-1}.vcard h3{margin:4px 0 7px}.vcard p,.vmuted{color:#8796aa;font-size:13px}.vrow{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;background:#080e18;border-radius:11px;margin-top:7px}.vrow small{color:#7d8ca2}.vactions{display:flex;gap:8px;flex-wrap:wrap;margin-top:11px}.vinput{width:100%;box-sizing:border-box;padding:11px 13px;border-radius:11px;border:1px solid #ffffff14;background:#080e18;color:#fff;outline:none}.vlist{max-height:300px;overflow:auto}.vstat{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.vstat>div{padding:10px;background:#080e18;border-radius:10px}.vstat b{display:block;font-size:18px}.vstat small{color:#748298}@media(max-width:1000px){.vgrid{grid-template-columns:1fr}.vcard.wide{grid-column:auto}.vstat{grid-template-columns:repeat(2,1fr)}}`
  document.head.appendChild(style)

  const sec = document.createElement('section')
  sec.id = 'v050'; sec.className = 'section hidden-section'
  sec.innerHTML = `<div class="vhead"><div><small>BINERLAUNCHER 1.0.0</small><h2>مرکز مدیریت Minecraft</h2><p>مدیریت Instance، Mod، Modpack، Performance، World، Resource Pack، Shader، Backup، Download، Logs و Account.</p></div><b>MANAGEMENT CENTER</b></div><div class="vgrid">
  <article class="vcard wide"><h3>Instance Manager</h3><p>محیط‌های مستقل Minecraft را بساز و مدیریت کن.</p><div class="vactions"><input id="viName" class="vinput" placeholder="نام Instance" style="max-width:300px"><button class="primary" id="viCreate">ساخت Instance</button><button class="ghost" id="viRefresh">Refresh</button></div><div class="vlist" id="viList"></div></article>
  <article class="vcard wide"><h3>Mod Manager</h3><div class="vactions"><input id="vmSearch" class="vinput" placeholder="جستجوی Mod در Modrinth" style="max-width:420px"><button class="primary" id="vmGo">جستجو</button></div><div class="vlist" id="vmList"></div></article>
  <article class="vcard wide"><h3>Modpack Manager</h3><p>Manifest سازگار با Instance فعلی بساز یا یک Manifest محلی را وارد کن.</p><div class="vactions"><input id="vpName" class="vinput" placeholder="نام Modpack" style="max-width:280px"><button class="primary" id="vpExport">Export Manifest</button><button class="ghost" id="vpImport">Import Manifest</button></div></article>
  <article class="vcard"><h3>Performance Center</h3><div class="vstat"><div><small>RAM</small><b id="vRam">—</b></div><div><small>Preset</small><b id="vPreset">—</b></div><div><small>Fast</small><b id="vFast">—</b></div><div><small>Java</small><b>AUTO</b></div></div><div class="vactions"><button class="primary" id="vBoost">Apply Performance</button></div></article>
  <article class="vcard"><h3>Repair Center 2.0</h3><p>سلامت فایل‌ها و Runtime را بررسی و تعمیر کن.</p><div id="vDiag" class="vmuted">آماده بررسی.</div><div class="vactions"><button class="primary" id="vScan">Scan</button><button class="ghost" id="vFix">Repair</button></div></article>
  <article class="vcard"><h3>World Manager</h3><div id="vWorlds" class="vlist"><div class="vmuted">یک Instance انتخاب کنید.</div></div><div class="vactions"><button class="primary" id="vWorldRefresh">Refresh Worlds</button><button class="ghost" id="vWorldFolder">Open Folder</button></div></article>
  <article class="vcard"><h3>Resource Pack & Shader</h3><div class="vactions"><button class="primary" id="vResource">Resource Packs</button><button class="ghost" id="vShader">Shaders</button></div></article>
  <article class="vcard"><h3>Backup Center</h3><div id="vBackups" class="vlist"><div class="vmuted">Backupها آماده بارگذاری.</div></div><div class="vactions"><button class="primary" id="vBackup">Create Backup</button><button class="ghost" id="vBackRefresh">Refresh</button></div></article>
  <article class="vcard wide"><h3>Download Manager</h3><div id="vDownloads" class="vlist"><div class="vmuted">دانلود فعالی وجود ندارد.</div></div><button class="ghost" id="vDlRefresh">Refresh Downloads</button></article>
  <article class="vcard wide"><h3>Minecraft Log Viewer</h3><div id="vLogs" style="height:220px;overflow:auto;padding:12px;background:#060a11;border-radius:11px;font:12px Consolas,monospace;white-space:pre-wrap;color:#b8c4d5">منتظر Log...</div><div class="vactions"><button class="ghost" id="vLogClear">Clear</button><button class="ghost" id="vCrash">Open Crash Reports</button></div></article>
  <article class="vcard"><h3>Server Center</h3><input id="vHost" class="vinput" value="Play.BinerCraft.ir"><div class="vactions"><button class="primary" id="vPing">Check Server</button></div><div id="vServer" class="vmuted"></div></article>
  <article class="vcard"><h3>Account / Profile</h3><div id="vAccounts" class="vlist"></div><div class="vactions"><input id="vAccount" class="vinput" placeholder="Offline username" style="max-width:220px"><button class="primary" id="vAddAccount">Add Account</button></div></article>
  <article class="vcard"><h3>Screenshot Manager</h3><p>Screenshotهای Minecraft را مستقیم باز کن.</p><button class="primary" id="vScreens">Open Screenshots</button></article>
  <article class="vcard"><h3>Launcher Customization</h3><p>مقیاس رابط را تنظیم کن.</p><div class="vactions"><button class="primary" id="vScaleDown">Zoom −</button><button class="ghost" id="vScaleUp">Zoom +</button></div></article></div>`
  document.querySelector('.content')?.appendChild(sec)

  const nav = document.querySelector('.sidebar nav')
  if (nav && !nav.querySelector('[data-section="v050"]')) {
    const button = document.createElement('button'); button.className = 'nav-item'; button.dataset.section = 'v050'
    button.innerHTML = '<i class="fa-solid fa-toolbox" aria-hidden="true"></i><span>مرکز مدیریت</span>'
    nav.appendChild(button)
    button.addEventListener('click', () => { $$('.nav-item').forEach(x => x.classList.toggle('active', x === button)); $$('.section').forEach(x => x.classList.toggle('hidden-section', x.id !== 'v050')) })
  }

  let selected = ''
  const loadInstances = async () => {
    const list = await api.instances.list(); const items = Array.isArray(list) ? list : []
    $('#viList').innerHTML = items.length ? items.map(x => `<div class="vrow"><span><b>${esc(x.name || x.id)}</b><br><small>${esc(x.version || 'Unknown')} • ${esc(x.loader || 'vanilla')}</small></span><span><button class="ghost" data-instance-open="${esc(x.id)}">Open</button> <button class="ghost" data-instance-del="${esc(x.id)}">Delete</button></span></div>`).join('') : '<div class="vmuted">Instanceی وجود ندارد.</div>'
    $$('[data-instance-open]').forEach(b => b.onclick = () => { selected = b.dataset.instanceOpen; renderWorlds() })
    $$('[data-instance-del]').forEach(b => b.onclick = async () => { await api.instances.delete(b.dataset.instanceDel); if (selected === b.dataset.instanceDel) selected = ''; await loadInstances(); renderWorlds() })
  }
  const ensureSelected = async () => { if (selected) return selected; const list = await api.instances.list(); if (list?.length) { selected = list[0].id; return selected } const created = await api.instances.create({ name: `Biner-${Date.now()}`, version: '1.21.11', loader: 'vanilla', memory: 4096 }); selected = created.id; await loadInstances(); return selected }
  $('#viCreate').onclick = async () => { try { const name = $('#viName').value.trim() || 'Biner Instance'; const created = await api.instances.create({ name, version: '1.21.11', loader: 'vanilla', memory: 4096 }); selected = created.id; $('#viName').value = ''; await loadInstances(); toast('Instance ساخته شد.') } catch (e) { toast(e.message) } }
  $('#viRefresh').onclick = loadInstances

  const searchMods = async () => { const query = $('#vmSearch').value.trim(); if (!query) return; $('#vmList').innerHTML = '<div class="vmuted">در حال جستجو در Modrinth...</div>'; try { const results = await api.mods.search(query); $('#vmList').innerHTML = (results || []).map(x => `<div class="vrow"><span><b>${esc(x.title)}</b><br><small>${esc(x.description || '')}</small></span><span><button class="ghost" data-mod-open="${esc(x.page)}">Open</button><button class="primary" data-mod-install="${esc(x.id)}">Install</button></span></div>`).join('') || '<div class="vmuted">نتیجه‌ای پیدا نشد.</div>'; $$('[data-mod-open]').forEach(b => b.onclick = () => window.biner.openExternal(b.dataset.modOpen)); $$('[data-mod-install]').forEach(b => b.onclick = async () => { try { const instanceId = await ensureSelected(); const p = await window.biner.getProfile() || {}; await api.mods.install({ projectId: b.dataset.modInstall, instanceId, gameVersion: p.version || '1.21.11', loader: p.loader && p.loader !== 'vanilla' ? p.loader : 'fabric' }); toast('Mod نصب شد.') } catch (e) { toast(e.message) } }) } catch (e) { $('#vmList').textContent = e.message } }
  $('#vmGo').onclick = searchMods; $('#vmSearch').addEventListener('keydown', e => { if (e.key === 'Enter') searchMods() })

  $('#vpExport').onclick = async () => { try { const p = await window.biner.getProfile() || {}; const instanceId = await ensureSelected(); const mods = await api.mods.list(instanceId); const manifest = { formatVersion: 1, name: $('#vpName').value.trim() || 'BinerModpack', minecraft: { version: p.version || '1.21.11', loader: p.loader || 'vanilla' }, files: mods.map(m => ({ path: `mods/${m.name}`, size: m.size })), generatedBy: 'BinerLauncher 1.0.0', createdAt: new Date().toISOString() }; const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = manifest.name.replace(/[^\w-]+/g, '_') + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); toast('Manifest export شد.') } catch (e) { toast(e.message) } }
  $('#vpImport').onclick = () => { const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json'; input.onchange = async () => { const file = input.files?.[0]; if (!file) return; try { const manifest = JSON.parse(await file.text()); if (!manifest?.minecraft?.version) throw new Error('Manifest نامعتبر است.'); const created = await api.instances.create({ name: manifest.name || 'Imported Modpack', version: manifest.minecraft.version, loader: manifest.minecraft.loader || 'vanilla', memory: 4096 }); selected = created.id; await loadInstances(); toast('Modpack به‌صورت Instance وارد شد.') } catch (e) { toast(e.message) } }; input.click() }

  const updatePerformance = async () => { const p = await window.biner.getProfile() || {}; const mb = Number(p.memory) || 4096; $('#vRam').textContent = `${mb} MB`; $('#vPreset').textContent = mb >= 12288 ? 'Extreme' : mb >= 8192 ? 'Performance' : mb >= 4096 ? 'Balanced' : 'Safe'; $('#vFast').textContent = p.fastMode !== false ? 'ON' : 'OFF' }
  $('#vBoost').onclick = async () => { try { const p = await window.biner.getProfile() || {}; const deviceMemory = Number(navigator.deviceMemory) || 8; p.memory = Math.max(2048, Math.min(16384, Math.round(deviceMemory * 512))); p.fastMode = true; p.customArgs = ['-XX:+UseG1GC', '-XX:+ParallelRefProcEnabled', '-XX:MaxGCPauseMillis=50', '-XX:+UnlockExperimentalVMOptions', '-XX:+DisableExplicitGC']; await window.biner.saveProfile(p); await updatePerformance(); toast('Performance profile اعمال شد.') } catch (e) { toast(e.message) } }
  $('#vScan').onclick = async () => { try { $('#vDiag').textContent = JSON.stringify(await window.biner.repairScan(), null, 2) } catch (e) { $('#vDiag').textContent = e.message } }
  $('#vFix').onclick = async () => { try { $('#vDiag').textContent = JSON.stringify(await window.biner.repairFix(), null, 2) } catch (e) { $('#vDiag').textContent = e.message } }

  const renderWorlds = async () => { if (!selected) { $('#vWorlds').innerHTML = '<div class="vmuted">یک Instance انتخاب کنید.</div>'; return } try { const worlds = await api.worlds.list(selected); $('#vWorlds').innerHTML = worlds.length ? worlds.map(x => `<div class="vrow"><span>${esc(x.name)}</span><button class="ghost" data-world-delete="${esc(x.name)}">Delete</button></div>`).join('') : '<div class="vmuted">Worldی پیدا نشد.</div>'; $$('[data-world-delete]').forEach(b => b.onclick = async () => { await api.worlds.delete({ instanceId: selected, name: b.dataset.worldDelete }); renderWorlds() }) } catch (e) { $('#vWorlds').textContent = e.message } }
  $('#vWorldRefresh').onclick = renderWorlds
  $('#vWorldFolder').onclick = async () => { const id = await ensureSelected(); const list = await api.instances.list(); const item = list.find(x => x.id === id); if (item) window.biner.openFolder(item.path) }
  $('#vResource').onclick = async () => { const f = await window.biner.folders(); window.biner.openFolder(`${f.root}\\resourcepacks`) }
  $('#vShader').onclick = async () => { const f = await window.biner.folders(); window.biner.openFolder(`${f.root}\\shaderpacks`) }

  const renderBackups = async () => { try { const backups = await api.backups.list(); $('#vBackups').innerHTML = backups.length ? backups.map(x => `<div class="vrow"><span>${esc(x.name)}</span><small>${(Number(x.size || 0) / 1048576).toFixed(1)} MB</small></div>`).join('') : '<div class="vmuted">Backupی وجود ندارد.</div>' } catch (e) { $('#vBackups').textContent = e.message } }
  $('#vBackup').onclick = async () => { try { await api.backups.create({ instanceId: await ensureSelected(), source: 'worlds' }); await renderBackups(); toast('Backup ساخته شد.') } catch (e) { toast(e.message) } }
  $('#vBackRefresh').onclick = renderBackups

  const renderDownloads = async () => { try { const jobs = await window.biner.activeDownloads(); $('#vDownloads').innerHTML = jobs.length ? jobs.map(x => `<div class="vrow"><span>${esc(x.filename || x.id)}</span><b>${esc(x.progress ?? 0)}%</b></div>`).join('') : '<div class="vmuted">دانلود فعالی وجود ندارد.</div>' } catch (e) { $('#vDownloads').textContent = e.message } }
  $('#vDlRefresh').onclick = renderDownloads; window.biner.onDownloadProgress?.(() => renderDownloads())

  window.biner.onLog?.(message => { const e = $('#vLogs'); if (!e) return; if (e.textContent === 'منتظر Log...') e.textContent = ''; e.textContent += (e.textContent ? '\n' : '') + String(message); e.scrollTop = e.scrollHeight })
  $('#vLogClear').onclick = () => { $('#vLogs').textContent = '' }
  $('#vCrash').onclick = () => window.biner.openCrashReports()
  $('#vPing').onclick = async () => { try { const r = await window.biner.serverStatus({ host: $('#vHost').value.trim(), port: 25565 }); $('#vServer').textContent = r.online ? `ONLINE • ${r.ping}ms` : 'OFFLINE' } catch (e) { $('#vServer').textContent = e.message } }

  const renderAccounts = async () => { try { const accounts = await window.biner.accounts.list(); $('#vAccounts').innerHTML = accounts.length ? accounts.map(x => `<div class="vrow"><span>${esc(x.username)}</span><button class="ghost" data-account="${esc(x.id)}">Activate</button></div>`).join('') : '<div class="vmuted">حسابی ثبت نشده.</div>'; $$('[data-account]').forEach(b => b.onclick = async () => { const a = await window.biner.accounts.activate(b.dataset.account); if (a) { const p = await window.biner.getProfile() || {}; p.username = a.username; await window.biner.saveProfile(p) } renderAccounts() }) } catch (e) { $('#vAccounts').textContent = e.message } }
  $('#vAddAccount').onclick = async () => { try { const n = $('#vAccount').value.trim(); if (!n) return; await window.biner.accounts.addLocal(n); $('#vAccount').value = ''; await renderAccounts() } catch (e) { toast(e.message) } }
  $('#vScreens').onclick = async () => { const f = await window.biner.folders(); window.biner.openFolder(`${f.root}\\screenshots`) }
  $('#vScaleDown').onclick = async () => window.biner.setZoom(Math.max(0.7, (await window.biner.getZoom()) - 0.1))
  $('#vScaleUp').onclick = async () => window.biner.setZoom(Math.min(1.4, (await window.biner.getZoom()) + 0.1))

  loadInstances().catch(e => console.error('[BinerLauncher] instances', e)); renderBackups().catch(() => {}); renderDownloads().catch(() => {}); renderAccounts().catch(() => {}); updatePerformance().catch(() => {})
})()
