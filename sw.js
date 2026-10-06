/* Service worker Kalkulator NICU PICU.
   Strategi: ambil dari jaringan lebih dulu agar update index.html langsung terpakai,
   jatuh ke cache bila offline atau jaringan lambat (lebih dari 3 detik). */
const VERSION = 'v2';
const CACHE = 'nicu-picu-' + VERSION;
const SHELL = ['./', './index.html', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('nicu-picu-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function networkFirst(req, key, timeoutMs) {
  return caches.open(CACHE).then(cache => {
    const net = fetch(req).then(res => {
      if (res && res.ok) cache.put(key || req, res.clone());
      return res;
    });
    const fallback = () => cache.match(key || req).then(hit => hit || net);
    const timer = new Promise(resolve => setTimeout(() => resolve(fallback()), timeoutMs));
    return Promise.race([net.catch(fallback), timer]);
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Pengecekan versi dari halaman (cache: no-store) selalu langsung ke jaringan.
  if (req.cache === 'no-store') return;

  // Halaman utama.
  if (req.mode === 'navigate') {
    e.respondWith(networkFirst(req, './index.html', 3000));
    return;
  }

  // Font Google: simpan saat pertama dimuat, pakai cache sesudahnya.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open(CACHE).then(c => c.match(req).then(hit => {
        const net = fetch(req).then(res => { c.put(req, res.clone()); return res; }).catch(() => hit);
        return hit || net;
      }))
    );
    return;
  }

  // File sendiri lainnya (manifest, ikon).
  if (url.origin === location.origin) {
    e.respondWith(networkFirst(req, null, 3000));
  }
});
