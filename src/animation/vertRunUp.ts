import * as THREE from 'three';
import { createAnimationClip } from './document';
import type { AnimationClip, QuaternionTuple, Vec3Tuple } from './types';
import { VERT_RUN_UP, VERT_MISS_ROLL, throughKeys } from '../vertRunUp';

// Running up a vert on foot ends one of three ways (src/vertRunUp.ts). These
// are the three performances. Gameplay owns where the pelvis is and pins the
// hands and feet to the real coping and wall afterwards, so a clip here is the
// POSE only: joint rotations against a body that stands upright facing the
// wall, scrubbed by gameplay's own progress through the move.
export const VERT_RUN_CLIP_IDS = {
  climb: 'player.vert-climb',
  leap: 'player.vert-leap',
  miss: 'player.vert-miss',
} as const;
export type VertRunClipId = typeof VERT_RUN_CLIP_IDS[keyof typeof VERT_RUN_CLIP_IDS];
export const isVertRunClip = (id: string | null | undefined): id is VertRunClipId =>
  id === VERT_RUN_CLIP_IDS.climb || id === VERT_RUN_CLIP_IDS.leap || id === VERT_RUN_CLIP_IDS.miss;

/** Euler XYZ per joint. Left is the leading side throughout: its foot is the one planted high, its hand the first on the lip. */
type Pose = Record<string, Vec3Tuple>;
interface Beat { p: number; pose: Pose }

/** One leg: hip (negative lifts the thigh forward), knee (positive bends), ankle (positive points the toes), and how far the thigh stands out. */
const leg = (side: 'Left' | 'Right', hip: number, knee: number, ankle = 0, out = 0, toe = 0): Pose => {
  const sign = side === 'Left' ? 1 : -1;
  return { [`hip${side}`]: [hip, 0, sign * out], [`knee${side}`]: [knee, 0, 0], [`ankle${side}`]: [ankle, 0, 0], [`toe${side}`]: [toe, 0, 0] };
};
/** One arm: shoulder swing (negative reaches forward and on up over the head), how far it stands out, elbow bend, wrist. */
const arm = (side: 'Left' | 'Right', swing: number, out: number, elbow: number, wrist = 0, twist = 0): Pose => {
  const sign = side === 'Left' ? 1 : -1;
  return { [`shoulder${side}`]: [swing, sign * twist, sign * out], [`elbow${side}`]: [-Math.abs(elbow), 0, 0], [`wrist${side}`]: [wrist, 0, 0],
    [`clavicle${side}`]: [0, 0, sign * Math.max(0, -swing - 1.6) * 0.16] };
};
/**
 * The trunk: whole-body pitch (positive tips the head toward the wall), then spine, chest, neck
 * and head each adding to it; a roll and a turn of the whole of it; and where he LOOKS, which is
 * the neck and head alone (positive is over his left shoulder) with a tilt of the head to go with it.
 */
const trunk = (pitch: number, spine: number, chest: number, neck: number, head: number, roll = 0, turn = 0, look = 0, tilt = 0): Pose => ({
  root: [pitch, turn, roll], hips: [0, 0, 0], spine: [spine, turn * 0.3, roll * -0.4], chest: [chest, turn * 0.4, roll * -0.3],
  neck: [neck, look * 0.45, tilt * 0.4], head: [head, turn * -0.5 + look * 0.55, tilt * 0.6], tail: [-(spine + chest) * 0.6, 0, 0],
});
const pose = (...parts: Pose[]): Pose => Object.assign({}, ...parts);

function build(id: VertRunClipId, name: string, rigId: string, duration: number, beats: Beat[],
  markers: [string, number][], design: string, samplesPerSecond = 90): AnimationClip {
  const clip = createAnimationClip({ id, name, rigId, duration });
  clip.loop.mode = 'once';
  const joints = [...new Set(beats.flatMap(beat => Object.keys(beat.pose)))];
  const ps = beats.map(beat => beat.p);
  // (sampled finely enough that the fastest thing in it, an arm thrown up in a tenth of a second, is an arc and not a corner)
  const count = Math.max(120, Math.round(duration * samplesPerSecond));
  const samples = Array.from({ length: count + 1 }, (_, i) => i / count);
  for (const joint of joints) {
    // A joint a beat does not mention keeps the value it last had.
    const table: Vec3Tuple[] = []; let held: Vec3Tuple = [0, 0, 0];
    for (const beat of beats) { held = beat.pose[joint] ?? held; table.push(held); }
    const channel = [0, 1, 2].map(axis => table.map(value => value[axis]));
    const trackId = `${clip.id}:${joint}:rotation`;
    // One smooth curve through the beats: velocity stays continuous through every one of them,
    // so a beat is an accent in one motion and never a pose that is stopped at.
    clip.tracks.push({ id: trackId, kind: 'quaternion', target: joint, keys: samples.map((p, i) => ({
      id: `${trackId}:${i}`, time: p * clip.duration, interpolation: 'linear',
      value: new THREE.Quaternion().setFromEuler(new THREE.Euler(throughKeys(ps, channel[0], p), throughKeys(ps, channel[1], p), throughKeys(ps, channel[2], p), 'XYZ'))
        .toArray() as QuaternionTuple,
    })) });
  }
  clip.markers = markers.map(([marker, p]) => ({ id: `${clip.id}:${marker}`, name: marker, time: p * clip.duration }));
  clip.tags = ['player', 'vert', 'run-up', 'on-foot', 'squash-stretch'];
  clip.metadata = { progressSource: 'gameplay-actionProgress', motionDesign: design,
    rootMotion: 'none: gameplay places the pelvis on the wall and pins hands and feet after the pose',
    contactPolicy: 'hands to the coping, feet to the wall, solved after segment lengths' };
  return clip;
}

// ---- the run pose the wall is met in, shared by all three ------------------
const ARRIVE = pose(trunk(.20, .10, .06, -.06, -.10),
  leg('Left', -1.05, 1.25, -.25), leg('Right', .30, .55, .20),
  arm('Left', .55, .16, .95), arm('Right', -.42, .20, 1.30));

// A wall is right in front of him the whole time, and his head is 0.8 m across.
// Nothing below the lip folds forward (that is his head through the wall): under
// it he stands tall. No arm swings through in front of his chest (that is his
// hands through it): arms travel up his sides. Nothing is done by both sides at
// once: one foot, one hand, one shoulder always leads. And where the lip is
// depends on the wall, so two things are left to gameplay and authored neutral
// here: his LOOK at it (the head is level in these poses, and is turned up at a
// lip over him or down at a coping by his knees) and his hands' way to it (the
// arms reach forward, and the hold takes them up or down).

/** A step up the wall, a hand and then the other on the coping, over it between his arms, and away. */
export function buildVertClimbClip(rigId: string): AnimationClip {
  const C = VERT_RUN_UP.climb;
  return build(VERT_RUN_CLIP_IDS.climb, 'Vert Run-Up — Climb Out', rigId, .70, [
    { p: 0, pose: ARRIVE },
    // The leading foot is driven into the wall high and the other leg drives him up off the last of the slope.
    // He comes upright against it, eyes on the lip, and the leading hand is already on its way there.
    { p: .09, pose: pose(trunk(.08, .12, .05, -.12, -.16, .03, .06),
      leg('Left', -1.62, 1.72, -.40), leg('Right', .38, .22, .46, 0, .28),
      arm('Left', -1.50, .44, .90, .25), arm('Right', -.80, .50, 1.20, .10)) },
    // Up the wall off the planted foot, the trailing leg swinging loose behind; the second hand follows the first.
    { p: .18, pose: pose(trunk(.05, .06, .00, -.06, -.08, .02, .05),
      leg('Left', -1.30, 1.46, -.26), leg('Right', .30, .70, .40, 0, .30),
      arm('Left', -1.75, .36, .80, .50), arm('Right', -1.45, .42, 1.00, .40)) },
    // Both palms on the coping. The planted leg is still pushing and the body has not stopped rising.
    { p: C.hands, pose: pose(trunk(.12, .04, -.03, -.07, -.09),
      leg('Left', -1.02, 1.24, -.16), leg('Right', .26, .92, .32, 0, .30),
      arm('Left', -1.62, .34, 1.20, .58), arm('Right', -1.55, .36, 1.28, .56)) },
    // The press: the chest goes over the hands and the elbows come up over them; the leading knee
    // tucks to clear the edge and the trailing leg swings back to balance it.
    { p: .42, pose: pose(trunk(.40, .26, .12, -.18, -.30, -.04, .10),
      leg('Left', -1.92, 2.10, -.30, .12), leg('Right', .48, .62, .36, .04, .20),
      arm('Left', -.96, .58, 1.78, .78), arm('Right', -.88, .54, 1.86, .74)) },
    // Over the edge on straight arms, the leading foot reaching down for the deck, eyes already along it.
    { p: C.over, pose: pose(trunk(.50, .30, .12, -.22, -.36, -.03, .14),
      leg('Left', -1.72, 1.50, .05, .16), leg('Right', .24, 1.10, .30, .06),
      arm('Left', -.16, .30, .14, .95), arm('Right', -.08, .32, .22, .95)) },
    // Off the hands and onto the leading foot: the trailing knee drives through, the leading arm comes forward with it.
    { p: .73, pose: pose(trunk(.46, .22, .10, -.22, -.34, .03, .04),
      leg('Left', -.92, 1.18, -.26), leg('Right', -1.12, 1.70, -.12),
      arm('Left', -.42, .22, 1.00, .10), arm('Right', .62, .26, .70, .10)) },
    // The first stride on the deck: the leading leg thrown out behind, still low and leaning.
    { p: .87, pose: pose(trunk(.32, .14, .06, -.12, -.18, -.02),
      leg('Left', .44, .34, .46, 0, .26), leg('Right', -.98, .74, -.20),
      arm('Left', -.86, .16, 1.05), arm('Right', .64, .18, .90)) },
    // ...and it is a run.
    { p: 1, pose: pose(trunk(.20, .10, .05, -.06, -.10),
      leg('Left', .30, 1.08, .12), leg('Right', -.62, .38, -.16),
      arm('Left', -.60, .15, 1.05), arm('Right', .50, .16, .95)) },
  ], [['plant', .09], ['hands', C.hands], ['press', .42], ['over', C.over], ['stride', .87]],
  'wall step / one hand then the other to the coping / press with the chest over the hands / through between the arms / low stride away');
}

/** The spring off the wall, to the lip: it ends hanging from it. */
const LEAP: Beat[] = [
  { p: 0, pose: ARRIVE },
  // Gather: the leading foot plants high, the arms swing down and back, the eyes go up to the lip.
  { p: .10, pose: pose(trunk(.04, .16, .06, -.12, -.16),
    leg('Left', -1.46, 1.52, -.36), leg('Right', -.62, .94, -.10),
    arm('Left', .58, .26, .52, -.10), arm('Right', .20, .22, .80, -.10)) },
  // Load: sat back off the wall over both feet, chest up, arms cocked behind him, one further than the other.
  { p: VERT_RUN_UP.leap.load, pose: pose(trunk(-.12, .26, .12, -.12, -.16, .03),
    leg('Left', -1.66, 2.12, -.50), leg('Right', -1.40, 1.98, -.44),
    arm('Left', .98, .36, .34, -.22), arm('Right', .80, .34, .52, -.20)) },
  // Drive: the legs open and the arms come up his sides, elbows leading, the leading one ahead.
  { p: .36, pose: pose(trunk(-.05, .06, .00, -.02, -.04, .02),
    leg('Left', -.82, 1.04, -.10), leg('Right', -.44, .74, .12),
    arm('Left', -.95, .78, 1.32, 0), arm('Right', -.42, .80, 1.36, 0)) },
  // Off the wall at full stretch, back arched, toes last: the trailing leg has peeled away, the leading one is still on it.
  { p: .47, pose: pose(trunk(-.03, -.12, -.10, .06, .10, -.04, .06),
    leg('Left', .06, .05, .62, 0, .40), leg('Right', .28, .32, .66, 0, .40),
    arm('Left', -2.96, .26, .14, .10), arm('Right', -2.30, .40, .58, .10)) },
  // Rising: the leading hand is as high as it goes and the other is still coming; the legs trail loose, one knee bent.
  { p: .66, pose: pose(trunk(-.04, -.08, -.06, -.06, -.12, -.05, .08),
    leg('Left', .12, .24, .52, 0, .20), leg('Right', -.22, .66, .42),
    arm('Left', -3.08, .16, .05, .30), arm('Right', -2.84, .24, .26, .25)) },
  // The top of the jump, and his fingers are over the edge. The legs are still coming up under him.
  { p: VERT_RUN_UP.leap.catch, pose: pose(trunk(-.06, -.06, -.04, -.26, -.46, -.02, .04),
    leg('Left', -.12, .32, .36), leg('Right', -.32, .60, .30),
    arm('Left', -3.08, .14, .06, .50), arm('Right', -3.00, .16, .16, .50)) },
  // His weight comes onto his arms: he sags the length of them, and his feet are carried on in to the wall.
  { p: .94, pose: pose(trunk(-.08, -.02, .00, -.24, -.42),
    leg('Left', -.34, .52, .24), leg('Right', -.18, .34, .28),
    arm('Left', -3.10, .12, .04, .55), arm('Right', -3.06, .13, .06, .55)) },
  // The dead hang. (From here it is the game's own catch, and the pull up onto bent arms.)
  { p: 1, pose: pose(trunk(-.08, .00, .00, -.22, -.40),
    leg('Left', -.12, .22, .30), leg('Right', -.06, .14, .30),
    arm('Left', -3.10, .12, .04, .55), arm('Right', -3.08, .12, .04, .55)) },
];
export function buildVertLeapClip(rigId: string): AnimationClip {
  return build(VERT_RUN_CLIP_IDS.leap, 'Vert Run-Up — Leap to the Lip', rigId, .52, LEAP,
    [['gather', .10], ['load', VERT_RUN_UP.leap.load], ['drive', .36], ['off', .47], ['catch', VERT_RUN_UP.leap.catch], ['hang', 1]],
    'gather / sit back over the feet / drive, arms up the sides / full stretch off the toes / one hand leads / the lip at the top of the jump / the sag onto his arms');
}

/** The same spring, the lip out of reach, the slide down the face, and the roll over backwards that puts him on his feet again. */
export function buildVertMissClip(rigId: string): AnimationClip {
  const M = VERT_RUN_UP.miss;
  // The leap is the same leap, played over the first fifth (gameplay scrubs it there at the same pace).
  const leap: Beat[] = LEAP.filter(beat => beat.p <= .66).map(beat => ({ p: beat.p * M.leap / VERT_RUN_UP.leap.catch, pose: beat.pose }));
  // The roll is the plan's own: its moments are where the poses are keyed, and its turn is the body's.
  const roll = (key: number): number => M.slide + (M.tumble - M.slide) * VERT_MISS_ROLL[key].at;
  const back = (key: number): number => -VERT_MISS_ROLL[key].back;
  const TURN = Math.PI * 2;
  return build(VERT_RUN_CLIP_IDS.miss, 'Vert Run-Up — Miss and Roll', rigId, 2.3, [
    ...leap,
    // The top: everything he has, and the lip is still above his fingers.
    { p: M.leap, pose: pose(trunk(-.06, -.12, -.10, -.28, -.50, -.04),
      leg('Left', -.10, .30, .50, 0, .30), leg('Right', .18, .36, .55, 0, .30),
      arm('Left', -3.10, .10, .04, .35), arm('Right', -2.98, .12, .08, .30)) },
    // The moment it is not there: one hand slaps higher for it, the other is already slipping. Still looking at it.
    { p: .222, pose: pose(trunk(-.08, -.04, -.04, -.26, -.44, .04),
      leg('Left', -.40, .78, .30), leg('Right', .02, .40, .50),
      arm('Left', -2.84, .22, .36, .70), arm('Right', -3.08, .12, .05, .50)) },
    // Sliding: palms dragging at the length of his arms, toes scraping, and a look down over his shoulder at where he is going.
    { p: .262, pose: pose(trunk(-.18, .06, .02, -.10, .06, 0, 0, 1.0, .18),
      leg('Left', -.56, 1.02, .38), leg('Right', -.74, 1.26, .34),
      arm('Left', -2.80, .30, .40, .85), arm('Right', -2.66, .34, .54, .85)) },
    // The transition takes his feet and his knees go: he is sat back off the wall with nothing behind him.
    { p: roll(0), pose: pose(trunk(back(0), .20, .08, .00, .12, 0, 0, .55, .08),
      leg('Left', -1.30, 1.78, -.20), leg('Right', -1.08, 1.56, -.15),
      arm('Left', -2.20, .44, .66, .40), arm('Right', -1.96, .50, .78, .40)) },
    // Going over backwards, arms thrown out at the wall he has just left.
    { p: roll(1), pose: pose(trunk(back(1), .42, .20, .14, .30),
      leg('Left', -1.96, 2.30, -.30), leg('Right', -1.74, 2.10, -.20),
      arm('Left', -1.52, .50, .34, 0), arm('Right', -1.20, .62, .50, 0)) },
    // The seat hits: chin tucked, everything folded round it.
    { p: roll(2), pose: pose(trunk(back(2), .60, .28, .32, .56),
      leg('Left', -2.10, 1.70, -.10, .10), leg('Right', -1.90, 1.46, -.05, .12),
      arm('Left', -1.30, .74, .70, .10), arm('Right', -1.10, .82, .80, .10)) },
    // Up his back onto his shoulders, knees at his chest, hands going back past his ears for the ground.
    { p: roll(3), pose: pose(trunk(back(3), .72, .32, .38, .64, .10, 0, 0, .50),
      leg('Left', -2.42, 2.10, -.10, .14), leg('Right', -2.24, 1.84, .00, .16),
      arm('Left', -2.70, .46, 1.36, .60), arm('Right', -2.50, .52, 1.46, .60)) },
    // Over the top: the back of his head and both hands on the ground, the tightest he gets.
    { p: roll(4), pose: pose(trunk(back(4), .66, .28, .34, .58, .22, 0, 0, 1.25),
      leg('Left', -2.50, 2.10, -.10, .12), leg('Right', -2.36, 1.90, -.05, .14),
      arm('Left', -3.02, .44, 1.10, .90), arm('Right', -2.94, .48, 1.18, .90)) },
    // He pushes up off his hands into a pike: hips at their highest, legs unfolding down past them for the ground.
    { p: roll(5), pose: pose(trunk(back(5), .64, .28, .32, .56, .26, 0, 0, 1.35),
      leg('Left', -2.58, .70, -.20, .10), leg('Right', -2.40, 1.00, -.10, .12),
      arm('Left', -2.90, .40, .30, .70), arm('Right', -2.80, .44, .40, .70)) },
    // Feet down under him, one a little before the other; his hands leave the ground and his head comes up off it.
    { p: roll(6), pose: pose(trunk(back(6), .52, .22, .26, .46, .10, 0, 0, .70),
      leg('Left', -1.72, .26, -.10), leg('Right', -1.56, .40, -.05),
      arm('Left', -2.30, .40, .40, .40), arm('Right', -2.10, .46, .52, .40)) },
    // The trunk swings up over his feet, arms coming through for balance, eyes up.
    { p: roll(7), pose: pose(trunk(back(7), .30, .12, .04, .08),
      leg('Left', -.84, .36, -.08), leg('Right', -.70, .46, -.06),
      arm('Left', -1.10, .40, .60, .20), arm('Right', -.84, .46, .52, .20)) },
    // On his feet, knees soft, nearly upright.
    { p: roll(8), pose: pose(trunk(back(8), .14, .06, -.08, -.12),
      leg('Left', -.40, .44, -.10), leg('Right', -.30, .38, -.08),
      arm('Left', -.30, .30, .60, .10), arm('Right', -.12, .34, .54, .10)) },
    // Up out of it, the arms swinging down past his hips.
    { p: .93, pose: pose(trunk(-TURN + .10, .08, .04, -.04, -.06),
      leg('Left', -.22, .28, -.06), leg('Right', -.14, .22, -.06),
      arm('Left', .16, .22, .44, .10), arm('Right', .26, .24, .38, .10)) },
    { p: 1, pose: pose(trunk(-TURN + .04, .04, .02, -.02, -.04),
      leg('Left', -.08, .14, -.04), leg('Right', -.02, .10, -.04),
      arm('Left', .04, .14, .30), arm('Right', .06, .14, .30)) },
  ], [['off', .47 * M.leap / VERT_RUN_UP.leap.catch], ['short', M.leap], ['slide', .262], ['caught', roll(0)], ['seat', roll(2)], ['over', roll(4)], ['pike', roll(5)], ['feet', roll(6)], ['up', 1]],
  'the same leap / fingertips short / palms drag down the face, a look down / thrown back onto his seat / over his shoulders, knees at his chest / piked over his hands / feet under him / up',
  // (its whole leap is the first fifth of it, and a whole turn of the body the middle: sampled finer than the others)
  120);
}

export const buildVertRunClips = (rigId: string): AnimationClip[] =>
  [buildVertClimbClip(rigId), buildVertLeapClip(rigId), buildVertMissClip(rigId)];
