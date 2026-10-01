const CACHE_NAME = 'mes-liens-v2';
const HTML_URL = '/mes-liens/index.html';
const URLS_TO_PRECACHE = [
  '/mes-liens/',
  '/mes-liens/index.html',
  '/mes-liens/manifest.json',
  '/mes-liens/icon.png'
];
const NETWORK_TIMEOUT_MS = 3000; // au-delà → on sert le cache (connexion lente)

// ── Installation ────────────────────────────────────────────────────────────
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      // cache: 'reload' → contourne le cache HTTP pour précacher la vraie dernière version
      return Promise.all(URLS_TO_PRECACHE.map(function(url) {
        return fetch(url, { cache: 'reload' }).then(function(res) {
          if (res.ok) return cache.put(url, res);
        }).catch(function() {});
      }));
    })
  );
  self.skipWaiting();
});

// ── Activation : supprime les anciens caches ────────────────────────────────
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// ── Message : la page peut forcer skipWaiting ────────────────────────────────
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// Réponse en cache pour la page (ignore ?query, fallback sur index.html)
function cachedPage(request) {
  return caches.match(request, { ignoreSearch: true }).then(function(r) {
    return r || caches.match(HTML_URL) || caches.match('/mes-liens/');
  });
}

// ── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', function(event) {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;          // Google Fonts etc. → navigateur
  if (url.pathname.endsWith('service-worker.js')) return;

  // ── Navigation (la page HTML) : réseau avec timeout → cache ──
  if (req.mode === 'navigate') {
    const network = fetch(req, { cache: 'no-store' }).then(function(res) {
      if (res && res.ok) {
        const clone = res.clone();
        event.waitUntil(caches.open(CACHE_NAME).then(function(c) {
          return Promise.all([c.put(HTML_URL, clone.clone()), c.put('/mes-liens/', clone)]);
        }));
      }
      return res;
    });

    event.respondWith(new Promise(function(resolve) {
      let done = false;
      const fallback = function() {
        if (done) return;
        cachedPage(req).then(function(cached) {
          if (cached) { done = true; resolve(cached); }
          // pas de cache → on attend quand même le réseau
        });
      };
      const timer = setTimeout(fallback, NETWORK_TIMEOUT_MS);

      network.then(function(res) {
        clearTimeout(timer);
        if (!done) { done = true; resolve(res); }
      }).catch(function() {
        clearTimeout(timer);
        cachedPage(req).then(function(cached) {
          if (done) return;
          done = true;
          resolve(cached || new Response(
            'Hors-ligne — ouvre l\'app une première fois avec une connexion.',
            { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
          ));
        });
      });
    }));
    return;
  }

  // ── Autres fichiers du site (manifest, icône) : réseau → cache ──
  event.respondWith(
    fetch(req).then(function(res) {
      if (res && res.ok) {
        const clone = res.clone();
        event.waitUntil(caches.open(CACHE_NAME).then(function(c) { return c.put(req, clone); }));
      }
      return res;
    }).catch(function() {
      return caches.match(req, { ignoreSearch: true }).then(function(r) {
        return r || new Response('', { status: 504 });
      });
    })
  );
});
