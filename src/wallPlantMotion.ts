import { characterElasticityAmplitudes, ELASTIC_LENGTH_CONTROLS } from './animation/elasticity';

/** Seconds the release takes to stretch, rebound once and come back to neutral. */
export const WALL_PLANT_RELEASE_SECONDS = 0.34;
/** How far the rig leans back off the face, feet to the wall: the launch line itself. */
export const WALL_PLANT_LEAN = 0.62;
/** Metres the feet come in from the collision skin to stand on the face. */
export const WALL_PLANT_REACH = 0.36;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

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
