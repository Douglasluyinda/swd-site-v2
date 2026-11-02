/* SWD POS service worker. Deliberately narrow: it only keeps the till page and
   its static assets so the designated terminal can open while the internet is
   down. It never caches API/action traffic, other admin pages, or credentials
   (the session cookie is httpOnly and is never read here). */
const CACHE = "swd-pos-shell-v1";
const SHELL = "/admin/business-os/pos";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("swd-pos-") && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function networkFirstShell(req) {
  const cache = await caches.open(CACHE);
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(req, { signal: ctrl.signal });
    clearTimeout(timer);
    // Only keep a real till page — never a redirect to the login screen.
    if (res.ok && !res.redirected && new URL(res.url).pathname === SHELL) await cache.put(SHELL, res.clone());
    return res;
  } catch {
    const cached = await cache.match(SHELL);
    if (cached) return cached;
    return new Response("The till has not been opened on this device while online yet. Connect to the internet and open it once.", { status: 503, headers: { "content-type": "text/plain" } });
  }
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/_next/static/")) { e.respondWith(cacheFirst(req)); return; }
  if (url.pathname === SHELL && (req.mode === "navigate" || req.headers.get("x-swd-warm"))) e.respondWith(networkFirstShell(req));
});
