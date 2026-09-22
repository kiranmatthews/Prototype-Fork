import { newerGameAvailable } from './gameUpdate';
type OfflinePhase = 'idle' | 'saving' | 'ready' | 'error' | 'unsupported';
interface OfflineStatus { phase: OfflinePhase; completed: number; total: number; reason?: string; olderCopy?:boolean }
let state: OfflineStatus = { phase: 'idle', completed: 0, total: 0 };
let registration: ServiceWorkerRegistration | undefined;
let updateWaiting = false;
let gameUpdate = false, checkingUpdate = false, lastUpdateCheck = -Infinity;
let releaseReachable=false;
export const OFFLINE_STATUS_EVENT = 'solProtoOfflineChanged';
export function gameUpdateAvailable(): boolean { return gameUpdate; }

export function offlineStatusText(): string {
  if (!import.meta.env.PROD) return '';
  if (gameUpdate) return 'A new game version is available. Update from Home; saves and custom levels are kept.';
  if (state.phase === 'unsupported') return 'Offline play is unavailable in this browser.';
  if (state.phase === 'ready') return updateWaiting
    ? 'Offline update saved. Close all game windows, then reopen.' : 'Ready for offline play.';
  if (state.phase === 'saving') return 'Offline save in progress. Use the offline save screen to finish.';
  if (state.olderCopy) return 'An older offline copy is saved. Save Offline updates it.';
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
  window.location.replace(`${import.meta.env.BASE_URL}offline-save.html?v=${Date.now()}`);
}
export async function openGameUpdate(): Promise<void> {
  const {sfx}=await import('./audio');
  await sfx.prepareToLeave();
  const {presentationAssets}=await import('./presentationLoading');
  await presentationAssets.waitUntilSettled();
  window.location.replace(`${import.meta.env.BASE_URL}update-game.html?v=${Date.now()}`);
}
async function checkGameUpdate(): Promise<void> {
  if (navigator.onLine===false || checkingUpdate || gameUpdate || Date.now()-lastUpdateCheck < 60000) return;
  checkingUpdate=true;lastUpdateCheck=Date.now();
  try {
    const entry=document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.src;
    releaseReachable=false;
    if (entry && await newerGameAvailable(new URL(import.meta.env.BASE_URL,location.href).href,entry,fetch,()=>{
      releaseReachable=true;requestWorkerUpdate();
    })) {
      gameUpdate=true;notify();
    }
  } finally { checkingUpdate=false; }
}
function notify(): void { window.dispatchEvent(new Event(OFFLINE_STATUS_EVENT)); }
function requestWorkerUpdate():void {
  if(releaseReachable&&navigator.onLine!==false)void registration?.update().catch(()=>{});
}
function requestStatus(): void {
  (registration?.waiting ?? registration?.active)?.postMessage({ type: 'solProtoOfflineStatus' });
}
/** The game checks lightweight updates; full-release saving belongs to its own page. */
export function startOfflineCache(): void {
  if (!import.meta.env.PROD) return;
  void checkGameUpdate();
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void checkGameUpdate();});
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
    // Updating worker code is lightweight; the worker requires an explicit
    // save-screen message before it can download or store the full release.
    requestWorkerUpdate();
  }).catch(()=>{});
  document.addEventListener('visibilitychange', () => { if (!document.hidden) requestStatus(); });
}
