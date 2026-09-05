import { browserResetDependencies, resetLocalGameData, undoLocalGameReset } from './localGameDataReset';

declare const __BUILD_TAG__: string;
declare const __BUILD_CHANNEL__: string;
const byId = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const reset = byId<HTMLButtonElement>('reset');
const undo = byId<HTMLButtonElement>('undo');
const confirmReset = byId<HTMLInputElement>('confirm-reset');
const confirmUndo = byId<HTMLInputElement>('confirm-undo');
const back = byId<HTMLAnchorElement>('back');
const status = byId('status');
let busy = false;
const deps = browserResetDependencies();
byId('build').textContent = `${__BUILD_CHANNEL__} · build ${__BUILD_TAG__}`;
confirmReset.onchange = () => { reset.disabled = busy || !confirmReset.checked; };
confirmUndo.onchange = () => { undo.disabled = busy || !confirmUndo.checked; };

async function refreshUndo(): Promise<void> {
  const backup = await deps.recovery.read();
  byId('undo-panel').hidden = !backup;
}
void refreshUndo().catch(() => { /* The reset action reports an unavailable backup store before deleting anything. */ });

async function run(restoring: boolean): Promise<void> {
  if (busy || !(restoring ? confirmUndo : confirmReset).checked) return;
  busy = true; reset.disabled = undo.disabled = true;
  confirmReset.disabled = confirmUndo.disabled = true;
  back.setAttribute('aria-disabled', 'true');
  back.onclick = (event) => event.preventDefault();
  status.textContent = restoring ? 'Restoring the previous local data…' : 'Saving an undo backup and resetting local data…';
  try {
    if (restoring) {
      await undoLocalGameReset(deps);
      status.textContent = 'Previous local game data restored. Return to the game to load it.';
      status.dataset.resetComplete = 'restored';
    } else {
      const receipt = await resetLocalGameData(deps);
      status.textContent = `Reset complete. Cleared ${receipt.localKeys} saved settings/data entries, ${receipt.sessionKeys} session entries and ${receipt.animationDrafts} animation drafts.\nReturn to the game to load the current defaults. Undo is available below.`;
      status.dataset.resetComplete = 'true';
    }
    back.textContent = 'Return to game';
    const url = new URL(import.meta.env.BASE_URL, location.href);
    url.searchParams.set('fresh', String(Date.now()));
    back.href = url.href;
  } catch (error) {
    status.textContent = `Reset could not finish: ${error instanceof Error ? error.message : String(error)}\nIf some data was already reset, use Undo below to restore the backup. Close other game tabs before retrying.`;
    status.dataset.resetComplete = 'false';
  } finally {
    busy = false; confirmReset.disabled = confirmUndo.disabled = false;
    confirmReset.checked = confirmUndo.checked = false;
    back.removeAttribute('aria-disabled'); back.onclick = null;
    await refreshUndo().catch(() => {});
  }
}
reset.onclick = () => { void run(false); };
undo.onclick = () => { void run(true); };
