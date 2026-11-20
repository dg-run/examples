// A small app that shows remote config with `dg.config`. Plain DOM (no framework); text is always put in with textContent.
//
// The four settings are declared in site/manifest.webmanifest ("config": { … }). When this build is uploaded, dg.run reads them and
// builds a form in My apps → Config. A value changed there reaches this page live (onChange), and the last values are kept in this
// browser, so the page starts with them even when it is opened offline.
import { createDg } from 'dgclient'

const dg = createDg({ version: '1.0.0' })

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T
const echo = $<HTMLOListElement>('#echo')

function note(text: string) {
  const li = document.createElement('li')
  li.textContent = `${new Date().toLocaleTimeString()}  ${text}`
  echo.prepend(li)
  while (echo.children.length > 30) echo.lastElementChild?.remove()
}

// `get(key, fallback)` answers at once: the value saved on this device, or the fallback until one has ever been received.
// Pass fallbacks that match what you declared: they are what a first-time visitor sees offline.
function render() {
  const theme = dg.config.get('theme', 'light')
  document.documentElement.dataset.theme = theme
  const banner = dg.config.get('banner', 'Welcome to the config demo')
  $('#banner').textContent = banner
  const maintenance = dg.config.get('maintenance', false)
  $('#maintenance').hidden = !maintenance
  $('#app').hidden = maintenance
  const n = Math.max(1, Math.min(24, dg.config.get('cards', 6)))
  const cards = $('#cards')
  cards.replaceChildren(...Array.from({ length: n }, (_, i) => Object.assign(document.createElement('div'), { className: 'card', textContent: String(i + 1) })))
  $('#values').textContent = JSON.stringify(dg.config.all())
}
render() // first paint from the device's copy (or the fallbacks)

// onChange: called when a value changes, also when the first fetch brings something new. It keeps a live connection open, so a change
// saved in the dashboard shows here within a second. Without onChange the values still refresh on start, when the page is shown again
// and when the network returns.
for (const key of ['banner', 'maintenance', 'theme', 'cards']) {
  dg.config.onChange(key, (value) => { note(`${key} → ${JSON.stringify(value)}`); $('#last').textContent = `just now (${new Date().toLocaleTimeString()})`; render() })
}
void dg.config.ready.then(() => { $('#last').textContent ||= 'checked just now'; render() })

dg.realtime.onStatus((s) => { $('#conn').textContent = s === 'open' ? 'live (changes arrive instantly)' : s === 'connecting' ? 'connecting…' : 'not live (values refresh when you come back)' })
$('#conn').textContent = 'connecting…'
$('#refresh').addEventListener('click', () => { note('checking…'); void dg.config.refresh().then(() => { note('up to date'); render() }) })
