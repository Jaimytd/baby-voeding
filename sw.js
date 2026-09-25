// Service worker: app werkt ook zonder verbinding. Verhoog VERSIE bij elke release.
const VERSIE = "v9";
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

// Eigen bestanden en Firebase-scripts: eerst netwerk (altijd de nieuwste versie).
// Antwoordt het netwerk niet binnen 2 seconden (wifi zonder internet), dan uit de cache;
// het netwerkantwoord ververst de cache dan op de achtergrond.
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  const eigen = url.origin === location.origin;
  const firebaseScript = url.hostname === "www.gstatic.com" && url.pathname.startsWith("/firebasejs/");
  if (!eigen && !firebaseScript) return;
  const netwerk = fetch(e.request).then((resp) => {
    if (resp.ok) {
      const kopie = resp.clone();
      caches.open(VERSIE).then((c) => c.put(e.request, kopie));
    }
    return resp;
  });
  e.waitUntil(netwerk.catch(() => {}));
  e.respondWith(
    new Promise((klaar) => {
      let beantwoord = false;
      const geef = (r) => { if (r && !beantwoord) { beantwoord = true; klaar(r); } };
      const uitCache = () => caches.match(e.request, { ignoreSearch: true });
      const wacht = setTimeout(() => uitCache().then(geef), 2000);
      netwerk
        .then((r) => { clearTimeout(wacht); geef(r); })
        .catch(() => { clearTimeout(wacht); uitCache().then((r) => geef(r || Response.error())); });
    }),
  );
});
