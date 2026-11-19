/* Studio Saint Tattoo – modo offline.
   A cada atualização do site no GitHub, aumente o número da VERSAO abaixo. */
const VERSAO = 'saint-v9';
const ARQUIVOS = ['./', 'index.html', 'app.js', 'config.js', 'manifest.json', 'logo.png', 'letra.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
/* Com internet: busca a versão mais nova do site (até 4 s). Sem internet: usa a cópia guardada.
   Os dados (api.github.com) nunca passam pelo cache. */
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSAO);
    try {
      const rede = fetch(req, { cache: 'no-cache' });
      const r = await Promise.race([rede, new Promise((_, rej) => setTimeout(() => rej(new Error('lento')), 4000))]);
      if (r && r.ok) cache.put(req, r.clone());
      return r;
    } catch (err) {
      const c = await cache.match(req, { ignoreSearch: true }) || (req.mode === 'navigate' ? await cache.match('index.html') : null);
      if (c) return c;
      return fetch(req);
    }
  })());
});
