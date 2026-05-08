// ── store.js ─────────────────────────────────────────────────────────────────
// Single source of truth for pins.
// • Reads are synchronous after init (in-memory cache).
// • Writes are debounced (16ms) so rapid edits don't hammer storage.
// • Search index is built once on load / updated on mutation.
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'qp2'

let _pins = []           // in-memory cache
let _index = []          // pre-lowercased search tokens per pin
let _writeTimer = null   // debounce handle

// ── Init ──────────────────────────────────────────
export async function init() {
  const raw = await chrome.storage.local.get(STORAGE_KEY)
  _pins = raw[STORAGE_KEY] ?? []
  _buildIndex()
  return _pins
}

// ── Read ──────────────────────────────────────────
export function getAll() { return _pins.slice() }  // shallow copy — prevent external mutation

export function search(q) {
  if (!q) return _pins.slice()  // shallow copy — consistent, no reference leak
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean)
  const out = []
  for (let i = 0; i < _pins.length; i++) {
    const row = _index[i]
    if (terms.every(t => row.includes(t))) out.push(_pins[i])
  }
  return out
}

export function has(url) {
  return _pins.some(p => p.url === url)
}

// ── Write (debounced) ─────────────────────────────
export function add(pin) {
  if (has(pin.url)) return false
  _pins.unshift(pin)
  _index.unshift(_tokenize(pin))
  _scheduleWrite()
  return true
}

export function remove(id) {
  const idx = _pins.findIndex(p => p.id === id)
  if (idx === -1) return
  _pins.splice(idx, 1)
  _index.splice(idx, 1)
  _scheduleWrite()
}

export function rename(id, title) {
  const idx = _pins.findIndex(p => p.id === id)
  if (idx === -1) return
  _pins[idx].title = String(title).trim().slice(0, 500) || _pins[idx].title
  _index[idx] = _tokenize(_pins[idx])
  _scheduleWrite()
}

// ── Internal ──────────────────────────────────────
function _tokenize(pin) {
  return (pin.title + ' ' + pin.url).toLowerCase()
}

function _buildIndex() {
  _index = _pins.map(_tokenize)
}

function _scheduleWrite() {
  clearTimeout(_writeTimer)
  _writeTimer = setTimeout(_flush, 16)
}

function _flush() {
  chrome.storage.local.set({ [STORAGE_KEY]: _pins }).catch(() => {})
}
