import type { AuthoredLine } from './street-line';
import type { CustomComponent, CustomLevelData } from '../../level';

export interface CrystalTrial {
  id: number;
  name: string;
  brief: string;
  spawn: [number, number, number];
  line?: AuthoredLine;
  /** Includes historical skating layouts, for corridor assembly. */
  skateLine?: boolean;
  exit?: [number, number, number];
  skateSections?: {
    kind: number;
    origin: [number, number, number];
    entry?: 'air' | 'spring';
    outgoingRail?: boolean;
    endZ: number;
  }[];
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

/** Otherwise the engine puts the Nitro detonator directly in the rider's path. */
export function addExitNitroSwitch(components: CustomComponent[], [x, y, z]: [number, number, number]) {
  if (components.some(c => c.t === 'crate' && c.kind === 'nitro') &&
      !components.some(c => c.t === 'crate' && c.kind === 'nitrobang')) {
    components.push({t: 'crate', kind: 'nitrobang', nm: 'Nitro switch beside the exit', p: [x + 5, y, z + 7]});
  }
}

/** Local coordinates remain source-owned so a trial can become a level later. */
export function trialLevel(trial: CrystalTrial): CustomLevelData {
  const exit: [number, number, number] = trial.exit ?? [0, 0, 16];
  const components = structuredClone(trial.components);
  if (trial.skateSections || trial.line) addExitNitroSwitch(components, exit);
  return {
    v: 1, name: trial.name, spawn: [...trial.spawn], killY: -24,
    skatepark: false, alwaysSkate: false, crystalTrials: 'challenge',
    startWarpPad: false, hugeDropBail: false,
    groups: [...new Set(trial.components.flatMap(c => c.grp === undefined ? [] : [c.grp]))]
      .map(id => ({ id, nm: `${trial.name} / ${id}` })),
    components: [
      ...components,
      ...(trial.skateLine ? [] : [deck('Return landing', 0, 0, 14, 12, 12)]),
      { t: 'gate', nm: 'Trial exit', p: [...exit] },
    ],
  };
}
