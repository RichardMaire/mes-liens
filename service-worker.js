const CACHE_NAME = 'mes-liens';
const URLS_TO_CACHE = [
  '/mes-liens/',
  '/mes-liens/index.html'
];

// Installation : mise en cache des fichiers de l'app
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(URLS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activation : nettoyage des anciens caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) { return key !== CACHE_NAME; })
            .map(function(key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

// Fetch : network-first pour HTML, cache-first pour le reste
self.addEventListener('fetch', function(event) {
  const isHTML = event.request.headers.get('accept')?.includes('text/html');

  if (isHTML) {
    // Network-first pour index.html → toujours à jour si en ligne
    event.respondWith(
      fetch(event.request).then(function(response) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, clone);
        });
        return response;
      }).catch(function() {
        // Hors-ligne → fallback sur le cache
        return caches.match(event.request) || caches.match('/mes-liens/index.html');
      })
    );
  } else {
    // Cache-first pour les autres fichiers (icônes, manifest...)
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        return cached || fetch(event.request).then(function(response) {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, clone);
            });
          }
          return response;
        });
      })
    );
  }
});
