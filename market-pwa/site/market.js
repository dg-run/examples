// The store page: ask the visitor to install, and skip itself once Tally is installed.
const $ = (id) => document.getElementById(id)
const installBtn = $('install'), browserLink = $('browser'), hint = $('hint'), hintText = $('hint-text'), done = $('done')
const FLAG = 'tally:installed'

const isStandalone = () =>
  matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: window-controls-overlay)').matches || navigator.standalone === true
// Opened from the installed app's icon (or a link inside the installed window): go straight to the app.
if (isStandalone()) location.replace('/app')

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})

const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
let deferred = null // the browser's install prompt, kept until the visitor presses the button
let installed = localStorage.getItem(FLAG) === '1'

function render() {
  done.hidden = !installed
  installBtn.hidden = installed
  browserLink.hidden = installed
}

// Chrome, Edge, Samsung Internet: the browser says "this can be installed" (so it is NOT installed: forget an old flag).
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferred = e
  installed = false
  localStorage.removeItem(FLAG)
  render()
})
addEventListener('appinstalled', () => {
  deferred = null
  installed = true
  localStorage.setItem(FLAG, '1')
  hint.hidden = true
  render()
})
// Where supported, ask the browser whether this app is already installed (the manifest's related_applications points at itself).
navigator.getInstalledRelatedApps?.().then((apps) => { if (apps.length) { installed = true; render() } }).catch(() => {})

installBtn.addEventListener('click', async () => {
  if (deferred) {
    deferred.prompt()
    const { outcome } = await deferred.userChoice
    deferred = null // a prompt can be used once
    if (outcome !== 'accepted') { hintText.textContent = 'No problem. You can install it later, or use it in the browser.'; hint.hidden = false }
    return
  }
  // No prompt available: say how to do it by hand on this browser.
  hintText.textContent = isIos
    ? 'On iPhone and iPad: tap the Share button, then “Add to Home Screen”.'
    : 'Open your browser’s menu and choose “Install app” or “Add to Home screen”. (If you don’t see it, this browser can’t install web apps.)'
  hint.hidden = false
})

render()
