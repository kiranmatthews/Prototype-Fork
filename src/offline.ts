type OfflinePhase = 'idle' | 'saving' | 'ready' | 'error' | 'unsupported';
interface OfflineStatus { phase: OfflinePhase; completed: number; total: number; reason?: string }
let state: OfflineStatus = { phase: 'idle', completed: 0, total: 0 };
let registration: ServiceWorkerRegistration | undefined;
let updateWaiting = false;
export const OFFLINE_STATUS_EVENT = 'solProtoOfflineChanged';

export function offlineStatusText(): string {
  if (!import.meta.env.PROD) return '';
  if (state.phase === 'unsupported') return 'Offline play is unavailable in this browser.';
  if (state.phase === 'ready') return updateWaiting
    ? 'Offline update saved. Close all game windows, then reopen.' : 'Ready for offline play.';
  if (state.phase === 'saving') return 'Offline save in progress. Use the offline save screen to finish.';
  return 'Save a copy for offline play from Home.';
}
export async function openOfflineSave(): Promise<void> {
  // Replace, rather than retain a full game behind the downloader in history.
  // This action appears only on Home, where no run is in progress.
  const {sfx}=await import('./audio');
  await sfx.prepareToLeave();
  // Initial scenery/image queues may still be completing behind Home. Let
  // their tracked jobs settle before detaching the document; this does not
  // start any extra assets or overlap them with the offline download.
  const {presentationAssets}=await import('./presentationLoading');
  await presentationAssets.waitUntilSettled();
  window.location.replace(`${import.meta.env.BASE_URL}offline-save.html`);
}
function notify(): void { window.dispatchEvent(new Event(OFFLINE_STATUS_EVENT)); }
function requestStatus(): void {
  (registration?.waiting ?? registration?.active)?.postMessage({ type: 'solProtoOfflineStatus' });
}
/** Read-only in the game. Full-release saving belongs to offline-save.html. */
export function startOfflineCache(): void {
  if (!import.meta.env.PROD) return;
  if (!('serviceWorker' in navigator) || !window.isSecureContext) {
    state.phase = 'unsupported'; notify(); return;
  }
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data?.type !== 'solProtoOffline') return;
    state = event.data as OfflineStatus;
    updateWaiting = !!registration?.waiting;
    notify();
  });
  void navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL).then(existing=>{
    registration=existing;updateWaiting=!!existing?.waiting;requestStatus();notify();
  }).catch(()=>{});
  document.addEventListener('visibilitychange', () => { if (!document.hidden) requestStatus(); });
}
