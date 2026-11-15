import { deck, type CrystalTrial } from './types';

export const TRIAL_10: CrystalTrial = {
  id: 10, name: '10 / Folding bridge and small platform',
  brief: 'Spin-open bridge → timed crossing → small raised platform.',
  spawn: [0, .15, 5],
  reviewViews: [{ name: 'lower-return', position: [15, -7.85, -21] }],
  components: [
    deck('10 / Approach', 0, 0, 5, 18, 26),
    deck('10 / Flat recovery floor', 0, -8, -15, 40, 74, '#929e94'),
    { t: 'checkpoint', nm: '10 / Checkpoint', p: [-4, 0, 5] },
    { t: 'spinbridge', nm: '10 / Timed folding bridge', p: [0, 0, -8], s: [14, .4, 3], yaw: 90, cycle: .5, hold: 5, tex: 'wood' },
    deck('10 / Small receiver', 0, 2.2, -27, 3.5, 3.5, '#d8b26e'),
    { t: 'crystal', nm: '10 / Folding bridge and small platform', p: [0, 2.2, -27] },
    { t: 'ramp', nm: '10 / Return ramp', p: [15, -8, -7.5], len: 25, rise: 8, w: 5, yaw: 180 },
    deck('10 / Return junction', 13, 0, 10, 8, 10),
    { t: 'camnode', nm: '10 / Bridge view', p: [0, 4, -13], s: [21, 42, 66], radius: 3,
      cameraView: true, cameraPresentationOnly: true, cameraPosition: [10, 11, 9], cameraTarget: [0, 3, -20],
      cameraFollowDistance: 18, cameraKeepDistance: true, cameraFollowTargetHeight: 4, cameraFov: 64 },
    { t: 'camnode', nm: '10 / Return view', p: [15, -4, -24], s: [9, 12, 80], radius: 2, yaw: 180,
      cameraView: true, cameraPosition: [15, 1, -40], cameraTarget: [15, -3, -18],
      cameraFollowDistance: 14, cameraFollowTargetHeight: 2.5 },
  ],
};
