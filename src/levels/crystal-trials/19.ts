import { TRIAL_14 } from './14';
import { deck, type CrystalTrial } from './types';

export const TRIAL_19: CrystalTrial = {
  id: 19, name: '19 / Crumbling steps and bounce crate',
  brief: 'Six crumbling steps with a rest → bounce crate → high platform.',
  spawn: [0, .15, 5],
  reviewViews: [{ name: 'upper-steps', position: [0, 6.35, -35] }, { name: 'high-bounce', position: [0, 12.55, -65] }],
  components: [
    ...structuredClone(TRIAL_14.components).filter(c => c.t !== 'crystal').map(c => ({ ...c,
      ...(c.t === 'phasepad' ? { t: 'crumble' as const, shake: 2.8, speed: 30, color: '#ae987d' } : {}),
      nm: c.nm?.replace('14 /', '19 /').replace('timed', 'crumbling').replace('Timed', 'Crumbling'),
    })),
    { t: 'crate', nm: '19 / Final bounce crate', kind: 'metalbounce', p: [0, 12.4, -68] },
    deck('19 / Final receiver', 6, 18.6, -72, 5, 6, '#d8b26e'),
    { t: 'crystal', nm: '19 / Crumbling steps and bounce crate', p: [6, 18.6, -72] },
    { t: 'camnode', nm: '19 / Final rebound view', p: [0, 17, -68], s: [25, 26, 24], radius: 3,
      cameraView: true, cameraPresentationOnly: true, cameraPosition: [6, 23, -46], cameraTarget: [0, 15, -68],
      cameraFollowDistance: 18, cameraKeepDistance: true, cameraFollowTargetHeight: 5, cameraFov: 67 },
  ],
};
