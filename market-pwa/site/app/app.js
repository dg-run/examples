// Tally: counters kept in localStorage. No server, so it works the same offline.
const KEY = 'tally:v1'
const $ = (id) => document.getElementById(id)
const list = $('list'), empty = $('empty'), form = $('add'), nameInput = $('name'), bar = $('bar')

const isStandalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
bar.hidden = isStandalone // installed: no bar. In a browser tab: offer the install.

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').then((reg) => {
  // An installed app stays open for days: look for a new version when it comes back to the foreground.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && navigator.onLine) void reg.update() })
}).catch(() => {})

let items = []
try { items = JSON.parse(localStorage.getItem(KEY) || '[]') } catch { items = [] }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(items)) } catch { /* storage full or blocked: keep working in memory */ } }

function render() {
  list.replaceChildren(...items.map((it) => {
    const li = document.createElement('li'); li.className = 'item'
    const label = Object.assign(document.createElement('span'), { className: 'label', textContent: it.name })
    const count = Object.assign(document.createElement('span'), { className: 'count', textContent: String(it.n) })
    count.setAttribute('aria-live', 'polite')
    const row = document.createElement('div'); row.className = 'row'
    const btn = (text, cls, aria, fn) => { const b = Object.assign(document.createElement('button'), { type: 'button', textContent: text, className: cls }); b.setAttribute('aria-label', aria); b.onclick = fn; return b }
    row.append(
      btn('−', 'minus', `One less ${it.name}`, () => { it.n = Math.max(0, it.n - 1); save(); render() }),
      btn('+', 'plus', `One more ${it.name}`, () => { it.n++; save(); render() }),
      btn('Delete', 'del', `Delete ${it.name}`, () => { items = items.filter((x) => x.id !== it.id); save(); render() }),
    )
    li.append(label, count, row)
    return li
  }))
  empty.hidden = items.length > 0
}

form.addEventListener('submit', (e) => {
  e.preventDefault()
  const name = nameInput.value.trim()
  if (!name) return
  items.unshift({ id: crypto.randomUUID(), name, n: 0 })
  nameInput.value = ''
  save(); render()
})
render()
