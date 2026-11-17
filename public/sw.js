/* Offline mode has been retired. Browsers that saved an offline copy still
 * check this address for worker updates, so it now holds a worker that removes
 * that copy: it deletes this project's offline caches and unregisters itself.
 * Nothing is cached or intercepted, and saved games live in local storage, so
 * they are untouched. Open pages keep running; the next visit loads the live
 * game. Keep this file published for as long as old installs may exist. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil((async () => {
  const prefix = `solProtoOffline:${new URL(self.registration.scope).pathname}:`;
  try {
    for (const name of await caches.keys()) if (name.startsWith(prefix)) await caches.delete(name);
  } finally {
    await self.registration.unregister();
  }
})()));
