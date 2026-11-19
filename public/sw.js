/**
 * Service Worker AZANUSA
 * - Precache: halaman utama, manifest, ikon, halaman offline
 * - Runtime: cache-first untuk aset statis; network-first untuk /api/prayer-times
 *   (fallback cache terakhir agar jadwal tetap tampil offline); navigasi → offline.html
 */
const VERSION = "azanusa-v1.2.0";
const PRECACHE = [
  "/",
  "/manifest.webmanifest",
  "/icons/logo.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
  "/icons/favicon-48.png",
  "/icons/apple-touch-icon.png",
  "/assets/azanusa-logo.png",
  "/assets/azanusa-logo-mark.png",
  "/assets/azanusa-mosque-bg.png",
  "/assets/azanusa-app-icon.png",
  "/audio/azan.mp3",
  "/offline.html",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  // API jadwal & Al-Qur'an: network-first dengan fallback cache terakhir
  if (url.pathname.startsWith("/api/prayer-times") || url.pathname.startsWith("/api/quran")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then((hit) => hit ?? new Response(JSON.stringify({ ok: false, error: "offline" }), { headers: { "Content-Type": "application/json" }, status: 503 }))
        )
    );
    return;
  }

  // Aset statis: cache-first
  if (
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/audio/") ||
    url.pathname.startsWith("/assets/") ||
    url.pathname === "/manifest.webmanifest" ||
    /\.(css|js|woff2|png|svg|jpg|webp)$/.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ??
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
            return res;
          })
      )
    );
    return;
  }

  // Navigasi halaman: network-first, fallback "/" lalu offline.html
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put("/", copy));
          return res;
        })
        .catch(() => caches.match("/").then((hit) => hit ?? caches.match("/offline.html").then((o) => o ?? Response.error())))
    );
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(self.location.origin));
      if (existing) return existing.focus();
      return self.clients.openWindow("/");
    })
  );
});
