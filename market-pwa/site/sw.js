// One service worker for the whole site (scope "/"): it keeps the store page and the app in /app available offline.
// {{BUILD}} changes with every build, so a new version replaces the old cache. Never cache sw.js itself.
const CACHE = 'tally-{{BUILD}}'
const SHELL = ['/', '/app', '/shared.css', '/market.css', '/market.js', '/app/app.css', '/app/app.js', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('tally-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', (e) => {
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname === '/sw.js' || url.pathname.startsWith('/_dg/')) return // never touch the platform's backend API
  if (req.mode === 'navigate') {
    // Pages: the network first (so updates show), the saved copy when offline.
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); void caches.open(CACHE).then((c) => c.put(req, copy)); return res })
      .catch(() => caches.match(req).then((hit) => hit || caches.match(url.pathname.startsWith('/app') ? '/app' : '/'))))
    return
  }
  // Files: the saved copy at once, refreshed in the background.
  e.respondWith(caches.match(req).then((hit) => {
    const net = fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); void caches.open(CACHE).then((c) => c.put(req, copy)) } return res }).catch(() => hit)
    return hit || net
  }))
})
