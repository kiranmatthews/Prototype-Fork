import type { CrtGuestSettings } from './settings';
import type { CrtGuestSettingsLike } from './pass';

const sourceHeights = new WeakMap<CrtGuestSettingsLike, number>();
const contextListeners = new WeakMap<CrtGuestSettingsLike, Set<() => void>>();
export function setCrtControlSourceHeight(settings: CrtGuestSettingsLike, height: number): void {
  if (sourceHeights.get(settings) === height) return;
  sourceHeights.set(settings, height);
  for (const listener of contextListeners.get(settings) ?? []) listener();
}
export function subscribeCrtControlContext(settings: CrtGuestSettingsLike, listener: () => void): () => void {
  let listeners = contextListeners.get(settings);
  if (!listeners) contextListeners.set(settings, listeners = new Set());
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The stored 143-slot schema stays compatible with existing presets. The
 * authoring UI exposes only controls with a live consumer in the chosen mode.
 * esrc's two samplers are the same current stock image in this browser port;
 * LS is fixed by the supplied LUT assets, so neither is an editable control. */
export function isCrtControlRelevant(id: string, settings: CrtGuestSettings): boolean {
  const v = (key: string) => settings.getValue(key);
  if (id === 'esrc' || id === 'LS') return false;
  const afterglow = v('AS') !== 0;
  const glow = v('glow') !== 0;
  const bloom = Math.abs(v('bloom')) > .025;
  const halation = Math.abs(v('halation')) > .01;
  const mask = v('shadowMask') > -.5;
  const maskBloom = mask && Math.abs(v('mask_bloom')) > .025;
  const magic = glow && v('m_glow') > .5;
  const height = sourceHeights.get(settings);
  const interlaced = height === undefined ? null :
    v('inter') <= height / (v('intres') > 1.25 ? v('intres') : 1) && v('interm') > .5 &&
    v('intres') !== 1 && v('intres') !== .5 && v('vga_mode') < .5;
  const alternateLines = v('interm') === (settings.variant === 'hd' ? 5 : 6);
  const scanlines = v('hiscan') > .5 || (v('no_scanlines') <= .025 && (!interlaced || alternateLines));
  if (['gsl','scanline1','scanline2','beam_min','beam_max','tds','beam_size','scans','scan_falloff','scangamma','rolling_scan','clips'].includes(id)) return scanlines;
  if (id === 'spike' && settings.variant === 'hd') return scanlines;
  if (id === 'HSHARPNESS') return v('S_SHARP') !== 0 || v('SIGMA_HOR') > .25;
  if (id === 'VSHARPNESS' && v('S_SHARP') === 0 && v('SIGMA_VER') <= .25) return false;
  if (['VSHARPNESS','SIGMA_VER'].includes(id)) return height === undefined || v('hiscan') > .5 || (!!interlaced && !alternateLines && v('no_scanlines') < .05);
  if (['iscan','iscans'].includes(id)) return interlaced !== false && !alternateLines && v('hiscan') < .5;
  if (['PR','PG','PB','agsat'].includes(id)) return afterglow;
  if (id === 'bth') return afterglow || v('BP') > 0;
  if (id === 'CS') return v('CP') !== -1;
  if (id === 'vigdef') return v('vigstr') !== 0;
  if (['lsmooth','lsdev','OS'].includes(id)) return v('BLOOM') !== 0;
  if (['ei_limit','sth'].includes(id)) return v('smart_ei') > .01 && v('TATE') < .5;
  if (['SIZEH','SIZEV','SIZEHB','SIZEVB'].includes(id)) {
    const glowRadius = id === 'SIZEH' || id === 'SIZEV';
    const sigma = {SIZEH:'SIGMA_H',SIZEV:'SIGMA_V',SIZEHB:'SIGMA_HB',SIZEVB:'SIGMA_VB'}[id]!;
    return (glowRadius ? glow : bloom || halation || maskBloom) && v(sigma) > .25;
  }
  if (['m_glow','FINE_GLOW','SIZEH','SIZEV','SIGMA_H','SIGMA_V'].includes(id)) return glow;
  if (['m_glow_cutoff','m_glow_low','m_glow_high','m_glow_dist','m_glow_mask'].includes(id)) return magic;
  if (['FINE_BLOOM','SIZEHB','SIZEVB','SIGMA_HB','SIGMA_VB'].includes(id)) return bloom || halation || maskBloom;
  if (id === 'bloom_dist') return bloom || maskBloom;
  if (id === 'bmask1') return bloom && mask;
  if (id === 'hmask1') return halation && mask;
  if (['HSHARP','MAXS','HARNG'].includes(id)) return v('S_SHARP') !== 0;
  if (id === 'sborder') return v('csize') !== 0 || v('bsize1') !== 0;
  if (id === 'c_shape') return v('warpX') !== 0 || v('warpY') !== 0;
  if (['barspeed','bardir'].includes(id)) return v('barintensity') !== 0;
  if (['noiseresd','noisetype'].includes(id)) return Math.abs(v('addnoised')) > .01;
  if (['dctypex','dctypey','decons'].includes(id))
    return ['deconrr','deconrg','deconrb','deconrry','deconrgy','deconrby'].some(key=>v(key)!==0);
  if (id === 'mcut') return v('shadowMask') >= 5;
  if (id === 'maskstr') return mask && (v('shadowMask') === 0 || v('shadowMask') >= 5);
  if (id === 'mask_gamma') return mask || bloom || v('halation') > .01;
  if (['maskDark','maskLight'].includes(id)) return v('shadowMask') >= 1 && v('shadowMask') <= 4;
  if (id === 'mzoom_sh') return mask && Math.abs(v('mask_zoom')) > .75;
  if (['slotwidth','double_slot','slotms','smask_mit'].includes(id)) return mask && (v('slotmask') !== 0 || v('slotmask1') !== 0);
  if (['maskboost','masksize','mask_zoom','mshift','mask_layout','slotmask','slotmask1','mclip','mask_bloom'].includes(id)) return mask;
  return true;
}

export function hasCrtKernelControls(settings: CrtGuestSettings): boolean {
  return isCrtControlRelevant('FINE_GLOW', settings) || isCrtControlRelevant('FINE_BLOOM', settings);
}
