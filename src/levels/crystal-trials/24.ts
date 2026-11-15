import { TRIAL_21 } from './21';
import { deck, type CrystalTrial } from './types';

export const TRIAL_24: CrystalTrial = {
  id: 24, name: '24 / Rails, enemy, spring, rope and timed steps',
  brief: 'Rail transfers and trick gate → enemy → spring → rope → timed steps.',
  spawn: [0, .15, 5],
  reviewViews: [{ name: 'enemy-and-bounce', position: [0, 3.25, -88] }, { name: 'upper-rope', position: [6, 9.45, -105] }, { name: 'timed-finish', position: [6, 18.65, -121] }],
  components: [
    ...structuredClone(TRIAL_21.components).filter(c => c.t !== 'crystal' && !['21 / Flat recovery floor', '21 / High receiver'].includes(c.nm ?? '')).map(c => {
      if (c.nm === '21 / Enemy and high receiver view') {
        c.p = [0, 7, -90];c.s = [25, 28, 28];
      }
      return { ...c, nm: c.nm?.replace('21 /', '24 /') };
    }),
    deck('24 / Flat recovery floor', 0, -8, -66, 40, 180, '#929e94'),
    deck('24 / Upper rope terrace', 6, 9.3, -105, 7, 16, '#a8b9a0'),
    { t: 'ropeswing', nm: '24 / Upper climbing rope', p: [6, 23.3, -109], len: 12, amp: .65, speed: .85, phase: .8, yaw: 90 },
    deck('24 / Timed route waiting bank', 6, 18.5, -119, 8, 8, '#a8b9a0'),
    ...[0, 1, 2].map(i => ({ t: 'phasepad' as const, nm: `24 / Timed finish step ${i + 1}`,
      p: [6, 20 + i * 1.5, -128 - i * 7] as [number, number, number], s: [4, .6, 4] as [number, number, number],
      cycle: 8, amp: .55, phase: [0, .76, .52][i] })),
    deck('24 / High receiver', 6, 24.7, -151, 8, 8, '#d8b26e'),
    { t: 'crystal', nm: '24 / Rails, enemy, spring, rope and timed steps', p: [6, 24.7, -152] },
    { t: 'camnode', nm: '24 / Upper rope view', p: [6, 15, -111], s: [22, 30, 28], radius: 3,
      cameraView: true, cameraPresentationOnly: true, cameraPosition: [10, 25, -86], cameraTarget: [6, 14, -112],
      cameraFollowDistance: 20, cameraKeepDistance: true, cameraFollowTargetHeight: 5, cameraFov: 70 },
    { t: 'camnode', nm: '24 / Timed finish view', p: [6, 22, -137], s: [22, 28, 42], radius: 3,
      cameraView: true, cameraPresentationOnly: true, cameraPosition: [10, 31, -110], cameraTarget: [6, 20, -138],
      cameraFollowDistance: 20, cameraKeepDistance: true, cameraFollowTargetHeight: 5, cameraFov: 70 },
  ],
};
