/**
 * QPM Stock AI - Service Worker
 * Enables Offline Capabilities & Progressive Web App (PWA) Functionality
 */

const CACHE_NAME = 'qpm-stock-v1.5.2';
const STATIC_ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './stock-api.js',
    './stock-data.js',
    './gemini-agent.js',
    './manifest.json',
    './assets/icons/icon-192.png',
    './assets/icons/icon-512.png',
    './assets/icons/icon-maskable.png',
    './assets/icons/apple-touch-icon.png',
    './assets/icons/icon.svg'
];

// Domains that should NEVER be cached (Real-time live APIs)
const BYPASS_CACHE_DOMAINS = [
    'generativelanguage.googleapis.com',
    'services.entrade.com.vn',
    'iboard-query.ssi.com.vn',
    'fireant.vn'
];

// 1. Install Event: Cache Core Assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching static shell assets');
            return cache.addAll(STATIC_ASSETS).catch(err => {
                console.warn('[Service Worker] Some assets failed to precache:', err);
            });
        }).then(() => self.skipWaiting())
    );
});

// 2. Activate Event: Clean Old Caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('[Service Worker] Removing old cache:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// 3. Fetch Event: Smart Routing
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Bypass live financial APIs & Gemini LLM
    if (BYPASS_CACHE_DOMAINS.some(domain => url.hostname.includes(domain))) {
        return; // Normal network request
    }

    // For HTML navigation: Network First, fallback to Cache
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then((networkResponse) => {
                    return caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                })
                .catch(() => {
                    return caches.match('./index.html') || caches.match(event.request);
                })
        );
        return;
    }

    // For Static Resources (CSS, JS, Fonts, Images): Stale-While-Revalidate
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return networkResponse;
                })
                .catch(() => {
                    // Fallback to cache if network fails
                    return cachedResponse;
                });

            return cachedResponse || fetchPromise;
        })
    );
});
