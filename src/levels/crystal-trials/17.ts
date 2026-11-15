import { TRIAL_11 } from './11';
import { deck, type CrystalTrial } from './types';

export const TRIAL_17: CrystalTrial = {
  id: 17, name: '17 / Rails, timed enemy and bounce crate',
  brief: 'Three offset rails → retracting enemy → bounce crate → high platform.',
  spawn: [0, .15, 5],
  reviewViews: [{ name: 'enemy-and-bounce', position: [0, 3.25, -88] }],
  components: [
    ...structuredClone(TRIAL_11.components).filter(c => c.t !== 'crystal' && !['11 / Raised receiver', '11 / Flat recovery floor'].includes(c.nm ?? '')).map(c => ({ ...c, nm: c.nm?.replace('11 /', '17 /') })),
    deck('17 / Flat recovery floor', 0, -8, -46, 40, 136, '#929e94'),
    deck('17 / Enemy and spring terrace', 0, 3.1, -92, 12, 20, '#a8b9a0'),
    { t: 'enemy', nm: '17 / Retracting enemy', foe: 'spinner', p: [0, 3.1, -94], range: 0, speed: 1 },
    { t: 'crate', nm: '17 / Bounce crate', kind: 'metalbounce', p: [0, 3.1, -100] },
    deck('17 / High receiver', 6, 9.3, -100, 5, 6, '#d8b26e'),
    { t: 'crystal', nm: '17 / Rails, timed enemy and bounce crate', p: [6, 9.3, -100] },
    { t: 'camnode', nm: '17 / Enemy and high receiver view', p: [0, 7, -96], s: [25, 28, 30], radius: 3,
      cameraView: true, cameraPresentationOnly: true, cameraPosition: [8, 14, -76], cameraTarget: [0, 6, -97],
      cameraFollowDistance: 18, cameraKeepDistance: true, cameraFollowTargetHeight: 4, cameraFov: 65 },
  ],
};
