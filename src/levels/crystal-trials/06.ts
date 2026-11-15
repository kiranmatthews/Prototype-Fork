import { deck, type CrystalTrial } from './types';

export const TRIAL_06: CrystalTrial = {
  id: 6, name: '6 / Climbing rope and high platform',
  brief: 'Climbing rope → high framed platform.',
  spawn: [0, .15, 5],
  reviewViews: [{ name: 'rope-and-window', position: [0, .15, -13] }],
  components: [
    deck('06 / Rope courtyard and missed-release recovery', 0, 0, -12, 26, 50, '#849c8d'),
    { t: 'checkpoint', nm: '06 / Vine Window start', p: [-4, 0, 5] },
    { t: 'ropeswing', nm: '06 / Climbing vine', p: [0, 14, -18], len: 12,
      amp: .65, speed: .85, phase: 0, yaw: 90 },
    deck('06 / High window gallery', 0, 9.2, -27, 6, 6, '#d8b26e'),
    { t: 'platform', nm: '06 / Window left pier', p: [-3.8, 7.6, -25], s: [1.2, 15.2, 1.2], color: '#aa9875' },
    { t: 'platform', nm: '06 / Window right pier', p: [3.8, 7.6, -25], s: [1.2, 15.2, 1.2], color: '#aa9875' },
    { t: 'platform', nm: '06 / Window lintel', p: [0, 15.2, -25], s: [8.8, .8, 1.2], color: '#aa9875' },
    { t: 'crystal', nm: '6 / Climbing rope and high platform', p: [0, 9.2, -28] },
    { t: 'camnode', nm: '06 / Frame the climb and its high receiving window',
      p: [0, 7, -17], s: [38, 42, 66], radius: 3, cameraView: true,
      cameraPresentationOnly: true, cameraPosition: [0, 12, 10], cameraTarget: [0, 5, -19],
      cameraFollowDistance: 20, cameraKeepDistance: true, cameraFollowTargetHeight: 4.5,
      cameraFov: 65, cameraAspect: 16 / 9 },
  ],
};
