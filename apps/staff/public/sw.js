/**
 * @tepisawah/staff — Progressive Web App Service Worker.
 *
 * Caching Strategy:
 * 1. Supabase API / Auth / Realtime: ALWAYS Network-Only (no stale transactions/auth).
 * 2. Static Assets (JS, CSS, Images, Fonts): Cache-First with Stale-While-Revalidate.
 * 3. Navigation / HTML pages: Network-First with Cache fallback (SPA Offline Shell).
 */

const CACHE_NAME = "tepisawah-staff-v1.5.2";

const PRECACHE_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/favicon.png",
  "/apple-touch-icon.png",
  "/logo.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-192.png",
  "/icons/maskable-512.png"
];

// Install: pre-cache application shell assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn("[SW] Pre-cache warning:", err);
      })
  );
});

// Activate: clean up outdated caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
            return null;
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: smart caching policies
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1. Never intercept non-GET requests
  if (req.method !== "GET") return;

  // 2. Bypass Supabase backend API, Auth, and WebSockets (Live data must always be fresh)
  if (
    url.hostname.includes("supabase.co") ||
    url.pathname.startsWith("/rest/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.startsWith("/realtime/")
  ) {
    return;
  }

  // 3. Navigation requests (HTML documents): Network-First, fallback to cached index
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          const fallback = await caches.match("/");
          if (fallback) return fallback;
          return new Response("Aplikasi offline. Silakan sambungkan koneksi internet.", {
            headers: { "Content-Type": "text/html; charset=utf-8" }
          });
        })
    );
    return;
  }

  // 4. Static assets (Vite hashed bundles, images, Google fonts, icons): Cache-First
  const isStatic =
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".webp") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg") ||
    url.hostname.includes("fonts.googleapis.com") ||
    url.hostname.includes("fonts.gstatic.com");

  if (isStatic) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) {
          // Revalidate in background
          fetch(req)
            .then((fresh) => {
              if (fresh.ok) {
                caches.open(CACHE_NAME).then((cache) => cache.put(req, fresh));
              }
            })
            .catch(() => {});
          return cached;
        }

        return fetch(req).then((fresh) => {
          if (fresh.ok) {
            const clone = fresh.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return fresh;
        });
      })
    );
  }
});
