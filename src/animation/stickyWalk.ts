import { createAnimationClip } from './document';
import { ease, solveLeg, solvedTracks, wave, type Foot, type Pelvis } from './solvedLegs';
import type { AnimationClip, AnimationTrack } from './types';

export const STICKY_WALK_CLIP_ID = 'player.sticky-walk';
export const STICKY_WALK_DURATION = 0.92;
/** How far a planted sole is carried under him in one cycle of the clip, in metres of the world: the clip is
 * played at the pace that makes that his real speed, so a stuck shoe stays where it stuck. */
export const STICKY_WALK_METRES = 0.71;
/** The share of a foot's cycle it spends planted. */
const PLANTED = 0.60;

/**
 * WALKING ON A FLOOR THAT WILL NOT LET GO. Each shoe is planted for most of
 * its cycle and does not slide: the body is dragged on over it. Then its heel
 * comes up while its toe is still stuck, the leg stretches after it, and it
 * lets go all at once and is thrown forward high, to be set down hard. The
 * pelvis is pulled back and round toward the stuck foot and released with it;
 * the chest heaves forward into each pull; the arms work.
 *
 * The legs are solved from each sole's path (see solvedLegs.ts), and the
 * stretch of the stuck leg is keyed here, not left to the shared oscillator:
 * it is what the goo does to him.
 */
export function buildStickyWalkClip(rigId: string, includeTorsoRoot = true): AnimationClip {
  const clip = createAnimationClip({ id: STICKY_WALK_CLIP_ID, name: 'Sticky Walk — Peel and Lurch', rigId, duration: STICKY_WALK_DURATION });
  clip.proceduralOrder = 'keyed-then-procedural';
  const t = solvedTracks(clip, 24);
  const own = (phase: number, side: number): number => ((phase + (side > 0 ? 0 : 0.5)) % 1 + 1) % 1;
  // (phase 0: the left shoe is set down ahead of him)
  const foot = (phase: number, side: number): Foot => {
    const p = own(phase, side);
    if (p < PLANTED) { // planted, and carried back under him at one even pace; the heel begins to come up before it lets go
      return { side: 0.022, fore: 0.27 - 0.60 * (p / PLANTED), lift: 0, toeOut: 0.10, heel: 0.82 * ease((p - 0.42) / (PLANTED - 0.42)) };
    }
    if (p < 0.68) { const k = ease((p - PLANTED) / (0.68 - PLANTED)); return { side: 0.022, fore: -0.33 + 0.03 * k, lift: 0.045 * k, toeOut: 0.10, heel: 0.82 + 0.10 * k }; } // off, and held by what is stretched under it
    if (p < 0.93) { const k = ease((p - 0.68) / 0.25), arc = Math.sin(k * Math.PI); return { side: 0.022 + 0.02 * arc, fore: -0.30 + 0.61 * k, lift: 0.045 * (1 - k) + 0.165 * arc, toeOut: 0.10, heel: 0.92 - 1.17 * k }; } // thrown forward, high
    const k = ease((p - 0.93) / 0.07); return { side: 0.022, fore: 0.31 - 0.04 * k, lift: 0, toeOut: 0.10, heel: -0.25 * (1 - k) }; // heel first, then flat
  };
  /** The stuck leg stretches as its heel comes up, snaps short as it lets go, and comes back to its length. */
  const shin = (phase: number, side: number): number => {
    const p = own(phase, side);
    if (p >= 0.44 && p < 0.66) return 1 + 0.085 * ease((p - 0.44) / 0.22);
    if (p >= 0.66 && p < 0.74) return 1.085 - 0.135 * ease((p - 0.66) / 0.08);
    if (p >= 0.74 && p < 0.90) return 0.95 + 0.05 * ease((p - 0.74) / 0.16);
    if (p < 0.08) return 1 - 0.03 * Math.sin(p / 0.08 * Math.PI); // set down hard
    return 1;
  };
  // How hard each foot is pulling just now: up as its heel rises, gone the moment it lets go.
  const pull = (phase: number, side: number): number => { const p = own(phase, side); return p < 0.40 ? 0 : p < 0.66 ? ease((p - 0.40) / 0.26) : p < 0.72 ? 1 - ease((p - 0.66) / 0.06) : 0; };
  const tug = (phase: number): number => pull(phase, 1) - pull(phase, -1); // + : the left is stuck
  const strain = (phase: number): number => Math.max(pull(phase, 1), pull(phase, -1));
  const pelvis = (phase: number): Pelvis => ({
    x: 0.026 * wave(phase + 0.13), // over whichever foot is planted alone
    drop: 0.066 + 0.020 * (0.5 + 0.5 * Math.cos(phase * Math.PI * 4)) + 0.016 * strain(phase), // down as a shoe is set down, and down into each pull
    pitch: 0.09 + 0.05 * strain(phase), yaw: 0.17 * tug(phase), roll: 0.040 * tug(phase),
  });
  t.offset('root', () => [0, 0, 0]);
  t.offset('hips', phase => { const p = pelvis(phase); return [p.x, -p.drop, -0.012 * strain(phase)]; });
  t.euler('hips', phase => { const p = pelvis(phase); return [p.pitch, p.yaw, p.roll]; });
  // The chest heaves forward into the pull and is thrown upright past level as the shoe comes free.
  const heave = (phase: number): number => strain(phase) - 0.45 * strain(phase - 0.09);
  if (includeTorsoRoot) t.euler('torsoRoot', phase => [.10 + .08 * heave(phase), 0, tug(phase) * -.035]);
  t.euler('spine', phase => [(includeTorsoRoot ? .09 : .19) + .07 * heave(phase), pelvis(phase).yaw * -.6, tug(phase) * (includeTorsoRoot ? -.04 : -.07)]);
  t.euler('chest', phase => [.06 + .05 * heave(phase), pelvis(phase).yaw * -.7, tug(phase) * -.04]);
  t.euler('neck', phase => [-.10 - .05 * heave(phase), pelvis(phase).yaw * .3, tug(phase) * .03]);
  t.euler('head', phase => [-.12 - .06 * heave(phase - 0.03), pelvis(phase).yaw * .3, tug(phase) * .04]);
  for (const [side, sign] of [['Left', 1], ['Right', -1]] as const) {
    const phases = t.times.map((_, i) => (i / (t.times.length - 1)) % 1);
    const solved = phases.map(phase => solveLeg(sign, pelvis(phase), foot(phase, sign), shin(phase, sign)));
    t.turns(`hip${side}`, solved.map(leg => leg.hip));
    t.turns(`knee${side}`, solved.map(leg => leg.knee));
    t.turns(`ankle${side}`, solved.map(leg => leg.ankle));
    t.euler(`toe${side}`, () => [0, 0, 0]); // (the shoe is one piece, and hangs from this joint: turning it turns the whole shoe)
    const lower = `deform.leg.lower.${side.toLowerCase()}.length`, upper = `deform.leg.upper.${side.toLowerCase()}.length`;
    for (const [target, share] of [[lower, 1], [upper, 0.45]] as const) {
      const id = `${clip.id}:${target}`;
      clip.tracks.push({ id, kind: 'scalar', target, keys: phases.map((phase, i) => ({ id: `${id}:${i}`, time: t.times[i],
        value: target === lower ? shin(phase, sign) : 1 + (shin(phase, sign) - 1) * share, interpolation: 'cubic' })) } as AnimationTrack);
    }
    // The arm on the side of the stuck foot is driven back and down with the pull, and thrown forward as it comes free.
    const work = (phase: number, lag = 0): number => pull(phase - lag, sign) - pull(phase - lag, -sign);
    t.euler(`clavicle${side}`, phase => [0, 0, sign * .06 + work(phase) * .05 * sign]);
    t.euler(`shoulder${side}`, phase => [.05 + .50 * work(phase, .02), sign * .12, sign * (.34 + .16 * strain(phase))]);
    t.euler(`elbow${side}`, phase => [-1.05 - .30 * work(phase, .06), 0, sign * .12]);
    t.euler(`wrist${side}`, phase => [.12 + .22 * work(phase, .11), sign * .12, sign * .05]);
  }
  // (a contact cannot wrap the clip's end: the right shoe's, which is planted across it, is listed in two parts)
  const planted = (side: 'Left' | 'Right', part: string, start: number, end: number) => ({
    id: `${clip.id}:shoe-${side}${part}`, start: start * clip.duration, end: end * clip.duration,
    effector: `foot${side}`, mode: 'custom' as const, weight: 1,
    metadata: { surface: 'goo', planarContact: 'stuck', verticalContact: 'ground', locking: 'pace-matched: the clip is played at the speed that holds a planted shoe still' },
  });
  clip.contacts = [planted('Left', '', 0, PLANTED), planted('Right', '-a', 0.5, 1), planted('Right', '-b', 0, PLANTED - 0.5)];
  clip.markers = [{ id: `${clip.id}:left-free`, time: 0.66 * clip.duration, name: 'Left shoe comes free' },
    { id: `${clip.id}:right-free`, time: 0.16 * clip.duration, name: 'Right shoe comes free' }];
  clip.tags = ['player', 'starter-authored', 'sticky', 'locomotion', 'effort', 'in-place'];
  clip.metadata = { starterQuality: 'authored-foundation', starterCatalogVersion: 40,
    performance: 'A planted shoe that will not slide; the heel peels, the leg stretches after it, it snaps free and is thrown forward; pelvis and chest are pulled and released with it',
    legSolve: 'Each sole follows a path on the floor; hip, knee and ankle keys are solved from it at build time, for the leg as stretched at that key',
    metresPerCycle: STICKY_WALK_METRES,
    footContactPolicy: 'A planted shoe is carried back under him at one even pace, so that played at the matching speed it stays where it stuck',
    elasticityPolicy: 'Leg lengths are keyed (stretch on the peel, snap short on release, rebound); torso and arms take the shared profile' };
  return clip;
}
