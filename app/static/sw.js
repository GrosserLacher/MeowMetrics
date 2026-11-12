/* sw.js – Service Worker: Offline-Start der App (Oberfläche aus dem Cache) und Push-Erinnerungen.
   Daten laufen nie über den Cache des Service Workers, sie liegen in der App (IndexedDB). */
const CACHE='mm-static-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('mm-static-') && k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  const fonts = u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com';
  if (u.origin !== location.origin && !fonts) return;
  if (u.pathname.startsWith('/api/') || u.pathname === '/sw.js') return;
  if (r.mode === 'navigate' || u.pathname === '/') {   // Seite: erst Netz, ohne Verbindung die zuletzt gespeicherte Version
    e.respondWith(fetch(r).then(res => { if (res.ok) { const c = res.clone(); caches.open(CACHE).then(x => x.put('/', c)); } return res; })
      .catch(() => caches.match('/').then(m => m || Response.error())));
    return;
  }
  e.respondWith(caches.open(CACHE).then(async cache => {   // Dateien: sofort aus dem Cache, im Hintergrund aktualisieren
    const hit = await cache.match(r);
    const net = fetch(r).then(res => { if (res.ok || res.type === 'opaque') cache.put(r, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) {}
  e.waitUntil(self.registration.showNotification(d.title || d.app || '', {
    body: d.body || '',
    icon: '/static/icon-192.png',
    badge: '/static/icon-192.png',
    tag: d.tag || 'feeding-reminder',
    data: { url: d.url || '/' }
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if ('focus' in c) return c.focus();
    return self.clients.openWindow(url);
  }));
});
