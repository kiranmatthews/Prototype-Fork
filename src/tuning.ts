// All movement in this prototype is authored numbers — there is no physics
// engine anywhere. These values ARE the game feel; everything is exposed on
// sliders in the debug panel (ui.ts) for live tuning.

export const TUNING = {
  maxSpeed: 43, // top skate speed
  walkSpeed: 12, // Crash walk: direct drive, instant stop; also the skate/walk boundary
  friction: 25.5, // skate speed bleed toward walking pace when coasting
  riseGravity: 40, // gravity while moving up (lighter = floatier jump arc)
  fallGravity: 107, // gravity while falling (heavier = snappy PS1 landing)
  jumpVelocity: 23.5, // fully-charged jump (hold X)
  jumpMinVelocity: 17, // quick-tap jump
  jumpChargeTime: 0.6, // hold this long for full power
  chargeBoost: 20, // THE skate acceleration: holding X builds speed toward maxSpeed
  slopeBoost: 42, // fake downhill acceleration, scaled by slope grade
  uphillSlowdown: 30, // fake uphill deceleration, scaled by slope grade
  railSnapDistance: 3.1, // forgiving radius for Triangle/E grind snap
  grindSpeed: 20, // reference speed: you grind at ENTRY speed; slower than this drifts harder
  grindJumpForce: 24.5, // vertical pop when jumping off a rail
  spinDuration: 0.3,
  spinAirCorrection: 3.5, // small vertical stall from spinning in air (not a rescue)
  turnaround: 150, // braking rate when input opposes travel — snappy direction flips
  grabBoost: 8, // speed burst on landing a clean Circle/Q air grab
  grabSpinRate: 9, // rad/s of the directional grab-spin (left arrow = spin left)
  crateBounce: 18, // vertical pop from stomping a crate — tuned for chaining crate to crate
  slideMinSpeed: 8, // moving at least this fast + Circle = slide (slower + held = crawl)
  slideDuration: 0.55, // how long the canned slide runs (distance = duration x speed)
  slideSpeed: 26, // the slide bursts to at least this speed, direction locked
  slideJumpBoost: 8, // extra speed when a slide is strung into a jump
  airControl: 14, // forward/back speed adjustment in the air
  balanceDrift: 0.55, // THPS grind balance: how fast the needle runs away
  balanceControl: 2.6, // how hard left/right fights the needle
  crawlSpeed: 5.5, // Crash crouch-crawl speed while holding Circle stopped
  pipeAccel: 46, // halfpipe: lateral carve accel on the flat (pump the walls!)
  pipeLift: 1.15, // halfpipe: carve speed left at the lip converts to air at this rate
};

export type TuningKey = keyof typeof TUNING;

// Slider metadata for the debug panel.
export const TUNING_RANGES: Record<TuningKey, { min: number; max: number; step: number }> = {
  maxSpeed: { min: 5, max: 60, step: 1 },
  walkSpeed: { min: 6, max: 20, step: 0.5 },
  friction: { min: 0, max: 30, step: 0.5 },
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
  turnaround: { min: 40, max: 300, step: 5 },
  grabBoost: { min: 0, max: 20, step: 0.5 },
  grabSpinRate: { min: 3, max: 20, step: 0.5 },
  crateBounce: { min: 5, max: 30, step: 0.5 },
  slideMinSpeed: { min: 2, max: 20, step: 0.5 },
  slideDuration: { min: 0.2, max: 1.2, step: 0.05 },
  slideSpeed: { min: 10, max: 45, step: 1 },
  slideJumpBoost: { min: 0, max: 20, step: 0.5 },
  airControl: { min: 0, max: 40, step: 1 },
  balanceDrift: { min: 0.1, max: 2, step: 0.05 },
  balanceControl: { min: 0.5, max: 6, step: 0.1 },
  crawlSpeed: { min: 2, max: 10, step: 0.5 },
  pipeAccel: { min: 10, max: 90, step: 1 },
  pipeLift: { min: 0.5, max: 2, step: 0.05 },
};

// Fixed authored constants that are part of the feel but stay off the sliders
// to keep the panel focused.
export const CONST = {
  fixedStep: 1 / 60, // deterministic chunky update rate
  overspeedDecay: 3, // bleed rate when above maxSpeed on flat ground
  maxOverspeed: 1.6, // hard cap = maxSpeed * this (downhill can exceed maxSpeed)
  killY: -48, // fall below this = instant death
  respawnDelay: 0.7, // quick Crash-style respawn
  playerHalf: { x: 0.5, y: 0.9, z: 0.5 }, // capsule-ish AABB approximation
  spinReach: 1.4, // extra horizontal hit reach while spinning
  spinCooldown: 0.15,
  maskInvuln: 1.0, // grace after a mask absorbs a hit or bail
  uberTime: 12, // third mask = Crash-style invincibility for this long
  coyoteTime: 0.28, // ledge-edge grace: you can still jump this long after rolling off
  teeterSpeed: 4, // below this speed, an overhanging edge makes you teeter
  railRideHeight: 0.15, // feet ride this far above the rail line
  regrindCooldown: 0.3, // stops instant re-snap right after leaving a rail
  grindMinSpeed: 8, // slowest a grind can crawl (and the floor for speed bleed)
  grindBleed: 2, // grind speed lost per second on the rail
  comboWindow: 0.15, // near-zero: combos live in the air/on rails, not on the ground
  // Base point values — combo total = sum of bases x number of actions.
  ptsCrate: 25,
  ptsFruit: 10,
  ptsEnemy: 100,
  ptsBouncy: 25,
  ptsSlide: 30,
  ptsSlam: 75,
  ptsGrab: 150,
  ptsGrabSpin: 100, // bonus for landing a spun grab
  ptsVert: 200,
  ptsGrindBase: 100,
  ptsGrindPerSec: 25,
  grabTransition: 0.15, // reach into / out of the grab pose; land mid-motion = bail
  grabGrace: 0.45, // landing this soon after COMPLETING a grab still pays out
  grabSnapRate: 10, // rad/s the rotation eases back on-axis after release
  grabOffAxisTolerance: 0.65, // landing more than this off-axis (rad) = bail
  flipDuration: 0.55, // Crash front-flip time on jumps (visual only)
  flipMinSpeed: 12, // below this speed a jump is a plain hop, no flip (Crash rules)
  slideCooldown: 0.25,
  slamSpeed: 46, // Circle+down pancake slam: authored fall rate
  slamHang: 0.32, // Wile E. Coyote beat: freeze in the air before the drop
  slamRadius: 2.4, // slam impact breaks crates/enemies within this radius
  slamSquashTime: 0.3, // pancake squash pose on impact
  fruitPerCrate: 3, // wumpa spawned per broken box
  balanceStart: 0.15, // initial needle kick when a grind starts
  balanceRamp: 0.25, // per-second growth of needle drift (longer grind = harder)
  balanceBailSpeedKeep: 0.3, // speed kept after a grind bail
  bounceCrateForce: 30, // arrow-crate launch (vs ~18 from a normal stomp)
  airBrakeFactor: 2, // holding down in the air brakes this much harder than airControl
  tntFuse: 3, // Crash-style TNT countdown (stomp lights it)
  tntBlastScale: 0.6, // TNT blast radius vs nitro (40% smaller)
  blastRadius: 5.5, // nitro explosion kill/break radius (expands over blastGrow)
  blastGrow: 0.35, // seconds for the blast sphere to reach full size
  hpSnapWindow: 2.6, // taller ground-snap window on halfpipe walls so steep climbs stick
  pipeMaxVel: 30, // halfpipe lateral carve speed cap
  pipeGravity: 46, // halfpipe: transition steepness bleeds carve speed at this rate
  pipeFriction: 9, // halfpipe: carve speed decay on the flat with no input
  pipeLandKeep: 0.55, // landing on the transition converts fall speed back to carve
  pipeMinLaunch: 5, // need this much carve left at the lip to air out
  deadzone: 0.18,
  renderScale: 0.5, // low internal resolution for the PS1 look
};
