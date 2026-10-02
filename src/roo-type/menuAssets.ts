import '../secondary-text.css';
import { rooReady } from '../roofont';
import { loadRooAtlases } from './atlas';

/** Request both faces explicitly before any menu measures or publishes ink. */
export const menuAssetsReady: Promise<void> = (async () => {
  if (typeof document === 'undefined') return;
  await Promise.all([
    rooReady,
    loadRooAtlases(),
    document.fonts?.load('700 32px "Staging Secondary"', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'),
  ].map(work => Promise.resolve(work).catch(() => {})));
  await document.fonts?.ready;
})();
