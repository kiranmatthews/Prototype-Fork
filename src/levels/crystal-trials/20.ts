import { TRIAL_15 } from './15';
import { outlineStep } from './primitives';
import { deck, type CrystalTrial } from './types';

export const TRIAL_20: CrystalTrial = {
  id: 20, name: '20 / TNT and two switch groups',
  brief: 'TNT switch → revealed steps and spring → second switch → upper spring.',
  spawn: [0, .15, 5],
  reviewViews: [{ name: 'second-switch', position: [-1, 10.35, -33] }],
  components: [
    ...structuredClone(TRIAL_15.components).filter(c => c.t !== 'crystal' && !['15 / Flat courtyard', '15 / High receiver'].includes(c.nm ?? '')).map(c => ({ ...c, nm: c.nm?.replace('15 /', '20 /') })),
    deck('20 / Flat recovery courtyard', 0, 0, -25, 34, 90, '#849d87'),
    deck('20 / Second switch terrace', -1, 10.2, -33, 7, 10, '#a8b9a0'),
    { t: 'crate', nm: '20 / Second switch', kind: 'bang', p: [1, 10.2, -34], grp: 3 },
    outlineStep('20 / Upper outlined step', -1, 12.4, -42, 5, 5, 3),
    outlineStep('20 / Upper spring terrace', -1, 14.6, -50, 6, 6, 3),
    { t: 'crate', nm: '20 / Upper bounce crate', kind: 'metalbounce', p: [-1, 14.6, -50], outline: true, grp: 3 },
    deck('20 / High receiver', 5, 20.8, -54, 5, 6, '#d8b26e'),
    { t: 'crystal', nm: '20 / TNT and two switch groups', p: [5, 20.8, -54] },
    { t: 'camnode', nm: '20 / Second switch and steps view', p: [0, 16, -43], s: [30, 26, 36], radius: 3,
      cameraView: true, cameraPresentationOnly: true, cameraPosition: [5, 24, -18], cameraTarget: [0, 14, -43],
      cameraFollowDistance: 20, cameraKeepDistance: true, cameraFollowTargetHeight: 5, cameraFov: 67 },
  ],
};
