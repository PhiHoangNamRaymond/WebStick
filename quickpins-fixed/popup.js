// ── popup.js v3 ───────────────────────────────────────────────────────────────
// Security contract:
//  • ZERO external network requests — no fonts, no CDN, no favicon fetch.
//  • ALL favicons routed through chrome://favicon2/ (Chrome's internal cache).
//  • No host_permissions in manifest → extension cannot touch page content.
//  • CSP: connect-src 'none' blocks any accidental outbound fetch.
//  • Strict textContent writes — no innerHTML with user data anywhere.
//  • URLs validated via URL() constructor before chrome.tabs.create.
//
// Performance contract (unchanged from v2):
//  • Parallel init: storage + session cache fire simultaneously.
//  • Search debounced 80ms with pre-built lowercase index.
//  • DOM rows pooled/reused — no GC pressure on keystrokes.
//  • Favicons lazy-loaded via IntersectionObserver.
//  • Writes batched in store.js (16ms debounce).
// ─────────────────────────────────────────────────────────────────────────────

import * as Store from './store.js'

// ── DOM refs ──────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id)
const cntEl   = $('cnt')
const cfav    = $('cfav')
const ctitle  = $('ctitle')
const sbtn    = $('sbtn')
const flash   = $('flash')
const si      = $('si')
const listEl  = $('list')
const emptyEl = $('empty')

// ── State ─────────────────────────────────────────────────────────────────────
let tab         = null
let searchTimer = null

// ── Favicon helper ────────────────────────────────────────────────────────────
// Uses Chrome's internal favicon cache — zero external HTTP requests.
function faviconSrc(pageUrl) {
  return `chrome://favicon2/?size=16&scale_factor=2x&show_fallback_monogram&page_url=${encodeURIComponent(pageUrl)}`
}

// ── Lazy favicon loader ───────────────────────────────────────────────────────
const favIO = new IntersectionObserver(entries => {
  for (const e of entries) {
    if (!e.isIntersecting) continue
    const img = e.target
    const u = img.dataset.pageUrl
    if (u) { img.src = faviconSrc(u); delete img.dataset.pageUrl }
    favIO.unobserve(img)
  }
}, { rootMargin: '40px' })

// ── URL safety check ──────────────────────────────────────────────────────────
// Only http/https allowed — blocks javascript:, data:, file:, etc.
function safeUrl(url) {
  try {
    const u = new URL(url)
    return (u.protocol === 'http:' || u.protocol === 'https:') ? url : null
  } catch { return null }
}

// ── Init (parallel) ───────────────────────────────────────────────────────────
async function init() {
  const [, cached] = await Promise.all([
    Store.init(),
    chrome.storage.session.get('activeTab').catch(() => ({}))
  ])

  tab = cached?.activeTab ?? null
  if (!tab) {
    const [t] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (t) tab = { url: t.url, title: t.title || t.url }
  }

  if (tab) {
    ctitle.textContent = tab.title  // textContent — never innerHTML
    if (safeUrl(tab.url)) {
      const img = document.createElement('img')
      img.className = 'fav'
      img.src = faviconSrc(tab.url)
      img.decoding = 'async'
      cfav.replaceWith(img)
    }
    if (Store.has(tab.url)) markSaved()
  }

  render(Store.getAll())
}

// ── Save ──────────────────────────────────────────────────────────────────────
sbtn.addEventListener('click', e => {
  e.stopPropagation()
  if (!tab || sbtn.disabled) return
  if (!safeUrl(tab.url)) return  // reject non-http URLs silently
  const pin = { id: crypto.randomUUID(), url: tab.url, title: tab.title, at: Date.now() }
  if (!Store.add(pin)) return
  markSaved()
  render(Store.search(si.value.trim().toLowerCase()))
})

function markSaved() {
  sbtn.style.display = 'none'
  flash.classList.add('on')
  setTimeout(() => {
    flash.classList.remove('on')
    sbtn.textContent = '✓ Ghim rồi'
    sbtn.disabled = true
    sbtn.style.display = ''
  }, 1200)
}

// ── Search (debounced 80ms) ───────────────────────────────────────────────────
si.addEventListener('input', () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() =>
    render(Store.search(si.value.trim().toLowerCase())), 80)
})

// ── Render ────────────────────────────────────────────────────────────────────
function render(pins) {
  cntEl.textContent = Store.getAll().length + ' link'

  if (pins.length === 0) {
    listEl.querySelectorAll('.row').forEach(r => r.remove())
    emptyEl.className = 'on'
    const span = emptyEl.querySelector('span')
    if (si.value) {
      span.textContent = 'Không tìm thấy link nào.'
    } else {
      span.textContent = ''
      span.append('Chưa có link nào.', document.createElement('br'))
      const b = document.createElement('b'); b.textContent = '+ Lưu'
      span.append('Nhấn ', b, ' để ghim trang hiện tại.')
    }
    return
  }
  emptyEl.className = ''

  // Minimal DOM queries — build/trim first, then one final querySelectorAll to update
  const existing = listEl.querySelectorAll('.row')
  const diff = pins.length - existing.length
  if (diff > 0) for (let i = 0; i < diff; i++) listEl.appendChild(buildRow())
  if (diff < 0) for (let i = existing.length - 1; i >= pins.length; i--) existing[i].remove()
  // One querySelectorAll for the update pass
  listEl.querySelectorAll('.row').forEach((row, i) => updateRow(row, pins[i]))
}

// ── Row builder (DOM API only — no innerHTML with dynamic data) ───────────────
function buildRow() {
  const row = document.createElement('div')
  row.className = 'row'

  const img = document.createElement('img')
  img.className = 'fav'; img.alt = ''; img.decoding = 'async'

  const info = document.createElement('div'); info.className = 'info'
  const name = document.createElement('div'); name.className = 'name'
  const dom  = document.createElement('div'); dom.className = 'domain'
  info.append(name, dom)

  const acts = document.createElement('div'); acts.className = 'acts'
  const eb = document.createElement('button'); eb.className = 'ab e'
  eb.title = 'Đổi tên'; eb.textContent = '✏️'
  const db = document.createElement('button'); db.className = 'ab d'
  db.title = 'Xóa'; db.textContent = '🗑'
  acts.append(eb, db)
  row.append(img, info, acts)

  row.addEventListener('click', e => {
    if (e.target.closest('.acts')) return
    const url = safeUrl(row.dataset.url)  // validate before opening
    if (url) { chrome.tabs.create({ url }); window.close() }
  })
  eb.addEventListener('click', e => { e.stopPropagation(); startRename(row) })
  db.addEventListener('click', e => { e.stopPropagation(); deleteRow(row) })
  return row
}

// ── Row updater ───────────────────────────────────────────────────────────────
function updateRow(row, pin) {
  if (row.dataset.id === String(pin.id)) return

  row.dataset.id  = pin.id
  row.dataset.url = pin.url

  row.querySelector('.name').textContent   = pin.title   // textContent — safe
  row.querySelector('.domain').textContent = tryDomain(pin.url)

  const img = row.querySelector('img.fav')
  if (safeUrl(pin.url)) {
    img.src = ''
    img.dataset.pageUrl = pin.url
    img.style.display = ''
    favIO.observe(img)
  } else {
    img.style.display = 'none'
  }
}

// ── Rename ────────────────────────────────────────────────────────────────────
function startRename(row) {
  const nameEl = row.querySelector('.name')
  const oldVal = nameEl.textContent
  const input  = document.createElement('input')
  input.className = 'ri'; input.value = oldVal
  nameEl.replaceWith(input)
  input.focus(); input.select()

  let committed = false
  const commit = () => {
    if (committed) return     // guard: blur fires after Enter — ignore second call
    committed = true
    const v = input.value.trim() || oldVal
    Store.rename(row.dataset.id, v)
    row.dataset.id = ''       // invalidate cache so updateRow refreshes title
    const div = document.createElement('div')
    div.className = 'name'
    div.textContent = v       // textContent — safe against XSS
    input.replaceWith(div)
  }
  input.addEventListener('blur', commit)
  input.addEventListener('keydown', ev => {
    if (ev.key === 'Enter')  { ev.preventDefault(); commit() }
    if (ev.key === 'Escape') {
      committed = true        // prevent blur from committing after cancel
      const div = document.createElement('div')
      div.className = 'name'; div.textContent = oldVal
      input.replaceWith(div)
    }
  })
}

// ── Delete ────────────────────────────────────────────────────────────────────
function deleteRow(row) {
  if (row.dataset.deleting) return  // guard: prevent double-delete race
  row.dataset.deleting = '1'

  const id  = row.dataset.id
  const url = row.dataset.url
  Store.remove(id)
  if (tab && url === tab.url) { sbtn.disabled = false; sbtn.textContent = '+ Lưu' }
  row.style.cssText = 'opacity:0;transform:translateX(5px);transition:opacity .13s,transform .13s'
  setTimeout(() => render(Store.search(si.value.trim().toLowerCase())), 130)
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function tryDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') }
  catch { return url }
}

init()
