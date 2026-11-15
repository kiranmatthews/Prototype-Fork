import { TRIAL_17 } from './17';
import { type CrystalTrial } from './types';

export const TRIAL_21: CrystalTrial = {
  id: 21, name: '21 / Rails, trick gate, enemy and spring',
  brief: 'Rail transfers → kickflip gate → retracting enemy → bounce crate.',
  spawn: [0, .15, 5],
  reviewViews: [{ name: 'trick-gate', position: [0, 3.25, -85] }, { name: 'enemy-and-bounce', position: [0, 3.25, -88] }],
  components: [
    ...structuredClone(TRIAL_17.components).map(c => {
      if (c.nm === '17 / Rail transfer view') {
        c.p = [0, 4, -31];c.s = [21, 38, 94];
      }
      if (c.nm === '17 / Enemy and high receiver view') {
        c.s = [25, 28, 40];c.cameraPosition = [20, 16, -91];c.cameraTarget = [0, 6, -97];
      }
      return { ...c, nm: c.t === 'crystal' ? '21 / Rails, trick gate, enemy and spring' : c.nm?.replace('17 /', '21 /') };
    }),
    { t: 'trickgate', nm: '21 / Kickflip gate', p: [0, 4.5, -80.5], s: [12, 10, .6], radius: 3, trick: 'kick', yaw: 0 },
  ],
};
