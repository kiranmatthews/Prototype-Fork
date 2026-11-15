import { deck, type CrystalTrial } from './types';

export const TRIAL_16: CrystalTrial = {
  id: 16, name: '16 / Nitro frames and two launchers',
  brief: 'Trampoline → bounce crate between Nitro → narrow high landing.',
  spawn: [0, .15, 5],
  components: [
    deck('16 / Flat recovery courtyard', 3, 0, -12, 32, 56, '#849d87'),
    { t: 'checkpoint', nm: '16 / Checkpoint', p: [-4, 0, 5] },
    { t: 'trampoline', nm: '16 / First launcher', p: [0, .12, -8], s: [6, .45, 6], speed: 22, amp: 1.25 },
    { t: 'crate', nm: '16 / Airborne bounce crate', kind: 'metalbounce', p: [4, 8, -12] },
    ...[2, 6].map(x => ({ t: 'crate' as const, nm: '16 / Nitro beside airborne spring', kind: 'nitro' as const, p: [x, 8, -12] as [number, number, number] })),
    deck('16 / Narrow high receiver', 8.5, 14.2, -12, 4, 6, '#d8b26e'),
    ...[6.7, 10.3].flatMap(x => [-14, -10].map(z => ({ t: 'crate' as const, nm: '16 / Nitro landing corner', kind: 'nitro' as const, p: [x, 14.2, z] as [number, number, number] }))),
    { t: 'crystal', nm: '16 / Nitro frames and two launchers', p: [8.5, 14.2, -12] },
    { t: 'camnode', nm: '16 / Nitro windows and launchers', p: [3, 7, -12], s: [44, 50, 70], radius: 3,
      cameraView: true, cameraPresentationOnly: true, cameraPosition: [3, 17, 10], cameraTarget: [3, 7, -18],
      cameraFollowDistance: 20, cameraKeepDistance: true, cameraFollowTargetHeight: 8, cameraFov: 70 },
  ],
};
