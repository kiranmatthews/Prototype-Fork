import { TRIAL_23 } from './23';
import { deck, type CrystalTrial } from './types';

export const TRIAL_25: CrystalTrial = {
  id: 25, name: '25 / Switches, rope, timed steps and Nitro spring',
  brief: 'TNT and two switches → rope → six timed steps → Nitro-framed spring.',
  spawn: [0, .15, 5],
  reviewViews: [{ name: 'timed-route', position: [5, 30.15, -74] }, { name: 'resting-island', position: [5, 36.35, -107] }, { name: 'nitro-spring', position: [5, 42.55, -136] }],
  components: [
    ...structuredClone(TRIAL_23.components).filter(c => c.t !== 'crystal' && !['23 / Flat recovery courtyard', '23 / High receiver'].includes(c.nm ?? '')).map(c => ({ ...c, nm: c.nm?.replace('23 /', '25 /') })),
    deck('25 / Flat recovery courtyard', 0, 0, -68, 40, 180, '#849d87'),
    deck('25 / Upper timed route bank', 5, 30, -72, 8, 8, '#a8b9a0'),
    ...[0, 1, 2].map(i => ({ t: 'phasepad' as const, nm: `25 / Lower timed step ${i + 1}`,
      p: [5, 31.5 + i * 1.5, -81 - i * 7] as [number, number, number], s: [4, .6, 4] as [number, number, number],
      cycle: 8, amp: .55, phase: [0, .76, .52][i] })),
    deck('25 / Permanent resting island', 5, 36.2, -104, 8, 12, '#a8b9a0'),
    ...[0, 1, 2].map(i => ({ t: 'phasepad' as const, nm: `25 / Upper timed step ${i + 1}`,
      p: [5, 37.7 + i * 1.5, -115 - i * 7] as [number, number, number], s: [4, .6, 4] as [number, number, number],
      cycle: 9, amp: .55, phase: [0, .78, .56][i] })),
    deck('25 / Nitro spring terrace', 5, 42.4, -138, 8, 8, '#a8b9a0'),
    { t: 'crate', nm: '25 / Final bounce crate', kind: 'metalbounce', p: [5, 42.4, -139] },
    ...[3, 7].map(x => ({ t: 'crate' as const, nm: '25 / Nitro beside final spring', kind: 'nitro' as const, p: [x, 42.4, -139] as [number, number, number] })),
    deck('25 / Final receiver', 11, 48.6, -143, 5, 6, '#d8b26e'),
    ...[9.2, 12.8].map(x => ({ t: 'crate' as const, nm: '25 / Nitro at receiver rear', kind: 'nitro' as const, p: [x, 48.6, -145] as [number, number, number] })),
    { t: 'crystal', nm: '25 / Switches, rope, timed steps and Nitro spring', p: [11, 48.6, -143] },
    { t: 'camnode', nm: '25 / Lower timed flight view', p: [5, 35, -92], s: [30, 28, 44], radius: 3,
      cameraView: true, cameraPresentationOnly: true, cameraPosition: [9, 43, -67], cameraTarget: [5, 33, -93],
      cameraFollowDistance: 20, cameraKeepDistance: true, cameraFollowTargetHeight: 5, cameraFov: 70 },
    { t: 'camnode', nm: '25 / Upper timed flight and Nitro view', p: [5, 42, -127], s: [34, 30, 50], radius: 3,
      cameraView: true, cameraPresentationOnly: true, cameraPosition: [9, 50, -102], cameraTarget: [5, 40, -128],
      cameraFollowDistance: 20, cameraKeepDistance: true, cameraFollowTargetHeight: 5, cameraFov: 70 },
  ],
};
