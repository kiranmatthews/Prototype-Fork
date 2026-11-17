import type { CustomComponent, CustomLevelData } from '../level';
import { addExitNitroSwitch, deck, type CrystalTrial } from './crystal-trials/types';
import { TRIAL_01 } from './crystal-trials/01';
import { TRIAL_02 } from './crystal-trials/02';
import { TRIAL_03 } from './crystal-trials/03';
import { TRIAL_04 } from './crystal-trials/04';
import { TRIAL_05 } from './crystal-trials/05';
import { TRIAL_06 } from './crystal-trials/06';
import { TRIAL_07 } from './crystal-trials/07';
import { TRIAL_08 } from './crystal-trials/08';
import { TRIAL_09 } from './crystal-trials/09';
import { TRIAL_10 } from './crystal-trials/10';
import { TRIAL_11 } from './crystal-trials/11';
import { TRIAL_12 } from './crystal-trials/12';
import { TRIAL_13 } from './crystal-trials/13';
import { TRIAL_14 } from './crystal-trials/14';
import { TRIAL_15 } from './crystal-trials/15';
import { TRIAL_16 } from './crystal-trials/16';
import { TRIAL_17 } from './crystal-trials/17';
import { TRIAL_18 } from './crystal-trials/18';
import { TRIAL_19 } from './crystal-trials/19';
import { TRIAL_20 } from './crystal-trials/20';
import { TRIAL_21 } from './crystal-trials/21';
import { TRIAL_22 } from './crystal-trials/22';
import { TRIAL_23 } from './crystal-trials/23';
import { TRIAL_24 } from './crystal-trials/24';
import { TRIAL_25 } from './crystal-trials/25';
import { REJECTED_CRYSTAL_TRIALS } from './crystal-trials/rejects';
export { REJECTED_GRID } from './crystal-trials/rejected-grid';
export { trialLevel } from './crystal-trials/types';

export const CRYSTAL_TRIALS: CrystalTrial[] = [TRIAL_01, TRIAL_02, TRIAL_03, TRIAL_04, TRIAL_05, TRIAL_06, TRIAL_07, TRIAL_08, TRIAL_09, TRIAL_10, TRIAL_11, TRIAL_12, TRIAL_13, TRIAL_14, TRIAL_15, TRIAL_16, TRIAL_17, TRIAL_18, TRIAL_19, TRIAL_20, TRIAL_21, TRIAL_22, TRIAL_23, TRIAL_24, TRIAL_25];
const stationSpan = (trial: CrystalTrial) => trial.skateLine
  ? Math.max(512, 224 - (trial.exit?.[2] ?? -288)) : 256;
const originsFor = (trials: CrystalTrial[]) => {
  let z = 0;
  return trials.map(trial => { const origin: [number, number, number] = [0, 0, z]; z -= stationSpan(trial); return origin; });
};
const origins = originsFor(CRYSTAL_TRIALS);
export const trialOrigin = (index: number): [number, number, number] => [...origins[index]];

function placed(trial: CrystalTrial, index: number, offset: [number, number, number]): CustomComponent[] {
  return structuredClone(trial.components)
    // The shared flat floor replaces coplanar local recovery slabs. The source
    // trial keeps them, so it remains independently playable when separated.
    .filter(c => !(c.t === 'platform' && c.s && Math.abs(c.p[1] + c.s[1] / 2 + 8) < .001))
    .map(c => {
    c.p = c.p.map((v, axis) => v + offset[axis]) as [number, number, number];
    if (c.to) c.to = c.to.map((v, axis) => v + offset[axis]) as [number, number, number];
    if (c.cameraPosition) c.cameraPosition = c.cameraPosition.map((v, axis) => v + offset[axis]) as [number, number, number];
    if (c.cameraTarget) c.cameraTarget = c.cameraTarget.map((v, axis) => v + offset[axis]) as [number, number, number];
    // Every station owns its switch/outline wiring in the assembled course.
    c.grp = index * 100 + (c.grp ?? 1);
    return c;
  });
}

function assemble(name: string, trials: CrystalTrial[], archive = false): CustomLevelData {
  const placements = originsFor(trials);
  const last = Math.max(0, trials.length - 1);
  const finishZ = placements[last][2] + (trials[last].exit?.[2] ?? -168) - 24;
  const back = finishZ - 32, front = archive ? 96 : 160;
  const components: CustomComponent[] = [
    deck('Continuous flat recovery floor', 0, -8, (front + back) / 2, 104, front - back, '#929e94'),
    { t: 'gate', nm: 'Exit after the final challenge', p: [0, -8, finishZ] },
  ];
  for (let i = 0; i < trials.length; i++) {
    const z = placements[i][2];
    if (trials[i].skateLine) {
      components.push(
        { t: 'ramp', nm: `${trials[i].id} / Wide rolling approach`, p: [0, -8, z + 102], len: 48, rise: 8, w: 24 },
        deck(`${trials[i].id} / Approach joins the run-up`, 0, 0, z + 74, 24, 8),
      );
      continue;
    }
    if (trials[i].spawn[1] < 0) continue; // Preserved entrance experiments own their ramp.
    const bankFront = Math.max(...trials[i].components.filter(c => c.t === 'platform' && c.s
      && Math.abs(c.p[1] + c.s[1] / 2) < .001 && Math.abs(c.p[0]) < c.s[0] / 2)
      .map(c => c.p[2] + c.s![2] / 2));
    components.push(
      { t: 'ramp', nm: `${trials[i].id} / Approach from the flat floor`, p: [0, -8, z + 44], len: 40, rise: 8, w: 8 },
      deck(`${trials[i].id} / Approach landing`, 0, 0, z + (24 + bankFront) / 2, 18, 24 - bankFront),
      { t: 'camnode', nm: `${trials[i].id} / Corridor approach`, p: [0, -3, z + 42], s: [42, 24, 64], radius: 4,
        cameraView: true, cameraPresentationOnly: true, cameraPosition: [0, 4, z + 68], cameraTarget: [0, -2, z + 35],
        cameraFollowDistance: 18, cameraKeepDistance: true, cameraFollowTargetHeight: 3.5, cameraFov: 62 },
    );
  }
  components.push(...trials.flatMap((trial, index) => placed(trial, index, placements[index])));
  if (!archive) addExitNitroSwitch(components, [0, -8, finishZ]);
  return { v: 1, name, spawn: [0, -7.85, archive ? 80 : 144], killY: -24, skatepark: true,
    alwaysSkate: !archive, crystalTrials: archive ? 'archive' : 'challenge',
    startWarpPad: false, hugeDropBail: false, sky: 'sunset',
    groups: trials.flatMap((trial, i) => [...new Set(trial.components.map(c => c.grp ?? 1))]
      .map(group => ({ id: i * 100 + group, nm: trial.name }))),
    components };
}

export const CRYSTAL_TRIALS_LEVEL = assemble('Numbered crystal challenges', CRYSTAL_TRIALS);
export const CRYSTAL_REJECTS_LEVEL = assemble('Rejected challenge layouts', REJECTED_CRYSTAL_TRIALS, true);
