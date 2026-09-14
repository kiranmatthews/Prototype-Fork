type OfflinePhase = 'saving' | 'ready' | 'error' | 'unsupported';
interface OfflineStatus { phase: OfflinePhase; completed: number; total: number; reason?: string }
let state: OfflineStatus = { phase: 'saving', completed: 0, total: 0 };
let registration: ServiceWorkerRegistration | undefined;
let updateWaiting = false;
export const OFFLINE_STATUS_EVENT = 'solProtoOfflineChanged';

function standalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}
export function offlineStatusText(): string {
  if (!import.meta.env.PROD) return '';
  if (state.phase === 'unsupported') return 'Offline play is unavailable in this browser.';
  if (state.phase === 'error') return state.reason === 'storage'
    ? 'Offline save needs more device space. Free some space, then reopen the game online.'
    : 'Offline save interrupted. Reconnect and reopen the game to finish.';
  if (state.phase === 'saving') {
    const progress = state.total ? ` ${Math.min(99, Math.floor(state.completed / state.total * 100))}%` : '';
    return `Saving for offline play${progress}. Keep the game open.`;
  }
  if (updateWaiting) return 'Offline game saved. Close all game windows and reopen to play the update.';
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return 'Ready for offline play.' + (ios && !standalone()
    ? ' On iOS, add to Home Screen, then open it once online.' : '');
}
function notify(): void { window.dispatchEvent(new Event(OFFLINE_STATUS_EVENT)); }
async function persist(): Promise<void> {
  try {
    if (navigator.storage?.persist && !await navigator.storage.persisted()) await navigator.storage.persist();
  } catch { /* Cache remains usable when the browser declines persistence. */ }
}
function requestStatus(): void {
  (registration?.installing ?? registration?.waiting ?? registration?.active)?.postMessage({ type: 'solProtoOfflineStatus' });
}
function observe(worker: ServiceWorker): void {
  worker.addEventListener('statechange', () => {
    updateWaiting = !!registration?.waiting;
    if (worker.state === 'redundant' && state.phase !== 'error') state = { ...state, phase: 'error' };
    requestStatus(); notify();
  });
}
export function startOfflineCache(): void {
  if (!import.meta.env.PROD) return;
  if (!('serviceWorker' in navigator) || !window.isSecureContext) {
    state.phase = 'unsupported'; notify(); return;
  }
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data?.type !== 'solProtoOffline') return;
    state = event.data as OfflineStatus;
    updateWaiting = !!registration?.waiting;
    if (state.phase === 'ready') void persist();
    notify();
  });
  const register = async (): Promise<void> => {
    try {
      registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
        scope: import.meta.env.BASE_URL, updateViaCache: 'none',
      });
      registration.addEventListener('updatefound', () => {
        if (registration?.installing) observe(registration.installing);
      });
      if (registration.installing) observe(registration.installing);
      updateWaiting = !!registration.waiting;
      requestStatus(); notify();
    } catch {
      // Reopening offline still uses the already active, cached release.
      const existing = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL).catch(() => undefined);
      if (existing?.active) { registration = existing; requestStatus(); }
      else { state.phase = 'error'; notify(); }
    }
  };
  // Let startup artwork/character loads win the initial network contention.
  if (document.readyState === 'complete') void register();
  else window.addEventListener('load', () => void register(), { once: true });
  window.addEventListener('online', () => void register());
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      requestStatus();
      if (navigator.onLine) void registration?.update().catch(() => undefined);
    }
  });
  window.addEventListener('pointerup', () => { if (state.phase === 'ready') void persist(); }, { once: true });
}
