/** Compare the loaded HTML's entry with a tiny, uncached release descriptor.
 * No worker installation, asset prefetch, save mutation or automatic reload. */
export async function newerGameAvailable(
  base: string,
  runningEntry: string,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  if (!runningEntry) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetcher(new URL('release.json', base), {
      cache: 'no-store', signal: controller.signal,
    });
    if (!response.ok) return false;
    const declared = Number(response.headers.get('content-length'));
    if (declared > 1024) { await response.body?.cancel(); return false; }
    if (!response.body) return false;
    const reader=response.body.getReader(),decoder=new TextDecoder();let text='',bytes=0;
    try {
      for (;;) {
        const chunk=await reader.read();if(chunk.done)break;
        bytes+=chunk.value.byteLength;
        if(bytes>1024){await reader.cancel();return false;}
        text+=decoder.decode(chunk.value,{stream:true});
      }
      text+=decoder.decode();
    } finally {reader.releaseLock();}
    const release = JSON.parse(text) as { entry?: unknown };
    if (typeof release.entry !== 'string' || !/^assets\/index-[\w-]+\.js$/.test(release.entry)) return false;
    const current = new URL(runningEntry, base), latest = new URL(release.entry, base);
    if(current.origin!==latest.origin)return false;
    return current.pathname !== latest.pathname;
  } catch { return false; }
  finally { clearTimeout(timer); }
}

/** Fired once when a newer published build is found. */
export const GAME_UPDATE_EVENT = 'solProtoGameUpdate';
let updateAvailable = false, checking = false, lastCheck = -Infinity;
export function gameUpdateAvailable(): boolean { return updateAvailable; }

async function checkForUpdate(): Promise<void> {
  if (navigator.onLine === false || checking || updateAvailable || Date.now() - lastCheck < 60000) return;
  checking = true; lastCheck = Date.now();
  try {
    const entry = document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.src;
    if (entry && await newerGameAvailable(new URL(import.meta.env.BASE_URL, location.href).href, entry)) {
      updateAvailable = true;
      window.dispatchEvent(new Event(GAME_UPDATE_EVENT));
    }
  } finally { checking = false; }
}

/** Offline mode is retired. Browsers that saved an offline copy under an
 * earlier release unregister it here, and its cached files are deleted, so the
 * live game always loads. public/sw.js does the same for visits that arrive
 * through the old worker. Saved games live in local storage and are kept. */
async function removeRetiredOfflineCopy(): Promise<void> {
  try {
    const scope = new URL(import.meta.env.BASE_URL, location.href).href;
    for (const registration of await navigator.serviceWorker?.getRegistrations() ?? [])
      if (registration.scope === scope) await registration.unregister();
    const prefix = `solProtoOffline:${new URL(scope).pathname}:`;
    for (const name of await globalThis.caches?.keys() ?? [])
      if (name.startsWith(prefix)) await caches.delete(name);
  } catch { /* storage may be blocked; then there is nothing to remove */ }
}

/** Published builds only: look for a newer release at start and whenever the
 * game returns to the foreground (at most once a minute). */
export function startGameUpdateChecks(): void {
  if (!import.meta.env.PROD) return;
  void removeRetiredOfflineCopy();
  void checkForUpdate();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void checkForUpdate(); });
}

/** Leave for the update page, which reloads the latest build with saves kept. */
export async function openGameUpdate(): Promise<void> {
  const {sfx}=await import('./audio');
  await sfx.prepareToLeave();
  // Initial scenery/image queues may still be completing behind Home. Let
  // their tracked jobs settle before detaching the document.
  const {presentationAssets}=await import('./presentationLoading');
  await presentationAssets.waitUntilSettled();
  window.location.replace(`${import.meta.env.BASE_URL}update-game.html?v=${Date.now()}`);
}
