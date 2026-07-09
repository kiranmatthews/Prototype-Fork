// All movement in this prototype is authored numbers — there is no physics
// engine anywhere. These values ARE the game feel; everything is exposed on
// sliders in the debug panel (ui.ts) for live tuning.

export const TUNING = {
  maxSpeed: 20, // top skate speed
  walkSpeed: 9.5, // Crash walk: direct drive, instant stop; also the skate/walk boundary
  friction: 1.5, // skate speed bleed toward walking pace when coasting
  riseGravity: 33, // gravity while moving up (lighter = floatier jump arc)
  fallGravity: 119, // gravity while falling (heavier = snappy PS1 landing)
  jumpVelocity: 17, // fully-charged jump (hold X)
  jumpMinVelocity: 12.5, // quick-tap jump
  jumpChargeTime: 0.4, // hold this long for full power
  chargeBoost: 11, // THE skate acceleration: holding X builds speed toward maxSpeed
  slopeBoost: 81, // fake downhill acceleration, scaled by slope grade
  uphillSlowdown: 74, // fake uphill deceleration, scaled by slope grade
  railSnapDistance: 3.1, // forgiving radius for Triangle/E grind snap
  grindSpeed: 20, // reference speed: you grind at ENTRY speed; slower than this drifts harder
  grindJumpForce: 20, // vertical pop when jumping off a rail
  spinDuration: 0.3,
  spinAirCorrection: 12, // small vertical stall from spinning in air (not a rescue)
  turnaround: 40, // braking rate when input opposes travel — snappy direction flips
  grabBoost: 8, // speed burst on landing a clean Circle/Q air grab
  grabSpinRate: 8, // rad/s of the directional grab-spin (left arrow = spin left)
  crateBounce: 5, // vertical pop from stomping a crate — tuned for chaining crate to crate
  boardSpeed: 9.5, // the board (visual + sound) only comes out above this speed
  skateHoldTime: 0.4, // X held this long (with a direction) before skate drive engages
  skateEntrySpeed: 5, // must also be moving this fast for the skate transition
  carveGrip: 240, // omnidirectional skate: heading turn rate toward the stick (deg/s); higher = sideways feels instant
  slideMinSpeed: 2, // moving at least this fast + Circle = slide (slower + held = crawl)
  slideDistance: 7.5, // how far the canned slide carries you (world units)
  slideSpeed: 37, // the slide bursts to at least this speed, direction locked
  slideJumpBoost: 14, // extra speed when a slide is strung into a jump
  airControl: 6, // forward/back speed adjustment in the air
  balanceDrift: 0.2, // THPS grind balance: how fast the needle runs away
  balanceControl: 2.8, // how hard left/right fights the needle
  crawlSpeed: 3.5, // Crash crouch-crawl speed while holding Circle stopped
  pipeAccel: 23, // halfpipe: lateral carve accel on the flat (pump the walls!)
  pipeLift: 1.1, // halfpipe: carve speed left at the lip converts to air at this rate
  boulderSpeed: 25, // Boulder Dash: the chase boulder's base roll speed (rubber-bands around it)
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
  boardSpeed: { min: 8, max: 30, step: 0.5 },
  skateHoldTime: { min: 0, max: 1, step: 0.05 },
  skateEntrySpeed: { min: 0, max: 15, step: 0.5 },
  carveGrip: { min: 90, max: 720, step: 15 },
  slideMinSpeed: { min: 2, max: 20, step: 0.5 },
  slideDistance: { min: 3, max: 25, step: 0.5 },
  slideSpeed: { min: 10, max: 45, step: 1 },
  slideJumpBoost: { min: 0, max: 20, step: 0.5 },
  airControl: { min: 0, max: 40, step: 1 },
  balanceDrift: { min: 0.1, max: 2, step: 0.05 },
  balanceControl: { min: 0.5, max: 6, step: 0.1 },
  crawlSpeed: { min: 2, max: 10, step: 0.5 },
  pipeAccel: { min: 10, max: 90, step: 1 },
  pipeLift: { min: 0.5, max: 2, step: 0.05 },
  boulderSpeed: { min: 10, max: 45, step: 1 },
};

// Hover text for the tuning panel: what each slider actually does in play.
export const TUNING_INFO: Record<TuningKey, string> = {
  maxSpeed:
    'Top skate speed. Caps what holding X can build to; downhill can exceed it up to a hard cap (1.6x) before bleeding back.',
  walkSpeed:
    'On-foot speed AND the walk/skate boundary. Walking is direct drive: instant start/stop, zero inertia, all four directions. Any carried speed above this counts as skating.',
  friction:
    'How fast skate speed bleeds back toward walking pace when coasting with no input. Holding into travel bleeds at ~1/3 of this.',
  riseGravity:
    'Gravity on the way UP in a jump. Lower = floatier, longer hang time for tricks.',
  fallGravity:
    'Gravity on the way DOWN. Higher = snappier PS1 landings and shorter overall airtime.',
  jumpVelocity: 'Launch speed of a FULLY charged jump (X held for jumpChargeTime).',
  jumpMinVelocity: 'Launch speed of a quick X tap — the smallest hop.',
  jumpChargeTime: 'How long X must be held for a full-power jump; charge scales linearly up to it.',
  chargeBoost:
    'THE skate accelerator: holding X builds speed toward maxSpeed at this rate. Also how fast you dig out of a stop.',
  slopeBoost: 'Fake downhill acceleration while skating, scaled by how steep the surface is.',
  uphillSlowdown: 'Fake uphill drag while skating; stalling on a ramp rolls you back down it.',
  railSnapDistance:
    'How close (in units) a rail must be for Triangle to snap you onto it. Bigger = more forgiving grind grabs.',
  grindSpeed:
    'REFERENCE grind speed: you actually grind at whatever speed you arrive with, but slower than this wobbles the balance meter harder and faster than it steadies it.',
  grindJumpForce: 'Vertical pop of a fully-charged jump off a rail.',
  spinDuration: 'How long the Square spin attack stays active per press.',
  spinAirCorrection:
    'Small upward stall from spinning in the air (capped, never a full rescue) — Crash-style ledge save.',
  turnaround:
    'Braking rate when your input opposes travel while skating. Higher = snappier direction flips and harder stops.',
  grabBoost: 'Speed burst paid out when a grab is completed cleanly before landing.',
  grabSpinRate: 'Rotation speed of the directional grab-spin (left arrow = spin left).',
  crateBounce: 'Vertical pop from stomping a crate — tune so crate-to-crate chains feel right.',
  boardSpeed:
    'The board (visual + rolling sound) only appears above this speed. Raise it if the board flickers in during normal platforming; the walk/skate physics boundary is walkSpeed, not this.',
  skateHoldTime:
    "Skate commit meter: X must be HELD this long (while pushing a direction) before the charge becomes the skate accelerator. Quick taps stay pure Crash hops.",
  skateEntrySpeed:
    "Second gate on the skate transition: you must already be moving this fast (walking counts) when the hold meter fills. Roughly 40% of walk speed feels right.",
  carveGrip:
    "Skate turn rate (deg/sec) the heading swings toward the direction you push, carrying your speed with it. Higher = sideways/turns feel immediate; lower = long drifty carves.",
  slideMinSpeed: 'Minimum speed for Circle to trigger a slide; slower than this, holding Circle crawls.',
  slideDistance:
    'How far the canned slide carries you, in world units — duration adapts to slide speed so the distance stays consistent.',
  slideSpeed: 'The speed the slide bursts to (it never slows you below your current speed).',
  slideJumpBoost: 'Extra speed converted when you jump out of a slide mid-burst.',
  airControl:
    'Forward/back speed adjustment in the air WHILE SKATING (braking against travel bites 2x harder). On-foot air is direct-drive and ignores this.',
  balanceDrift: 'How fast the grind balance needle runs away from center on its own.',
  balanceControl: 'How hard left/right input fights the balance needle.',
  crawlSpeed: 'Movement speed of the all-fours Circle-crawl.',
  pipeAccel: 'Halfpipe carve acceleration from the stick — pumping strength on the flat and walls.',
  pipeLift:
    'How much carve speed left at the halfpipe lip converts into vertical air (launch = carve x this).',
  boulderSpeed:
    'Boulder Dash chase speed. The boulder rubber-bands around this base — faster when it has passed you or lags too far, a touch slower when right on your heels. Higher = a tighter, scarier chase.',
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
  spinReach: 0.8, // extra horizontal hit reach while spinning (arm+board span)
  spinCooldown: 0.15,
  maskInvuln: 1.0, // grace after a mask absorbs a hit or bail
  uberTime: 12, // third mask = Crash-style invincibility for this long
  coyoteTime: 0.28, // ledge-edge grace: you can still jump this long after rolling off
  teeterSpeed: 4, // below this speed, an overhanging edge makes you teeter
  railRideHeight: 0.15, // feet ride this far above the rail line
  regrindCooldown: 0.3, // stops instant re-snap right after leaving a rail
  grindMinSpeed: 8, // slowest a grind can crawl (and the floor for speed bleed)
  grindSmashSpeed: 28, // at or above this grind speed, plain crates just shatter
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
  ptsGrabQuarter: 40, // per 90 degrees of grab rotation landed
  ptsGrabTick: 4, // accrues every quarter second a grab is held (THPS-style)
  ptsVert: 200,
  ptsGrindBase: 100,
  ptsGrindTick: 6, // accrues every quarter second on the rail (THPS-style)
  grabTransition: 0.15, // reach into / out of the grab pose; land mid-motion = bail
  grabGrace: 0.45, // landing this soon after COMPLETING a grab still pays out
  grabSnapRate: 10, // rad/s the rotation eases back on-axis after release
  grabOffAxisTolerance: 0.65, // landing more than this off-axis (rad) = bail
  flipDuration: 0.55, // Crash front-flip time on jumps (visual only)
  flipMinSpeed: 12, // below this speed a jump is a plain hop, no flip (Crash rules)
  slideCooldown: 0.25,
  slamSpeed: 46, // Circle+down pancake slam: authored fall rate
  maxFallSpeed: 52, // terminal velocity: fall no faster than the ground ray can catch (no deck tunneling)
  slamHang: 0.32, // Wile E. Coyote beat: freeze in the air before the drop
  slamFlat: 0.5, // lie pancaked on the ground this long after impact
  crouchJumpMult: 1.35, // crouch (crawl) jumps launch this much higher
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
  renderScale: 0.5, // low internal resolution for the PS1 look
};
