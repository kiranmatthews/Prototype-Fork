import { characterElasticityAmplitudes, ELASTIC_LENGTH_CONTROLS } from './animation/elasticity';

/** Seconds the release takes to stretch, rebound once and come back to neutral. */
export const WALL_PLANT_RELEASE_SECONDS = 0.34;
/** How far the rig leans back off the face, feet to the wall: the launch line itself. */
export const WALL_PLANT_LEAN = 0.62;
/** Metres the feet come in from the collision skin to stand on the face. */
export const WALL_PLANT_REACH = 0.36;

/**
 * The three-point crouch on the face: both soles and one palm on the wall, the
 * hips sat back off it, the chest turned open and the head looking over the
 * shoulder at the way out. Positions are in the wall's own frame: metres out
 * from the surface, up from the line of the feet, and along the wall toward
 * the side the chest opens to. Sized on the game's own rig (hips 1.03 m up).
 */
export const WALL_PLANT_CROUCH = {
  seat: { out: 0.37, up: 0.42, along: -0.02 },
  /** The foot under the planted hand, and the open-side foot drawn up high. */
  footLow: { up: 0.36, along: -0.48 },
  footHigh: { up: 0.72, along: 0.5 },
  hand: { up: 1.0, along: -0.6 },
  /** Radians the chest turns off the wall, and the spine hangs back from it. */
  twist: 0.62,
  lean: 0.26,
} as const;
/** How far the body is drawn onto a face it has just hit, while the press is
 * still open: the brace that a late plant grows out of. */
export const WALL_PLANT_BRACE = 0.6;
/** An early press reaches for the wall on the way in: how far into the crouch
 * it gets by the time the body arrives, and from how many metres out. */
export const WALL_PLANT_REACH_FOR = 0.8;
export const WALL_PLANT_REACH_FROM = 1.7;
/** The push: seconds the soles stay on the wall while the legs fire, then the
 * seconds the drawn body takes to catch the real one up. */
export const WALL_PLANT_PUSH_SECONDS = 0.06;
export const WALL_PLANT_CATCH_SECONDS = 0.14;
/** Share of its real speed the drawn body moves at while the legs are firing. */
const WALL_PLANT_PUSH_PACE = 0.3;
/** Seconds of leap flourish after the launch, start to finish. */
export const WALL_PLANT_LEAP_SECONDS = 0.46;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => { const k = clamp01(value); return k * k * (3 - 2 * k); };

/**
 * Seconds the drawn body trails the real one, `flight` seconds after it left
 * the wall. The lag builds while the legs straighten against the face and is
 * spent in one surge, so the kick reads as a push and not as a jump cut off
 * the wall. Exactly zero before the launch and once the catch is over.
 * Presentation only: collision and the camera stay on the real body.
 */
export function wallPlantPushLag(flight: number): number {
  if (!(flight > 0)) return 0;
  if (flight <= WALL_PLANT_PUSH_SECONDS) return flight * (1 - WALL_PLANT_PUSH_PACE);
  return WALL_PLANT_PUSH_SECONDS * (1 - WALL_PLANT_PUSH_PACE) *
    (1 - smooth((flight - WALL_PLANT_PUSH_SECONDS) / WALL_PLANT_CATCH_SECONDS));
}

/** 0..1 through the push: how far the legs have fired off the wall. */
export function wallPlantPushProgress(flight: number): number {
  return smooth(flight / WALL_PLANT_PUSH_SECONDS);
}

/**
 * The leap that follows the push, as weights over an ordinary jump pose: the
 * arms thrown wide, the back arched open and the lead knee driven up, peaking
 * about a tenth of a second out and gone before the apex. Every weight is
 * exactly zero outside 0..WALL_PLANT_LEAP_SECONDS.
 */
export function sampleWallPlantLeap(flight: number) {
  if (!(flight > 0) || flight >= WALL_PLANT_LEAP_SECONDS) return { spread: 0, arch: 0, drive: 0, trail: 0 };
  const bump = (rise: number, peak: number, fall: number) =>
    smooth((flight - rise) / (peak - rise)) * (1 - smooth((flight - peak) / (fall - peak)));
  return {
    /** Arms out and back into a wide open Y. */
    spread: bump(0.02, 0.1, 0.4),
    /** Chest lifted, spine arched away from the wall. */
    arch: bump(0.03, 0.12, 0.38),
    /** The open-side knee drives up through the leap. */
    drive: bump(0.07, 0.17, WALL_PLANT_LEAP_SECONDS),
    /** The pushing leg trails long behind it. */
    trail: bump(0.04, 0.12, 0.36),
  };
}

/**
 * Presentation only: the squash of the plant and the stretch of the push.
 *
 * `load` runs 0..1 through the hold on the wall. `age` is seconds since the
 * launch, negative while the feet are still planted. The body compresses into
 * the face, releases into a stretch, swings back through neutral into one
 * shallow rebound and ends exactly neutral, so nothing keeps wobbling after
 * the kick has gone. Segments deform independently (never a whole-skeleton
 * scale) and the arms trail the legs and torso by a few hundredths, which is
 * what makes the push read as a push and not as a resize. Movement is not
 * touched.
 */
export function sampleWallPlantMotion(load: number, age: number, board: boolean) {
  const planted = age < 0;
  const squashAt = (lead: number) => {
    if (planted) { const l = clamp01(load * (1 + lead)); return l * l * (3 - 2 * l); }
    return Math.max(0, 1 - (age + lead * .02) / .05);
  };
  const stretchAt = (lag: number) => {
    const u = planted ? 0 : clamp01((age - lag) / WALL_PLANT_RELEASE_SECONDS);
    if (u <= 0 || u >= 1) return 0;
    // One damped swing: out fast (peak near 0.05 s), back through neutral near
    // 0.13 s into a single shallow rebound, then still. The window closes it
    // to exactly zero, so the settle is finite.
    return Math.sin(Math.PI * 2 * Math.pow(u, .7)) * Math.pow(1 - u, 1.5);
  };
  const amplitudes = characterElasticityAmplitudes(board ? 'wall-plant-board' : 'wall-plant');
  const deformations: Record<string, number> = {};
  for (const [target, part] of ELASTIC_LENGTH_CONTROLS) {
    const amplitude = amplitudes[part];
    if (!amplitude) continue;
    // Legs and torso lead; upper arms and forearms follow through.
    const lag = part === 2 ? .045 : part === 1 ? .025 : 0;
    deformations[target] = 1 + amplitude * (stretchAt(lag) - .85 * squashAt(part >= 3 ? .15 : 0));
  }
  const squash = squashAt(0), stretch = stretchAt(0);
  return {
    squash,
    stretch,
    /** Knees fold into the face, then snap straight on the push. */
    knee: 1.05 * squash - .28 * Math.max(0, stretch),
    hip: -.55 * squash + .18 * Math.max(0, stretch),
    /** The chest curls over the knees and opens on the release. */
    spine: .30 * squash - .16 * stretch,
    head: -.18 * squash + .10 * stretch,
    /** Arms gather in front, then throw back and out behind the push. */
    armSwing: -.55 * squash + .85 * stretchAt(.03),
    armSpread: .12 * squash + .42 * stretchAt(.045),
    elbow: -.55 * squash + .18 * stretchAt(.045),
    deformations,
  };
}
