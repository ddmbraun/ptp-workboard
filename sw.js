// Service Worker – PAM Desktop (Workboard + Stammblatt)
// Beide Apps liegen im selben GitHub-Pages-Repo → eine gemeinsame sw.js
// Google-APIs (Drive, OAuth) werden NIEMALS gecacht –
// sie brauchen Auth-Token und müssen immer live abgefragt werden.

const CACHE_NAME = 'pam-desktop-v63';
const PRECACHE = [
  // CDN – Workboard
  'https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css',
  'https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js',
  'https://cdn.jsdelivr.net/npm/piexifjs@1.0.6/piexif.js',
  'https://cdn.jsdelivr.net/npm/jspdf-autotable@5.0.7/dist/jspdf.plugin.autotable.min.js',
  // CDN – Workboard + Stammblatt (gemeinsam)
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  // 'https://accounts.google.com/gsi/client' → Cache-Control: no-store, nicht cachebar
];

// HTML-Dateien: nie vorab cachen, immer Network-First (damit Updates sofort ankommen)
// index.html = PAM Workboard
// stammblatt.html = PAM Stammblatt

// Installation: nur CDN-Ressourcen vorab cachen
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// Aktivierung: veraltete Caches aus alten Versionen löschen
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Hilfsfunktion: ist die URL eine lokale HTML-Seite?
function isHtmlPage(url) {
  const u = new URL(url);
  return u.pathname === '/' ||
         u.pathname.endsWith('/index.html') ||
         u.pathname.endsWith('/stammblatt.html') ||
         u.pathname.endsWith('.html');
}

// Fetch-Strategie:
// – Google APIs / Microsoft / ssl.gstatic.com: immer direkt ans Netzwerk
// – Lokale HTML-Seiten (index.html, stammblatt.html): Network-First (immer aktuell)
// – Alles andere (CDN-Libs etc.): Cache-First, dann Netzwerk
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Blob-URLs und Data-URLs nie durch den SW routen
  if (url.startsWith('blob:') || url.startsWith('data:')) return;

  // Alle externen Dienste immer live – kein SW-Eingriff
  if (
    url.includes('googleapis.com') ||
    url.includes('accounts.google.com') ||
    url.includes('drive.google.com') ||
    url.includes('oauth2.google') ||
    url.includes('lh3.googleusercontent.com') ||
    url.includes('withgoogle.com') ||
    url.includes('ssl.gstatic.com') ||
    url.includes('microsoft.com') ||
    url.includes('microsoftonline.com') ||
    url.includes('microsoftauthenticator') ||
    url.includes('graph.microsoft.com') ||
    url.includes('login.live.com') ||
    url.includes('cdn.jsdelivr.net/npm/@azure')
  ) {
    return;
  }

  // Requests mit redirect-Modus != 'follow' nicht durch SW routen
  if (e.request.redirect && e.request.redirect !== 'follow') return;

  // ── Network-First für lokale HTML-Seiten ──────────────────────────────
  if (isHtmlPage(url)) {
    e.respondWith(
      fetch(e.request)
        .then(resp => {
          if (resp.status === 200) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return resp;
        })
        .catch(() => caches.match(e.request).then(c => c || new Response('Offline – bitte Netzwerk prüfen', {status: 503})))
    );
    return;
  }

  // ── Cache-First für alle anderen Ressourcen (CDN-Bibliotheken etc.) ──
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (e.request.method === 'GET' && resp.status === 200) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return resp;
      });
    })
  );
});
