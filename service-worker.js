const CACHE_NAME = 'mes-liens';
const URLS_TO_CACHE = [
  '/mes-liens/',
  '/mes-liens/index.html'
];

// Installation
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

// Fetch : stale-while-revalidate pour HTML avec notification auto-reload
self.addEventListener('fetch', function(event) {
  const isHTML = event.request.headers.get('accept')?.includes('text/html');

  if (isHTML) {
    const responsePromise = caches.open(CACHE_NAME).then(function(cache) {
      return cache.match(event.request).then(function(cached) {

        const networkFetch = fetch(event.request).then(function(response) {
          if (response && response.status === 200) {
            const responseClone = response.clone();

            cache.match(event.request).then(function(existing) {
              cache.put(event.request, responseClone);

              // Si le contenu a changé, notifier tous les clients pour recharger
              if (existing) {
                const oldDate = existing.headers.get('last-modified') || existing.headers.get('etag');
                const newDate = response.headers.get('last-modified') || response.headers.get('etag');
                if (oldDate && newDate && oldDate !== newDate) {
                  self.clients.matchAll().then(function(clients) {
                    clients.forEach(function(client) {
                      client.postMessage({ type: 'NEW_VERSION' });
                    });
                  });
                }
              }
            });
          }
          return response;
        }).catch(function() {
          return cached;
        });

        return cached || networkFetch;
      });
    });

    event.respondWith(responsePromise);

  } else {
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
