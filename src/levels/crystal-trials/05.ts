import { deck, type CrystalTrial } from './types';

export const TRIAL_05: CrystalTrial = {
  id: 5, name: '5 / Halfpipe and high crystal',
  brief: 'Halfpipe pumps → high crystal.',
  spawn: [0, .15, 5],
  reviewViews: [{ name: 'halfpipe-floor', position: [0, .15, -33] }],
  components: [
    deck('05 / Open halfpipe approach', 0, 0, -5, 24, 32, '#809b9b'),
    { t: 'checkpoint', nm: '05 / Skylight start', p: [-4, 0, 5] },
    { t: 'vertramp', nm: '05 / Pumping halfpipe', p: [0, 0, -33],
      vkind: 'half', w: 5, rise: 4, len: 28, arc: 90, arcSteps: 24, deck: 2.5, skateCamera: true },
    { t: 'crystal', nm: '5 / Halfpipe and high crystal', p: [9, 9.8, -33] },
    { t: 'camnode', nm: '05 / See the pipe and high crystal',
      p: [0, 6, -20], s: [38, 40, 70], radius: 3, cameraView: true,
      cameraPresentationOnly: true, cameraPosition: [0, 13, 8], cameraTarget: [0, 4, -22],
      cameraFollowDistance: 22, cameraKeepDistance: true, cameraFollowTargetHeight: 4,
      cameraFov: 65, cameraAspect: 16 / 9 },
  ],
};
