// All movement in this prototype is authored numbers — there is no physics
// engine anywhere. These values ARE the game feel; everything is exposed on
// sliders in the debug panel (ui.ts) for live tuning.

export const TUNING = {
  maxSpeed: 13, // top skate speed
  walkSpeed: 8.5, // Crash walk: direct drive, instant stop; also the skate/walk boundary
  friction: 1.5, // skate speed bleed toward walking pace when coasting
  riseGravity: 33, // gravity while moving up (lighter = floatier jump arc)
  fallGravity: 119, // gravity while falling (heavier = snappy PS1 landing)
  jumpVelocity: 17, // fully-charged jump (hold X)
  jumpMinVelocity: 12.5, // quick-tap jump
  jumpChargeTime: 0.4, // hold this long for full power
  chargeBoost: 7, // THE skate acceleration: holding X builds speed toward maxSpeed
  slopeBoost: 20, // fake downhill acceleration, scaled by slope grade
  uphillSlowdown: 15, // fake uphill deceleration, scaled by slope grade
  railSnapDistance: 2, // forgiving radius for Triangle/E grind snap
  grindSpeed: 7, // reference speed: you grind at ENTRY speed; slower than this drifts harder
  grindJumpForce: 15, // vertical pop when jumping off a rail
  spinDuration: 0.3,
  spinAirCorrection: 2, // small vertical stall from spinning in air (not a rescue)
  turnaround: 40, // PULL-BACK BRAKE: bleed rate when yanking the stick against travel (the dismount)
  grabBoost: 4.5, // speed burst on landing a clean Circle/Q air grab
  grabSpinRate: 9, // rad/s of the directional grab-spin (left arrow = spin left)
  crateBounce: 14, // vertical pop from stomping a crate — tuned for chaining crate to crate
  boardSpeed: 8.5, // the board (visual + sound) only comes out above this speed
  skateHoldTime: 0.4, // X held this long (with a direction) before skate drive engages
  skateEntrySpeed: 5, // must also be moving this fast for the skate transition
  carveGrip: 300, // omnidirectional skate: heading turn rate toward the stick (deg/s); higher = sideways feels instant
  slideMinSpeed: 2, // moving at least this fast + Circle = slide (slower + held = crawl)
  slideDistance: 5, // how far the canned slide carries you (world units)
  slideSpeed: 37, // the slide bursts to at least this speed, direction locked
  slideJumpHeight: 1.3, // Crash slide-jump: jump velocity multiplier when leaping out of a slide
  slideJumpGrace: 0.1, // jumps this long AFTER a slide ends still get the slide boost
  airControl: 0, // forward/back speed adjustment in the air
  balanceDrift: 1.25, // THPS grind balance: how fast the needle runs away
  balanceControl: 2.8, // how hard left/right fights the needle
  balanceSpeedEffect: 2, // how much grind SPEED sways the needle (0 = none, slow grinds wobble more)
  crawlSpeed: 3.5, // Crash crouch-crawl speed while holding Circle stopped
  smashSpeed: 12, // skating/grinding at or above this speed plows straight through plain crates
  arrowBounce: 16, // arrow-crate super bounce launch velocity
  arrowBoostMult: 1.25, // perfect-timed X press on an arrow crate multiplies the launch
  arrowBoostWindow: 0.09, // press X within this many seconds of impact for the perfect bounce
  slamRadius: 2.7, // pancake slam: crates/enemies within this radius break on impact
  nitroRadius: 2.75, // nitro explosion kill/break radius
  tntRadius: 2.75, // TNT explosion kill/break radius
  boulderSpeed: 10, // Boulder Dash: the chase boulder's base roll speed (rubber-bands around it)
  renderScale: 0.75, // internal render resolution as a fraction of the window — the era knob
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
  slideJumpHeight: { min: 1, max: 4, step: 0.05 },
  slideJumpGrace: { min: 0, max: 0.8, step: 0.05 },
  airControl: { min: 0, max: 40, step: 1 },
  balanceDrift: { min: 0.1, max: 2, step: 0.05 },
  balanceControl: { min: 0.5, max: 6, step: 0.1 },
  balanceSpeedEffect: { min: 0, max: 2, step: 0.1 },
  crawlSpeed: { min: 2, max: 10, step: 0.5 },
  smashSpeed: { min: 8, max: 40, step: 0.5 },
  arrowBounce: { min: 10, max: 60, step: 1 },
  arrowBoostMult: { min: 1, max: 2, step: 0.05 },
  arrowBoostWindow: { min: 0.04, max: 0.3, step: 0.01 },
  slamRadius: { min: 1.5, max: 7, step: 0.1 },
  nitroRadius: { min: 2, max: 12, step: 0.25 },
  tntRadius: { min: 1.5, max: 10, step: 0.25 },
  boulderSpeed: { min: 10, max: 45, step: 1 },
  renderScale: { min: 0.25, max: 1, step: 0.05 },
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
    'PULL-BACK BRAKE (still live!): carving handles all turning now, but yanking the stick (near-)opposite your travel bleeds speed at this rate — the intentional slow-down-and-dismount. Higher = harder stops.',
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
  slideJumpHeight:
    'Crash slide-jump: a fresh X press+release during a slide leaps THIS much higher than a normal jump. The burst momentum carries through the air; a walk-slide still lands on your feet.',
  slideJumpGrace:
    'Timing forgiveness: releasing the jump within this many seconds AFTER the slide ends still fires the boosted slide jump (0 = strict, boost only mid-slide).',
  airControl:
    'Forward/back speed adjustment in the air WHILE SKATING (braking against travel bites 2x harder). On-foot air is direct-drive and ignores this.',
  balanceDrift: 'How fast the grind balance needle runs away from center on its own.',
  balanceControl: 'How hard left/right input fights the balance needle.',
  balanceSpeedEffect:
    'Baseline for how much grind speed sways the needle. 0 = speed is ignored; 1 = slow grinds wobble up to 1.5x, fast grinds less; 2 = that effect doubled.',
  crawlSpeed: 'Movement speed of the all-fours Circle-crawl.',
  smashSpeed:
    'Skating or grinding at or above this speed plows straight through plain wooden crates and checkpoints (TNT and nitro stay dangerous). Below it, a crate is a wall.',
  arrowBounce: 'Launch velocity of the yellow arrow-crate super bounce (a normal crate stomp is ~18).',
  arrowBoostMult:
    'PERFECT BOUNCE: press X right as you hit an arrow crate and the launch is multiplied by this (1 = feature off).',
  arrowBoostWindow:
    'How tight the perfect-bounce timing is: X must be pressed within this many seconds before impact.',
  slamRadius: 'Pancake slam blast radius — crates and enemies within this range of the impact break.',
  nitroRadius: 'Nitro explosion radius — everything (including you, unmasked) within it when a nitro pops.',
  tntRadius: 'TNT explosion radius once the 3-2-1 fuse runs out (or it is spun/slammed).',
  boulderSpeed:
    'Boulder Dash chase speed. The boulder rubber-bands around this base — faster when it has passed you or lags too far, a touch slower when right on your heels. Higher = a tighter, scarier chase.',
  renderScale:
    'Internal render resolution as a fraction of the window. 0.75-1 = full-smooth PS2 look (linear upscale); below 0.7 the upscale goes pixelated, and below 0.5 it is full PS1 crunch. Purely visual.',
};

// Debug-panel layout: sliders grouped under labelled sections, in this order.
// Every TuningKey should appear exactly once; anything missed lands in OTHER.
export const TUNING_SECTIONS: { title: string; keys: TuningKey[] }[] = [
  { title: 'WALKING', keys: ['walkSpeed', 'crawlSpeed'] },
  {
    title: 'JUMPS & AIR',
    keys: ['jumpVelocity', 'jumpMinVelocity', 'jumpChargeTime', 'riseGravity', 'fallGravity', 'airControl'],
  },
  {
    title: 'SKATING',
    keys: [
      'maxSpeed',
      'chargeBoost',
      'friction',
      'turnaround',
      'boardSpeed',
      'skateHoldTime',
      'skateEntrySpeed',
      'carveGrip',
      'smashSpeed',
    ],
  },
  { title: 'SLOPES & PIPES', keys: ['slopeBoost', 'uphillSlowdown'] },
  { title: 'SLIDES', keys: ['slideMinSpeed', 'slideDistance', 'slideSpeed', 'slideJumpHeight', 'slideJumpGrace'] },
  {
    title: 'GRINDS',
    keys: ['railSnapDistance', 'grindSpeed', 'grindJumpForce', 'balanceDrift', 'balanceControl', 'balanceSpeedEffect'],
  },
  { title: 'TRICKS', keys: ['spinDuration', 'spinAirCorrection', 'grabBoost', 'grabSpinRate', 'slamRadius'] },
  { title: 'CRATES', keys: ['crateBounce', 'arrowBounce', 'arrowBoostMult', 'arrowBoostWindow', 'nitroRadius', 'tntRadius'] },
  { title: 'WORLD', keys: ['boulderSpeed', 'renderScale'] },
];

// Fixed authored constants that are part of the feel but stay off the sliders
// to keep the panel focused.
export const CONST = {
  carveBrakeAngle: 2.7, // rad (~155 deg): stick pulled this far from the heading = brake/dismount, not a carve
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
  railSnapEase: 0.12, // seconds to glide onto a grabbed rail (no one-frame zap)
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
  ptsGrabQuarter: 40, // per 90 degrees of grab rotation landed
  ptsGrabTick: 4, // accrues every quarter second a grab is held (THPS-style)
  ptsCrystal: 500, // the level crystal pickup
  ptsGem: 1000, // all-boxes gem
  ptsGrindBase: 100,
  ptsGrindTick: 6, // accrues every quarter second on the rail (THPS-style)
  grabTransition: 0.15, // reach into / out of the grab pose; land mid-motion = bail
  grabGrace: 0.45, // landing this soon after COMPLETING a grab still pays out
  grabSnapRate: 15, // rad/s the rotation eases back on-axis after release
  grabOffAxisTolerance: 0.95, // landing more than this off-axis (rad) = bail (forgiving)
  flipDuration: 0.55, // Crash front-flip time on jumps (visual only)
  flipMinSpeed: 12, // below this speed a jump is a plain hop, no flip (Crash rules)
  slideCooldown: 0.25,
  slamSpeed: 46, // Circle+down pancake slam: authored fall rate
  maxFallSpeed: 52, // terminal velocity: fall no faster than the ground ray can catch (no deck tunneling)
  slamHang: 0.32, // Wile E. Coyote beat: freeze in the air before the drop
  slamFlat: 0.5, // lie pancaked on the ground this long after impact
  crouchJumpMult: 1.35, // crouch (crawl) jumps launch this much higher
  slamSquashTime: 0.3, // pancake squash pose on impact
  fruitPerCrate: 3, // wumpa spawned per broken box
  balanceStart: 0.15, // initial needle kick when a grind starts
  balanceRamp: 0.25, // per-second growth of needle drift (longer grind = harder)
  balanceGrace: 2, // seconds before the drift ramp starts growing (no hidden max grind length)
  balanceCritWindow: 0.35, // pegged-needle beat where opposite input can still save the grind
  balanceBailSpeedKeep: 0.3, // speed kept after a grind bail
  airBrakeFactor: 2, // holding down in the air brakes this much harder than airControl
  tntFuse: 3, // Crash-style TNT countdown (stomp lights it)
  blastGrow: 0.35, // seconds for the blast sphere to reach full size
  // Steep-ground rules: the halfpipe is just terrain now — these decide when
  // a slope stops being floor and starts being transition.
  steepStand: 0.78, // ground normal.y below this (~39deg+) = too steep to stand: always ridden
  steepSnapNormal: 0.85, // below this, ground-follow + landing windows widen for transitions
  steepSnapWindow: 2.6, // taller ground-snap window on steep transitions so fast climbs stick
  steepLandGive: 1.5, // landing penetration forgiveness on steep faces (vs 0.35 on decks)
  vertGrade: 1.2, // leaving a lip steeper than this counts as vert coping...
  vertKeep: 0.25, // ...and keeps only this fraction of planar speed (air goes UP, back into the pipe)
  renderScale: 0.75, // build default for the internal resolution (live knob: TUNING.renderScale)
};
