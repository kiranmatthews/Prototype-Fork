const finiteNonNegative = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, value) : 0;

export interface CameraSkateSpeedState {
  readonly state: string;
  readonly speed: number;
  readonly grindSpeed: number;
  readonly boardRolling: boolean;
  readonly airFromSkate: boolean;
  readonly wallriding: boolean;
  readonly bailing: boolean;
}

/** Presentation-only speed with explicit board ownership. Fast running,
 * slides, ropes, ledges, bails and a thrown board never widen the lens. */
export function cameraSkateSpeed(state: CameraSkateSpeedState): number {
  if (
    state.bailing ||
    state.state === 'dead' ||
    state.state === 'gameover' ||
    state.state === 'rope' ||
    state.state === 'hang'
  ) return 0;
  if (state.state === 'grind') return finiteNonNegative(Math.abs(state.grindSpeed));
  const boardOwned =
    state.boardRolling ||
    state.wallriding ||
    (state.state === 'air' && state.airFromSkate);
  return boardOwned ? finiteNonNegative(Math.abs(state.speed)) : 0;
}

/** Additive FOV in degrees. The trick begins at cruise and reaches full
 * strength at maxSpeed; overspeed holds the authored maximum. */
export function speedSkateFovTarget(
  speed: number,
  skating: boolean,
  cruiseSpeed: number,
  maxSpeed: number,
  boostDegrees: number,
): number {
  if (!skating) return 0;
  const velocity = finiteNonNegative(Math.abs(speed));
  const start = finiteNonNegative(cruiseSpeed);
  const end = Math.max(start, finiteNonNegative(maxSpeed));
  const strength = finiteNonNegative(boostDegrees);
  const span = end - start;
  const linear = span > 1e-6
    ? Math.min(1, Math.max(0, (velocity - start) / span))
    : velocity > start ? 1 : 0;
  const eased = linear * linear * (3 - 2 * linear);
  return strength * eased;
}

/** Frame-rate independent lens easing: the push arrives quickly at speed and
 * relaxes more gently when the board slows or disappears. */
export function stepSpeedSkateFov(
  current: number,
  target: number,
  deltaSeconds: number,
  snap = false,
): number {
  const from = Number.isFinite(current) ? Math.max(0, current) : 0;
  const to = Number.isFinite(target) ? Math.max(0, target) : 0;
  if (snap) return to;
  const dt = finiteNonNegative(deltaSeconds);
  const response = to > from ? 6 : 3.5;
  return from + (to - from) * (1 - Math.exp(-response * dt));
}
