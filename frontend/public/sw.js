// Service Worker for Rentu PWA & Web Push Notifications
const CACHE_NAME = 'rentu-pwa-v13';

// Assets to precache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/site.webmanifest',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Precache core assets non-blockingly
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('Pre-cache non-fatal error:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event listener required for PWA installability
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle GET requests and http(s) protocols
  if (request.method !== 'GET' || !request.url.startsWith('http')) {
    return;
  }

  // Bypass API requests and auth handlers to ensure real-time freshness
  if (
    request.url.includes('/api/') || 
    request.url.includes('/supabase') || 
    request.url.includes('/auth/') || 
    request.url.includes('/__/auth')
  ) {
    return;
  }

  // Network-first with cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache valid static responses
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache).catch(() => {});
          });
        }
        return response;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }
        // If navigating to an HTML page while offline, return cached root
        if (request.mode === 'navigate') {
          const fallback = await caches.match('/');
          if (fallback) return fallback;
        }
        return new Response('Offline - Rentu requires an internet connection', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain' },
        });
      })
  );
});

// Push notification handling
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { body: event.data.text() };
    }
  }

  const title = data.title || 'Rentu Notification';
  const options = {
    body: data.body || 'You have a new update on Rentu.',
    icon: data.icon || "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚡</text></svg>",
    badge: data.badge || "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚡</text></svg>",
    data: {
      url: data.url || '/',
      id: data.id,
      type: data.type,
      referenceId: data.referenceId,
      referenceType: data.referenceType,
    },
    tag: data.tag || (data.type ? `${data.type}_${Date.now()}` : 'rentu-notification'),
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
