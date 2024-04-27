const CACHE_NAME = "peezer-cache-v1";
const urlsToCache = [
  "/",
  "/index.html",
  "/styles.css",
  "/howItWorks.html",
  "/privacyNotice.html",
  "/peeStreamAnalyzer.js",
  "/assets/images/logo-192x192.png",
  "/assets/images/logo-512x512.png",
  "/manifest.json",
];

self.addEventListener("install", function (event) {
  // Perform install steps: Open a cache and cache our files
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      console.log("Opened cache");
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener("activate", (event) => {
  // Clean up old caches
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            return cacheName !== CACHE_NAME;
          })
          .map((cacheName) => {
            return caches.delete(cacheName);
          })
      );
    })
  );
});

self.addEventListener("fetch", function (event) {
  event.respondWith(
    caches.match(event.request).then(function (response) {
      // Cache hit - return the response from the cached version
      if (response) {
        return response;
      }

      // Not in cache - return the result from the live server
      // and cache it
      return fetch(event.request).then(function (response) {
        // Check if we received a valid response
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }

        // IMPORTANT: Clone the response. A response is a stream
        // and because we want the browser to consume the response
        // as well as the cache consuming the response, we need
        // to clone it so we have two streams.
        var responseToCache = response.clone();

        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(event.request, responseToCache);
        });

        return response;
      });
    })
  );
});
