import { deck, type CrystalTrial } from './types';

export const TRIAL_01: CrystalTrial = {
  id: 1, name: '1 / Bounce crate',
  brief: 'Bounce crate → airborne crystal.',
  spawn: [0, .15, 5],
  components: [
    deck('01 / Garden landing and retry floor', 0, 0, -4, 24, 30),
    { t: 'checkpoint', nm: '01 / First Lift start', p: [-4, 0, 5] },
    { t: 'crate', nm: '01 / Reusable arrow spring', kind: 'metalbounce', p: [0, 0, -5] },
    { t: 'crystal', nm: '1 / Bounce crate', p: [0, 6.1, -5] },
    { t: 'camnode', nm: '01 / See the spring and its overhead goal together',
      p: [0, 5, -4], s: [30, 30, 40], radius: 3, cameraView: true,
      cameraPresentationOnly: true, cameraPosition: [0, 11, 18], cameraTarget: [0, 4, -4],
      cameraFollowDistance: 17, cameraKeepDistance: true, cameraFollowTargetHeight: 3.6,
      cameraFov: 57, cameraAspect: 16 / 9 },
    { t: 'platform', nm: '01 / Rear garden rim', p: [0, -.2, -19.6], s: [24, .6, 1.2], color: '#d5b376' },
  ],
};
