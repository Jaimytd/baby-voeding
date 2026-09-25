// Service worker: app werkt ook zonder verbinding. Verhoog VERSIE bij elke release.
const VERSIE = "v2";
const SHELL = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "store.js",
  "config.js",
  "manifest.webmanifest",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSIE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSIE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Eigen bestanden en Firebase-scripts: eerst netwerk (altijd de nieuwste versie),
// bij geen verbinding uit de cache. Firestore-verkeer zelf gaat er buiten om.
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  const eigen = url.origin === location.origin;
  const firebaseScript = url.hostname === "www.gstatic.com" && url.pathname.startsWith("/firebasejs/");
  if (!eigen && !firebaseScript) return;
  e.respondWith(
    fetch(e.request)
      .then((resp) => {
        if (resp.ok) {
          const kopie = resp.clone();
          caches.open(VERSIE).then((c) => c.put(e.request, kopie));
        }
        return resp;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
