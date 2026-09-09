const { contextBridge, ipcRenderer } = require('electron')
const invoke=(channel,...args)=>ipcRenderer.invoke(channel,...args)
contextBridge.exposeInMainWorld('biner',{
 appVersion:()=>invoke('app:get-version'),openExternal:url=>invoke('app:open-external',url),openFolder:target=>invoke('app:open-folder',target),toggleDevTools:open=>invoke('app:toggle-devtools',open),clearCache:()=>invoke('app:clear-cache'),getProfile:()=>invoke('profile:get'),saveProfile:p=>invoke('profile:save',p),
 getVersions:s=>invoke('minecraft:versions',s),installLoader:o=>invoke('minecraft:install-loader',o),importOptifine:()=>invoke('minecraft:import-optifine'),folders:()=>invoke('minecraft:folders'),launchMinecraft:o=>invoke('minecraft:launch',o),smartPlay:o=>invoke('biner:smart-play',o),minecraftStatus:()=>invoke('minecraft:status'),serverStatus:o=>invoke('server:status',o),checkForUpdates:async()=>{try{const current=await invoke('app:get-version');const r=await fetch('https://binercraft.ir/cdn/latest.json',{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);const m=await r.json();const parse=v=>{const x=String(v||'').replace(/^v/i,'').match(/^(\d+)\.(\d+)\.(\d+)/);return x?[+x[1],+x[2],+x[3]]:null};const a=parse(m.version),b=parse(current);if(!a||!b)throw new Error('Invalid version');let c=0;for(let i=0;i<3;i++){if(a[i]!==b[i]){c=a[i]>b[i]?1:-1;break}}return{update:c>0,currentVersion:current,version:String(m.version||'').replace(/^v/i,''),url:m.download||m.url,notes:m.releaseNotes||m.notes||''}}catch(e){return{update:false,error:e.message}}},
 getCrashReports:()=>invoke('app:crash-reports'),openCrashReports:()=>invoke('app:open-crash-reports'),analyzeCrash:i=>invoke('biner:crash:analyze',i),repairScan:()=>invoke('biner:repair:scan'),repairFix:()=>invoke('biner:repair:fix'),compatibleLoaders:v=>invoke('biner:loaders:compatible',v),fastPresets:o=>invoke('biner:fast-mode:presets',o),downloadStart:o=>invoke('biner:download:start',o),downloadCancel:id=>invoke('biner:download:cancel',id),activeDownloads:()=>invoke('biner:download:active'),accounts:{list:()=>invoke('biner:accounts:list'),addLocal:n=>invoke('biner:accounts:add-local',n),activate:id=>invoke('biner:accounts:activate',id),delete:id=>invoke('biner:accounts:delete',id)},
 setZoom:v=>invoke('ui:set-zoom',v),getZoom:()=>invoke('ui:get-zoom'),onProgress:cb=>ipcRenderer.on('launcher:progress',(_,d)=>cb(d)),onLog:cb=>ipcRenderer.on('launcher:log',(_,d)=>cb(d)),onCrash:cb=>ipcRenderer.on('launcher:crash',(_,d)=>cb(d)),onSmartStep:cb=>ipcRenderer.on('smart-play:step',(_,d)=>cb(d)),onDownloadProgress:cb=>ipcRenderer.on('download:progress',(_,d)=>cb(d)),
 window:{minimize:()=>ipcRenderer.send('window:minimize'),maximize:()=>ipcRenderer.send('window:maximize'),close:()=>ipcRenderer.send('window:close')}
})
contextBridge.exposeInMainWorld('binerCore',{instances:{list:()=>invoke('biner:instances:list'),create:o=>invoke('biner:instances:create',o),delete:id=>invoke('biner:instances:delete',id),open:id=>invoke('biner:instances:open',id)},mods:{list:id=>invoke('biner:mods:list',id),search:q=>invoke('biner:mods:search',q),install:o=>invoke('biner:mods:install',o)},worlds:{list:id=>invoke('biner:worlds:list',id),delete:o=>invoke('biner:worlds:delete',o)},backups:{create:o=>invoke('biner:backups:create',o),list:()=>invoke('biner:backups:list'),restore:o=>invoke('biner:backups:restore',o)},resources:{list:o=>invoke('biner:resources:list',o)},storageStats:()=>invoke('biner:storage:stats'),diagnostics:()=>invoke('biner:diagnostics'),fileHash:f=>invoke('biner:file-hash',f)})
window.addEventListener('DOMContentLoaded',()=>{
 const grid=document.querySelector('.loader-grid');if(grid&&!grid.querySelector('[data-loader="neoforge"]')){const card=document.createElement('article');card.className='loader-card neoforge';card.innerHTML='<div class="loader-logo">N</div><b>NEOFORGE</b><h3>NeoForge</h3><p>مدرن، سریع و مناسب مودهای نسل جدید Minecraft.</p><button class="primary loader-install" data-loader="neoforge">نصب NeoForge</button>';grid.appendChild(card)}
 const launcherPanel=document.querySelector('.setting-panel[data-panel="launcher"]');if(launcherPanel&&!document.querySelector('#guiScaleControl')){const c=document.createElement('div');c.id='guiScaleControl';c.style.cssText='margin-top:18px;padding:18px 20px;border:1px solid #ffffff12;border-radius:17px;background:#ffffff04';c.innerHTML='<b>GUI SCALE</b><div style="display:flex;gap:12px;align-items:center;margin-top:12px"><span>70%</span><input id="guiScaleInput" type="range" min="70" max="140" step="5" value="100" style="flex:1"><span>140%</span></div><strong id="guiScaleValue" style="display:block;margin-top:8px">100%</strong>';launcherPanel.appendChild(c);const input=c.querySelector('#guiScaleInput'),value=c.querySelector('#guiScaleValue');const apply=async p=>{const safe=Math.max(70,Math.min(140,Number(p)||100));input.value=safe;value.textContent=`${safe}%`;await invoke('ui:set-zoom',safe/100)};invoke('ui:get-zoom').then(z=>apply(Math.round((Number(z)||1)*100)));input.addEventListener('input',()=>apply(input.value))}
 const smart=document.createElement('div');smart.id='smartPlayStatus';smart.style.cssText='position:fixed;left:50%;bottom:26px;transform:translateX(-50%);padding:10px 18px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(7,11,20,.94);backdrop-filter:blur(14px);color:#fff;font:600 13px Arial,sans-serif;z-index:9999;display:none;box-shadow:0 12px 40px rgba(0,0,0,.35)';document.body.appendChild(smart)
 const runSmart=async()=>{const profile=await invoke('profile:get')||{};if(!profile.username){document.querySelector('#accountModal')?.classList.remove('hidden');return}smart.style.display='block';smart.textContent='SMART PLAY • Checking…';try{await invoke('biner:smart-play',profile);smart.textContent='SMART PLAY • Ready ✓';await new Promise(r=>setTimeout(r,350));smart.textContent='SMART PLAY • Launching…';await invoke('minecraft:launch',profile);smart.textContent='SMART PLAY • Minecraft launched ✓';setTimeout(()=>smart.style.display='none',1800)}catch(e){smart.textContent=`SMART PLAY • ${e?.message||e}`;setTimeout(()=>smart.style.display='none',3500)}}
 document.addEventListener('click',e=>{const b=e.target.closest('#playBtn,#previewPlay');if(b){e.preventDefault();e.stopImmediatePropagation();runSmart()}},true)
 const fastModeObserver=new MutationObserver(()=>{const row=[...document.querySelectorAll('.toggle-row')].find(x=>x.textContent.includes('Fast Launch'));if(!row||row.querySelector('#fastModeInput'))return;const input=document.createElement('input');input.type='checkbox';input.id='fastModeInput';input.style.cssText='width:18px;height:18px;cursor:pointer;accent-color:#7c5cff;margin-inline-start:12px';row.appendChild(input);invoke('profile:get').then(p=>input.checked=p?.fastMode!==false);input.addEventListener('change',async()=>{const p=await invoke('profile:get')||{};p.fastMode=input.checked;await invoke('profile:save',p)})});fastModeObserver.observe(document.documentElement,{childList:true,subtree:true})

 // BinerLauncher SVG icon layer: replaces legacy Unicode/emoji UI glyphs with crisp inline SVGs.
 const iconPaths={
  home:'M3 10.8 12 3l9 7.8V21a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  versions:'M4 5h16v4H4z M4 11h16v4H4z M4 17h10v2H4z',
  instances:'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z',
  loader:'M12 3v5 M12 16v5 M3 12h5 M16 12h5 M5.6 5.6l3.5 3.5 M14.9 14.9l3.5 3.5 M18.4 5.6l-3.5 3.5 M9.1 14.9l-3.5 3.5 M12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6z',
  news:'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z M7 8h10 M7 12h10 M7 16h6',
  settings:'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z M19.4 15a1.8 1.8 0 0 0 .36 1.98l.05.05-1.8 1.8-.05-.05a1.8 1.8 0 0 0-1.98-.36 1.8 1.8 0 0 0-1.1 1.66V20h-2.55v-.08a1.8 1.8 0 0 0-1.1-1.66 1.8 1.8 0 0 0-1.98.36l-.05.05-1.8-1.8.05-.05A1.8 1.8 0 0 0 7.9 15a1.8 1.8 0 0 0-1.66-1.1H6V11.4h.24A1.8 1.8 0 0 0 7.9 10.3a1.8 1.8 0 0 0-.36-1.98l-.05-.05 1.8-1.8.05.05a1.8 1.8 0 0 0 1.98.36 1.8 1.8 0 0 0 1.1-1.66V5h2.55v.08a1.8 1.8 0 0 0 1.1 1.66 1.8 1.8 0 0 0 1.98-.36l.05-.05 1.8 1.8-.05.05A1.8 1.8 0 0 0 19.4 10c.2.64.78 1.1 1.46 1.1H21v2.5h-.14A1.8 1.8 0 0 0 19.4 15z',
  developer:'M8 8 4 12l4 4 M16 8l4 4-4 4 M13 5l-2 14',
  play:'M8 5v14l11-7z',
  store:'M5 9h14l-1 11H6L5 9z M8 9a4 4 0 0 1 8 0 M9 13h6',
  version:'M5 5h14v14H5z M9 9h6 M9 13h4',
  profile:'M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M5 21a7 7 0 0 1 14 0',
  boost:'M13 2 5 13h6l-1 9 8-12h-6z',
  search:'M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z M16 16l5 5',
  refresh:'M20 11a8 8 0 0 0-14.9-4L3 10 M3 4v6h6 M4 13a8 8 0 0 0 14.9 4L21 14 M21 20v-6h-6',
  add:'M12 5v14 M5 12h14',
  folder:'M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  java:'M8 5c3 1 1 3 3 4s2 3-1 4 M16 5c-3 1-1 3-3 4s-2 3 1 4 M7 18c3 2 7 2 10 0',
  tools:'M14 6l4 4 M5 19l6-6 M7 7l10 10 M15 5a4 4 0 0 0-5 5l-6 6 4 4 6-6a4 4 0 0 0 5-5z',
  console:'M5 7l5 5-5 5 M12 17h7',
  clear:'M6 7h12 M9 7V5h6v2 M8 10v7 M12 10v7 M16 10v7 M5 7l1 14h12l1-14',
  export:'M12 3v12 M7 10l5 5 5-5 M5 21h14',
  world:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M3 12h18 M12 3c2.2 2.5 3.3 5.5 3.3 9s-1.1 6.5-3.3 9c-2.2-2.5-3.3-5.5-3.3-9S9.8 5.5 12 3z',
  resource:'M4 5h16v14H4z M8 5v14 M4 10h4 M12 10h8 M12 15h8',
  server:'M4 5h16v5H4z M4 14h16v5H4z M7 7.5h.01 M7 16.5h.01 M10 7.5h7 M10 16.5h7',
  update:'M12 4v8l5 3 M20 12a8 8 0 1 1-2.34-5.66',
  crash:'M8 4v3 M16 4v3 M5 8h14v11H5z M9 12l2 2 4-4',
  pack:'M4 7 12 3l8 4-8 4z M4 7v10l8 4 8-4V7 M12 11v10',
  close:'M6 6l12 12 M18 6 6 18',
  maximize:'M6 6h12v12H6z',
  minimize:'M5 12h14'
 };
 const svg=(name)=>{const p=iconPaths[name]||iconPaths.tools;const el=document.createElement('span');el.className='biner-svg-icon';el.setAttribute('aria-hidden','true');el.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p.split(' M').map((x,i)=>i?' M'+x:x).join('')}</svg>`;return el};
 const style=document.createElement('style');style.textContent='.biner-svg-icon{display:inline-grid;place-items:center;width:18px;height:18px;flex:0 0 18px;color:currentColor;vertical-align:middle}.biner-svg-icon svg{width:100%;height:100%;display:block}.nav-item .biner-svg-icon{width:17px;height:17px;flex-basis:17px}.quick-icon .biner-svg-icon{width:17px;height:17px}.pc h3 .biner-svg-icon,.dev-card .biner-svg-icon,.setting-tab .biner-svg-icon{margin-inline-end:6px}.play-main .biner-svg-icon{grid-row:1/3;align-self:center;width:17px;height:17px}.search-box .biner-svg-icon{width:16px;height:16px}.toolbar .biner-svg-icon{width:16px;height:16px}.primary>.biner-svg-icon,.ghost>.biner-svg-icon{margin-inline-end:6px}.biner-svg-icon svg{pointer-events:none}';document.head.appendChild(style);
 const put=(el,name)=>{if(!el||el.querySelector(':scope>.biner-svg-icon'))return;el.prepend(svg(name));};
 const leading={
  '⌂':['nav-item','home'],'◈':['nav-item','versions'],'▦':['nav-item','instances'],'🧩':['nav-item','loader'],'◉':['nav-item','news'],'⚙':['nav-item','settings'],'⌘':['nav-item','developer'],'✦':['nav-item','tools'],
  '▶':['play'],'↗':['store'],'⚡':['boost'],'⌕':['search'],'↻':['refresh'],'＋':['add'],'📁':['folder'],'🛠':['tools'],'▣':['console'],'☕':['java'],'♻':['clear'],'⇩':['export'],'🌐':['server'],'📦':['pack'],'🌍':['world'],'🎨':['resource'],'🔎':['crash'],'🔄':['update']
 };
 const scan=()=>{document.querySelectorAll('button,.quick-icon,.news-icon,h3,.search-box').forEach(el=>{if(el.querySelector('.biner-svg-icon'))return;const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let n;while(n=walker.nextNode()){const t=n.nodeValue;const key=Object.keys(leading).find(k=>t.trimStart().startsWith(k));if(!key)continue;const idx=t.indexOf(key);if(idx<0)continue;n.nodeValue=t.slice(0,idx)+t.slice(idx+key.length);const icon=svg(leading[key][1]);n.parentNode.insertBefore(icon,n);break}})};
 scan();
 new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});

})
