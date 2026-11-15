import { TRIAL_20 } from './20';
import { deck, type CrystalTrial } from './types';

export const TRIAL_23: CrystalTrial = {
  id: 23, name: '23 / Two switch groups and climbing rope',
  brief: 'TNT → two revealed spring routes → climbing rope → high platform.',
  spawn: [0, .15, 5],
  reviewViews: [{ name: 'upper-rope', position: [5, 20.95, -57] }],
  components: [
    ...structuredClone(TRIAL_20.components).filter(c => c.t !== 'crystal' && !['20 / Flat recovery courtyard', '20 / High receiver'].includes(c.nm ?? '')).map(c => ({ ...c, nm: c.nm?.replace('20 /', '23 /') })),
    deck('23 / Flat recovery courtyard', 0, 0, -33, 36, 110, '#849d87'),
    deck('23 / Upper rope terrace', 5, 20.8, -59, 7, 16, '#a8b9a0'),
    { t: 'ropeswing', nm: '23 / Upper climbing rope', p: [5, 34.8, -62], len: 12, amp: .65, speed: .85, phase: .8, yaw: 90 },
    deck('23 / High receiver', 5, 30, -71, 6, 6, '#d8b26e'),
    { t: 'crystal', nm: '23 / Two switch groups and climbing rope', p: [5, 30, -72] },
    { t: 'camnode', nm: '23 / Upper rope and receiver view', p: [5, 28, -66], s: [28, 28, 30], radius: 3,
      cameraView: true, cameraPresentationOnly: true, cameraPosition: [9, 36, -40], cameraTarget: [5, 27, -67],
      cameraFollowDistance: 20, cameraKeepDistance: true, cameraFollowTargetHeight: 5, cameraFov: 70 },
  ],
};
