import { deck, type CrystalTrial } from './types';

export const TRIAL_11: CrystalTrial = {
  id: 11, name: '11 / Offset rail transfers',
  brief: 'Three offset rails over a pit → raised platform.',
  spawn: [0, .15, 5],
  reviewViews: [{ name: 'lower-return', position: [15, -7.85, -21] }],
  components: [
    deck('11 / Safe approach', 0, 0, 0, 18, 22),
    deck('11 / Flat recovery floor', 0, -8, -38, 40, 112, '#929e94'),
    { t: 'checkpoint', nm: '11 / Checkpoint', p: [-4, 0, 5] },
    { t: 'rail', nm: '11 / First rail', p: [0, 1.2, -17.5], len: 25 },
    { t: 'rail', nm: '11 / Right rail', p: [3.2, 1.2, -39], len: 34 },
    { t: 'rail', nm: '11 / Left rail', p: [0, 1.2, -64.5], len: 31 },
    { t: 'pit', nm: '11 / Rail transfer pit', p: [0, -6, -49], s: [18, 1, 62], color: '#192e42' },
    deck('11 / Raised receiver', 0, 3.1, -86, 7, 8, '#d8b26e'),
    { t: 'crystal', nm: '11 / Offset rail transfers', p: [0, 3.1, -86] },
    { t: 'ramp', nm: '11 / Return ramp', p: [15, -8, -7.5], len: 25, rise: 8, w: 5, yaw: 180 },
    deck('11 / Return junction', 13, 0, 10, 8, 10),
    { t: 'camnode', nm: '11 / Rail transfer view', p: [0, 4, -39], s: [21, 38, 110], radius: 3,
      cameraView: true, cameraPresentationOnly: true, cameraPosition: [0, 11, -10], cameraTarget: [0, 2, -39],
      cameraFollowDistance: 18, cameraKeepDistance: true, cameraFollowTargetHeight: 2.5, cameraFov: 62 },
    { t: 'camnode', nm: '11 / Return view', p: [15, -4, -44], s: [9, 12, 120], radius: 2, yaw: 180,
      cameraView: true, cameraPosition: [15, 1, -60], cameraTarget: [15, -3, -38],
      cameraFollowDistance: 14, cameraFollowTargetHeight: 2.5 },
  ],
};
