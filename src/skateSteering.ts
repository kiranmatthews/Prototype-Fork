export type SkateSteeringIntent = 'carve' | 'pullback-brake';

export interface SkateSteeringSolution {
  readonly targetX: number;
  readonly targetZ: number;
  readonly angle: number;
  readonly intent: SkateSteeringIntent;
}

const EPSILON = 1e-6;

/**
 * Resolve a skate direction in the same screen-relative frame used by the
 * camera/lane controls, then distinguish a real pull-back stop from a hard
 * carve. A stop is specifically a screen-back-dominant gesture against
 * screen-forward-dominant travel. Lateral reversals and diagonal redirects
 * remain full-rate carves even when they initially point 180 degrees away
 * from the current heading.
 */
export function solveSkateSteering(
  headingX: number,
  headingZ: number,
  screenForwardX: number,
  screenForwardZ: number,
  moveX: number,
  moveY: number,
  brakeAngle: number,
): SkateSteeringSolution {
  let sfX = Number.isFinite(screenForwardX) ? screenForwardX : 0;
  let sfZ = Number.isFinite(screenForwardZ) ? screenForwardZ : -1;
  const sfLength = Math.hypot(sfX, sfZ);
  if (sfLength <= EPSILON) {
    sfX = 0;
    sfZ = -1;
  } else {
    sfX /= sfLength;
    sfZ /= sfLength;
  }

  let hX = Number.isFinite(headingX) ? headingX : sfX;
  let hZ = Number.isFinite(headingZ) ? headingZ : sfZ;
  const headingLength = Math.hypot(hX, hZ);
  if (headingLength <= EPSILON) {
    hX = sfX;
    hZ = sfZ;
  } else {
    hX /= headingLength;
    hZ /= headingLength;
  }

  const inputX = Number.isFinite(moveX) ? moveX : 0;
  const inputY = Number.isFinite(moveY) ? moveY : 0;
  const inputLength = Math.hypot(inputX, inputY);
  if (inputLength <= EPSILON) {
    return { targetX: hX, targetZ: hZ, angle: 0, intent: 'carve' };
  }

  // screen-right is the clockwise perpendicular to screen-forward.
  const srX = -sfZ;
  const srZ = sfX;
  const targetX = (sfX * inputY + srX * inputX) / inputLength;
  const targetZ = (sfZ * inputY + srZ * inputX) / inputLength;
  const forward = targetX * hX + targetZ * hZ;
  const side = targetX * hZ - targetZ * hX;
  let angle = Math.atan2(side, forward);

  const travelForward = hX * sfX + hZ * sfZ;
  const travelRight = hX * srX + hZ * srZ;
  const backDominant = inputY < -Math.abs(inputX);
  const forwardDominant = travelForward > Math.abs(travelRight);
  const threshold = Number.isFinite(brakeAngle)
    ? Math.max(0, Math.min(Math.PI, brakeAngle))
    : Math.PI;
  const intent: SkateSteeringIntent =
    Math.abs(angle) > threshold && backDominant && forwardDominant
      ? 'pullback-brake'
      : 'carve';

  // Exact lateral reversals have two equally short 180-degree arcs. Choose
  // the one through screen-forward, so left<->right hard carves never swing
  // toward the camera merely because atan2 received a different signed zero.
  if (
    intent === 'carve' &&
    forward < -1 + EPSILON &&
    Math.abs(side) <= EPSILON &&
    Math.abs(travelRight) > Math.abs(travelForward)
  ) {
    angle = Math.sign(travelRight || 1) * Math.PI;
  }

  return { targetX, targetZ, angle, intent };
}
