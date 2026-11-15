import { TRIAL_13 } from './13';
import { type CrystalTrial } from './types';

export const TRIAL_18: CrystalTrial = {
  id: 18, name: '18 / Two ropes and moving platform',
  brief: 'Climbing rope → moving rest → second rope → high platform.',
  spawn: [0, .15, 5],
  reviewViews: [{ name: 'moving-rest', position: [0, 9.35, -32] }],
  components: structuredClone(TRIAL_13.components).map(c => {
    if (c.nm === '13 / Raised resting platform') return {
      t: 'mover', nm: '18 / Moving rest', p: [0, 9.2, -31], s: [8, .8, 14], axis: 'x', amp: 3, speed: .7, phase: .4, color: '#a8a3d8',
    };
    return { ...c, nm: c.t === 'crystal' ? '18 / Two ropes and moving platform' : c.nm?.replace('13 /', '18 /') };
  }),
};
