import { deck, type CrystalTrial } from './types';

export const TRIAL_13: CrystalTrial = {
  id: 13, name: '13 / Two climbing ropes',
  brief: 'Climbing rope → raised rest → second climbing rope → high platform.',
  spawn: [0, .15, 5],
  reviewViews: [{ name: 'second-rope', position: [0, 9.35, -32] }],
  components: [
    deck('13 / Flat recovery courtyard', 0, 0, -24, 28, 76, '#849d87'),
    { t: 'checkpoint', nm: '13 / Checkpoint', p: [-4, 0, 5] },
    { t: 'ropeswing', nm: '13 / First climbing rope', p: [0, 14, -18], len: 12, amp: .65, speed: .85, phase: 0, yaw: 90 },
    deck('13 / Raised resting platform', 0, 9.2, -31, 6, 14, '#a8b9a0'),
    { t: 'ropeswing', nm: '13 / Second climbing rope', p: [0, 23.2, -37], len: 12, amp: .65, speed: .85, phase: 1.7, yaw: 90 },
    deck('13 / High receiver', 0, 18.4, -46, 6, 6, '#d8b26e'),
    { t: 'crystal', nm: '13 / Two climbing ropes', p: [0, 18.4, -47] },
    { t: 'camnode', nm: '13 / Both ropes and their receiving platforms', p: [0, 8, -15], s: [40, 48, 48], radius: 3,
      cameraView: true, cameraPresentationOnly: true, cameraPosition: [0, 17, 10], cameraTarget: [0, 7, -20],
      cameraFollowDistance: 20, cameraKeepDistance: true, cameraFollowTargetHeight: 8, cameraFov: 70 },
    { t: 'camnode', nm: '13 / Upper climb and receiver', p: [0, 16, -43], s: [40, 32, 40], radius: 3,
      cameraView: true, cameraPresentationOnly: true, cameraPosition: [0, 23, -17], cameraTarget: [0, 16, -44],
      cameraFollowDistance: 18, cameraKeepDistance: true, cameraFollowTargetHeight: 5, cameraFov: 65 },
  ],
};
