import type { CustomComponent, CustomLevelData } from '../../level';

export interface CrystalTrial {
  id: number;
  name: string;
  brief: string;
  spawn: [number, number, number];
  reviewViews?: { name: string; position: [number, number, number] }[];
  components: CustomComponent[];
}

export interface RejectedCrystalTrial extends CrystalTrial {
  attempt: string;
  reason: string;
}

export const deck = (name: string, x: number, y: number, z: number,
  w: number, d: number, color = '#789496'): CustomComponent =>
  ({ t: 'platform', nm: name, p: [x, y - .5, z], s: [w, 1, d], color });

/** Local coordinates remain source-owned so a trial can become a level later. */
export function trialLevel(trial: CrystalTrial): CustomLevelData {
  return {
    v: 1, name: trial.name, spawn: [...trial.spawn], killY: -24,
    skatepark: true, alwaysSkate: false, crystalTrials: 'challenge',
    startWarpPad: false, hugeDropBail: false,
    groups: [...new Set(trial.components.flatMap(c => c.grp === undefined ? [] : [c.grp]))]
      .map(id => ({ id, nm: `${trial.name} / ${id}` })),
    components: [
      ...structuredClone(trial.components),
      deck('Return landing', 0, 0, 14, 12, 12),
      { t: 'gate', nm: 'Trial exit', p: [0, 0, 16] },
    ],
  };
}
