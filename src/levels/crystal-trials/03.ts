import { deck, type CrystalTrial } from './types';

export const TRIAL_03: CrystalTrial = {
  id: 3, name: '3 / Long rail over a pit',
  brief: 'Long rail over a death pit → raised platform.',
  spawn: [0, .15, 5],
  reviewViews: [{ name: 'lower-return', position: [15, -7.85, -21] }],
  components: [
    deck('03 / Safe catch and balance practice', 0, 0, -6, 18, 32, '#809b9b'),
    { t: 'checkpoint', nm: '03 / Viaduct start', p: [-4, 0, 5] },
    { t: 'rail', nm: '03 / Needle rail', p: [0, 1.2, -41], len: 72, yaw: 0 },
    { t: 'pit', nm: '03 / Visible pit beneath the silver line', p: [0, -6, -50], s: [18, 1, 54], color: '#192e42' },
    deck('03 / Raised crystal receiver', 0, 3.1, -84, 8, 12, '#d8b26e'),
    { t: 'crystal', nm: '3 / Long rail over a pit', p: [0, 3.1, -84] },
    deck('03 / Wide one-way return landing', 11, -8, -84, 10, 12),
    deck('03 / Lower return outside the pit', 15, -8, -52, 6, 64),
    { t: 'ramp', nm: '03 / Return climb to the approach', p: [15, -8, -7.5], len: 25, rise: 8, w: 6, yaw: 180 },
    deck('03 / Return joins the observation promenade', 13, 0, 10, 10, 10),
    { t: 'camnode', nm: '03 / Read the pit, line and raised receiver',
      p: [0, 5, -39], s: [21, 30, 108], radius: 3, cameraView: true,
      cameraPresentationOnly: true, cameraPosition: [0, 11, -14], cameraTarget: [0, 2, -39],
      cameraFollowDistance: 16, cameraKeepDistance: true, cameraFollowTargetHeight: 2,
      cameraFov: 58, cameraAspect: 16 / 9 },
    { t: 'camnode', nm: '03 / Return view', p: [15, -4, -44], s: [9, 12, 120], radius: 2, yaw: 180,
      cameraView: true, cameraPosition: [15, 1, -60], cameraTarget: [15, -3, -38],
      cameraFollowDistance: 14, cameraFollowTargetHeight: 2.5 },
  ],
};
