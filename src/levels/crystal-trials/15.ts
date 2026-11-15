import { deck, type CrystalTrial } from './types';
import { box, outlineStep } from './primitives';

export const TRIAL_15: CrystalTrial = {
  id: 15, name: '15 / TNT, switch and revealed route',
  brief: 'TNT → enclosed switch → revealed steps and bounce crate → high platform.',
  spawn: [0, .15, 5],
  reviewViews: [{ name: 'tnt-and-switch', position: [-5, .15, -9] }],
  components: [
    deck('15 / Flat courtyard', 0, 0, -18, 34, 68, '#849d87'),
    { t: 'checkpoint', nm: '15 / Checkpoint', p: [-4, 0, 5] },
    { t: 'crate', nm: '15 / TNT trigger', kind: 'tnt', p: [0, 0, -10] },
    { t: 'crate', nm: '15 / Enclosed switch', kind: 'bang', p: [0, 0, -13.1], grp: 2 },
    box('15 / Transparent front panel', [0, 2.75, -10.65], [6, 5.5, .2], { opacity: .2, color: '#83c5d0' }),
    box('15 / Transparent back panel', [0, 2.75, -15.6], [6, 5.5, .2], { opacity: .2, color: '#83c5d0' }),
    box('15 / Transparent left panel', [-3, 2.75, -13.1], [.2, 5.5, 5.15], { opacity: .2, color: '#83c5d0' }),
    box('15 / Transparent right panel', [3, 2.75, -13.1], [.2, 5.5, 5.15], { opacity: .2, color: '#83c5d0' }),
    box('15 / Enclosure roof', [0, 5.65, -13.1], [6.2, .3, 5.15], { color: '#536c77' }),
    outlineStep('15 / First revealed step', -7, 2.2, -21, 5, 4, 2),
    outlineStep('15 / Revealed spring terrace', -7, 4.4, -29, 6, 6, 2),
    { t: 'crate', nm: '15 / Revealed bounce crate', kind: 'metalbounce', p: [-7, 4.4, -29], outline: true, grp: 2 },
    deck('15 / High receiver', -1, 10.2, -33, 5, 6, '#d8b26e'),
    { t: 'crystal', nm: '15 / TNT, switch and revealed route', p: [-1, 10.2, -33] },
    { t: 'camnode', nm: '15 / TNT, switch and raised route view', p: [-2, 6, -20], s: [44, 44, 78], radius: 3,
      cameraView: true, cameraPresentationOnly: true, cameraPosition: [-2, 14, 10], cameraTarget: [-2, 5, -22],
      cameraFollowDistance: 19, cameraKeepDistance: true, cameraFollowTargetHeight: 5, cameraFov: 65 },
  ],
};
