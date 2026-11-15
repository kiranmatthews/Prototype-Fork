import { deck, type CrystalTrial } from './types';
import type { CustomComponent } from '../../level';

const revealedStep = (...args: Parameters<typeof deck>): CustomComponent => ({
  ...deck(...args), t: 'mesh', outline: true, grp: 2,
  vertices: [-.5,-.5,-.5, .5,-.5,-.5, .5,.5,-.5, -.5,.5,-.5,
    -.5,-.5,.5, .5,-.5,.5, .5,.5,.5, -.5,.5,.5],
  indices: [3,7,6, 3,6,2, 0,3,2, 0,2,1, 4,5,6, 4,6,7,
    0,4,7, 0,7,3, 1,2,6, 1,6,5, 0,1,5, 0,5,4],
  grindTopTriangles: 2,
});

export const TRIAL_08: CrystalTrial = {
  id: 8, name: '8 / Switch, steps and bounce crate',
  brief: 'Switch → two raised steps → bounce crate → high platform.',
  spawn: [0, .15, 5],
  components: [
    deck('08 / Orchard courtyard and local retry', 0, 0, -12, 26, 52, '#849d87'),
    { t: 'checkpoint', nm: '08 / Outline Orchard start', p: [-4, 0, 5] },
    { t: 'crate', nm: '08 / Reveal switch', kind: 'bang', p: [-5, 0, -7], grp: 2 },
    revealedStep('08 / First revealed step', 0, 2.2, -14, 5, 4, '#a8b9a0'),
    revealedStep('08 / Revealed spring terrace', 0, 4.4, -22, 6, 6, '#a8b9a0'),
    { t: 'crate', nm: '08 / Revealed reusable arrow', kind: 'metalbounce', p: [0, 4.4, -22], outline: true, grp: 2 },
    deck('08 / High orchard gallery', 6, 10.2, -26, 5, 6, '#d8b26e'),
    { t: 'crystal', nm: '8 / Switch, steps and bounce crate', p: [6, 10.2, -26] },
    { t: 'camnode', nm: '08 / Read switch, outlines, arrow and high gallery',
      p: [0, 6, -18], s: [40, 42, 70], radius: 3, cameraView: true,
      cameraPresentationOnly: true, cameraPosition: [3, 14, 10], cameraTarget: [3, 5, -20],
      cameraFollowDistance: 20, cameraKeepDistance: true, cameraFollowTargetHeight: 4.5,
      cameraFov: 63, cameraAspect: 16 / 9 },
  ],
};
