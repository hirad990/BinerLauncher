const $ = s => document.querySelector(s)
const $$ = s => [...document.querySelectorAll(s)]

function toast(message) {
  const el = $('#toast')
  el.textContent = message
  el.classList.add('show')
  clearTimeout(window.__toastTimer)
  window.__toastTimer = setTimeout(() => el.classList.remove('show'), 2600)
}

$$('.nav-item').forEach(btn => btn.addEventListener('click', () => {
  $$('.nav-item').forEach(x => x.classList.remove('active'))
  btn.classList.add('active')
  $$('.section').forEach(x => { x.classList.remove('active-section'); x.classList.add('hidden-section') })
  const section = $('#' + btn.dataset.section)
  section.classList.remove('hidden-section')
  section.classList.add('active-section')
}))

$$('.version-card').forEach(card => card.addEventListener('click', () => {
  $$('.version-card').forEach(x => x.classList.remove('selected'))
  card.classList.add('selected')
  toast(`نسخه ${card.querySelector('b').textContent} انتخاب شد`)
}))

$('#playBtn').addEventListener('click', () => toast('سیستم اجرای Minecraft در مرحله بعد فعال می‌شود 🚀'))
$('#storeBtn').addEventListener('click', () => window.biner?.openExternal('https://binercraft.ir'))
$('#accountBtn').addEventListener('click', () => toast('سیستم حساب Microsoft و Local به‌زودی اضافه می‌شود'))
$('#saveSettings').addEventListener('click', () => {
  const name = $('#nameInput').value.trim() || 'بازیکن مهمان'
  $('#username').textContent = name
  localStorage.setItem('biner_username', name)
  toast('تنظیمات با موفقیت ذخیره شد ✓')
})

const savedName = localStorage.getItem('biner_username')
if (savedName) { $('#nameInput').value = savedName; $('#username').textContent = savedName }

$('#minimize').addEventListener('click', () => window.biner?.window.minimize())
$('#maximize').addEventListener('click', () => window.biner?.window.maximize())
$('#close').addEventListener('click', () => window.biner?.window.close())

window.biner?.appVersion().then(v => {
  document.title = `Biner Launcher v${v}`
}).catch(() => {})
