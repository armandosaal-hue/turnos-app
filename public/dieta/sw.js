// Caché de la app de dieta para usarla sin conexión. Los datos están en localStorage, no aquí.
const CACHE = 'dieta-v1'
const ARCHIVOS = ['./', './index.html', './app.js', './logic.js', './alimentos.js', './manifest.webmanifest']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('dieta-') && k !== CACHE).map((k) => caches.delete(k)))),
  )
  self.clients.claim()
})

// Red primero; si no hay conexión, lo que haya en caché.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put(e.request, copy))
        return res
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html'))),
  )
})
