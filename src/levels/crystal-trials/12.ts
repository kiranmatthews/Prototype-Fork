import { deck, type CrystalTrial } from './types';

export const TRIAL_12: CrystalTrial = {
  id: 12, name: '12 / Trampoline and airborne bounce crate',
  brief: 'Trampoline → airborne bounce crate → high platform.',
  spawn: [0, .15, 5],
  components: [
    deck('12 / Flat recovery courtyard', 3, 0, -12, 32, 56, '#849d87'),
    { t: 'checkpoint', nm: '12 / Checkpoint', p: [-4, 0, 5] },
    { t: 'trampoline', nm: '12 / First launcher', p: [0, .12, -8], s: [6, .45, 6], speed: 22, amp: 1.25 },
    { t: 'crate', nm: '12 / Airborne bounce crate', kind: 'metalbounce', p: [4, 8, -12] },
    deck('12 / High receiver', 8.5, 14.2, -12, 4, 6, '#d8b26e'),
    { t: 'crystal', nm: '12 / Trampoline and airborne bounce crate', p: [8.5, 14.2, -12] },
    { t: 'camnode', nm: '12 / Both launchers and receiver', p: [3, 7, -12], s: [44, 50, 70], radius: 3,
      cameraView: true, cameraPresentationOnly: true, cameraPosition: [3, 17, 10], cameraTarget: [3, 7, -18],
      cameraFollowDistance: 20, cameraKeepDistance: true, cameraFollowTargetHeight: 8, cameraFov: 70 },
  ],
};
