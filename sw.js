// Service Worker – PAM Desktop (Workboard + Stammblatt)
// Beide Apps liegen im selben GitHub-Pages-Repo → eine gemeinsame sw.js
// Google-APIs (Drive, Sheets, OAuth) werden NIEMALS gecacht –
// sie brauchen Auth-Token und müssen immer live abgefragt werden.

const CACHE_NAME = 'pam-desktop-v13';
const PRECACHE = [
  './',
  './index.html',
  './stammblatt.html',
  // CDN-Bibliotheken Workboard
  'https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css',
  'https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js',
  'https://cdn.jsdelivr.net/npm/piexifjs@1.0.6/piexif.js',
  'https://cdn.jsdelivr.net/npm/jspdf-autotable@5.0.7/dist/jspdf.plugin.autotable.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  // CDN-Bibliotheken Stammblatt (html2canvas + jspdf bereits oben enthalten)
  // 'https://accounts.google.com/gsi/client' → Cache-Control: no-store, nicht cachebar
];

// Installation: alle statischen Ressourcen vorab cachen
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

// Fetch-Strategie:
// – Google APIs (Drive, Sheets, OAuth, GSI): immer direkt ans Netzwerk
//   → Datensynchronisation über Drive API läuft immer live, wird nie gecacht
// – Alles andere: Cache-First, dann Netzwerk (und dynamisch nachcachen)
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Blob-URLs und Data-URLs nie durch den SW routen – sie existieren nur im Tab
  if (url.startsWith('blob:') || url.startsWith('data:')) return;

  // Google-Dienste immer live – kein SW-Eingriff
  if (
    url.includes('googleapis.com') ||
    url.includes('accounts.google.com') ||
    url.includes('drive.google.com') ||
    url.includes('oauth2.google') ||
    url.includes('lh3.googleusercontent.com')
  ) {
    return; // Browser-Standard-Fetch ohne SW-Cache
  }

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        // Nur erfolgreiche GET-Antworten dynamisch nachlegen
        if (e.request.method === 'GET' && resp.status === 200) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return resp;
      });
    })
  );
});