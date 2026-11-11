// Gemmer appens skal, så den åbner hurtigt – data hentes altid fra serveren.
const CACHE = 'feltapp-v5';
const SKAL = ['./', 'index.html', 'style.css', 'app.js', 'tjeklister.js', 'tilbud.js', 'anlaeg.js', 'demo.js', 'logo.svg', 'logo-ikon.svg', 'ikon.svg', 'manifest.webmanifest'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SKAL)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== CACHE).map((x) => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
	const u = new URL(e.request.url);
	if (e.request.method !== 'GET' || u.pathname.startsWith('/api') || u.pathname.startsWith('/public')) return;
	e.respondWith(fetch(e.request).then((r) => { const k = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, k)); return r; }).catch(() => caches.match(e.request)));
});
