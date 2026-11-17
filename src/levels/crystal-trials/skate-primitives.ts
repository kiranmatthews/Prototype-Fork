import type { CustomComponent } from '../../level';
import { deck, type CrystalTrial } from './types';

/** Source geometry only: all dimensions use the unchanged production skater. */
export const runway = (name: string, front: number, back: number, y = 0, width = 24, x = 0) =>
  deck(name, x, y, (front + back) / 2, width, front - back, '#789496');

export const bank = (name: string, lip: number, rise = 2, length = 16, width = 18, x = 0): CustomComponent =>
  ({ t: 'ramp', nm: name, p: [x, 0, lip + length / 2], len: length, rise, w: width });

export const rail = (name: string, front: number, back: number, x = 0, y = 1.2): CustomComponent =>
  ({ t: 'rail', nm: name, p: [x, y, (front + back) / 2], len: front - back });

export const tape = (name: string, z: number, y: number, x = 0): CustomComponent =>
  ({ t: 'crystal', nm: name, p: [x, y, z] });

export const pit = (name: string, front: number, back: number, width = 26): CustomComponent =>
  ({ t: 'pit', nm: name, p: [0, -6, (front + back) / 2], s: [width, 1, front - back], color: '#192e42' });

export function skateTrial(id: number, description: string, brief: string,
  components: CustomComponent[], endZ = -120): CrystalTrial {
  const name = `${id} / ${description}`;
  return {
    id, name, brief, skateLine: true, spawn: [0, .15, 55], exit: [0, -8, endZ - 76],
    reviewViews: [{ name: 'commitment', position: [0, .15, -5] }],
    components: [
      runway(`${id} / Flat recovery floor`, 90, endZ - 100, -8, 104),
      runway(`${id} / Clear skating approach`, 44, -20, 0, 32),
      runway(`${id} / Return junction`, 70, 44, 0, 88),
      { t: 'checkpoint', nm: `${id} / Checkpoint before the line`, p: [0, 0, 35] },
      { t: 'ramp', nm: `${id} / Recovery bank`, p: [34, -8, 20], len: 48, rise: 8, w: 16, yaw: 180 },
      { t: 'camnode', nm: `${id} / Skating line view`, p: [0, 12, (70 + endZ) / 2],
        s: [52, 100, 90 - endZ], radius: 6, cameraView: true, cameraPresentationOnly: true,
        cameraPosition: [0, 12, 25], cameraTarget: [0, 3, -5], cameraFollowDistance: 20,
        cameraKeepDistance: true, cameraFollowTargetHeight: 4, cameraFov: 64, cameraAspect: 16 / 9 },
      { t: 'camnode', nm: `${id} / Recovery lane view`, p: [34, 2, (70 + endZ) / 2],
        s: [16, 30, 90 - endZ], radius: 3, yaw: 180, cameraView: true,
        cameraPosition: [34, 4, endZ - 20], cameraTarget: [34, -3, endZ + 8],
        cameraFollowDistance: 20, cameraKeepDistance: true, cameraFollowTargetHeight: 3, cameraFov: 64 },
      ...components,
      { t: 'ramp', nm: `${id} / Rolling exit to the flat floor`, p: [0, -8, endZ - 24], len: 48, rise: 8, w: 24, yaw: 180 },
    ],
  };
}
