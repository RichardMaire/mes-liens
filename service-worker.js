const CACHE_NAME = 'mes-liens-v2';
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

// Fetch : stale-while-revalidate pour HTML, cache-first pour le reste
self.addEventListener('fetch', function(event) {
  const isHTML = event.request.headers.get('accept')?.includes('text/html');

  if (isHTML) {
    event.respondWith(
      caches.open(CACHE_NAME).then(function(cache) {
        return cache.match(event.request).then(function(cached) {
          // Mise à jour en arrière-plan garantie avec waitUntil
          const updateCache = fetch(event.request).then(function(response) {
            if (response && response.status === 200) {
              cache.put(event.request, response.clone());
            }
            return response;
          }).catch(function() { return cached; });

          event.waitUntil(updateCache);

          // Sert le cache immédiatement si disponible, sinon attend le réseau
          return cached || updateCache;
        });
      })
    );
  } else {
    // Cache-first pour les autres fichiers (icônes, manifest...)
    // Exclure service-worker.js du cache pour ne pas bloquer les mises à jour
    if (event.request.url.includes('service-worker.js')) return;

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
