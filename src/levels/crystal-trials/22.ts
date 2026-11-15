import { TRIAL_13 } from './13';
import { deck, type CrystalTrial } from './types';

export const TRIAL_22: CrystalTrial = {
  id: 22, name: '22 / Two ropes, timed steps and spring',
  brief: 'Two climbing ropes → timed steps → bounce crate → high platform.',
  spawn: [0, .15, 5],
  reviewViews: [{ name: 'upper-timed-steps', position: [0, 18.55, -49] }, { name: 'final-spring', position: [0, 24.75, -77] }],
  components: [
    ...structuredClone(TRIAL_13.components).filter(c => c.t !== 'crystal' && !['13 / Flat recovery courtyard', '13 / High receiver'].includes(c.nm ?? '')).map(c => ({ ...c, nm: c.nm?.replace('13 /', '22 /') })),
    deck('22 / Flat recovery courtyard', 0, 0, -42, 32, 112, '#849d87'),
    deck('22 / Upper resting platform', 0, 18.4, -47, 8, 8, '#a8b9a0'),
    ...[0, 1, 2].map(i => ({ t: 'phasepad' as const, nm: `22 / Upper timed step ${i + 1}`,
      p: [0, 19.9 + i * 1.5, -56 - i * 7] as [number, number, number], s: [4, .6, 4] as [number, number, number],
      cycle: 8, amp: .55, phase: [0, .76, .52][i] })),
    deck('22 / Upper spring terrace', 0, 24.6, -79, 8, 8, '#a8b9a0'),
    { t: 'crate', nm: '22 / Final bounce crate', kind: 'metalbounce', p: [0, 24.6, -80] },
    deck('22 / High receiver', 6, 30.8, -84, 5, 6, '#d8b26e'),
    { t: 'crystal', nm: '22 / Two ropes, timed steps and spring', p: [6, 30.8, -84] },
    { t: 'camnode', nm: '22 / Timed flight and final spring view', p: [0, 25, -65], s: [30, 30, 58], radius: 3,
      cameraView: true, cameraPresentationOnly: true, cameraPosition: [4, 32, -38], cameraTarget: [0, 23, -66],
      cameraFollowDistance: 20, cameraKeepDistance: true, cameraFollowTargetHeight: 5, cameraFov: 70 },
  ],
};
