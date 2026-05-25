const CACHE_NAME = 'mes-liens-v1';
const HTML_URL = '/mes-liens/index.html';
const URLS_TO_PRECACHE = [
  '/mes-liens/',
  '/mes-liens/index.html'
];

// ── Installation ────────────────────────────────────────────────────────────
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(URLS_TO_PRECACHE);
    })
  );
  self.skipWaiting(); // prend le contrôle immédiatement
});

// ── Activation : supprime les anciens caches + notifie les clients ──────────
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys
          .filter(function(key) { return key !== CACHE_NAME; })
          .map(function(key) { return caches.delete(key); })
      );
    }).then(function() {
      // Prend le contrôle de toutes les pages ouvertes
      return self.clients.claim();
    }).then(function() {
      // Demande à toutes les pages de recharger après activation
      return self.clients.matchAll({ type: 'window' }).then(function(clients) {
        clients.forEach(function(client) {
          client.postMessage({ type: 'SW_ACTIVATED' });
        });
      });
    })
  );
});

// ── Message handler : permet à la page de déclencher skipWaiting ─────────────
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', function(event) {
  // Ne pas intercepter le SW lui-même
  if (event.request.url.includes('service-worker.js')) return;

  const isHTML = event.request.headers.get('accept')?.includes('text/html');

  if (isHTML) {
    // HTML : network-first → cache fallback
    // Garantit toujours la version la plus récente quand on est en ligne
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(function(response) {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, clone);
            });
          }
          return response;
        })
        .catch(function() {
          // Hors-ligne : sert le cache
          return caches.match(event.request).then(function(cached) {
            return cached || new Response('Hors-ligne — ouvre l\'app une première fois avec une connexion.', {
              status: 503,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            });
          });
        })
    );

  } else {
    // Tous les autres assets (icônes, etc.) : réseau direct, pas de cache
    // → toujours à jour sans intervention manuelle
    return;
  }
});
