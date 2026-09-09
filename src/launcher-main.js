const { app } = require('electron')

// 1.0.0 renderer recovery layer: keep core controls alive even if a renderer feature
// throws during startup. This is intentionally independent from app.js/features.js.
app.on('web-contents-created', (_event, contents) => {
  contents.once('did-finish-load', () => {
    contents.executeJavaScript(`(() => {
      const q = s => document.querySelector(s)
      const qs = s => [...document.querySelectorAll(s)]
      const b = window.biner
      if (!b) return
      const toast = m => { const e=q('#toast'); if(!e) return; e.textContent=m; e.classList.add('show'); clearTimeout(window.__binerRecoveryToast); window.__binerRecoveryToast=setTimeout(()=>e.classList.remove('show'),2800) }
      const show = id => { qs('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.section===id)); qs('.section').forEach(x=>x.classList.toggle('hidden-section',x.id!==id)); if(id==='versions') loadVersions() }
      const bind = (id, fn) => { const e=q(id); if(!e || e.dataset.recoveryBound) return; e.dataset.recoveryBound='1'; e.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();fn()}) }
      qs('.nav-item').forEach(x=>{ if(!x.dataset.recoveryBound){x.dataset.recoveryBound='1';x.addEventListener('click',()=>show(x.dataset.section))} })
      bind('#storeBtn',()=>b.openExternal('https://binercraft.ir'))
      bind('#accountBtn',()=>q('#accountModal')?.classList.remove('hidden'))
      bind('#accountClose',()=>q('#accountModal')?.classList.add('hidden'))
      bind('#localLogin',async()=>{const n=(q('#localNameInput')?.value||'').trim();if(!/^[A-Za-z0-9_]{3,16}$/.test(n))return toast('نام باید 3 تا 16 کاراکتر باشد.');const p=await b.getProfile()||{};p.username=n;await b.saveProfile(p);q('#accountModal')?.classList.add('hidden');if(q('#username'))q('#username').textContent=n;if(q('#accountStatus'))q('#accountStatus').textContent='حساب محلی • آماده اجرا';toast('ورود محلی انجام شد')})
      const launch=async()=>{const p=await b.getProfile()||{};const input=(q('#localNameInput')?.value||q('#nameInput')?.value||'').trim();const username=p.username||input;if(!username){q('#accountModal')?.classList.remove('hidden');return}try{const state={...p,username,version:p.version||'1.21.11',memory:Number(p.memory)||4096,loader:p.loader||'vanilla',serverHost:p.serverHost||'Play.BinerCraft.ir',serverPort:Number(p.serverPort)||25565,fastMode:p.fastMode!==false};await b.saveProfile(state);toast('در حال اجرای Minecraft...');await b.launchMinecraft(state)}catch(e){toast('خطا: '+(e?.message||e))}}
      bind('#playBtn',launch); bind('#previewPlay',launch)
      bind('#minimize',()=>b.window?.minimize());bind('#maximize',()=>b.window?.maximize());bind('#close',()=>b.window?.close())
      bind('#versionQuick',()=>show('versions'));bind('#refreshVersions',loadVersions)
      async function loadVersions(){const box=q('#versionList');if(!box)return;box.innerHTML='<div class="loading">در حال دریافت نسخه‌ها...</div>';try{const list=await b.getVersions(Boolean(q('#snapshots')?.checked));q('#versionCount')&&(q('#versionCount').textContent=list.length);box.innerHTML=list.filter(v=>v.type==='release'||q('#snapshots')?.checked).map(v=>'<button class="version-item '+(v.id===(q('#homeVersion')?.textContent||'')?'selected':'')+'" data-version="'+v.id+'"><b>'+v.id+'</b><small>'+String(v.type).toUpperCase()+'</small></button>').join('')||'<div class="loading">نسخه‌ای پیدا نشد.</div>';qs('.version-item').forEach(x=>x.addEventListener('click',async()=>{const p=await b.getProfile()||{};p.version=x.dataset.version;p.loader='vanilla';p.profileId='';await b.saveProfile(p);if(q('#selectedVersionLabel'))q('#selectedVersionLabel').textContent=p.version;if(q('#homeVersion'))q('#homeVersion').textContent=p.version;toast('نسخه انتخاب شد: '+p.version) }))}catch(e){box.innerHTML='<div class="loading">خطا: '+(e?.message||e)+'</div>'}}
      bind('#checkUpdates',async()=>{const r=await b.checkForUpdates();if(r.update&&r.url){toast('نسخه جدید پیدا شد');b.openExternal(r.url)}else toast(r.error||'آخرین نسخه نصب است')})
      bind('#openGameFolder',async()=>{const f=await b.folders();b.openFolder(f.root)})
      bind('#gameFolderBtn',async()=>{const f=await b.folders();b.openFolder(f.root)})
      bind('#runtimeFolderBtn',async()=>{const f=await b.folders();b.openFolder(f.runtime)})
      window.addEventListener('error',e=>{console.error('[BinerLauncher]',e.error||e.message)})
      loadVersions()
    })()`).catch(()=>{})
  })
})

require('./main.js')
