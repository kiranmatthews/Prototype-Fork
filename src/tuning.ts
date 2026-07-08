// All movement in this prototype is authored numbers — there is no physics
// engine anywhere. These values ARE the game feel; everything is exposed on
// sliders in the debug panel (ui.ts) for live tuning.

export const TUNING = {
  maxSpeed: 43, // top speed from pedaling on flat ground
  acceleration: 37, // forward input accel
  friction: 25.5, // speed bleed when not holding forward
  lateralSpeed: 12, // Crash-style axis-locked sidestep, ground and air
  riseGravity: 40, // gravity while moving up (lighter = floatier jump arc)
  fallGravity: 107, // gravity while falling (heavier = snappy PS1 landing)
  jumpVelocity: 23.5, // fully-charged jump (hold X)
  jumpMinVelocity: 17, // quick-tap jump
  jumpChargeTime: 0.6, // hold this long for full power
  chargeBoost: 14, // holding X also pumps speed toward maxSpeed
  slopeBoost: 42, // fake downhill acceleration, scaled by slope grade
  uphillSlowdown: 30, // fake uphill deceleration, scaled by slope grade
  railSnapDistance: 3.1, // forgiving radius for Triangle/E grind snap
  grindSpeed: 20, // rail owns the player: constant authored speed
  grindJumpForce: 24.5, // vertical pop when jumping off a rail
  spinDuration: 0.3,
  spinAirCorrection: 3.5, // small vertical stall from spinning in air (not a rescue)
  reverseSpeed: 18, // Crash-style backing up on stick-down
  turnaround: 150, // braking rate when input opposes travel — snappy direction flips
  grabBoost: 8, // speed burst on landing a Circle/Q air grab
  crateBounce: 18, // vertical pop from stomping a crate — tuned for chaining crate to crate
  slideJumpBoost: 8, // extra speed when a Circle/Q ground slide is strung into a jump
  airControl: 14, // forward/back speed adjustment in the air
  balanceDrift: 0.55, // THPS grind balance: how fast the needle runs away
  balanceControl: 2.6, // how hard left/right fights the needle
  vertLaunch: 22, // upward pop when carving over the halfpipe lip (locked air)
};

export type TuningKey = keyof typeof TUNING;

// Slider metadata for the debug panel.
export const TUNING_RANGES: Record<TuningKey, { min: number; max: number; step: number }> = {
  maxSpeed: { min: 5, max: 60, step: 1 },
  acceleration: { min: 5, max: 80, step: 1 },
  friction: { min: 0, max: 30, step: 0.5 },
  lateralSpeed: { min: 2, max: 25, step: 0.5 },
  riseGravity: { min: 10, max: 120, step: 1 },
  fallGravity: { min: 10, max: 160, step: 1 },
  jumpVelocity: { min: 4, max: 30, step: 0.5 },
  jumpMinVelocity: { min: 6, max: 25, step: 0.5 },
  jumpChargeTime: { min: 0.2, max: 1.5, step: 0.05 },
  chargeBoost: { min: 0, max: 40, step: 1 },
  slopeBoost: { min: 0, max: 120, step: 1 },
  uphillSlowdown: { min: 0, max: 120, step: 1 },
  railSnapDistance: { min: 0.5, max: 8, step: 0.1 },
  grindSpeed: { min: 5, max: 50, step: 1 },
  grindJumpForce: { min: 4, max: 30, step: 0.5 },
  spinDuration: { min: 0.1, max: 1.2, step: 0.05 },
  spinAirCorrection: { min: 0, max: 12, step: 0.5 },
  reverseSpeed: { min: 2, max: 20, step: 1 },
  turnaround: { min: 40, max: 300, step: 5 },
  grabBoost: { min: 0, max: 20, step: 0.5 },
  crateBounce: { min: 5, max: 30, step: 0.5 },
  slideJumpBoost: { min: 0, max: 20, step: 0.5 },
  airControl: { min: 0, max: 40, step: 1 },
  balanceDrift: { min: 0.1, max: 2, step: 0.05 },
  balanceControl: { min: 0.5, max: 6, step: 0.1 },
  vertLaunch: { min: 8, max: 40, step: 1 },
};

// Fixed authored constants that are part of the feel but stay off the sliders
// to keep the panel focused.
export const CONST = {
  fixedStep: 1 / 60, // deterministic chunky update rate
  brakePower: 90, // reverse build rate once you're already stopped/backing
  overspeedDecay: 3, // bleed rate when above maxSpeed on flat ground
  maxOverspeed: 1.6, // hard cap = maxSpeed * this (downhill can exceed maxSpeed)
  killY: -48, // fall below this = instant death
  respawnDelay: 0.7, // quick Crash-style respawn
  playerHalf: { x: 0.5, y: 0.9, z: 0.5 }, // capsule-ish AABB approximation
  spinReach: 1.4, // extra horizontal hit reach while spinning
  spinCooldown: 0.15,
  coyoteTime: 0.28, // ledge-edge grace: you can still jump this long after rolling off
  teeterSpeed: 4, // below this speed, an overhanging edge makes you teeter
  railRideHeight: 0.15, // feet ride this far above the rail line
  regrindCooldown: 0.3, // stops instant re-snap right after leaving a rail
  walkFaceSpeed: 8, // below this forward speed the body faces its travel direction
  grabGrace: 0.18, // releasing the grab this close to landing still counts
  grabSpinRate: 9, // rad/s of the grab trick spin (visual only)
  flipDuration: 0.55, // Crash front-flip time on jumps (visual only)
  flipMinSpeed: 12, // below this speed a jump is a plain hop, no flip (Crash rules)
  slideDuration: 0.55, // Circle/Q ground slide length
  slideMinSpeed: 10, // need this much speed to start a slide
  slideInitBoost: 3, // small shove when the slide starts
  slideCooldown: 0.25,
  fruitPerCrate: 3, // wumpa spawned per broken box
  balanceStart: 0.15, // initial needle kick when a grind starts
  balanceRamp: 0.25, // per-second growth of needle drift (longer grind = harder)
  balanceBailSpeedKeep: 0.3, // speed kept after a grind bail
  bounceCrateForce: 30, // arrow-crate launch (vs ~18 from a normal stomp)
  airBrakeFactor: 2, // holding down in the air brakes this much harder than airControl
  manualMinSpeed: 8, // need this much speed to pop a manual
  manualFlickWindow: 0.2, // up->down (or down->up) within this = manual flick
  manualDownHoldExit: 0.4, // holding down this long during a manual = you meant to brake
  tntFuse: 3, // Crash-style TNT countdown
  blastRadius: 5.5, // explosion kill/break radius (expands over blastGrow)
  blastGrow: 0.35, // seconds for the blast sphere to reach full size
  hpSnapWindow: 2.2, // taller ground-snap window on halfpipe walls so steep climbs stick
  deadzone: 0.18,
  renderScale: 0.5, // low internal resolution for the PS1 look
};
