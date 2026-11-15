import { deck, type CrystalTrial } from './types';

export const TRIAL_09: CrystalTrial = {
  id: 9, name: '9 / Turtle shell and high platform',
  brief: 'Turtle shell → held bounce → double jump → high platform.',
  spawn: [0, .15, 5],
  components: [
    deck('09 / Flat courtyard', 0, 0, -12, 28, 52, '#849d87'),
    { t: 'checkpoint', nm: '09 / Checkpoint', p: [-4, 0, 5] },
    { t: 'enemy', nm: '09 / Turtle spring', foe: 'turtle', p: [0, 0, -14], range: 0, speed: 0 },
    deck('09 / High receiver', 6, 8.2, -18, 5, 6, '#d8b26e'),
    { t: 'crystal', nm: '9 / Turtle shell and high platform', p: [6, 8.2, -18] },
    { t: 'pit', nm: '09 / Reset pit beyond the courtyard', p: [-9, -6, -42], s: [6, 1, 8] },
    { t: 'camnode', nm: '09 / Shell and receiver view', p: [0, 5, -15], s: [42, 40, 62], radius: 3,
      cameraView: true, cameraPresentationOnly: true, cameraPosition: [2, 12, 12], cameraTarget: [2, 4, -16],
      cameraFollowDistance: 18, cameraKeepDistance: true, cameraFollowTargetHeight: 4, cameraFov: 62 },
  ],
};
