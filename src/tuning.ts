// All movement in this prototype is authored numbers — there is no physics
// engine anywhere. These values ARE the game feel; everything is exposed on
// sliders in the debug panel (ui.ts) for live tuning.

export const TUNING = {
  maxSpeed: 26, // top speed from pedaling on flat ground
  acceleration: 30, // forward input accel
  friction: 5, // speed bleed when not holding forward
  turnRate: 2.6, // radians/sec of heading change at full stick
  riseGravity: 40, // gravity while moving up (lighter = floatier jump arc)
  fallGravity: 70, // gravity while falling (heavier = snappy PS1 landing)
  jumpVelocity: 15,
  slopeBoost: 42, // fake downhill acceleration, scaled by slope grade
  uphillSlowdown: 30, // fake uphill deceleration, scaled by slope grade
  railSnapDistance: 3.5, // forgiving radius for Triangle/E grind snap
  grindSpeed: 24, // rail owns the player: constant authored speed
  grindJumpForce: 14, // vertical pop when jumping off a rail
  spinDuration: 0.45,
  spinAirCorrection: 3.5, // small vertical stall from spinning in air (not a rescue)
  reverseSpeed: 10, // Crash-style backing up on stick-down
  strafeSpeed: 6, // sideways step speed when (near) stationary
  grabBoost: 8, // speed burst on landing a Circle/Q air grab
};

export type TuningKey = keyof typeof TUNING;

// Slider metadata for the debug panel.
export const TUNING_RANGES: Record<TuningKey, { min: number; max: number; step: number }> = {
  maxSpeed: { min: 5, max: 60, step: 1 },
  acceleration: { min: 5, max: 80, step: 1 },
  friction: { min: 0, max: 30, step: 0.5 },
  turnRate: { min: 0.5, max: 6, step: 0.1 },
  riseGravity: { min: 10, max: 120, step: 1 },
  fallGravity: { min: 10, max: 160, step: 1 },
  jumpVelocity: { min: 4, max: 30, step: 0.5 },
  slopeBoost: { min: 0, max: 120, step: 1 },
  uphillSlowdown: { min: 0, max: 120, step: 1 },
  railSnapDistance: { min: 0.5, max: 8, step: 0.1 },
  grindSpeed: { min: 5, max: 50, step: 1 },
  grindJumpForce: { min: 4, max: 30, step: 0.5 },
  spinDuration: { min: 0.1, max: 1.2, step: 0.05 },
  spinAirCorrection: { min: 0, max: 12, step: 0.5 },
  reverseSpeed: { min: 2, max: 20, step: 1 },
  strafeSpeed: { min: 1, max: 15, step: 0.5 },
  grabBoost: { min: 0, max: 20, step: 0.5 },
};

// Fixed authored constants that are part of the feel but stay off the sliders
// to keep the panel focused.
export const CONST = {
  fixedStep: 1 / 60, // deterministic chunky update rate
  brakePower: 34, // pulling back on the stick
  overspeedDecay: 3, // bleed rate when above maxSpeed on flat ground
  maxOverspeed: 1.6, // hard cap = maxSpeed * this (downhill can exceed maxSpeed)
  airTurnFactor: 0.55, // reduced steering authority in the air
  killY: -22, // fall below this = instant death
  respawnDelay: 0.7, // quick Crash-style respawn
  playerHalf: { x: 0.5, y: 0.9, z: 0.5 }, // capsule-ish AABB approximation
  spinReach: 1.4, // extra horizontal hit reach while spinning
  spinCooldown: 0.15,
  coyoteTime: 0.12, // ledge-edge grace window so late jumps aren't eaten
  railRideHeight: 0.15, // feet ride this far above the rail line
  regrindCooldown: 0.3, // stops instant re-snap right after leaving a rail
  strafeFade: 8, // speed at which sidestep fully hands over to carving turns
  turnLowSpeedFactor: 0.35, // turn authority when stationary (ramps to 1 at strafeFade)
  grabGrace: 0.18, // releasing the grab this close to landing still counts
  deadzone: 0.18,
  renderScale: 0.5, // low internal resolution for the PS1 look
};
