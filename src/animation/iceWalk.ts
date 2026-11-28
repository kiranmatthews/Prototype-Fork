import * as THREE from 'three';
import { createAnimationClip, createProceduralDriver } from './document';
import { ease, solveLeg, solvedTracks, wave, type Foot, type Pelvis } from './solvedLegs';
import type { AnimationClip, AnimationTrack, QuaternionTuple, Vec3Tuple } from './types';

export const ICE_WALK_CLIP_ID = 'player.ice-walk';
export const ICE_WALK_DURATION = 1.44;
export const ICE_EFFORT_INPUT = 'iceEffort';
export const ICE_SIDE_SLIP_INPUT = 'iceSideSlip';
export const ICE_WALK_INPUTS = { effort: ICE_EFFORT_INPUT, sideSlip: ICE_SIDE_SLIP_INPUT } as const;
/** Coasting on ice with the stick let go: braced, both shoes down, arms out. */
export const ICE_GLIDE_CLIP_ID = 'player.ice-glide';
export const ICE_GLIDE_DURATION = 1.8;

// Original in-place performance: a small right recovery, a longer left scuff,
// then an uneasy glide. All sampled poses become ordinary editable Studio keys.
const BEATS = [0, .12, .24, .38, .50, .63, .74, .88, 1] as const;
const LEAN = [-.065, -.115, -.025, .080, .055, .125, .018, -.095, -.065];
const DROP = [-.033, -.032, -.036, -.031, -.031, -.036, -.040, -.033, -.033];
const LEFT_KNEE = [.50, .48, .52, .62, .50, .65, .82, .64, .50];
const RIGHT_KNEE = [.52, .64, .78, .56, .48, .52, .60, .64, .52];
const LEFT_GLIDE = [.10, .12, .03, -.10, -.07, .02, .13, .11, .10];
const RIGHT_GLIDE = [-.10, -.02, .12, .13, .10, -.02, -.11, -.07, -.10];

/** Evaluate only at authoring time, so elbow/wrist delay remains editable keys. */
function delayed(values: readonly number[], phase: number, lag: number): number {
  const t = ((phase - lag) % 1 + 1) % 1;
  let i = 0;
  while (i < BEATS.length - 2 && t > BEATS[i + 1]) i++;
  const blend = (t - BEATS[i]) / (BEATS[i + 1] - BEATS[i]);
  return values[i] + (values[i + 1] - values[i]) * blend;
}

/** Match endpoint velocity as well as pose with a brief keyed regather. */
function softenLoopWrap<T extends { id: string; time: number }>(keys: T[]): T[] {
  const first = structuredClone(keys[0]), last = structuredClone(keys[keys.length - 1]);
  first.id += ':wrap-out'; first.time = .03 * ICE_WALK_DURATION;
  last.id += ':wrap-in'; last.time = .97 * ICE_WALK_DURATION;
  return [keys[0], first, ...keys.slice(1, -1), last, keys[keys.length - 1]];
}

/** The ice walk as it shipped up to starter catalog 39. Kept only so that a saved suite's untouched copy can
 * be told from an edited one and replaced by the sliding stride below. Its soles never met the ice. */
export function buildLegacyIceWalkClip(rigId: string, includeTorsoRoot = true): AnimationClip {
  const clip = createAnimationClip({ id: ICE_WALK_CLIP_ID,
    name: 'Ice Walk — Scuff and Counterbalance', rigId, duration: ICE_WALK_DURATION });
  clip.proceduralOrder = 'keyed-then-procedural';
  const rotation = (joint: string, poses: readonly Vec3Tuple[]): void => {
    const id = `${clip.id}:${joint}:quaternion`;
    clip.tracks.push({ id, target: joint, kind: 'quaternion', keys: softenLoopWrap(poses.map((pose, i) => ({
      id: `${id}:${i}`, time: BEATS[i] * clip.duration,
      value: new THREE.Quaternion().setFromEuler(new THREE.Euler(...pose, 'XYZ')).toArray() as QuaternionTuple,
      interpolation: 'cubic',
    }))) });
  };
  const position = (joint: string, poses: readonly Vec3Tuple[]): void => {
    const id = `${clip.id}:${joint}:position`;
    clip.tracks.push({ id, target: joint, kind: 'position', keys: softenLoopWrap(poses.map((pose, i) => ({
      id: `${id}:${i}`, time: BEATS[i] * clip.duration, value: [...pose], interpolation: 'cubic',
    }))) } as AnimationTrack);
  };
  // No root trajectory, root scale or skeleton-wide squash. The small pelvis
  // gather makes soft knees credible while the controller owns every metre.
  position('root', BEATS.map(() => [0, 0, 0]));
  position('hips', BEATS.map((_, i) => [LEAN[i] * -.11, DROP[i], 0]));
  rotation('hips', BEATS.map((_, i) => [0, LEAN[i] * .20, LEAN[i] * -.18]));
  if (includeTorsoRoot) rotation('torsoRoot', BEATS.map((_, i) => [.055, 0, LEAN[i] * .28]));
  rotation('spine', BEATS.map((_, i) => [includeTorsoRoot ? .035 : .09, LEAN[i] * .10, LEAN[i] * (includeTorsoRoot ? .30 : .58)]));
  rotation('chest', BEATS.map((_, i) => [.025, LEAN[i] * -.10, LEAN[i] * .60]));
  rotation('neck', BEATS.map((_, i) => [-.045, LEAN[i] * -.08, LEAN[i] * -.40]));
  rotation('head', BEATS.map((_, i) => [-.045, LEAN[i] * -.12, LEAN[i] * -.60]));

  const armX = [[.18, .07, -.12, .20, .28, .05, -.18, .04, .18],
    [-.08, .12, .24, .08, -.10, -.19, .10, .24, -.08]];
  const spread = [[1.12, 1.40, 1.30, .99, 1.05, 1.24, 1.45, 1.34, 1.12],
    [1.32, 1.10, .98, 1.23, 1.48, 1.34, 1.05, 1.16, 1.32]];
  const elbows = [[-.45, -.36, -.56, -.62, -.37, -.42, -.58, -.51, -.45],
    [-.57, -.49, -.37, -.44, -.61, -.54, -.36, -.48, -.57]];
  for (const [side, sign, index] of [['Left', 1, 0], ['Right', -1, 1]] as const) {
    const knee = index === 0 ? LEFT_KNEE : RIGHT_KNEE;
    const glide = index === 0 ? LEFT_GLIDE : RIGHT_GLIDE;
    const hip = knee.map((bend, i) => -bend / 2 + glide[i]);
    rotation(`clavicle${side}`, BEATS.map((_, i) => [0, 0, sign * .06 - LEAN[i] * .10]));
    rotation(`shoulder${side}`, BEATS.map((_, i) => [armX[index][i], sign * .08 - LEAN[i] * .45, sign * spread[index][i]]));
    rotation(`elbow${side}`, BEATS.map(phase => [delayed(elbows[index], phase, .06), 0, sign * .16]));
    rotation(`wrist${side}`, BEATS.map(phase => [delayed(armX[index], phase, .11) * -.55,
      sign * .18, sign * .06 - delayed(LEAN, phase, .11) * .85]));
    rotation(`hip${side}`, BEATS.map((_, i) => [hip[i], 0, sign * .065]));
    rotation(`knee${side}`, BEATS.map((_, i) => [knee[i], 0, 0]));
    rotation(`ankle${side}`, BEATS.map((_, i) => [-hip[i] - knee[i], 0, -sign * .065]));
    rotation(`toe${side}`, BEATS.map(() => [0, 0, 0]));
  }

  const response = (joint: string, axis: Vec3Tuple, source: string, amount: number, signed = false): void => {
    clip.proceduralDrivers.push(createProceduralDriver('response', { kind: 'quaternion', target: joint, axis }, {
      id: `${clip.id}:response:${source}:${joint}:${axis.join('-')}`, name: `${source} · ${joint}`,
      order: 100 + clip.proceduralDrivers.length, blend: 'additive', source,
      amplitude: amount * (signed ? 2 : 1), bias: signed ? -amount : 0,
      inputRange: signed ? [-1, 1] : [0, 1], responseCurve: signed ? 'linear' : 'smoothstep',
      clamp: [Math.min(0, -Math.abs(amount)), Math.abs(amount)],
    }));
  };
  // Effort deepens the soft gathering and raises the balance arms. Signed
  // side slip produces a coherent counter-lean with an opposing head turn.
  response('spine', [1, 0, 0], ICE_EFFORT_INPUT, .055);
  response('head', [1, 0, 0], ICE_EFFORT_INPUT, -.055);
  response('chest', [0, 0, 1], ICE_SIDE_SLIP_INPUT, -.10, true);
  response('neck', [0, 0, 1], ICE_SIDE_SLIP_INPUT, .04, true);
  response('head', [0, 0, 1], ICE_SIDE_SLIP_INPUT, .06, true);
  for (const [side, sign] of [['Left', 1], ['Right', -1]] as const) {
    response(`shoulder${side}`, [0, 0, 1], ICE_EFFORT_INPUT, sign * .10);
    response(`shoulder${side}`, [1, 0, 0], ICE_SIDE_SLIP_INPUT, -sign * .12, true);
  }
  const glideContact = (name: string, start: number, end: number, effector: string) => ({
    id: `${clip.id}:${name}`, start: start * clip.duration, end: end * clip.duration,
    effector, mode: 'custom' as const, weight: 1,
    metadata: { surface: 'ice', planarContact: 'glide', verticalContact: 'ground', locking: 'no-world-XZ-plant' },
  });
  clip.contacts = [glideContact('left-long-glide', 0, .62, 'footLeft'),
    glideContact('left-catch', .84, 1, 'footLeft'), glideContact('right-entry-glide', 0, .13, 'footRight'),
    glideContact('right-long-glide', .32, 1, 'footRight')];
  clip.markers = [{ id: `${clip.id}:right-scuff`, time: .24 * clip.duration, name: 'Small right recovery' },
    { id: `${clip.id}:left-scuff`, time: .74 * clip.duration, name: 'Long left corrective scuff' }];
  clip.tags = ['player', 'starter-authored', 'ice', 'locomotion', 'balance', 'in-place'];
  clip.metadata = { starterQuality: 'authored-foundation', starterCatalogVersion: 32,
    performance: 'Original low scuffs, asymmetric corrections and delayed arm counterbalance',
    referenceStudy: { url: 'https://www.youtube.com/watch?v=x_Q7VARdpdg&t=107s',
      scope: 'PS1 Snow Go posture reference only; original keys and timing, no extracted animation' },
    motionInputs: { [ICE_EFFORT_INPUT]: { min: 0, max: 1, default: 0 },
      [ICE_SIDE_SLIP_INPUT]: { min: -1, max: 1, default: 0 } },
    footContactPolicy: 'Low lifted recoveries separated by surface glides; never a locked skating foot',
    headPolicy: 'Counter-rotate chest sway and slip; no camera or gameplay changes' };
  return clip;
}

// ---------------------------------------------------------------------------
// THE SLIDING STRIDE AND THE BRACED GLIDE (starter catalog 40).
//
// On ice both shoes stay on the ice. Pushing, each foot in turn slides back
// and out under a low pelvis, like a skater's stroke, and slides forward again
// without leaving the surface; let go of the stick and he coasts braced, one
// foot a little ahead, arms wide, correcting. Nothing here steps.
//
// The legs are solved, not posed: each sole is given a path on the floor and
// the hip, knee and ankle that put it there are worked out when the clip is
// built (and stored as ordinary keys, which the Studio can edit). That is what
// keeps two feet at one height through a whole stroke, which hand-set angles
// did not: the old walk's soles were never both down.
// ---------------------------------------------------------------------------

function iceResponses(clip: AnimationClip, effort: boolean): void {
  const response = (joint: string, axis: Vec3Tuple, source: string, amount: number, signed = false): void => {
    clip.proceduralDrivers.push(createProceduralDriver('response', { kind: 'quaternion', target: joint, axis }, {
      id: `${clip.id}:response:${source}:${joint}:${axis.join('-')}`, name: `${source} · ${joint}`,
      order: 100 + clip.proceduralDrivers.length, blend: 'additive', source,
      amplitude: amount * (signed ? 2 : 1), bias: signed ? -amount : 0,
      inputRange: signed ? [-1, 1] : [0, 1], responseCurve: signed ? 'linear' : 'smoothstep',
      clamp: [Math.min(0, -Math.abs(amount)), Math.abs(amount)],
    }));
  };
  // Effort drives the chest down over the stroke and the arms higher. A side slip leans the chest against it
  // and the head back to level: the pelvis and both legs are left alone, so neither takes a shoe off the ice.
  if (effort) { response('spine', [1, 0, 0], ICE_EFFORT_INPUT, .11); response('head', [1, 0, 0], ICE_EFFORT_INPUT, -.09); }
  response('chest', [0, 0, 1], ICE_SIDE_SLIP_INPUT, -.13, true);
  response('neck', [0, 0, 1], ICE_SIDE_SLIP_INPUT, .05, true);
  response('head', [0, 0, 1], ICE_SIDE_SLIP_INPUT, .07, true);
  for (const [side, sign] of [['Left', 1], ['Right', -1]] as const) {
    if (effort) response(`shoulder${side}`, [0, 0, 1], ICE_EFFORT_INPUT, sign * .12);
    response(`shoulder${side}`, [1, 0, 0], ICE_SIDE_SLIP_INPUT, -sign * .14, true);
  }
}

const glideContact = (clip: AnimationClip, side: 'Left' | 'Right') => ({
  id: `${clip.id}:shoe-${side}`, start: 0, end: clip.duration, effector: `foot${side}`, mode: 'custom' as const, weight: 1,
  metadata: { surface: 'ice', planarContact: 'glide', verticalContact: 'ground', locking: 'no-world-XZ-plant' },
});

/**
 * The stride. One foot's cycle, the other's half a cycle on: for a little over half of it the sole slides
 * back and out under him (the push), and for the rest it slides forward and in again, flat on the ice and
 * quicker. The pelvis sinks over each push and comes up as it ends, sways over the pushing foot
 * and turns to follow the one coming forward; the chest counters it, and the arms swing wide against the legs.
 */
export function buildIceWalkClip(rigId: string, includeTorsoRoot = true): AnimationClip {
  const clip = createAnimationClip({ id: ICE_WALK_CLIP_ID, name: 'Ice Walk — Sliding Stride', rigId, duration: ICE_WALK_DURATION });
  clip.proceduralOrder = 'keyed-then-procedural';
  const t = solvedTracks(clip, 16);
  const PUSH = 0.56; // of a foot's cycle
  // (phase 0: the left foot is as far forward as it goes and begins its push)
  const foot = (phase: number, side: number): Foot => {
    const p = ((phase + (side > 0 ? 0 : 0.5)) % 1 + 1) % 1;
    // The push: back and out on a leg that ends all but straight, toes turning out as it goes.
    if (p < PUSH) { const k = ease(p / PUSH); return { side: 0.015 + 0.090 * k * k, fore: 0.245 - 0.545 * k, lift: 0, toeOut: 0.08 + 0.42 * k, heel: 0 }; }
    // The recovery: forward and in under him, quicker, flat on the ice.
    const k = ease((p - PUSH) / (1 - PUSH));
    return { side: 0.105 - 0.090 * k, fore: -0.30 + 0.545 * k, lift: 0, toeOut: 0.50 - 0.42 * k, heel: 0 };
  };
  const pelvis = (phase: number): Pelvis => ({
    x: 0.034 * wave(phase + 0.10), // over the pushing foot (the left pushes first: +x is his left)
    drop: 0.094 + 0.022 * (0.5 - 0.5 * Math.cos((phase + 0.03) * Math.PI * 4)), // down into each push, up out of it
    pitch: 0.10, yaw: -0.21 * wave(phase + 0.25), roll: 0.050 * wave(phase + 0.10),
  });
  t.offset('root', () => [0, 0, 0]);
  t.offset('hips', phase => { const p = pelvis(phase); return [p.x, -p.drop, 0]; });
  t.euler('hips', phase => { const p = pelvis(phase); return [p.pitch, p.yaw, p.roll]; });
  const lean = (phase: number): number => wave(phase + 0.10);
  // The chest is driven down over the stroke and rises between pushes; it turns against the pelvis.
  const drive = (phase: number): number => 0.5 - 0.5 * Math.cos((phase - 0.02) * Math.PI * 4);
  if (includeTorsoRoot) t.euler('torsoRoot', phase => [.13 + .03 * drive(phase), 0, lean(phase) * -.045]);
  t.euler('spine', phase => [(includeTorsoRoot ? .10 : .23) + .03 * drive(phase), pelvis(phase).yaw * -.60, lean(phase) * (includeTorsoRoot ? -.055 : -.10)]);
  t.euler('chest', phase => [.075, pelvis(phase).yaw * -.85, lean(phase) * -.060]);
  t.euler('neck', phase => [-.14, pelvis(phase).yaw * .40, lean(phase) * .045]);
  t.euler('head', phase => [-.17 - .02 * drive(phase), pelvis(phase).yaw * .35, lean(phase) * .055]);
  for (const [side, sign] of [['Left', 1], ['Right', -1]] as const) {
    const solved = t.times.map((_, i) => { const phase = (i / (t.times.length - 1)) % 1; return solveLeg(sign, pelvis(phase), foot(phase, sign)); });
    t.turns(`hip${side}`, solved.map(leg => leg.hip));
    t.turns(`knee${side}`, solved.map(leg => leg.knee));
    t.turns(`ankle${side}`, solved.map(leg => leg.ankle));
    t.euler(`toe${side}`, () => [0, 0, 0]);
    // An arm swings against its own leg: forward as that foot slides back. Each joint below the shoulder is later,
    // so the forearm and the hand whip through after the upper arm has turned.
    const swing = (phase: number, lag = 0): number => wave(phase + (sign > 0 ? 0 : 0.5) + 0.17 - lag);
    t.euler(`clavicle${side}`, phase => [0, 0, sign * .07 + swing(phase) * .04]);
    t.euler(`shoulder${side}`, phase => [-.12 - .78 * swing(phase), sign * .12, sign * (.74 + .26 * Math.abs(swing(phase, .05)))]);
    t.euler(`elbow${side}`, phase => [-.78 - .36 * swing(phase, .08), 0, sign * .14]);
    t.euler(`wrist${side}`, phase => [.10 + .32 * swing(phase, .15), sign * .16, sign * .05]);
  }
  iceResponses(clip, true);
  clip.contacts = [glideContact(clip, 'Left'), glideContact(clip, 'Right')];
  clip.markers = [{ id: `${clip.id}:left-push`, time: 0, name: 'Left foot begins its push' },
    { id: `${clip.id}:right-push`, time: .5 * clip.duration, name: 'Right foot begins its push' }];
  clip.tags = ['player', 'starter-authored', 'ice', 'locomotion', 'balance', 'in-place'];
  clip.metadata = { starterQuality: 'authored-foundation', starterCatalogVersion: 40,
    performance: 'Skating strokes on both soles under a low pelvis; chest and wide arms counter the stroke',
    legSolve: 'Each sole follows a path on the floor; hip, knee and ankle keys are solved from it at build time',
    motionInputs: { [ICE_EFFORT_INPUT]: { min: 0, max: 1, default: 0 },
      [ICE_SIDE_SLIP_INPUT]: { min: -1, max: 1, default: 0 } },
    footContactPolicy: 'Both shoes flat on the ice throughout: a push slides back and out, a recovery slides forward and in',
    headPolicy: 'Counter-rotate the pelvis turn and the slip; no camera or gameplay changes' };
  return clip;
}

/**
 * The glide. He is not pushing: he is carried, and stays on his feet. Both soles are down and stay where they
 * are, the left a little ahead; the pelvis is low and drifts over them; the chest and the wide arms make the
 * corrections, two small ones and a larger one in each loop, and settle between them.
 */
export function buildIceGlideClip(rigId: string, includeTorsoRoot = true): AnimationClip {
  const clip = createAnimationClip({ id: ICE_GLIDE_CLIP_ID, name: 'Ice Glide — Braced Coast', rigId, duration: ICE_GLIDE_DURATION });
  clip.proceduralOrder = 'keyed-then-procedural';
  const t = solvedTracks(clip, 18);
  // A correction: a quick tip one way and a slower return past level (it rebounds, and settles).
  const wobble = (phase: number): number => {
    const beat = (at: number, size: number, width: number): number => { const d = ((phase - at) % 1 + 1.5) % 1 - 0.5; return size * Math.exp(-(d * d) / (width * width)) * Math.sin(d / width * 2.2); };
    return beat(0.14, 1, 0.10) + beat(0.50, -0.6, 0.08) + beat(0.80, 0.8, 0.09);
  };
  // He is turned a little side-on to the way he is going, as a body is that is braking with its edges.
  const pelvis = (phase: number): Pelvis => ({ x: 0.016 * wobble(phase), drop: 0.088 + 0.012 * Math.abs(wobble(phase)), pitch: -0.03, yaw: 0.16 + 0.04 * wobble(phase + 0.04), roll: 0.03 * wobble(phase) });
  const foot = (sign: number): Foot => ({ side: 0.05, fore: sign > 0 ? 0.15 : -0.115, lift: 0, toeOut: sign > 0 ? 0.10 : 0.34, heel: 0 });
  t.offset('root', () => [0, 0, 0]);
  t.offset('hips', phase => { const p = pelvis(phase); return [p.x, -p.drop, 0]; });
  t.euler('hips', phase => { const p = pelvis(phase); return [p.pitch, p.yaw, p.roll]; });
  // The chest hangs back from the slide and does the correcting; the head stays level over it.
  if (includeTorsoRoot) t.euler('torsoRoot', phase => [-.07, 0, wobble(phase + 0.03) * -.075]);
  t.euler('spine', phase => [includeTorsoRoot ? -.05 : -.12, pelvis(phase).yaw * -.5, wobble(phase + 0.03) * (includeTorsoRoot ? -.095 : -.17)]);
  t.euler('chest', phase => [-.02, pelvis(phase).yaw * -.4, wobble(phase + 0.06) * -.090]);
  t.euler('neck', phase => [.06, 0, wobble(phase + 0.09) * .090]);
  t.euler('head', phase => [.08, 0, wobble(phase + 0.10) * .11]);
  for (const [side, sign] of [['Left', 1], ['Right', -1]] as const) {
    const solved = t.times.map((_, i) => solveLeg(sign, pelvis((i / (t.times.length - 1)) % 1), foot(sign)));
    t.turns(`hip${side}`, solved.map(leg => leg.hip));
    t.turns(`knee${side}`, solved.map(leg => leg.knee));
    t.turns(`ankle${side}`, solved.map(leg => leg.ankle));
    t.euler(`toe${side}`, () => [0, 0, 0]);
    // Arms wide. The one on the side he tips toward is thrown up and out and the other comes down; between
    // corrections they circle slowly, out of step with each other. Each elbow and wrist follows late.
    const tip = (phase: number, lag = 0): number => wobble(phase - lag) * sign;
    const circle = (phase: number): number => wave(phase * 2 + (sign > 0 ? 0 : 0.37));
    t.euler(`clavicle${side}`, phase => [0, 0, sign * .09 + tip(phase) * .07]);
    t.euler(`shoulder${side}`, phase => [.05 + .16 * circle(phase), sign * .10, sign * 1.20 + tip(phase, .03) * .42]);
    t.euler(`elbow${side}`, phase => [-.40 - .12 * circle(phase + .08) - .18 * Math.abs(wobble(phase - .06)), 0, sign * .12 + tip(phase, .07) * .16]);
    t.euler(`wrist${side}`, phase => [.06 + .10 * circle(phase + .16), sign * .14, sign * .05 + tip(phase, .12) * -.38]);
  }
  iceResponses(clip, false);
  clip.contacts = [glideContact(clip, 'Left'), glideContact(clip, 'Right')];
  clip.tags = ['player', 'starter-authored', 'ice', 'glide', 'balance', 'in-place'];
  clip.metadata = { starterQuality: 'authored-foundation', starterCatalogVersion: 40,
    performance: 'Braced coast: both soles down and still, pelvis low, chest and wide arms correcting and settling',
    legSolve: 'Each sole is held at a place on the floor; hip, knee and ankle keys are solved from it at build time',
    motionInputs: { [ICE_SIDE_SLIP_INPUT]: { min: -1, max: 1, default: 0 } },
    footContactPolicy: 'Both shoes glide on the support plane; no stepping or root travel',
    headPolicy: 'Level against the chest; no camera or gameplay changes' };
  return clip;
}
