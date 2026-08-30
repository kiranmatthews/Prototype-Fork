// All movement in this prototype is authored numbers — there is no physics
// engine anywhere. These values ARE the game feel; everything is exposed on
// sliders in the debug panel (ui.ts) for live tuning.

export const TUNING = {
  maxSpeed: 23, // top skate speed
  walkSpeed: 9, // full on-foot run speed; also the skate/walk boundary
  walkRampTime: 0.75, // seconds for a fresh walk to build from rest to full walkSpeed
  walkSlowdownTime: 0.45, // seconds for released-input foot momentum to coast from full speed to rest (also shapes committed direction changes)
  friction: 7, // bleed on STEEP ground (transitions) — deliberately linear so a sideways crawl on a wall dies and the stall-flip can fire. FLAT roll-out is rollFriction + windDrag.
  // Jump ballistics: the playtested hand-tuned feel. (A Crash-3-matched fit
  // — rise 22 / fall 62 / v 10.4 / min 8.7 — was tried and felt worse in
  // THIS game's speed and level scale; the reference timing already matched.)
  riseGravity: 33, // ON FOOT: gravity while moving up (lighter = floatier jump arc). Platforming only now — a board air flies under the board pair below
  fallGravity: 119, // ON FOOT: gravity while falling (heavier = snappy PS1 landing). Platforming only now — see boardFallGravity
  // BOARD AIR gravity. A skater's air and a platformer's hop were sharing one
  // arc, and the Crash arc won: 119 down against 33 up spikes you back into the
  // floor at nearly terminal velocity, which is the whole reason ollies and
  // kicker launches read as "short". These are the same two numbers for airs
  // that START ON THE BOARD, so the platforming jump can be reworked on its own
  // without retiming every ollie in the game (and vice versa).
  boardRiseGravity: 33, // BOARD: gravity on the way up. Deliberately identical to riseGravity out of the box, so a board air peaks at exactly the height it always did — anything you could clear, you still clear
  boardFallGravity: 70, // BOARD: gravity on the way down (vs 119 on foot). THIS is the one that makes a board air float: same peak, longer glide down, and you land at 18 u/s instead of 24 instead of being spiked. NOTE the reference: THPS/THUG air gravity is a single SYMMETRIC number (Physics_Air_Gravity -1350, no up/down branch), which converts to ~34.5 in our units — so the authentic value here is ~36, one rung heavier than boardRiseGravity, matching the reference's own 1.1x ladder (vert 30 / rise 33 / fall 36). 70 is a deliberately conservative half-step that leaves the authored gaps alone; drag it to 36 for the real THPS arc
  rampFallGravity: 40, // BOARD, RAMP/DOWNHILL LAUNCHES ONLY: fall gravity for an air that left the ground off a ramp, kicker, or sloped face. Near-symmetric with boardRiseGravity (the THPS ballistic arc) so launched airs glide down instead of being spiked — flat-ground ollies keep boardFallGravity and their tuned snap
  boardApexFloat: 0.35, // BOARD: how much gravity is bled out at the very top of the arc, where the trick reads. Buys hang time exactly where you can see it, and barely lengthens a huge kicker air — so authored gaps stay honest. 0 = off, plain two-value gravity
  boardApexBand: 4.5, // BOARD: how wide the float window is, in up/down speed. The float fades in as you slow toward the peak and fades out as you pick up fall speed, so there is no step anywhere in the arc
  jumpVelocity: 14, // fully-charged jump (hold X)
  jumpMinVelocity: 12, // quick-tap jump
  ollieVelocity: 11, // BOARD OLLIE at full charge — the ollie charges on its own min..max scale, decoupled from the on-foot jump (riding the jumpVelocity scale made accelerating ollies moon jumps)
  ollieMinVelocity: 6.5, // quick-tap board ollie. NOTE this no longer clears a crate on its own: measured, a tap now peaks at 0.559 against a 0.96 crate (it was 8.25, tuned to peak at exactly 0.962 for that reason). Clearing a crate on the board is a CHARGED ollie now — hold X and the full pop peaks at 1.679. The ramp climb still stacks on top (see chargedJump), so a lip pays out instead of robbing you
  ollieDownCouple: 0.65, // DOWNHILL OLLIES ONLY: fraction of the slope's descent rate folded back into the pop, so the arc hugs the hill instead of hanging over it. 0 = old floaty behavior, 1 = airtime matches a flat-ground ollie
  jumpChargeTime: 0.4, // hold this long for full power
  flipHoldTime: 0.18, // direction held at least this long AT the jump = forward somersault; steering only after takeoff never rolls
  doubleJump: 1, // 1 = a fresh X press mid-air pops a second, smaller jump (one per air)
  doubleJumpWindow: 0.7, // how LATE into the air the double can still fire (seconds since takeoff)
  doubleJumpVelocity: 11, // vertical speed of the second on-foot pop
  doubleJumpHorizontalScale: 0.55, // traversal retained after the second pop
  chargeBoost: 9, // THE skate acceleration: holding X builds speed toward maxSpeed
  cruiseSpeed: 12, // baseline the board holds on its own while skating (no input)
  chargeDecay: 10, // rate the board eases UP to cruiseSpeed when you're below it. (It no longer bleeds you DOWN to cruise — that was punishing you for steering, and overspeed now goes through the normal friction model.)
  downhillMax: 30.5, // hard ceiling for speed EARNED downhill (charge still tops at maxSpeed)
  vertMax: 32, // speed ceiling on TRANSITIONS. Above downhillMax (30.5) so vert is the FASTEST surface in the game, the way THPS reads — and the ceiling is enforced as a bleed now, not a one-frame chop, so arriving hot keeps its momentum readable
  heavyDrag: 0.005, // quadratic bleed above maxSpeed, every surface: 2.7 u/s^2 at 23, 7.2 at 38, so the top end has texture instead of a linear countdown
  rollFriction: 3.5, // CONSTANT rolling friction: the crisp part of the stop (replaces the old speed-scaled curve that made the last 1 u/s ooze)
  windDrag: 0.0015, // v^2 wind resistance: only bites up top, so you coast a long way fast then stop decisively
  groundGravity: 45, // ONE symmetric slope gravity, all surfaces: climbing decelerates exactly as fast as descending accelerates. Asymmetric ramp physics made every dip-and-rise hand back more than it took, so bowls dispensed free speed and the pump sliders were unreadable
  pipeCarve: 16, // HALFPIPE: speed built per second just by HOLDING a direction (no X) on the transition — carving works the wall for momentum. Scaled by steepness so the flat gives nothing.
  pipePumpGain: 24, // HALFPIPE: EXTRA speed added per second holding X up a wall — the THPS skill loop: a first swing barely clears the lip, each well-timed pump grows the air toward the cap
  pipeFriction: 0.1, // HALFPIPE: tiny speed bleed per second on the transition (keep low; too much and the swing dies at the bottom)
  pipePop: 2.5, // HALFPIPE: extra vertical launch popped over the coping into the hang (the earned climb speed dominates; this is just the over-the-lip garnish)
  pipeAirGravity: 31, // VERT AIR (pipes AND tracked walls): SYMMETRIC gravity above the coping (same up + down) so you drop back at the speed you left — THPS rules. Sitting just under the 33 rise keeps vert a touch floatier than street, which is what THPS's own Vert_Hang stat does; match it to 33 exactly and the branch buys nothing. Lower = floatier hangs.
  pipeSmooth: 25, // per-second easing of the ride plane across segmented transitions
  footGrip: 0.3, // ON FOOT: ground normal.y below this and feet can't grip — you slither down
  steepStand: 0.76, // WITH MOMENTUM: normal.y below this pops the board out to ride the transition
  vertLip: 0.59, // slope (sine along travel) that counts as vert coping at the lip
  hangLaunch: 2.5, // extra UP pop when you release X right at the lip to fly into hang time
  hangSnapAngle: 6, // approach within this many degrees of straight-on snaps to pure vertical hang (no drift)
  hangLateral: 0.8, // beyond that, how much of your off-axis approach speed becomes sideways hang-time drift (gaps)
  landingFlow: 1, // how much fall speed converts into riding speed when you land on a ramp/wall
  vertLaunchConserve: 0.55, // how much of the entry speed a vert launch conserves into vVel (1 = full; an angled carve stops being taxed twice)
  vertGravityBlend: 0.35, // seconds to ease from vert gravity back to street gravity when a tracked wall runs out (0 = the old single-frame 33->119 cliff)
  vertDrift: 4.5, // hang time: stick drift speed ALONG the coping during a vert air
  wallStick: 5, // ground-snap window on steep transitions (how hard the wall holds the board)
  landGive: 0.35, // landing forgiveness on steep faces (vs 0.35 on flat decks)
  railSnapDistance: 2.1, // forgiving radius for Triangle/E grind snap
  grindApproachMargin: 15, // moving catches must be this many degrees away from a perfectly perpendicular rail hit (0 = legacy behavior)
  railTripSpeed: 12.5, // side-on into a rail at/above this speed enters the shared obstacle-wipeout vocabulary; slower, the rail blocks
  grindDrag: 0, // friction a FLAT rail scrubs per second. 0 = a rail holds the speed you brought and only climbs cost you
  railSpeedBoost: 0, // flat speed handed to you on a rail entry. 0 = THPS speed-keep: a grind now KEEPS the speed you carried in (redirected along the rail, whatever the angle), so the rail no longer needs a consolation gift — only DOWNHILL rails add speed (slope gravity works the grind line)
  perfectGrindSpeed: 48, // THE SLIPSTREAM: pop off after riding a rail end to end and you leave at this — well past downhillMax (30.5), so it is comfortably the fastest the board ever goes. It gets its own temporary ceiling while perfectGrindHold runs, so the usual clamps do not eat it
  perfectGrindHold: 3.9, // how long that over-ceiling speed is allowed to survive before the normal downhillMax clamp takes it back (heavyDrag is bleeding it the whole time)
  grindSpeed: 5, // reference speed: you grind at ENTRY speed; slower than this drifts harder
  grindJumpForce: 12.5, // vertical pop when jumping off a rail
  underRailCooldown: 1.5, // seconds between under-rail hang switches (Circle on a rail)
  spinDuration: 0.3,
  spinAirCorrection: 0.5, // small vertical stall from spinning in air (not a rescue)
  turnaround: 35, // PULL-BACK BRAKE: bleed rate when yanking the stick against travel (the dismount)
  brakeRampTime: 0.4, // Circle brake on the board: seconds of HOLDING before the slow-down reaches full force (eases in, so a tap barely bites)
  brakeLockTime: 0.6, // after a brake (Circle or pull-back) stops you, movement stays LOCKED this long (measured from when you release the brake) — no instant reverse-run / insta-crouch
  brakeLockRamp: 0.55, // after the lock, how long walk/crawl movement takes to ease from zero back to full (0 = snap straight to full)
  grabBoost: 2.5, // speed burst on landing a clean Circle/Q air grab
  landPumpBoost: 2.2, // THPS landing pump: X held through touchdown pays this speed burst — re-crouching for every landing is the rhythm that keeps lines fast
  grabSpinRate: 9, // rad/s of the directional grab-spin (~515°/s — 540s reachable on medium airs; the pre-land auto-correct keeps landings clean)
  grabRelease: 0.15, // how long the grab pose takes to return to neutral after letting go of Circle
  spinTolerance: 30, // degrees a landing spin may be off the travel (or 180/switch) line before it's a bail. 30 still leaves 240 of the circle bailing — it's a net under the auto-correct, not a removal
  sketchyTolerance: 55, // degrees off-line before a SKETCHY landing becomes a full bail — between spinTolerance and this you ride away wobbling with a speed tax and half the spin points (THPS's middle tier)
  crateBounce: 14, // vertical pop from stomping a crate — tuned for chaining crate to crate
  crateHopSpeed: 14, // how hard an arrow crate throws a BOX that lands on it (0 = the box just sits there)
  crateHopGravity: 28, // gravity on crate-on-Arrow loops; 14/28 produces the stable ~59-tick cadence
  boardSpeed: 8.5, // speed gate on the transition-carve SFX only — the board VISUAL and the rolling loop follow the skate state, not a speed
  skateHoldTime: 0.55, // X held this long (with a direction) before skate drive engages
  skateEntrySpeed: 5, // must also be moving this fast for the skate transition
  teeterCatchSpeed: 6, // roll off a LETHAL edge slower than this and you teeter at the brink instead of falling
  carveGrip: 135, // omnidirectional skate: heading turn rate toward the stick (deg/s); higher = sideways feels instant
  carveGripRatio: 0.05, // how much grip scales with speed (0 = constant, 1 = same turn radius at any speed)
  slideMinSpeed: 2, // moving at least this fast + Circle = slide (slower + held = crawl)
  slideDistance: 5, // how far the canned slide carries you (world units)
  slideSpeed: 26, // the slide starts at least this fast, then analytically brakes to zero over slideDistance
  slideJumpHeight: 1.3, // Crash slide-jump: jump velocity multiplier when leaping out of a slide
  slideJumpTravel: 0.2, // horizontal launch speed scale out of a slide-jump (independent of height)
  slideJumpGrace: 0.15, // jumps this long AFTER a slide ends still get the slide boost
  slideRecover: 0.5, // get-up beat after a PLAIN slide: movement locked while the skater picks themselves off the ground (stops slide-spam for free speed)
  wallrideGravity: 16, // THPS wallride: gentle sink while riding a wall (vs the board pair 33/70, or 33/119 on foot)
  wallrideFriction: 1, // along-wall speed bleed per second on a wallride
  wallrideMinSpeed: 7.5, // need at least this much horizontal speed (airborne, grind held) to stick to a wall
  wallrideMaxAngle: 76, // max approach angle OFF PARALLEL (deg) to stick — steeper/more head-on and you bonk off
  wallrideMaxTime: 12, // longest a single wallride lasts before you drop off
  wallKickUp: 10.5, // the WALLIE: base vertical pop when you ollie OFF a wallride (a quick tap)
  wallPumpBonus: 17, // extra vertical launch at FULL pump — hold X on the wall, release to spring off big
  wallChargeMax: 1.5, // seconds of pumping X to reach a full-power wall launch
  wallKickOut: 1.5, // push away from the wall when you kick off
  ledgeGrabTime: 6, // seconds you can hang off a ledge before your grip fails
  ledgeClimbTime: 0.38, // seconds the animated clamber-up takes (pull up, then over the lip)
  ledgeClimbPop: 1, // extra lift as you top out of the clamber (0 = plant flat)
  ledgeReach: 1.8, // highest a lip can sit above your feet and still be caught
  airControl: 0, // forward/back speed adjustment in the air
  manualMinSpeed: 3.5, // must be rolling at least this fast to pop (or hold) a manual
  manualDrift: 0.65, // manual balance: how fast the pitch needle runs away
  manualControl: 3.8, // how hard up/down input fights the manual needle
  manualFlickWindow: 0.28, // max seconds between the two stick flicks (up-then-down = manual, down-then-up = nose)
  manualLandGrace: 0.65, // seconds after a clean landing before the combo banks — time to flick into a manual
  manualCoyote: 0.45, // seconds a manual survives with the wheels off the deck (crests, rollers) before it drops
  lipAngle: 10, // LIP TRICK: approach must be within this many degrees of dead-on (90 deg to the coping) — off-axis arrivals grind the coping instead
  lipMaxTime: 12, // longest a lip stall holds before you drop back in
  lipDrift: 0.95, // lip stall balance: how fast the needle runs away on its own
  lipControl: 2.1, // how hard up/down input fights the lip needle
  // (spineDrift is RETIRED — the hold-into-the-lip spine carry walked the
  // glue anchor off the wall and is removed from the code entirely; old
  // saves/replays that still carry the key are ignored. Spine transfers
  // return as a deliberate mechanic in the redesign.)
  balanceDrift: 0.9, // THPS grind balance: how fast the needle runs away
  balanceControl: 2.8, // how hard left/right fights the needle
  grindCalm: 0.45, // entry calm: a full-speed catch steadies the needle for up to this many seconds (momentum plants you; slow creeps get less)
  balanceSpeedEffect: 1.4, // how much grind SPEED sways the needle (0 = none, slow grinds wobble more)
  balanceGrace: 2, // seconds of flat difficulty at the start of every grind
  balanceRamp: 0.25, // per-second drift growth after the grace (longer grind = harder)
  balanceRampMax: 6, // difficulty CEILING: drift never exceeds this multiple of balanceDrift
  bailSpeedKeep: 0.5, // fraction of speed a bail KEEPS — crashing at 23 should carry you further than crashing at a walk (0 = the old dead stop)
  bailFriction: 14, // how fast the downed body scrubs that speed off (2x normal friction)
  bailMashWindow: 0.4, // button-edge accumulator half-life while knocked down
  bailMashGain: 0.2, // knockdown clock speed-up per accumulated edge
  bailMashMax: 1, // cap on that speed-up: 1 = a saturated mash HALVES the lockout (THUG's 1.0-2.0x bash factor)
  bailGrace: 0.15, // pegged-needle beat where slamming the stick back can still save the grind
  // RAGDOLL WIPEOUTS: every knockdown becomes a tumbling body — it bounces off
  // the ground, the limbs windmill, the deck flies off on its own, and the
  // whole thing settles into the existing sprawl + mash-out get-up.
  ragBounce: 0.42, // restitution of a tumbling body: how much of each fall the bounce keeps
  ragSpin: 1, // tumble rotation speed scale (0 = the old rigid sprawl, ~3 = washing machine)
  ragFlail: 1, // limb windmill amplitude while airborne in a wipeout
  wallBailSpeed: 12.5, // frontal skate into a solid at/above this = wipeout (below: a block); shared with the generic obstacle response
  wallBailFrontal: 0.68, // required head-on dot for a solid/rail wipeout; angled scrapes keep sliding
  tripMaxHeight: 1.15, // obstacle height above the feet that selects a forward low-obstacle tumble
  tripLiftBase: 3.8, // base vertical lift for a generic low-obstacle tumble
  tripLiftPerSpeed: 0.16, // extra trip lift per unit of impact speed
  tripLiftMax: 8.5, // vertical-lift ceiling for generic low-obstacle trips
  tripLiftVariation: 0.12, // deterministic +/- variation around generic trip lift
  tripCarryMin: 0.58, // minimum entry-speed fraction carried through a low trip
  tripCarryMax: 0.72, // maximum entry-speed fraction carried through a low trip
  hugeDropDistance: 12, // apex-to-touchdown descent required for a heavy-landing bail
  hugeDropImpact: 20, // minimum velocity into the landing normal for a heavy-landing bail
  crateTripSpeed: 6, // skate into a wood crate at or above this (but below smashSpeed) = trip and tumble OVER it
  // AUTHENTIC THPS/THUG balance dynamics (Neversoft's CManual is an unstable
  // inverted pendulum: needle position + velocity, nudged by taps and noise).
  // Each layer is ADDITIVE — at 0 the meter is exactly the classic first-order
  // needle, so neutral reproduces today; dial up for the real Tony Hawk feel.
  balanceInertia: 0, // needle MOMENTUM: 0 = snappy instant correction, 1 = heavy lag — input feeds velocity so the needle overshoots and you must lead your taps
  balanceGravity: 2, // EDGE CLIFF: extra runaway proportional to how far off-center you are — 0 = flat, higher = calm middle but the edges bolt away (react late = no save)
  balanceNoise: 0.18, // SKETCH: smoothed random wander so the tip direction can't be memorized (rides the same capped ramp as the drift; a committed counter-tap quiets it)
  balanceNoiseFreq: 6, // how fast the sketch sways (rad/s) — low = a lazy roll, high = a nervous jitter
  balanceSafePeriod: 0.15, // entry ease-in: corrective input fades in over this many seconds so an eager first tap can't fling the fresh needle (Neversoft safe_period)
  crawlSpeed: 3.5, // Crash crouch-crawl speed while holding Circle stopped
  smashSpeed: 12.5, // skating/grinding at or above this speed plows straight through plain crates
  arrowBounce: 16, // arrow-crate super bounce launch velocity
  arrowBoostMult: 1.25, // holding X on the Arrow-crate impact tick multiplies the launch
  slamRadius: 3.41526, // pancake slam radius: 1.6x the old 2.7-radius affected area
  nitroRadius: 2.75, // nitro explosion kill/break radius
  tntRadius: 2.75, // TNT explosion kill/break radius
  boulderSpeed: 10, // Boulder Dash: the chase boulder's base roll speed (rubber-bands around it)
  // CAMERA defaults (the long-standing hand-tuned chase framing).
  // camTilt aims AT the character (2.1 ≈ just over her head — this exactly
  // reproduces the old 21° down-pitch); camOffset TRANSLATES the whole rig
  // down-course, so framing moves without the tilt changing. Decoupled knobs.
  camFov: 57, // zoom / focal length: lower = telephoto punch-in, higher = wide angle
  chaseCam: 0, // 1 = third-person follow: camera swings behind the travel direction, skater always faces forward
  camDist: 5.9, // trailing distance behind the character
  camHeight: 5.1, // camera elevation above the character
  camAirLift: 0, // how much the rig rises WITH an airborne jump: 1 = classic full-follow (jumps read small/snappy on screen), 0 = ground-anchored Crash rig (skater does all the rising on screen). Default 0: with the small playtested jump pops the anchored rig reads clean and keeps the landing framed
  camTilt: 2.4, // aim height on the character: higher = camera tilts UP (sees more sky)
  camOffset: 1, // rig translation down-course: + = skater rests LOWER in frame (more road ahead), tilt untouched
  camBalanceRoll: 7, // degrees the horizon rolls with the grind balance needle at a full lean (0 = off)
};

export type TuningKey = keyof typeof TUNING;

// Bump when shipped DEFAULTS change in a way saved snapshots must not mask.
// A saved tuning records the defaults it was taken against; on load, only
// the keys the user actually MOVED off those defaults are re-applied — every
// untouched key follows the new build. (The spineDrift saga: a snapshot from
// an old build silently kept a retired mechanic alive for days.)
export const TUNING_VERSION = 13; // v13: Unity-port feel/collision pass — foot inertia, exact slide, tuned double jump, generic wipeouts, Arrow/crate/Slam updates
// v11: pipePump retired — pipePumpGain superseded it and applies on every transition
// v10: board airs fly under their OWN gravity (boardRise/boardFall + apex float), declared at launch; riseGravity/fallGravity are now on-foot platforming only
// v9: THPS physics pass — ollie stacks the ramp climb (min 8), one symmetric groundGravity replaces slopeBoost/uphillSlowdown/pipeGravity, quadratic heavyDrag + vertMax, rollFriction/windDrag roll-out shape, bail momentum

// Slider metadata for the debug panel.
export const TUNING_RANGES: Record<TuningKey, { min: number; max: number; step: number }> = {
  maxSpeed: { min: 5, max: 60, step: 1 },
  walkSpeed: { min: 6, max: 20, step: 0.5 },
  walkRampTime: { min: 0, max: 2, step: 0.05 },
  walkSlowdownTime: { min: 0, max: 2, step: 0.05 },
  friction: { min: 0, max: 30, step: 0.5 },
  riseGravity: { min: 10, max: 120, step: 1 },
  fallGravity: { min: 10, max: 160, step: 1 },
  // Floor at 30, not 10: pipeAirGravity is 30 and is deliberately the floatiest
  // air in the game (THPS's vert-hang bonus). Let a board slider under it and a
  // street ollie out-floats a vert hang, which inverts the whole contrast.
  boardRiseGravity: { min: 30, max: 120, step: 1 },
  boardFallGravity: { min: 30, max: 160, step: 1 },
  rampFallGravity: { min: 25, max: 160, step: 1 },
  boardApexFloat: { min: 0, max: 0.8, step: 0.05 }, // above ~0.8 the top of the arc stops falling at all
  boardApexBand: { min: 0.5, max: 12, step: 0.5 },
  jumpVelocity: { min: 4, max: 30, step: 0.5 },
  jumpMinVelocity: { min: 6, max: 25, step: 0.5 },
  ollieVelocity: { min: 6, max: 20, step: 0.5 },
  ollieMinVelocity: { min: 6, max: 18, step: 0.5 }, // floor at 6: below this a tap ollie can't clear a crate
  ollieDownCouple: { min: 0, max: 1, step: 0.05 },
  jumpChargeTime: { min: 0.2, max: 1.5, step: 0.05 },
  chargeBoost: { min: 0, max: 40, step: 1 },
  cruiseSpeed: { min: 6, max: 20, step: 0.5 },
  chargeDecay: { min: 0.5, max: 20, step: 0.5 },
  downhillMax: { min: 10, max: 45, step: 0.5 },
  vertMax: { min: 20, max: 50, step: 0.5 },
  heavyDrag: { min: 0, max: 0.02, step: 0.0005 },
  rollFriction: { min: 0, max: 15, step: 0.25 },
  windDrag: { min: 0, max: 0.01, step: 0.0005 },
  groundGravity: { min: 0, max: 90, step: 1 },
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
  vertLaunchConserve: { min: 0, max: 1, step: 0.05 },
  vertGravityBlend: { min: 0, max: 1, step: 0.05 },
  vertDrift: { min: 0, max: 15, step: 0.5 },
  wallStick: { min: 0.8, max: 5, step: 0.1 },
  landGive: { min: 0.35, max: 3, step: 0.05 },
  railSnapDistance: { min: 0.5, max: 8, step: 0.1 },
  grindApproachMargin: { min: 0, max: 90, step: 1 },
  railTripSpeed: { min: 8, max: 30, step: 0.5 },
  railSpeedBoost: { min: 0, max: 10, step: 0.5 },
  grindDrag: { min: 0, max: 4, step: 0.1 },
  perfectGrindSpeed: { min: 23, max: 55, step: 0.5 },
  perfectGrindHold: { min: 0, max: 6, step: 0.1 },
  grindSpeed: { min: 5, max: 50, step: 1 },
  grindJumpForce: { min: 4, max: 30, step: 0.5 },
  underRailCooldown: { min: 0.5, max: 4, step: 0.1 },
  spinDuration: { min: 0.1, max: 1.2, step: 0.05 },
  flipHoldTime: { min: 0, max: 0.6, step: 0.02 },
  doubleJump: { min: 0, max: 1, step: 1 },
  doubleJumpWindow: { min: 0.1, max: 1.5, step: 0.05 },
  doubleJumpVelocity: { min: 4, max: 24, step: 0.5 },
  doubleJumpHorizontalScale: { min: 0, max: 1, step: 0.05 },
  spinAirCorrection: { min: 0, max: 12, step: 0.5 },
  turnaround: { min: 5, max: 300, step: 1 },
  brakeRampTime: { min: 0.1, max: 6, step: 0.05 },
  brakeLockTime: { min: 0, max: 2, step: 0.05 },
  brakeLockRamp: { min: 0, max: 2, step: 0.05 },
  grabBoost: { min: 0, max: 20, step: 0.5 },
  landPumpBoost: { min: 0, max: 8, step: 0.2 },
  grabSpinRate: { min: 3, max: 20, step: 0.5 },
  grabRelease: { min: 0.05, max: 0.6, step: 0.05 },
  spinTolerance: { min: 10, max: 90, step: 5 },
  sketchyTolerance: { min: 20, max: 120, step: 5 },
  crateBounce: { min: 5, max: 30, step: 0.5 },
  crateHopSpeed: { min: 0, max: 26, step: 0.5 },
  crateHopGravity: { min: 5, max: 80, step: 1 },
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
  ledgeGrabTime: { min: 0.4, max: 6, step: 0.1 },
  ledgeClimbTime: { min: 0.15, max: 1.2, step: 0.05 },
  ledgeClimbPop: { min: 0, max: 12, step: 0.5 },
  ledgeReach: { min: 1.4, max: 3.5, step: 0.1 },
  airControl: { min: 0, max: 40, step: 1 },
  manualMinSpeed: { min: 0, max: 15, step: 0.5 },
  manualDrift: { min: 0.2, max: 3, step: 0.05 },
  manualControl: { min: 0.5, max: 8, step: 0.1 },
  manualFlickWindow: { min: 0.1, max: 0.6, step: 0.02 },
  manualLandGrace: { min: 0, max: 1.2, step: 0.05 },
  manualCoyote: { min: 0, max: 0.6, step: 0.05 },
  lipAngle: { min: 5, max: 60, step: 1 },
  lipMaxTime: { min: 0.5, max: 12, step: 0.25 },
  lipDrift: { min: 0.1, max: 3, step: 0.05 },
  lipControl: { min: 0.5, max: 8, step: 0.1 },
  balanceDrift: { min: 0.1, max: 2, step: 0.05 },
  balanceControl: { min: 0.5, max: 6, step: 0.1 },
  grindCalm: { min: 0, max: 1.2, step: 0.05 },
  balanceSpeedEffect: { min: 0, max: 2, step: 0.1 },
  balanceGrace: { min: 0, max: 6, step: 0.25 },
  balanceRamp: { min: 0, max: 1.5, step: 0.05 },
  balanceRampMax: { min: 1, max: 6, step: 0.25 },
  bailSpeedKeep: { min: 0, max: 1, step: 0.05 },
  bailFriction: { min: 0, max: 40, step: 1 },
  bailMashWindow: { min: 0.1, max: 1, step: 0.05 },
  bailMashGain: { min: 0, max: 0.5, step: 0.05 },
  bailMashMax: { min: 0, max: 2, step: 0.1 },
  ragBounce: { min: 0, max: 0.8, step: 0.02 },
  ragSpin: { min: 0, max: 3, step: 0.1 },
  ragFlail: { min: 0, max: 2, step: 0.1 },
  wallBailSpeed: { min: 4, max: 30, step: 0.5 },
  wallBailFrontal: { min: 0.3, max: 1, step: 0.02 },
  tripMaxHeight: { min: 0.35, max: 1.5, step: 0.05 },
  tripLiftBase: { min: 0, max: 12, step: 0.2 },
  tripLiftPerSpeed: { min: 0, max: 0.5, step: 0.01 },
  tripLiftMax: { min: 1, max: 16, step: 0.25 },
  tripLiftVariation: { min: 0, max: 0.5, step: 0.01 },
  tripCarryMin: { min: 0, max: 1, step: 0.02 },
  tripCarryMax: { min: 0, max: 1, step: 0.02 },
  hugeDropDistance: { min: 4, max: 30, step: 0.5 },
  hugeDropImpact: { min: 5, max: 52, step: 1 },
  crateTripSpeed: { min: 1, max: 15, step: 0.5 },
  bailGrace: { min: 0, max: 1.2, step: 0.05 },
  balanceInertia: { min: 0, max: 1, step: 0.05 },
  balanceGravity: { min: 0, max: 6, step: 0.1 },
  balanceNoise: { min: 0, max: 0.6, step: 0.02 },
  balanceNoiseFreq: { min: 0.5, max: 20, step: 0.5 },
  balanceSafePeriod: { min: 0, max: 1.5, step: 0.05 },
  crawlSpeed: { min: 2, max: 10, step: 0.5 },
  smashSpeed: { min: 8, max: 40, step: 0.5 },
  arrowBounce: { min: 10, max: 60, step: 1 },
  arrowBoostMult: { min: 1, max: 2, step: 0.05 },
  slamRadius: { min: 1.5, max: 7, step: 0.1 },
  nitroRadius: { min: 2, max: 12, step: 0.25 },
  tntRadius: { min: 1.5, max: 10, step: 0.25 },
  boulderSpeed: { min: 10, max: 45, step: 1 },
  camFov: { min: 30, max: 100, step: 1 },
  chaseCam: { min: 0, max: 1, step: 1 },
  camDist: { min: 2, max: 14, step: 0.1 },
  camHeight: { min: 0.5, max: 10, step: 0.1 },
  camAirLift: { min: 0, max: 1, step: 0.05 },
  camTilt: { min: -6, max: 10, step: 0.05 },
  camBalanceRoll: { min: 0, max: 25, step: 0.5 },
  camOffset: { min: -8, max: 4, step: 0.25 },
};

// Hover text for the tuning panel: what each slider actually does in play.
export const TUNING_INFO: Record<TuningKey, string> = {
  maxSpeed:
    'Top skate speed from CHARGING. Downhill/pipe riding can exceed it up to the downhillMax slider before bleeding back on the flat.',
  walkSpeed:
    'Full on-foot run speed AND the walk/skate boundary. Fresh input builds toward it through walkRampTime; released input coasts through walkSlowdownTime.',
  walkRampTime:
    'On-foot acceleration time: a fresh direction builds from rest to full walkSpeed over this many seconds. 0 = instant full pace.',
  walkSlowdownTime:
    'On-foot release inertia: time for a full-speed run to coast to a true stop. Committed direction changes use the same envelope to slide physical momentum toward the new intent while the gait and facing lead the turn. 0 = instant stop/turn.',
  friction:
    'Linear speed bleed on STEEP ridden ground — NOT ordinary foot release inertia and NOT the flat skate roll-out. Foot coasting is owned by walkSlowdownTime; flat board roll-out is rollFriction + windDrag.',
  riseGravity:
    'ON FOOT ONLY: gravity on the way UP in a platforming jump. Lower = floatier. Airs that start on the board ignore this and use boardRiseGravity, so you can retune the Crash jump without touching a single ollie.',
  fallGravity:
    'ON FOOT ONLY: gravity on the way DOWN in a platforming jump. Higher = snappier PS1 landings. Board airs use boardFallGravity instead.',
  boardRiseGravity:
    'BOARD AIRS: gravity on the way UP out of an ollie, a kicker, a rail or a wall. Ships identical to the on-foot number on purpose — a board air peaks exactly as high as it always did, so nothing you used to clear becomes unclearable. Lower it for a floatier, higher pop.',
  boardFallGravity:
    'BOARD AIRS: gravity on the way DOWN — the knob that actually makes the board float. On foot the fall is 3.6x heavier than the rise (a deliberate PS1 snap); on the board that same slam is what made ollies and ramp launches feel short and punishing. Lower = longer glide down and a softer landing; raise it back toward the on-foot number for the old spiked arc. THPS itself uses ONE symmetric gravity up and down, which converts to about 36 in our units — try 36 for the authentic arc where you land at the speed you launched. Expect every gap to get noticeably easier at that setting.',
  rampFallGravity:
    'RAMP AND DOWNHILL LAUNCHES ONLY: fall gravity for a board air that left the ground off a ramp, kicker, or sloped face — the airs that should fly ballistic, THPS-style. Near boardRiseGravity = you glide down at the speed you launched; flat-ground ollies are untouched (they keep boardFallGravity and the tuned snap).',
  boardApexFloat:
    'BOARD AIRS: bleeds gravity out of the moment at the TOP of the arc, where the trick actually reads, then hands it straight back as you fall. This buys hang time you can see without stretching the whole jump — a little ollie gains proportionally much more than a huge kicker air does, which is what keeps authored gaps from turning trivial. 0 = off.',
  boardApexBand:
    'How wide the apex float window is, measured in up/down speed. Small = a brief kiss of float right at the peak; large = the whole top of the arc hangs. The float eases in and out across this band, so there is never a step in the arc.',
  jumpVelocity: 'Launch speed of a FULLY charged jump (X held for jumpChargeTime).',
  jumpMinVelocity: 'Launch speed of a quick X tap — the smallest hop.',
  ollieVelocity:
    'BOARD OLLIE at FULL charge. Skate jumps charge on their own min..max scale (ollieMinVelocity up to this), decoupled from the on-foot jump — because X doubles as the accelerator, an ollie released out of a long speed-pump lands here at the top of the scale. On-foot jumps keep their own jumpMinVelocity..jumpVelocity scale; vert/pipe ollies keep their earned climb.',
  ollieMinVelocity:
    'BOARD OLLIE from a quick tap — the small pop for real-play ollies where you cruise on direction keys (after pumping speed with X) and just flick X. Holding X longer charges the ollie up toward ollieVelocity.',
  ollieDownCouple:
    'DOWNHILL SKATE OLLIES ONLY. Ollieing on a descending road, the ground falls away under the arc — a flat pop up there buys near-double the airtime and feels floaty. This folds a fraction of the descent rate (slope times speed) back into the pop so the arc follows the hill down. 0 keeps the old float; 1 makes downhill airtime match flat ground. Uphill ollies, kickers, and vert launches are untouched.',
  jumpChargeTime: 'How long X must be held for a full-power jump; charge scales linearly up to it.',
  flipHoldTime:
    'The roll-jump gate: a direction held at least this long GOING INTO an on-foot jump triggers the forward somersault (Crash rules). Jumping neutral and only steering mid-air never rolls. 0 = every moving jump rolls; raise it to demand a longer committed run-up.',
  doubleJump:
    'DOUBLE JUMP: a fresh X press mid-air pops a second, smaller jump (quick-tap height) — one per air, re-armed by any ground or rail contact. Hangs, slams, and grabs own their airs and never double-jump.',
  doubleJumpWindow:
    'How LATE into the air the double jump can still fire — seconds since takeoff for a FULL-CHARGE jump. The window scales with each air\'s launch power: bigger pops (arrow crates, crate bounces) earn proportionally more time, quick taps less, and a plain walk-off fall keeps the base value so ledge saves still work. Short = a right-after-takeoff skill window; long = last-moment saves.',
  doubleJumpVelocity:
    'Vertical launch speed of the second on-foot jump. It replaces the current rise speed and cancels any running somersault.',
  doubleJumpHorizontalScale:
    'Fraction of on-foot horizontal traversal retained after a double jump. 0 stops horizontal travel; 1 keeps the original air movement.',
  chargeBoost:
    'THE skate accelerator: holding X builds speed toward maxSpeed at this rate. Also how fast you dig out of a stop.',
  cruiseSpeed:
    'Baseline skate speed: the board holds this on its own, no input needed. The ladder: cruiseSpeed -> hold X toward maxSpeed -> release decays back at chargeDecay -> downhill/pipes exceed everything up to downhillMax.',
  chargeDecay:
    'The PICK-UP rate only: how fast the board eases UP to cruiseSpeed when you are below it — coasting back up to cruise, or recovering after a hill scrubbed you. It no longer drags you DOWN to cruise from above. Bleeding at this rate while you held a direction was HARSHER than letting go of the stick entirely, so steering was punished and holding X forever was the only way to keep a hard-won hill; overspeed now goes through the normal friction model whether you steer or coast.',
  downhillMax:
    'Hard ceiling for speed EARNED from downhill and pipe riding. Charging alone still tops out at maxSpeed; slopes carry you up to this, and the excess bleeds off on the flat.',
  vertMax:
    'Speed ceiling on TRANSITIONS (bowls, banks, pipe walls). Ships ABOVE downhillMax now, so vert is where the big speed lives — the THPS hierarchy — and the ceiling is enforced as a quick BLEED rather than a one-frame chop, so carrying downhill speed onto a bank no longer hitches. Above maxSpeed the quadratic drag is always pulling back regardless.',
  heavyDrag:
    'Quadratic bleed applied whenever you are above maxSpeed, on EVERY surface. Higher = the top of the speed range gets a harder wall to press against. (The old flat bleed only fired on level ground, so earned speed was immortal on a hill and then vanished the instant it flattened.)',
  rollFriction:
    'Constant rolling friction on the roll-out — the part that makes the board STOP instead of oozing through the last unit of speed.',
  windDrag:
    'v-squared wind resistance on the roll-out: near-nothing at walking pace, real up top. Together with rollFriction: coast a long way fast, then settle decisively.',
  groundGravity:
    'ONE symmetric slope gravity for every surface — a climb decelerates exactly as hard as a descent accelerates, so a bowl conserves energy instead of manufacturing it. This is what makes PUMPING the way you gain speed rather than just riding geometry. Higher = hills bite harder both ways.',
  pipeCarve:
    'HALFPIPE carve: momentum built just by HOLDING a direction on the transition — no X needed. This is the "carving pumps you" feel; higher = holding toward the wall drives you up harder and builds speed faster. Scaled by wall steepness, so the flat bottom gives no free speed.',
  pipePumpGain:
    'HALFPIPE pump: speed per second added while holding X on a wall — the skill move that builds height over successive swings and carries you to the coping. 0 = carve + momentum only (you session the walls but never quite launch).',
  pipeFriction:
    'HALFPIPE speed bleed per second on the transition. Keep this LOW — too much and the swing dies at the bottom instead of carrying your speed wall to wall.',
  pipePop:
    'HALFPIPE: extra vertical launch popped over the coping — an ollie-out into hang time on top of the speed you carried up. Bigger = higher airs off the lip.',
  pipeAirGravity:
    'VERT AIR gravity above the coping — halfpipes AND tracked vert walls (bowls, banked walls). SYMMETRIC (same rising and falling) so you drop back in at the speed you launched — no asymmetric-fall surge that pings you across the pipe on landing. Sits just under boardRiseGravity (31 vs 33) so vert hangs read a touch floatier than street airs. Lower = floatier, longer hang.',
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
    'Once your approach is past hangSnapAngle, how much of that off-axis speed becomes SIDEWAYS hang-time drift. THPS rules: the drift is CONSERVED — air has no friction, so what you launch with is what you land with, and a hard angled carve genuinely flies you down the pipe. (The old capped-and-damped behaviour is gone: hangLatMax is effectively uncapped and there is no damping term. Out-running the pipe is the hang-end bail\'s job, not a clamp\'s.) Test: hit the lip at an angle, raise it, you travel further down the coping before coming down.',
  landingFlow:
    'How much of your FALL speed becomes riding speed when you land on a ramp or wall (0 = dead stop like before, 1 = keep it all). This is what makes dropping in from hang time flow instead of stalling. Test: drop into a pipe, raise it, you rocket out the far wall.',
  vertLaunchConserve:
    'How much of the speed you carried into a vert launch is conserved as HEIGHT. An angled carve up a wall used to be taxed twice — once for going off-axis, again because the shallower angle shrank the vertical term. 1 = fully conserved (head-on is unchanged either way).',
  vertGravityBlend:
    'How long vert gravity eases back to normal gravity when a tracked wall runs out from under a hang. It eases into whichever pair THAT air was launched under — the board pair for a board air, the on-foot pair for a platforming one — so how big the step is depends on how you got there. 0 = the change lands in a single frame, a visible hitch mid-arc.',
  vertDrift:
    'During a NON-PIPE vert crest the stick moves you along the lip at this speed. Pipe hangs ignore it — there the stick spins you (left/right, any wall) and never translates you: locked-in vert.',
  wallStick: 'Ground-snap window on steep transitions — how hard the wall holds the board through fast climbs.',
  landGive:
    'Landing forgiveness on steep transition faces. Flat decks ignore this and always use a fixed strict window. A HALFPIPE wall also enforces a deep floor of its own however low you set this — its face is near-vertical at the coping, so a fast drifting descent has to LAND on it rather than punch through into the pit below.',
  railSnapDistance:
    'How close (in units) a rail must be for Triangle to snap you onto it. Bigger = more forgiving grind grabs.',
  grindApproachMargin:
    'Moving grind-catch safety margin in degrees away from a perfectly PERPENDICULAR rail hit. The default 15° rejects near-square catches while preserving broad angled approaches; the exact boundary catches. 0° restores the old behavior, including fully perpendicular catches. A stationary eligible catch has no approach angle and remains valid.',
  railTripSpeed:
    'Running/skating STRAIGHT INTO a rail from the side (no jump, no grind): below this speed the rail simply BLOCKS you like a curb; at or above it you catch the rail and TRIP (bail/stumble). Jump over it or grind it to pass cleanly.',
  grindDrag:
    'Friction a FLAT rail scrubs off per second. 0 (default) = a rail HOLDS the speed you brought it, and only a climb costs you — the slope works the grind line either way, so downhill rails still feed speed. Dial it up to make long grinds a speed decision again; a crosswise slide scrubs the full amount, a crooked grind about half, a nosegrind least.',
  railSpeedBoost:
    'EXTRA flat speed granted on top when you land a grind. Grinds now KEEP the speed you carried in (THPS speed-keep — redirected along the rail whatever the angle you hit it at), so this ships at 0: slow entry = slow grind, fast entry = fast grind, and only DOWNHILL rails add speed. Raise it if you want every rail to be a gear change again.',
  perfectGrindSpeed:
    'THE SLIPSTREAM only. Ride a rail its WHOLE length — on at one end, off at the other, no bail — and you leave the rail at this speed. It sits above downhillMax on purpose: a perfect grind is meant to be the fastest the board ever moves, so the level built around one long rail line rewards committing to it.',
  perfectGrindHold:
    'How long a perfect-grind launch is allowed to stay above the normal downhillMax ceiling. The quadratic heavyDrag is pulling it down the whole time; when this runs out the usual clamp takes back whatever is left.',
  grindSpeed:
    'REFERENCE grind speed: you actually grind at whatever speed you arrive with, but slower than this wobbles the balance meter harder and faster than it steadies it.',
  grindJumpForce: 'Vertical pop of a fully-charged jump off a rail.',
  underRailCooldown: 'Cooldown between Circle switches on a rail (grind top <-> hanging underneath).',
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
  landPumpBoost:
    'THPS landing pump: touch down on the board with X already held (crouched landing) and you get this speed burst. Re-crouching through every landing is the rhythm that keeps a line fast. 0 = off.',
  grabSpinRate: 'Rotation speed of the directional grab-spin (left arrow = spin left).',
  grabRelease:
    'How long the grab pose takes to animate back to neutral after RELEASING Circle. Land any time before it finishes (or while still holding) = bail; pose back at neutral = clean, spin permitting.',
  bailSpeedKeep:
    'How much speed survives a wipeout. A bail used to zero your momentum, so a 23 u/s crash and a walking-pace crash were the same event; now you slide out of it in proportion to how fast you were going. 0 = the old dead stop.',
  bailFriction:
    'How fast the physical tumble scrubs retained crash speed and how firmly the procedural roll-up blends its run-out velocity toward held movement input. Higher = shorter slide and snappier recovery steering.',
  bailMashWindow:
    'How long a mashed button keeps counting toward getting up. Shorter = you must mash faster to hold the bonus.',
  bailMashGain: 'How much each mashed button speeds up the knockdown clock and procedural roll-up together.',
  bailMashMax:
    'Ceiling on the mash speed-up. 1 = a saturated mash plays the tumble/recovery clock at up to 2x; 0 = mashing does nothing.',
  spinTolerance:
    'Landing with your grab-spin more than this many degrees off the travel line = you landed funny: bail. Landing within it of the 180 line is CLEAN — you ride away in switch stance.',
  sketchyTolerance:
    'The SKETCHY net under spinTolerance: land off-line beyond spinTolerance but inside this and you keep it — with a wobble, a speed tax, and half the spin points. Past this = the full bail. Must be above spinTolerance to matter.',
  crateBounce: 'Vertical pop from stomping a crate — tune so crate-to-crate chains feel right.',
  crateHopSpeed:
    'How hard an Arrow crate throws a BOX that lands on it. The fixed launch is re-applied on every contact, so the hop never decays. The shipped 14 launch with 28 gravity produces a stable roughly 59-tick cadence. 0 parks the box on the pad.',
  crateHopGravity:
    'Gravity used only by crates falling and bouncing in stacks. Together with crateHopSpeed it owns the height and rhythm of a crate-on-Arrow loop; 28 with launch 14 is the authored stable cadence.',
  boardSpeed:
    'Speed gate on the transition-carve sound effect. It NO LONGER controls whether the board is drawn or whether the wheels roll — both of those follow the skate state (freeSkate), so the deck is out exactly when you are skating and stowed exactly when you are not. The walk/skate physics boundary is walkSpeed.',
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
    'Exact authored slide travel in world units. The slide analytically brakes from its entry speed to a genuine stop across this distance.',
  slideSpeed:
    'Minimum entry speed of the slide. It never slows a faster entry, then analytically brakes to zero over slideDistance.',
  slideJumpHeight:
    'Crash slide-jump: a fresh X press+release during a slide leaps THIS much higher than a normal jump. It is a PLATFORMING move — always lands back on your feet, never flips out the board into skating.',
  slideJumpTravel:
    'Extra horizontal reach of a slide-jump, as a multiple of WALK speed OVER a normal jump (0.95 = launches ~1.95x walk speed). The launch is a fixed punch regardless of how fast the slide was, so the gap-clearing distance stays predictable — it is not a speed carry.',
  slideJumpGrace:
    'Timing forgiveness: releasing the jump within this many seconds AFTER the slide ends still fires the boosted slide jump (0 = strict, boost only mid-slide).',
  slideRecover:
    'Get-up beat after a PLAIN slide: for this long the skater is picking themselves off the ground and CANNOT run — movement input is dead and leftover speed bleeds to a stop, then control returns. Stops slide-spam for constant free speed. A slide JUMP is exempt (it launches straight out of the slide).',
  wallrideGravity:
    'THPS wallride sink rate: jump into a wall while HOLDING GRIND (E) and you ride along its face. This is the gentle gravity while stuck to the wall (0 = ride dead level, higher = sink faster). A board air is 33 up / 70 down for reference, and a platforming jump is 33 up / 119 down.',
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
  ledgeGrabTime: 'How long you can hang off a grabbed ledge before your grip gives out and you drop. Longer = more time to decide climb up vs hop down.',
  ledgeClimbTime: 'How long the animated clamber-up takes — she pulls up the face, then over the lip. Shorter = snappier parkour; longer = a deliberate heave.',
  ledgeClimbPop: 'Extra lift as you top out of the clamber. 0 plants you flat on the landing; higher adds a springy finishing hop.',
  ledgeReach: 'The highest a ledge lip can sit above your feet and still be caught. Higher = you snag taller edges; lower = only chest-high lips grab.',
  airControl:
    'Forward/back speed adjustment in the air WHILE SKATING (braking against travel bites 2x harder). On-foot air is direct-drive and ignores this.',
  manualMinSpeed:
    'Minimum rolling speed to pop a manual (flick the stick up-then-down) or nose manual (down-then-up), and the speed a held manual drops out at.',
  manualDrift: 'How fast the manual balance needle runs away on its own (fought with up/down on the stick). Pegging it = bail.',
  manualControl: 'How hard up/down input fights the manual needle.',
  manualLandGrace:
    'Seconds after a clean landing before the combo banks. Flick a manual (or catch a rail) inside this window and the string stays alive.',
  manualCoyote:
    'Seconds a live manual keeps balancing with the wheels briefly off the deck — carries it over crests and rollers instead of dropping. The needle freezes while airborne.',
  manualFlickWindow:
    'Max time between the two stick flicks that pop a manual. Finish the flick mid-air (within a beat of touchdown) and you LAND INTO the manual — the combo stays alive.',
  lipAngle:
    'LIP TRICKS: reach the top of the pipe within this many degrees of DEAD-ON (square to the coping) with Triangle down and you stall on the lip — any speed, press it on the climb or around the lip. Arrive more off-axis than this and Triangle grinds the coping instead. Once stalled you can let go of Triangle: balance alone holds the trick.',
  lipMaxTime: 'Longest a lip stall holds before it auto-drops back into the pipe (keeping the trick).',
  lipDrift:
    'How fast the lip stall balance needle runs away on its own. The meter + stick axis auto-align with the CAMERA: when tipping reads left/right on screen you fight with left/right (horizontal bar); when it reads toward/away you fight with up/down (vertical bar). Tip INTO the pipe = drop back in keeping the trick; tip out the BACK = bail onto the deck. Ollie out any time.',
  lipControl: 'How hard stick input fights the lip stall needle (along whichever screen axis the meter shows).',
  balanceDrift: 'How fast the grind balance needle runs away from center on its own.',
  balanceControl: 'How hard left/right input fights the balance needle.',
  grindCalm:
    'Momentum steadies the catch: landing on a rail at speed keeps the needle quiet for up to this many seconds (scaled by how fast you got on — slow creeps get a shorter beat). The direction you were still holding at the catch never shoves the needle; let go once and left/right fight as normal. 0 = off.',
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
  balanceInertia:
    'AUTHENTIC THPS momentum. 0 = the classic snappy needle (corrections are instant). Higher makes the needle carry velocity — input accelerates it instead of moving it directly, so it overshoots center and you must feather taps and lead the drift, the real Tony Hawk slosh. Applies to grinds, manuals AND lip stalls.',
  balanceGravity:
    'The inverted-pendulum edge cliff. 0 = the needle runs away at the same rate everywhere (classic). Higher keeps the CENTER calm and makes the EDGES bolt away — drift too far and no counter-tap saves it, so you fight to stay near the middle. Shares the grind/manual/lip drift scaling (speed, style, ramp).',
  balanceNoise:
    "The 'sketch'. 0 = a perfectly predictable needle. Above 0 adds a smoothed random wander so which way you start tipping is never the same twice (a committed counter-tap quiets it). Amplitude rides the same capped ramp as the drift, so long tricks fluctuate wilder but stay bounded.",
  balanceNoiseFreq:
    'How fast the sketch wander sways, in radians/sec (~6 ≈ a one-second sway). Low = a slow lazy roll that is easy to read; high = a nervous jitter. Does nothing while Balance Noise is 0.',
  balanceSafePeriod:
    "Entry ease-in (Neversoft's safe_period). 0 = full corrective authority the instant a trick starts. Above 0, inward (toward-center) taps fade in over this many seconds so an over-eager first tap can't fling the fresh needle straight off; pushing further OUT always keeps full authority.",
  ragBounce:
    'Wipeout restitution: how much of each fall a tumbling body keeps when it hits the ground. 0 = flops dead on first contact (the old bail); higher = bouncier, more chaotic crashes.',
  ragSpin:
    'How fast a wiped-out body cartwheels/pitches while airborne. 0 = the old rigid sprawl with no rotation; around 1 reads like THPS; 3 = washing machine.',
  ragFlail:
    'Limb windmill amplitude while a wipeout is airborne. The arms and legs thrash between bounces and settle once the body is sliding.',
  wallBailSpeed:
    'Minimum board speed for a sufficiently frontal wall, balustrade, or other solid impact to enter the generic wipeout response. Below it, the obstacle blocks without a bail.',
  wallBailFrontal:
    'Required head-on approach dot for a solid or rail impact to become a wipeout. Higher demands a squarer hit; angled scrapes keep sliding.',
  tripMaxHeight:
    'Maximum obstacle height above the feet that selects the forward fold-over low-obstacle tumble instead of a backward wall rebound.',
  tripLiftBase: 'Base vertical lift for every generic low-obstacle ragdoll trip.',
  tripLiftPerSpeed: 'Additional low-obstacle lift contributed by impact speed.',
  tripLiftMax: 'Maximum vertical lift for a generic fold-over ragdoll response.',
  tripLiftVariation: 'Deterministic per-impact variation around low-obstacle lift.',
  tripCarryMin: 'Minimum fraction of entry momentum carried through a generic forward trip.',
  tripCarryMax: 'Maximum fraction of entry momentum carried through a generic forward trip.',
  hugeDropDistance:
    'Apex-to-touchdown descent required before a heavy landing can trigger a bail.',
  hugeDropImpact:
    'Minimum velocity into the landing surface for a huge-drop bail. A fast but well-aligned transition landing remains safe.',
  crateTripSpeed:
    'Skate into a plain wood crate or checkpoint at or above this (but below smashSpeed, which plows through) and you trip OVER the box and tumble down the far side. Below it, the crate is a wall.',
  crawlSpeed: 'Movement speed of the all-fours Circle-crawl.',
  smashSpeed:
    'Skating or grinding at or above this speed plows straight through plain wooden crates and checkpoints (TNT and nitro stay dangerous). Below it, a crate is a wall.',
  arrowBounce:
    'Launch velocity of the yellow arrow-crate super bounce. Compare it against the crateBounce slider, which is what a plain crate stomp gives you.',
  arrowBoostMult:
    'PERFECT BOUNCE: hold X on the exact Arrow-crate impact tick and the launch is multiplied by this (1 = feature off).',
  slamRadius:
    'Pancake slam blast radius. Its shock travels up to 3 units downward through metal support stacks, with only 0.6 upward allowance.',
  nitroRadius: 'Nitro explosion radius — everything (including you, unmasked) within it when a nitro pops.',
  tntRadius: 'TNT explosion radius once the 3-2-1 fuse runs out (or it is spun/slammed).',
  boulderSpeed:
    'Boulder Dash chase speed. The boulder rubber-bands around this base — faster when it has passed you or lags too far, a touch slower when right on your heels. Higher = a tighter, scarier chase.',
  camFov:
    'ZOOM (focal length): the camera lens angle. Lower = telephoto punch-in (tighter, flatter, more cinematic); higher = wide angle (more of the world, more distortion). Side-scroll zones and the boulder chase still add their own push.',
  camTilt:
    'TILT: the height on the character the camera aims at — around 2.1 is just over her head, so the current 2.4 aims slightly above it. Higher tilts the view UP toward the horizon/sky; lower buries it into the ground. Pure angle — the framing position knob is camOffset.',
  camDist: 'DISTANCE: how far the camera trails behind the character. Side-scroll zones scale with it.',
  camBalanceRoll:
    'How far the horizon ROLLS with the grind balance needle, in degrees at a full lean. The shot leans the way you are falling off the rail, so a grind you are losing reads in the frame itself and not only in the meter. 0 turns it off.',
  camOffset:
    'OFFSET: slides the WHOLE rig (camera + aim together) down-course — moves where the skater rests in the frame WITHOUT changing the tilt. Positive = she sits lower in frame with more road ahead; negative = she rides higher/closer.',
  camHeight: 'ELEVATION: how high above the character the camera rides. Higher = more top-down.',
  camAirLift:
    'AIR LIFT: how much the camera rises WITH you during a jump. 1 = full follow — the rig tracks your height, so jumps read small and snappy on screen (the classic feel). 0 = ground-anchored — the camera holds at floor level and the skater does ALL the on-screen rising: the exact same jump arc reads much bigger and floatier, but your landing spot stays perfectly in shot. Values between blend the two.',
  chaseCam:
    'CHASE CAM (0 = off, 1 = on): third-person follow — the camera swings around behind wherever you travel, so the skater always faces forward and stick-up is always "onward". Overrides the fixed corridor framing, drawn camera lanes, and corner zones while on; the boulder chase keeps its authored shot. All the other CAMERA sliders still shape the rig.',
};

// Debug-panel layout: sliders grouped under labelled sections, in this order.
// Every TuningKey should appear exactly once; anything missed lands in OTHER.
export const TUNING_SECTIONS: { title: string; keys: TuningKey[] }[] = [
  { title: 'WALKING', keys: ['walkSpeed', 'walkRampTime', 'walkSlowdownTime', 'crawlSpeed'] },
  {
    title: 'JUMPS & AIR',
    keys: ['jumpVelocity', 'jumpMinVelocity', 'ollieVelocity', 'ollieMinVelocity', 'ollieDownCouple', 'jumpChargeTime', 'flipHoldTime', 'doubleJump', 'doubleJumpWindow', 'doubleJumpVelocity', 'doubleJumpHorizontalScale', 'riseGravity', 'fallGravity', 'boardRiseGravity', 'boardFallGravity', 'rampFallGravity', 'boardApexFloat', 'boardApexBand', 'airControl'],
  },
  {
    title: 'SKATING',
    keys: [
      'maxSpeed',
      'cruiseSpeed',
      'chargeBoost',
      'chargeDecay',
      'friction',
      'rollFriction',
      'windDrag',
      'heavyDrag',
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
      'groundGravity',
      'vertMax',
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
      'vertLaunchConserve',
      'vertGravityBlend',
      'vertDrift',
      'wallStick',
      'landGive',
    ],
  },
  { title: 'SLIDES', keys: ['slideMinSpeed', 'slideDistance', 'slideSpeed', 'slideRecover', 'slideJumpHeight', 'slideJumpTravel', 'slideJumpGrace'] },
  { title: 'WALLRIDE', keys: ['wallrideMinSpeed', 'wallrideMaxAngle', 'wallrideGravity', 'wallrideFriction', 'wallrideMaxTime', 'wallKickUp', 'wallPumpBonus', 'wallChargeMax', 'wallKickOut'] },
  { title: 'LEDGE GRAB', keys: ['ledgeGrabTime', 'ledgeClimbTime', 'ledgeClimbPop', 'ledgeReach'] },
  {
    title: 'GRINDS',
    keys: ['railSnapDistance', 'grindApproachMargin', 'railTripSpeed', 'railSpeedBoost', 'grindDrag', 'perfectGrindSpeed', 'perfectGrindHold', 'grindSpeed', 'grindJumpForce', 'underRailCooldown', 'balanceDrift', 'balanceControl', 'grindCalm', 'balanceSpeedEffect', 'balanceGrace', 'balanceRamp', 'balanceRampMax', 'bailGrace', 'balanceInertia', 'balanceGravity', 'balanceNoise', 'balanceNoiseFreq', 'balanceSafePeriod'],
  },
  {
    title: 'MANUAL & LIP',
    keys: ['manualMinSpeed', 'manualDrift', 'manualControl', 'manualFlickWindow', 'manualLandGrace', 'manualCoyote', 'lipAngle', 'lipMaxTime', 'lipDrift', 'lipControl'],
  },
  { title: 'TRICKS', keys: ['spinDuration', 'spinAirCorrection', 'grabBoost', 'landPumpBoost', 'grabSpinRate', 'grabRelease', 'spinTolerance', 'sketchyTolerance', 'slamRadius', 'bailSpeedKeep', 'bailFriction', 'bailMashWindow', 'bailMashGain', 'bailMashMax'] },
  {
    title: 'WIPEOUTS',
    keys: [
      'ragBounce', 'ragSpin', 'ragFlail', 'crateTripSpeed',
      'hugeDropDistance', 'hugeDropImpact',
      'wallBailSpeed', 'wallBailFrontal', 'tripMaxHeight',
      'tripLiftBase', 'tripLiftPerSpeed', 'tripLiftMax', 'tripLiftVariation',
      'tripCarryMin', 'tripCarryMax',
    ],
  },
  { title: 'CRATES', keys: ['crateBounce', 'crateHopSpeed', 'crateHopGravity', 'arrowBounce', 'arrowBoostMult', 'nitroRadius', 'tntRadius'] },
  { title: 'CAMERA', keys: ['chaseCam', 'camFov', 'camTilt', 'camDist', 'camOffset', 'camHeight', 'camAirLift', 'camBalanceRoll'] },
  { title: 'WORLD', keys: ['boulderSpeed'] },
];

// Fixed authored constants that are part of the feel but stay off the sliders
// to keep the panel focused.
export const CONST = {
  carveBrakeAngle: 2.7, // rad (~155 deg): stick pulled this far from the heading = brake/dismount, not a carve
  fixedStep: 1 / 60, // deterministic chunky update rate
  bailDownTime: 1.1, // knocked-down beat after a mask-less bail before getting up
  respawnDelay: 0.7, // quick Crash-style respawn
  playerHalf: { x: 0.5, y: 0.46, z: 0.5 }, // capsule-ish AABB: full height 0.92, just shy of one crate (0.96)
  spinReach: 0.8, // extra horizontal hit reach while spinning (arm+board span)
  spinCooldown: 0.15,
  maskInvuln: 1.15, // grace after a mask absorbs a hit or bail — must OUTLAST bailDownTime (1.1), or the last beat of a now-MOVING downed body is unprotected and can slide into a nitro
  uberTime: 12, // third mask = Crash-style invincibility for this long
  coyoteTime: 0.28, // ledge-edge grace: you can still jump this long after rolling off
  teeterSpeed: 4, // below this speed, an overhanging edge makes you teeter
  railRideHeight: 0.15, // feet ride this far above the rail line
  railBlockRadius: 0.2, // on-foot rail block/trip: horizontal contact skin around the rail line (added to player half)
  railSnapEase: 0.12, // seconds to glide onto a grabbed rail (no one-frame zap)
  regrindCooldown: 0.3, // stops instant re-snap right after leaving a rail
  grindMinSpeed: 3.5, // slowest a grind can crawl (and the floor for grindDrag). Dropped from 8 with THPS speed-keep: a deliberate slow creep onto a rail is a slow, deliberate grind now, not a free 8 u/s dispenser
  comboWindow: 0.15, // near-zero: combos live in the air/on rails, not on the ground
  // Base point values — combo total = sum of bases x number of actions.
  ptsCrate: 25,
  ptsFruit: 10,
  ptsEnemy: 100,
  ptsBouncy: 25,
  ptsSlide: 30,
  ptsSlam: 75,
  ptsRopeSwing: 60, // leaping off a swing rope
  ptsGrab: 150,
  vertSpinMin: 2, // halves needed to SCORE a spin out of a pipe hang (2 = a full 360; a vert 180 is too easy to be worth points)
  ptsSpin: 80, // per 180 degrees of air rotation landed — a rotation is its own trick
  ptsGrabTick: 4, // accrues every quarter second a grab is held (THPS-style)
  ptsCrystal: 500, // the level crystal pickup
  ptsGem: 1000, // all-boxes gem
  ptsGrindBase: 100,
  ptsGrindTick: 6, // accrues every quarter second on the rail (THPS-style)
  ptsWallride: 120, // base for a wallride (shows the plate immediately)
  ptsWallrideTick: 6, // accrues every quarter second on a wallride (THPS-style)
  ptsManualBase: 100, // popping a manual / nose manual
  ptsManualTick: 5, // accrues every quarter second balanced on two wheels
  ptsLip: 125, // catching a lip stall on the coping
  ptsLipTick: 6, // accrues every quarter second stalled on the lip
  ptsSpine: 250, // spine transfer: carried over the ridge, landed the far side
  repeatDecay: [1, 0.75, 0.5, 0.25], // THPS4/THUG: the Nth use of the SAME trick in one combo pays this share of its base (last entry is the floor). World rewards — crates, fruit, enemies — never decay
  flipTime: 0.42, // how long a flip trick takes the deck to complete — finish it in the air or the landing goes sketchy and pays nothing
  ptsFlip: 110, // base for a flip trick (kickflip family), scored the moment the deck completes mid-air
  ptsRevert: 100, // R2 within the beat after a transition touchdown: the pivot that keeps a vert combo alive into the manual (THPS3+/THUG's bridge)
  uberScoreMult: 2, // three masks banked (uber): every trick goes SPECIAL — renamed on the plate and paying this multiple
  hangLatMax: 40, // pipe hang: cap on the off-axis lateral carry. Effectively uncapped now (THPS conserves coping drift — a hard angled carve genuinely flies you down the pipe); out-running the pipe is the hang-end bail's job, not a clamp's
  rollOffLevelTime: 1.5, // riding out a pipe's open END partway up the wall: the body levels from the wall tilt to wheels-down over this many airborne seconds — touch down still tilted (off a saving surface) and it's the bail you were carrying
  manualArmWindow: 0.35, // a flick finished mid-air arms a LAND-INTO-manual for this long
  ropeGrabRadius: 1.1, // jump within this of a swing rope's line to catch it
  ropeClimbSpeed: 2.4, // up/down on the stick walks the grip along the rope (u/s)
  ropeRegrabCool: 0.5, // after leaping off, the rope won't re-catch you for this long
  ropeSpinReach: 1.9, // spin-on-the-rope smash radius (mid-air crates, enemies)
  grabTransition: 0.15, // reach into / out of the grab pose; land mid-motion = bail
  liftMemory: 0.12, // how long a kicker's climb is remembered for the takeoff. The ground ray flattens a frame or two before the wheels actually leave a lip, and without this the launch converts the flat instead of the ramp
  grabGrace: 0.62, // landing this soon after COMPLETING a grab still pays out. Raised from 0.45 with the board-air split: the paying release window is [airtime - grabGrace, airtime - grabRelease], so a LONGER board air was silently pushing an early grab-and-release out of the payout with no bail and no tell. 0.62 keeps a press-at-launch release paying across the WHOLE boardFallGravity slider, down to a fully symmetric 0.75s air
  grabSnapRate: 15, // rad/s the rotation eases back on-axis after release
  frontFlip: true, // running-jump somersault animation (triggered by TUNING.flipHoldTime)
  flipDuration: 0.75, // full somersault clock — matches the reference full-hold jump arc; rotation lives in the 15..80% window (visual only)
  slideCooldown: 0.25,
  slideSpinCancel: 0.2, // spin inside the slide's last beat (or its grace/get-up) cancels the cool-off — slide-spin-slide chains
  slamSpeed: 46, // Circle+down pancake slam: authored fall rate
  maxFallSpeed: 52, // terminal velocity: fall no faster than the ground ray can catch (no deck tunneling)
  slippyFriction: 0.12, // friction multiplier on slick/icy planks (near-frictionless slide)
  slipAccel: 3.5, // ice-walk responsiveness on slick planks (low = more momentum/coast, harder to stop)
  slamHang: 0.32, // Wile E. Coyote beat: freeze in the air before the drop
  slamFlat: 0.5, // lie pancaked on the ground this long after impact
  crouchJumpMult: 1.35, // crouch (crawl) jumps launch this much higher
  crouchJumpGrace: 0.16, // ...and a jump still gets that boost for this long after a static crouch ends (coyote time)
  slamSquashTime: 0.3, // pancake squash pose on impact
  fruitPerCrate: 3, // wumpa spawned per broken box
  balanceStart: 0.15, // initial needle kick when a grind starts
  balanceBailSpeedKeep: 0.3, // speed kept after a grind bail
  balanceRespSnap: 60, // needle-velocity follow rate at inertia 0 (== fixedStep hz, so follow==1 and the needle stays exactly first-order)
  balanceRespFloat: 5, // needle-velocity follow rate at inertia 1 (heavy lag / overshoot)
  balanceNoiseGate: 1.5, // above this |needle velocity| the sketch quiets to 0 — a committed counter-tap stills the wander
  airBrakeFactor: 2, // holding down in the air brakes this much harder than airControl
  tntFuse: 3, // Crash-style TNT countdown (stomp lights it)
  blastGrow: 0.35, // seconds for the blast sphere to reach full size
  // Steep-ground rules live in TUNING now (footGrip/steepStand/vertLip/
  // landingFlow/wallStick/landGive sliders); only the structural facet
  // threshold stays fixed here.
  steepSnapNormal: 0.85, // below this, ground-follow + landing windows widen for transitions
};
