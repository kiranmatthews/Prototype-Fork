// All movement in this prototype is authored numbers — there is no physics
// engine anywhere. These values ARE the game feel; everything is exposed on
// sliders in the debug panel (ui.ts) for live tuning.

export const TUNING = {
  maxSpeed: 23, // top skate speed
  walkSpeed: 8.5, // Crash walk: direct drive, instant stop; also the skate/walk boundary
  walkRampTime: 0.15, // seconds for a fresh walk to ease from 0 up to full walkSpeed (0 = instant Crash snap; higher = a soft start)
  friction: 7, // idle roll-out: NO input at all bleeds speed to a stop (0 = frictionless)
  riseGravity: 33, // gravity while moving up (lighter = floatier jump arc)
  fallGravity: 119, // gravity while falling (heavier = snappy PS1 landing)
  jumpVelocity: 17, // fully-charged jump (hold X)
  jumpMinVelocity: 12.5, // quick-tap jump
  jumpChargeTime: 0.4, // hold this long for full power
  chargeBoost: 9, // THE skate acceleration: holding X builds speed toward maxSpeed
  cruiseSpeed: 12, // baseline the board holds on its own while skating (no input)
  chargeDecay: 10, // rate speed settles back to cruiseSpeed after releasing X
  downhillMax: 30.5, // hard ceiling for speed EARNED downhill / in pipes (charge still tops at maxSpeed)
  slopeBoost: 38, // downhill acceleration, scaled by sin(slope along travel)
  uphillSlowdown: 27, // uphill deceleration, scaled by sin(slope along travel)
  pipePump: 4, // crouch-pump gain: X held on ground too steep to stand
  pipeGravity: 42, // HALFPIPE: symmetric pendulum gravity on the transition walls — the punch of the wall-to-wall swing (both ways, so it conserves energy)
  pipeCarve: 26, // HALFPIPE: speed built per second just by HOLDING a direction (no X) on the transition — carving works the wall for momentum. Scaled by steepness so the flat gives nothing.
  pipePumpGain: 16, // HALFPIPE: EXTRA speed added per second holding X up a wall — the hard pump on top of the carve, to reach the coping
  pipeFriction: 0.6, // HALFPIPE: tiny speed bleed per second on the transition (keep low; too much and the swing dies at the bottom)
  pipePop: 5, // HALFPIPE: extra vertical launch popped over the coping into the hang
  pipeAirGravity: 30, // HALFPIPE: SYMMETRIC gravity for the air above the coping (same up + down) so you drop back at the speed you left — no asymmetric-fall speed surge that pings you off on landing. Lower = floatier hang.
  pipeSmooth: 25, // per-second easing of the ride plane across segmented transitions
  footGrip: 0.4, // ON FOOT: ground normal.y below this and feet can't grip — you slither down
  steepStand: 0.95, // WITH MOMENTUM: normal.y below this pops the board out to ride the transition
  vertLip: 0.59, // slope (sine along travel) that counts as vert coping at the lip
  hangLaunch: 9, // extra UP pop when you release X right at the lip to fly into hang time
  hangSnapAngle: 3, // approach within this many degrees of straight-on snaps to pure vertical hang (no drift)
  hangLateral: 1.55, // beyond that, how much of your off-axis approach speed becomes sideways hang-time drift (gaps)
  landingFlow: 1, // how much fall speed converts into riding speed when you land on a ramp/wall
  vertGlue: 17.5, // hang time: how hard a vert air is pulled back onto the wall plane
  vertDrift: 4.5, // hang time: stick drift speed ALONG the coping during a vert air
  wallStick: 5, // ground-snap window on steep transitions (how hard the wall holds the board)
  landGive: 3, // landing forgiveness on steep faces (vs 0.35 on flat decks)
  railSnapDistance: 2.1, // forgiving radius for Triangle/E grind snap
  railTripSpeed: 19.5, // side-on into a rail at/above this speed TRIPS you (bail); slower, the rail just blocks your walk
  grindSpeed: 5, // reference speed: you grind at ENTRY speed; slower than this drifts harder
  grindJumpForce: 15, // vertical pop when jumping off a rail
  spinDuration: 0.3,
  spinAirCorrection: 0.5, // small vertical stall from spinning in air (not a rescue)
  turnaround: 20, // PULL-BACK BRAKE: bleed rate when yanking the stick against travel (the dismount)
  brakeRampTime: 0.4, // Circle brake on the board: seconds of HOLDING before the slow-down reaches full force (eases in, so a tap barely bites)
  brakeLockTime: 0.6, // after a brake (Circle or pull-back) stops you, movement stays LOCKED this long (measured from when you release the brake) — no instant reverse-run / insta-crouch
  brakeLockRamp: 0.55, // after the lock, how long walk/crawl movement takes to ease from zero back to full (0 = snap straight to full)
  grabBoost: 2.5, // speed burst on landing a clean Circle/Q air grab
  grabSpinRate: 7.5, // rad/s of the directional grab-spin (left arrow = spin left)
  grabRelease: 0.15, // how long the grab pose takes to return to neutral after letting go of Circle
  spinTolerance: 10, // degrees a landing spin may be off the travel (or 180/switch) line before it's a bail
  crateBounce: 14, // vertical pop from stomping a crate — tuned for chaining crate to crate
  boardSpeed: 8.5, // the board (visual + sound) only comes out above this speed
  skateHoldTime: 0.55, // X held this long (with a direction) before skate drive engages
  skateEntrySpeed: 5, // must also be moving this fast for the skate transition
  teeterCatchSpeed: 6, // roll off a LETHAL edge slower than this and you teeter at the brink instead of falling
  carveGrip: 180, // omnidirectional skate: heading turn rate toward the stick (deg/s); higher = sideways feels instant
  carveGripRatio: 0.05, // how much grip scales with speed (0 = constant, 1 = same turn radius at any speed)
  slideMinSpeed: 2, // moving at least this fast + Circle = slide (slower + held = crawl)
  slideDistance: 5, // how far the canned slide carries you (world units)
  slideSpeed: 37, // the slide bursts to at least this speed, direction locked
  slideJumpHeight: 1.2, // Crash slide-jump: jump velocity multiplier when leaping out of a slide
  slideJumpTravel: 0.65, // horizontal launch speed scale out of a slide-jump (independent of height)
  slideJumpGrace: 0.15, // jumps this long AFTER a slide ends still get the slide boost
  slideRecover: 0.5, // get-up beat after a PLAIN slide: movement locked while the skater picks themselves off the ground (stops slide-spam for free speed)
  wallrideGravity: 8, // THPS wallride: gentle sink while riding a wall (vs 33 rise / 119 fall)
  wallrideFriction: 3, // along-wall speed bleed per second on a wallride
  wallrideMinSpeed: 8, // need at least this much horizontal speed (airborne, grind held) to stick to a wall
  wallrideMaxAngle: 50, // max approach angle OFF PARALLEL (deg) to stick — steeper/more head-on and you bonk off
  wallrideMaxTime: 1.6, // longest a single wallride lasts before you drop off
  wallKickUp: 12, // the WALLIE: base vertical pop when you ollie OFF a wallride (a quick tap)
  wallPumpBonus: 16, // extra vertical launch at FULL pump — hold X on the wall, release to spring off big
  wallChargeMax: 0.45, // seconds of pumping X to reach a full-power wall launch
  wallKickOut: 8, // push away from the wall when you kick off
  airControl: 0, // forward/back speed adjustment in the air
  balanceDrift: 0.9, // THPS grind balance: how fast the needle runs away
  balanceControl: 2.8, // how hard left/right fights the needle
  balanceSpeedEffect: 1.4, // how much grind SPEED sways the needle (0 = none, slow grinds wobble more)
  balanceGrace: 2, // seconds of flat difficulty at the start of every grind
  balanceRamp: 0.25, // per-second drift growth after the grace (longer grind = harder)
  balanceRampMax: 6, // difficulty CEILING: drift never exceeds this multiple of balanceDrift
  bailGrace: 0.15, // pegged-needle beat where slamming the stick back can still save the grind
  crawlSpeed: 3.5, // Crash crouch-crawl speed while holding Circle stopped
  smashSpeed: 12.5, // skating/grinding at or above this speed plows straight through plain crates
  arrowBounce: 16, // arrow-crate super bounce launch velocity
  arrowBoostMult: 1.25, // perfect-timed X press on an arrow crate multiplies the launch
  arrowBoostWindow: 0.09, // press X within this many seconds of impact for the perfect bounce
  slamRadius: 2.7, // pancake slam: crates/enemies within this radius break on impact
  nitroRadius: 2.75, // nitro explosion kill/break radius
  tntRadius: 2.75, // TNT explosion kill/break radius
  boulderSpeed: 10, // Boulder Dash: the chase boulder's base roll speed (rubber-bands around it)
  renderScale: 1, // internal render resolution as a fraction of the window — the era knob
};

export type TuningKey = keyof typeof TUNING;

// Slider metadata for the debug panel.
export const TUNING_RANGES: Record<TuningKey, { min: number; max: number; step: number }> = {
  maxSpeed: { min: 5, max: 60, step: 1 },
  walkSpeed: { min: 6, max: 20, step: 0.5 },
  walkRampTime: { min: 0, max: 2, step: 0.05 },
  friction: { min: 0, max: 30, step: 0.5 },
  riseGravity: { min: 10, max: 120, step: 1 },
  fallGravity: { min: 10, max: 160, step: 1 },
  jumpVelocity: { min: 4, max: 30, step: 0.5 },
  jumpMinVelocity: { min: 6, max: 25, step: 0.5 },
  jumpChargeTime: { min: 0.2, max: 1.5, step: 0.05 },
  chargeBoost: { min: 0, max: 40, step: 1 },
  cruiseSpeed: { min: 6, max: 20, step: 0.5 },
  chargeDecay: { min: 0.5, max: 20, step: 0.5 },
  downhillMax: { min: 10, max: 45, step: 0.5 },
  slopeBoost: { min: 0, max: 120, step: 1 },
  uphillSlowdown: { min: 0, max: 120, step: 1 },
  pipePump: { min: 0, max: 40, step: 0.5 },
  pipeGravity: { min: 10, max: 90, step: 1 },
  pipeCarve: { min: 0, max: 80, step: 1 },
  pipePumpGain: { min: 0, max: 80, step: 1 },
  pipeFriction: { min: 0, max: 6, step: 0.1 },
  pipePop: { min: 0, max: 20, step: 0.5 },
  pipeAirGravity: { min: 10, max: 90, step: 1 },
  pipeSmooth: { min: 2, max: 25, step: 0.5 },
  footGrip: { min: 0.3, max: 0.95, step: 0.01 },
  steepStand: { min: 0.5, max: 0.95, step: 0.01 },
  vertLip: { min: 0.4, max: 0.95, step: 0.01 },
  hangLaunch: { min: 0, max: 15, step: 0.5 },
  hangSnapAngle: { min: 0, max: 60, step: 1 },
  hangLateral: { min: 0, max: 2, step: 0.05 },
  landingFlow: { min: 0, max: 1, step: 0.05 },
  vertGlue: { min: 0, max: 20, step: 0.5 },
  vertDrift: { min: 0, max: 15, step: 0.5 },
  wallStick: { min: 0.8, max: 5, step: 0.1 },
  landGive: { min: 0.35, max: 3, step: 0.05 },
  railSnapDistance: { min: 0.5, max: 8, step: 0.1 },
  railTripSpeed: { min: 8, max: 30, step: 0.5 },
  grindSpeed: { min: 5, max: 50, step: 1 },
  grindJumpForce: { min: 4, max: 30, step: 0.5 },
  spinDuration: { min: 0.1, max: 1.2, step: 0.05 },
  spinAirCorrection: { min: 0, max: 12, step: 0.5 },
  turnaround: { min: 5, max: 300, step: 1 },
  brakeRampTime: { min: 0.1, max: 6, step: 0.05 },
  brakeLockTime: { min: 0, max: 2, step: 0.05 },
  brakeLockRamp: { min: 0, max: 2, step: 0.05 },
  grabBoost: { min: 0, max: 20, step: 0.5 },
  grabSpinRate: { min: 3, max: 20, step: 0.5 },
  grabRelease: { min: 0.05, max: 0.6, step: 0.05 },
  spinTolerance: { min: 10, max: 90, step: 5 },
  crateBounce: { min: 5, max: 30, step: 0.5 },
  boardSpeed: { min: 8, max: 30, step: 0.5 },
  skateHoldTime: { min: 0, max: 1, step: 0.05 },
  skateEntrySpeed: { min: 0, max: 15, step: 0.5 },
  teeterCatchSpeed: { min: 0, max: 15, step: 0.5 },
  carveGrip: { min: 90, max: 720, step: 15 },
  carveGripRatio: { min: 0, max: 1.5, step: 0.05 },
  slideMinSpeed: { min: 2, max: 20, step: 0.5 },
  slideDistance: { min: 3, max: 25, step: 0.5 },
  slideSpeed: { min: 10, max: 45, step: 1 },
  slideJumpHeight: { min: 1, max: 4, step: 0.05 },
  slideJumpTravel: { min: 0.2, max: 1.5, step: 0.05 },
  slideJumpGrace: { min: 0, max: 0.8, step: 0.05 },
  slideRecover: { min: 0, max: 1.2, step: 0.05 },
  wallrideGravity: { min: 0, max: 40, step: 1 },
  wallrideFriction: { min: 0, max: 20, step: 0.5 },
  wallrideMinSpeed: { min: 0, max: 25, step: 0.5 },
  wallrideMaxAngle: { min: 15, max: 90, step: 5 },
  wallrideMaxTime: { min: 0.3, max: 12, step: 0.1 },
  wallKickUp: { min: 0, max: 30, step: 0.5 },
  wallPumpBonus: { min: 0, max: 40, step: 1 },
  wallChargeMax: { min: 0.05, max: 1.5, step: 0.05 },
  wallKickOut: { min: 0, max: 25, step: 0.5 },
  airControl: { min: 0, max: 40, step: 1 },
  balanceDrift: { min: 0.1, max: 2, step: 0.05 },
  balanceControl: { min: 0.5, max: 6, step: 0.1 },
  balanceSpeedEffect: { min: 0, max: 2, step: 0.1 },
  balanceGrace: { min: 0, max: 6, step: 0.25 },
  balanceRamp: { min: 0, max: 1.5, step: 0.05 },
  balanceRampMax: { min: 1, max: 6, step: 0.25 },
  bailGrace: { min: 0, max: 1.2, step: 0.05 },
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
    'Top skate speed from CHARGING. Downhill/pipe riding can exceed it up to the downhillMax slider before bleeding back on the flat.',
  walkSpeed:
    'On-foot speed AND the walk/skate boundary. Walking is direct drive: instant start/stop, zero inertia, all four directions. Any carried speed above this counts as skating.',
  walkRampTime:
    'Soft-start for on-foot walking: a fresh push eases from a standstill up to full walkSpeed over this many seconds (applies to sidesteps too). 0 = the instant Crash snap; higher = a gentler pick-up. The STOP stays instant, and it resets every time you let go so each start ramps fresh.',
  friction:
    'Idle roll-out: with NO input at all, speed bleeds to a full stop on an ease-out curve (fast up top, gentle near rest). Holding a direction coasts at cruiseSpeed instead; 0 = frictionless forever-glide.',
  riseGravity:
    'Gravity on the way UP in a jump. Lower = floatier, longer hang time for tricks.',
  fallGravity:
    'Gravity on the way DOWN. Higher = snappier PS1 landings and shorter overall airtime.',
  jumpVelocity: 'Launch speed of a FULLY charged jump (X held for jumpChargeTime).',
  jumpMinVelocity: 'Launch speed of a quick X tap — the smallest hop.',
  jumpChargeTime: 'How long X must be held for a full-power jump; charge scales linearly up to it.',
  chargeBoost:
    'THE skate accelerator: holding X builds speed toward maxSpeed at this rate. Also how fast you dig out of a stop.',
  cruiseSpeed:
    'Baseline skate speed: the board holds this on its own, no input needed. The ladder: cruiseSpeed -> hold X toward maxSpeed -> release decays back at chargeDecay -> downhill/pipes exceed everything up to downhillMax.',
  chargeDecay:
    'How fast speed settles back to cruiseSpeed after releasing X — and how fast it recovers up to cruise after a hill scrubs you below it.',
  downhillMax:
    'Hard ceiling for speed EARNED from downhill and pipe riding. Charging alone still tops out at maxSpeed; slopes carry you up to this, and the excess bleeds off on the flat.',
  slopeBoost: 'Downhill acceleration while skating, scaled by the sine of the slope along travel (bounded — vert never explodes).',
  uphillSlowdown: 'Uphill drag while skating, same sine scaling; stalling on a ramp rolls you back down it.',
  pipePump:
    'Crouch-pump: speed gained per second holding X on ground too steep to stand — the honest way to build vert height. Steeper wall = stronger pump.',
  pipeGravity:
    'HALFPIPE swing punch: SYMMETRIC gravity on the transition walls (decelerates the climb and accelerates the drop at the same rate = a conserving pendulum). Higher = you whip wall-to-wall faster and snappier; lower = floaty and mellow.',
  pipeCarve:
    'HALFPIPE carve: momentum built just by HOLDING a direction on the transition — no X needed. This is the "carving pumps you" feel; higher = holding toward the wall drives you up harder and builds speed faster. Scaled by wall steepness, so the flat bottom gives no free speed.',
  pipePumpGain:
    'HALFPIPE pump: speed per second added while holding X on a wall — the skill move that builds height over successive swings and carries you to the coping. 0 = carve + momentum only (you session the walls but never quite launch).',
  pipeFriction:
    'HALFPIPE speed bleed per second on the transition. Keep this LOW — too much and the swing dies at the bottom instead of carrying your speed wall to wall.',
  pipePop:
    'HALFPIPE: extra vertical launch popped over the coping — an ollie-out into hang time on top of the speed you carried up. Bigger = higher airs off the lip.',
  pipeAirGravity:
    'HALFPIPE hang gravity ABOVE the coping. SYMMETRIC (same rising and falling) so you drop back in at the speed you launched — no asymmetric-fall surge that pings you across the pipe on landing. Lower = floatier, longer hang.',
  pipeSmooth:
    'How fast the board’s ride plane eases across segmented transitions. Lower = surfy and smooth, higher = snappy and reactive.',
  footGrip:
    'ON FOOT ONLY: the steepest ground your feet can grip (higher = grips less). Below it a walker slides down the fall line instead of climbing — this is the ONE knob that stops walking up pipes. Test: walk up a ramp, raise this, the walk becomes a slither.',
  steepStand:
    'WITH MOMENTUM: normal.y below this pops the board out so you ride the transition (banks, halfpipe walls). Only affects skaters/momentum now — feet obey footGrip. Test: roll at a ramp, lower this, the board comes out sooner.',
  vertLip:
    'Slope steepness (sine along travel) that counts as vert coping when you crest it — steeper than this gives THPS2 hang time; shallower is a plain kicker air. Test: hit the coping, lower it, ordinary ramps start giving hang time.',
  hangLaunch:
    'Extra UP pop when you RELEASE X right at the lip — that flick launches you higher into hang time (holding X gives a lower, mellower hang). Test: pump a wall, let go of X at the top, watch the air get taller.',
  hangSnapAngle:
    'Hit the coping within this many degrees of head-on and you snap to a PURE vertical hang (glued, drop straight back in). Steeper angles carry sideways momentum instead. Test: raise it and even angled approaches drop straight in.',
  hangLateral:
    'Once your approach is past hangSnapAngle, how much of that off-axis speed becomes SIDEWAYS hang-time drift — this is what lets you carry across a gap or transfer to the far wall. Test: hit the lip at an angle, raise it, you sail further sideways.',
  landingFlow:
    'How much of your FALL speed becomes riding speed when you land on a ramp or wall (0 = dead stop like before, 1 = keep it all). This is what makes dropping in from hang time flow instead of stalling. Test: drop into a pipe, raise it, you rocket out the far wall.',
  vertGlue:
    'THPS2 hang time: how hard a vert air is pulled back onto the wall plane so you drop into the same transition. 0 = free air, high = riveted. Test: hang time, raise it, you always drop back down the same face.',
  vertDrift:
    'During vert hang time the stick moves you ALONG the coping at this speed — line up your landing without leaving the wall.',
  wallStick: 'Ground-snap window on steep transitions — how hard the wall holds the board through fast climbs.',
  landGive: 'Landing forgiveness on steep transition faces (flat decks stay strict).',
  railSnapDistance:
    'How close (in units) a rail must be for Triangle to snap you onto it. Bigger = more forgiving grind grabs.',
  railTripSpeed:
    'Running/skating STRAIGHT INTO a rail from the side (no jump, no grind): below this speed the rail simply BLOCKS you like a curb; at or above it you catch the rail and TRIP (bail/stumble). Jump over it or grind it to pass cleanly.',
  grindSpeed:
    'REFERENCE grind speed: you actually grind at whatever speed you arrive with, but slower than this wobbles the balance meter harder and faster than it steadies it.',
  grindJumpForce: 'Vertical pop of a fully-charged jump off a rail.',
  spinDuration: 'How long the Square spin attack stays active per press.',
  spinAirCorrection:
    'Small upward stall from spinning in the air (capped, never a full rescue) — Crash-style ledge save.',
  turnaround:
    'PULL-BACK BRAKE (still live!): carving handles all turning now, but yanking the stick (near-)opposite your travel bleeds speed at this rate — the intentional slow-down-and-dismount. Also the FULL-FORCE rate the Circle brake ramps up to. Higher = harder stops.',
  brakeRampTime:
    'Circle brake on the board eases in: a quick TAP barely slows you, and the slow-down accelerates the longer you hold, reaching full force (the turnaround rate) after this many seconds — so you cannot insta-stop with one tap. Lower = the brake bites sooner.',
  brakeLockTime:
    'After a brake (Circle or a pull-back) has stopped you, movement stays LOCKED for this long once you let the brake go — the "getting up" beat that stops you snapping straight into a reverse run or a crouch. The clock only runs after you release the brake; hold it and you stay locked. 0 = no lock (instant control back).',
  brakeLockRamp:
    'How gradually walk / crawl movement eases from a standstill back to full AFTER the lock ends — the recovery ramp. Higher = a slower, smoother pick-up; 0 = movement snaps straight back to full.',
  grabBoost: 'Speed burst paid out when a grab is completed cleanly before landing.',
  grabSpinRate: 'Rotation speed of the directional grab-spin (left arrow = spin left).',
  grabRelease:
    'How long the grab pose takes to animate back to neutral after RELEASING Circle. Land any time before it finishes (or while still holding) = bail; pose back at neutral = clean, spin permitting.',
  spinTolerance:
    'Landing with your grab-spin more than this many degrees off the travel line = you landed funny: bail. Landing within it of the 180 line is CLEAN — you ride away in switch stance.',
  crateBounce: 'Vertical pop from stomping a crate — tune so crate-to-crate chains feel right.',
  boardSpeed:
    'The board (visual + rolling sound) only appears above this speed. Raise it if the board flickers in during normal platforming; the walk/skate physics boundary is walkSpeed, not this.',
  skateHoldTime:
    "Skate commit meter: X must be HELD this long (while pushing a direction) before the charge becomes the skate accelerator. Quick taps stay pure Crash hops.",
  skateEntrySpeed:
    "Second gate on the skate transition: you must already be moving this fast (walking counts) when the hold meter fills. Roughly 40% of walk speed feels right.",
  teeterCatchSpeed:
    "Ledge forgiveness: roll or skate off a LETHAL edge (a pit, not a step-down) slower than this and you're caught at the brink in a teeter wobble instead of yeeting off to your death. Above it you commit and fall. 0 = no catch, always fall.",
  carveGrip:
    "Skate turn rate (deg/sec) the heading swings toward the direction you push, carrying your speed with it. Higher = sideways/turns feel immediate; lower = long drifty carves. This is the rate AT cruise speed — see carveGripRatio.",
  carveGripRatio:
    'Speed-to-grip coupling: effective turn rate = carveGrip × (1 + ratio × (speed/cruise − 1)), clamped ×0.5–×2. 0 = same grip at every speed (old feel); 1 = your turning circle stays the same size no matter how fast you go; 0.5 = at full charge you carve ~1.5× sharper, at half cruise ~25% lazier.',
  slideMinSpeed: 'Minimum speed for Circle to trigger a slide; slower than this, holding Circle crawls.',
  slideDistance:
    'How far the canned slide carries you, in world units — duration adapts to slide speed so the distance stays consistent.',
  slideSpeed: 'The speed the slide bursts to (it never slows you below your current speed).',
  slideJumpHeight:
    'Crash slide-jump: a fresh X press+release during a slide leaps THIS much higher than a normal jump. It is a PLATFORMING move — always lands back on your feet, never flips out the board into skating.',
  slideJumpTravel:
    'Extra horizontal reach of a slide-jump, as a multiple of WALK speed OVER a normal jump (0.95 = launches ~1.95x walk speed). The launch is a fixed punch regardless of how fast the slide was, so the gap-clearing distance stays predictable — it is not a speed carry.',
  slideJumpGrace:
    'Timing forgiveness: releasing the jump within this many seconds AFTER the slide ends still fires the boosted slide jump (0 = strict, boost only mid-slide).',
  slideRecover:
    'Get-up beat after a PLAIN slide: for this long the skater is picking themselves off the ground and CANNOT run — movement input is dead and leftover speed bleeds to a stop, then control returns. Stops slide-spam for constant free speed. A slide JUMP is exempt (it launches straight out of the slide).',
  wallrideGravity:
    'THPS wallride sink rate: jump into a wall while HOLDING GRIND (E) and you ride along its face. This is the gentle gravity while stuck to the wall (0 = ride dead level, higher = sink faster). Normal air gravity is 33 up / 119 down for reference.',
  wallrideFriction: 'How fast your along-the-wall speed bleeds off during a wallride (higher = shorter rides).',
  wallrideMinSpeed:
    'Minimum horizontal speed needed (airborne, grind held, moving into the wall) to stick to a wall instead of bonking off it.',
  wallrideMaxAngle:
    'How PARALLEL your approach must be to stick to a wall. This is the biggest angle (in degrees) your flight can be off the wall face — glide in almost parallel (0 = dead parallel) and you catch it; come in too head-on (past this angle) and you bonk off. Ollie into the wall holding Triangle to catch it. Lower = stricter (must be very parallel), higher = catch steeper approaches.',
  wallrideMaxTime: 'Longest a single wallride can last before you automatically drop off.',
  wallKickUp: 'The WALLIE: BASE vertical pop when you ollie off a wallride — what a quick tap-and-release of X gives you.',
  wallPumpBonus:
    'Extra vertical launch at a FULL pump. On the wall, HOLD X to load a spring then RELEASE to leap off — a quick tap gives the base pop (wallKickUp), a full pump adds this whole bonus on top for a big jump.',
  wallChargeMax: 'How long you have to hold (pump) X on the wall to reach a full-power launch. Shorter = the pump maxes out faster.',
  wallKickOut: 'How hard the kick-off shoves you AWAY from the wall (out into the level) when you jump off a wallride.',
  airControl:
    'Forward/back speed adjustment in the air WHILE SKATING (braking against travel bites 2x harder). On-foot air is direct-drive and ignores this.',
  balanceDrift: 'How fast the grind balance needle runs away from center on its own.',
  balanceControl: 'How hard left/right input fights the balance needle.',
  balanceSpeedEffect:
    'Baseline for how much grind speed sways the needle. 0 = speed is ignored; 1 = slow grinds wobble up to 1.5x, fast grinds less; 2 = that effect doubled.',
  balanceGrace:
    'Every grind starts with this many seconds at BASE difficulty — the needle ramp only starts growing after.',
  balanceRamp:
    'After the grace, needle drift grows by this fraction of balanceDrift per second — long grinds get progressively dicier.',
  balanceRampMax:
    'The difficulty ceiling: drift never exceeds this multiple of balanceDrift, so marathon grinds stay hard but never impossible.',
  bailGrace:
    'Rail forgiveness buffer: once the balance needle pegs, you have this many seconds to slam the stick the other way before the bail actually fires. 0 = pegging is instant death for the grind.',
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
  { title: 'WALKING', keys: ['walkSpeed', 'walkRampTime', 'crawlSpeed'] },
  {
    title: 'JUMPS & AIR',
    keys: ['jumpVelocity', 'jumpMinVelocity', 'jumpChargeTime', 'riseGravity', 'fallGravity', 'airControl'],
  },
  {
    title: 'SKATING',
    keys: [
      'maxSpeed',
      'cruiseSpeed',
      'chargeBoost',
      'chargeDecay',
      'friction',
      'turnaround',
      'brakeRampTime',
      'brakeLockTime',
      'brakeLockRamp',
      'boardSpeed',
      'skateHoldTime',
      'skateEntrySpeed',
      'teeterCatchSpeed',
      'carveGrip',
      'carveGripRatio',
      'smashSpeed',
    ],
  },
  {
    title: 'SLOPES & PIPES',
    keys: [
      'downhillMax',
      'slopeBoost',
      'uphillSlowdown',
      'pipePump',
      'pipeGravity',
      'pipeCarve',
      'pipePumpGain',
      'pipeFriction',
      'pipePop',
      'pipeAirGravity',
      'pipeSmooth',
      'footGrip',
      'steepStand',
      'vertLip',
      'hangLaunch',
      'hangSnapAngle',
      'hangLateral',
      'landingFlow',
      'vertGlue',
      'vertDrift',
      'wallStick',
      'landGive',
    ],
  },
  { title: 'SLIDES', keys: ['slideMinSpeed', 'slideDistance', 'slideSpeed', 'slideRecover', 'slideJumpHeight', 'slideJumpTravel', 'slideJumpGrace'] },
  { title: 'WALLRIDE', keys: ['wallrideMinSpeed', 'wallrideMaxAngle', 'wallrideGravity', 'wallrideFriction', 'wallrideMaxTime', 'wallKickUp', 'wallPumpBonus', 'wallChargeMax', 'wallKickOut'] },
  {
    title: 'GRINDS',
    keys: ['railSnapDistance', 'railTripSpeed', 'grindSpeed', 'grindJumpForce', 'balanceDrift', 'balanceControl', 'balanceSpeedEffect', 'balanceGrace', 'balanceRamp', 'balanceRampMax', 'bailGrace'],
  },
  { title: 'TRICKS', keys: ['spinDuration', 'spinAirCorrection', 'grabBoost', 'grabSpinRate', 'grabRelease', 'spinTolerance', 'slamRadius'] },
  { title: 'CRATES', keys: ['crateBounce', 'arrowBounce', 'arrowBoostMult', 'arrowBoostWindow', 'nitroRadius', 'tntRadius'] },
  { title: 'WORLD', keys: ['boulderSpeed', 'renderScale'] },
];

// Fixed authored constants that are part of the feel but stay off the sliders
// to keep the panel focused.
export const CONST = {
  carveBrakeAngle: 2.7, // rad (~155 deg): stick pulled this far from the heading = brake/dismount, not a carve
  fixedStep: 1 / 60, // deterministic chunky update rate
  overspeedDecay: 3, // bleed rate when above maxSpeed on flat ground
  bailDownTime: 1.1, // knocked-down beat after a mask-less bail before getting up
  killY: -48, // fall below this = instant death
  respawnDelay: 0.7, // quick Crash-style respawn
  playerHalf: { x: 0.5, y: 0.46, z: 0.5 }, // capsule-ish AABB: full height 0.92, just shy of one crate (0.96)
  spinReach: 0.8, // extra horizontal hit reach while spinning (arm+board span)
  spinCooldown: 0.15,
  maskInvuln: 1.0, // grace after a mask absorbs a hit or bail
  uberTime: 12, // third mask = Crash-style invincibility for this long
  coyoteTime: 0.28, // ledge-edge grace: you can still jump this long after rolling off
  teeterSpeed: 4, // below this speed, an overhanging edge makes you teeter
  railRideHeight: 0.15, // feet ride this far above the rail line
  railBlockRadius: 0.2, // on-foot rail block/trip: horizontal contact skin around the rail line (added to player half)
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
  ptsSpin: 80, // per 180 degrees of air rotation landed — a rotation is its own trick
  ptsGrabTick: 4, // accrues every quarter second a grab is held (THPS-style)
  ptsCrystal: 500, // the level crystal pickup
  ptsGem: 1000, // all-boxes gem
  ptsGrindBase: 100,
  ptsGrindTick: 6, // accrues every quarter second on the rail (THPS-style)
  ptsWallride: 120, // base for a wallride (shows the plate immediately)
  ptsWallrideTick: 6, // accrues every quarter second on a wallride (THPS-style)
  grabTransition: 0.15, // reach into / out of the grab pose; land mid-motion = bail
  grabGrace: 0.45, // landing this soon after COMPLETING a grab still pays out
  grabSnapRate: 15, // rad/s the rotation eases back on-axis after release
  frontFlip: false, // running-jump somersault animation — OFF for now; re-enable with a better character model
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
  balanceBailSpeedKeep: 0.3, // speed kept after a grind bail
  airBrakeFactor: 2, // holding down in the air brakes this much harder than airControl
  tntFuse: 3, // Crash-style TNT countdown (stomp lights it)
  blastGrow: 0.35, // seconds for the blast sphere to reach full size
  // Steep-ground rules live in TUNING now (footGrip/steepStand/vertLip/
  // landingFlow/wallStick/landGive sliders); only the structural facet
  // threshold stays fixed here.
  steepSnapNormal: 0.85, // below this, ground-follow + landing windows widen for transitions
  renderScale: 0.75, // build default for the internal resolution (live knob: TUNING.renderScale)
};
