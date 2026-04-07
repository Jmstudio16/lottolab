/* eslint-disable no-restricted-globals */

/**
 * LOTTOLAB Service Worker - Version Professionnelle APK POS
 * =========================================================
 * PWA Service Worker avec cache API complet pour mode offline
 * 
 * Stratégies:
 * - Static assets: Cache First
 * - API critiques: Stale-While-Revalidate
 * - API dynamiques: Network First with Cache Fallback
 */

const CACHE_VERSION = 'v3';
const STATIC_CACHE = `lottolab-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `lottolab-dynamic-${CACHE_VERSION}`;
const API_CACHE = `lottolab-api-${CACHE_VERSION}`;

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html'
];

// API endpoints to cache (critical for offline mode)
const CACHEABLE_API_PATTERNS = [
  '/api/sync/vendeur/open-lotteries',
  '/api/company/vendor/bet-type-limits',
  '/api/device/config',
  '/api/vendeur/profile',
  '/api/results',
  '/api/global-schedules',
  '/api/company/schedules'
];

// API endpoints that should never be cached
const NO_CACHE_API_PATTERNS = [
  '/api/auth/',
  '/api/vendeur/sell',
  '/api/vendeur/pay-winner',
  '/api/upload',
  '/api/export'
];

// Cache TTL settings (in milliseconds)
const CACHE_TTL = {
  lotteries: 5 * 60 * 1000,      // 5 minutes
  config: 60 * 60 * 1000,        // 1 hour
  results: 2 * 60 * 1000,        // 2 minutes
  profile: 30 * 60 * 1000,       // 30 minutes
  default: 10 * 60 * 1000        // 10 minutes
};

/**
 * Install Event - Cache static assets
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing LOTTOLAB Service Worker v3...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS.map(url => {
          return new Request(url, { cache: 'reload' });
        })).catch(err => {
          console.warn('[SW] Some static assets failed to cache:', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

/**
 * Activate Event - Clean old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating LOTTOLAB Service Worker v3...');
  
  event.waitUntil(
    caches.keys()
      .then((keys) => {
        return Promise.all(
          keys
            .filter((key) => {
              return key.startsWith('lottolab-') && 
                     key !== STATIC_CACHE && 
                     key !== DYNAMIC_CACHE && 
                     key !== API_CACHE;
            })
            .map((key) => {
              console.log('[SW] Deleting old cache:', key);
              return caches.delete(key);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

/**
 * Check if URL is an API request
 */
function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

/**
 * Check if API should be cached
 */
function shouldCacheApi(url) {
  const pathname = url.pathname;
  
  // Never cache these
  if (NO_CACHE_API_PATTERNS.some(pattern => pathname.includes(pattern))) {
    return false;
  }
  
  // Always cache these
  if (CACHEABLE_API_PATTERNS.some(pattern => pathname.includes(pattern))) {
    return true;
  }
  
  // Default: cache GET requests only
  return false;
}

/**
 * Get cache TTL for an API endpoint
 */
function getCacheTTL(url) {
  const pathname = url.pathname;
  
  if (pathname.includes('lotteries') || pathname.includes('schedules')) {
    return CACHE_TTL.lotteries;
  }
  if (pathname.includes('config') || pathname.includes('bet-type-limits')) {
    return CACHE_TTL.config;
  }
  if (pathname.includes('results')) {
    return CACHE_TTL.results;
  }
  if (pathname.includes('profile')) {
    return CACHE_TTL.profile;
  }
  
  return CACHE_TTL.default;
}

/**
 * Check if cached response is still valid
 */
function isCacheValid(response, ttl) {
  if (!response) return false;
  
  const cachedTime = response.headers.get('sw-cached-time');
  if (!cachedTime) return true; // No timestamp, assume valid
  
  const age = Date.now() - parseInt(cachedTime);
  return age < ttl;
}

/**
 * Add timestamp to response before caching
 */
function addCacheTimestamp(response) {
  const headers = new Headers(response.headers);
  headers.set('sw-cached-time', Date.now().toString());
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: headers
  });
}

/**
 * Fetch Event Handler
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip WebSocket requests
  if (url.protocol === 'wss:' || url.protocol === 'ws:') {
    return;
  }

  // Skip chrome-extension and other protocols
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Handle API requests
  if (isApiRequest(url)) {
    if (shouldCacheApi(url)) {
      event.respondWith(handleApiRequest(request, url));
    }
    // Let non-cacheable API requests pass through
    return;
  }

  // Handle navigation requests (HTML pages)
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  // Handle static assets
  event.respondWith(handleStaticRequest(request));
});

/**
 * Handle API requests with Stale-While-Revalidate strategy
 */
async function handleApiRequest(request, url) {
  const cache = await caches.open(API_CACHE);
  const ttl = getCacheTTL(url);
  
  // Try to get from cache first
  const cachedResponse = await cache.match(request);
  
  // If we have a valid cached response
  if (cachedResponse && isCacheValid(cachedResponse, ttl)) {
    // Return cached response immediately
    // But also update cache in background (stale-while-revalidate)
    const fetchPromise = fetch(request)
      .then((networkResponse) => {
        if (networkResponse.ok) {
          const responseToCache = addCacheTimestamp(networkResponse.clone());
          cache.put(request, responseToCache);
        }
        return networkResponse;
      })
      .catch(() => null);
    
    // Don't wait for the update
    event.waitUntil && event.waitUntil(fetchPromise);
    
    console.log('[SW] Serving from cache (stale-while-revalidate):', url.pathname);
    return cachedResponse;
  }
  
  // No valid cache, try network
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache the new response
      const responseToCache = addCacheTimestamp(networkResponse.clone());
      await cache.put(request, responseToCache);
      console.log('[SW] Cached API response:', url.pathname);
    }
    
    return networkResponse;
  } catch (error) {
    // Network failed, return stale cache if available
    if (cachedResponse) {
      console.log('[SW] Network failed, serving stale cache:', url.pathname);
      return cachedResponse;
    }
    
    // No cache, return offline error
    console.error('[SW] API request failed with no cache:', url.pathname);
    return new Response(
      JSON.stringify({ 
        error: 'offline', 
        message: 'Vous êtes hors ligne',
        cached: false 
      }), 
      { 
        status: 503, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}

/**
 * Handle navigation requests
 */
async function handleNavigationRequest(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    // Cache the response
    const cache = await caches.open(DYNAMIC_CACHE);
    cache.put(request, networkResponse.clone());
    
    return networkResponse;
  } catch (error) {
    // Try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Try index.html for SPA routing
    const indexResponse = await caches.match('/index.html');
    if (indexResponse) {
      return indexResponse;
    }
    
    // Return offline page
    const offlineResponse = await caches.match('/offline.html');
    if (offlineResponse) {
      return offlineResponse;
    }
    
    // Last resort: return error
    return new Response('Vous êtes hors ligne', { status: 503 });
  }
}

/**
 * Handle static asset requests
 */
async function handleStaticRequest(request) {
  // Try cache first for static assets
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // Try network
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Return placeholder for images
    if (request.destination === 'image') {
      return new Response('', { status: 404 });
    }
    
    throw error;
  }
}

/**
 * Message handler for communication with main thread
 */
self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CLEAR_CACHE':
      caches.keys().then(keys => {
        keys.forEach(key => caches.delete(key));
      });
      break;
      
    case 'CACHE_API':
      if (payload && payload.url) {
        caches.open(API_CACHE).then(cache => {
          fetch(payload.url).then(response => {
            if (response.ok) {
              cache.put(payload.url, addCacheTimestamp(response));
            }
          });
        });
      }
      break;
      
    case 'GET_CACHE_STATS':
      Promise.all([
        caches.open(STATIC_CACHE).then(c => c.keys()),
        caches.open(DYNAMIC_CACHE).then(c => c.keys()),
        caches.open(API_CACHE).then(c => c.keys())
      ]).then(([staticKeys, dynamicKeys, apiKeys]) => {
        event.ports[0].postMessage({
          static: staticKeys.length,
          dynamic: dynamicKeys.length,
          api: apiKeys.length
        });
      });
      break;
      
    default:
      console.log('[SW] Unknown message type:', type);
  }
});

/**
 * Background sync for pending tickets
 */
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-tickets') {
    console.log('[SW] Background sync triggered for tickets');
    event.waitUntil(syncPendingTickets());
  }
});

/**
 * Sync pending tickets (called by background sync)
 */
async function syncPendingTickets() {
  // This will be handled by the SyncQueueManager in the main thread
  // Just notify all clients
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'SYNC_REQUESTED' });
  });
}

/**
 * Push notification handler (for future use)
 */
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  const data = event.data.json();
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'LOTTOLAB', {
      body: data.body || '',
      icon: '/assets/logos/icon-192.png',
      badge: '/assets/logos/badge-72.png',
      data: data.data
    })
  );
});

console.log('[SW] LOTTOLAB Service Worker v3 loaded');
