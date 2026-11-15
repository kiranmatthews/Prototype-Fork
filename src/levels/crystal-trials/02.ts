import { deck, type CrystalTrial } from './types';

export const TRIAL_02: CrystalTrial = {
  id: 2, name: '2 / Trampoline and high platform',
  brief: 'Trampoline → high platform.',
  spawn: [0, .15, 5],
  components: [
    deck('02 / Courtyard and local retry', 3, 0, -10, 30, 42, '#829a94'),
    { t: 'checkpoint', nm: '02 / Bell Tower start', p: [-4, 0, 5] },
    { t: 'trampoline', nm: '02 / Bell spring', p: [0, .12, -8], s: [6, .45, 6], speed: 22, amp: 1.25 },
    deck('02 / High bell balcony', 6, 8.4, -13, 4.6, 5.2, '#d8b26e'),
    { t: 'crystal', nm: '2 / Trampoline and high platform', p: [6, 8.4, -13] },
    { t: 'platform', nm: '02 / Left bell pillar', p: [3.15, 6.15, -15.6], s: [.8, 12.3, .8], color: '#536c77' },
    { t: 'platform', nm: '02 / Right bell pillar', p: [8.85, 6.15, -15.6], s: [.8, 12.3, .8], color: '#536c77' },
    { t: 'platform', nm: '02 / Bell arch lintel', p: [6, 12.6, -15.6], s: [6.5, .6, .8], color: '#d8b26e' },
    { t: 'camnode', nm: '02 / Spring and bell balcony in one view',
      p: [3, 7, -10], s: [38, 38, 52], radius: 3, cameraView: true,
      cameraPresentationOnly: true, cameraPosition: [3, 11, 18], cameraTarget: [3, 5, -10],
      cameraFollowDistance: 18, cameraKeepDistance: true, cameraFollowTargetHeight: 4.5,
      cameraFov: 58, cameraAspect: 16 / 9 },
  ],
};
