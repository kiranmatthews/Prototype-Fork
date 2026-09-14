# Skate pose contact audit — September 2026

**Visual review status:** the user subsequently reported that several poses regressed. The numerical contact checks below are historical technical evidence, not approval of the silhouettes. Use the [three-column contact sheet](SKATE_REVIEW_SHEET.md) to identify and repair the individual poses.

`src/skateTricks.ts` defines mechanical identities; `src/skateAnimation.ts` applies the final contact constraints to the actual Player rig after animation and character proportions. `skate-pose-review.html` is a local catalogue viewer with phase scrubbing, both foot-forward stances and five camera views. `trick-review.html?playtest&level=jungle-cup` exercises real takeoffs, inputs, catches and landings.

## Mechanical identities

| Grind | Loaded contact |
| --- | --- |
| 50-50 | Both hangers, parallel |
| Nosegrind | Front hanger; tail raised |
| 5-0 | Rear hanger; nose raised |
| Crooked | Front hanger, angled deck |
| Smith | Rear hanger; nose dipped on approach side |
| Feeble | Rear hanger; nose dipped across rail |
| Boardslide / Lipslide | Deck underside, opposing 10° offsets from crosswise; entry path distinguishes them |
| Darkslide | Inverted griptape; close stance on the underside between trucks |

A nosegrind uses the front truck; pressing the deck tip is a different contact. See [skatedeluxe's nosegrind lesson](https://www.skatedeluxe.com/blog/en/trick-tips/skateboard/curb-rail/how-to-nosegrind/).

| Grab | Hand / contact |
| --- | --- |
| Indy | Trailing / toe edge |
| Melon | Leading / heel edge |
| Nosegrab | Leading / nose |
| Tailgrab | Trailing / tail |
| Method | Leading / heel edge, tweaked |
| Mute (Weddle) | Leading / toe edge |
| Stalefish | Trailing / heel edge, behind leg |
| Japan | Leading / toe edge, tucked knees |

The hand mapping is stance-relative; anatomical left/right alone cannot define a grab. The rig's existing `stance = +1` is right-foot-forward. The viewer names the actual leading foot. Grab and stall terminology was cross-checked against the [skateboarding glossary](https://skateglossary.com/).

| Flip / special | Motion |
| --- | --- |
| Kickflip / Heelflip | Opposite full longitudinal flips |
| Pop Shove-It | Backside half-shove |
| Varial Kickflip | Kickflip + backside half-shove |
| Varial Heelflip | Heelflip + frontside half-shove |
| Hardflip | Kickflip + frontside half-shove |
| Inward Heelflip | Heelflip + backside half-shove |
| Impossible | Full wrap around a moving trailing shoe, with rolling contact and balancing arm sweeps |
| Backflip | Nose-up ollie with one full backward rotation, shortened segments and a leading-hand board grip at the compressed apex |
| Tornado Twist | Two-and-a-half backside turns with Weddle grip |

References include [skatedeluxe's Hardflip lesson](https://www.skatedeluxe.com/blog/en/trick-tips/skateboard/flat/how-to-hardflip/), [Nollie Skateboarding's rear-foot Impossible lesson](https://nollieskateboarding.com/en/news/15884), and [Mike McGill's McTwist account](https://www.wbur.org/onlyagame/2012/11/10/skateboarding-mctwist). These are original procedural interpretations, not copied animation clips.

Manuals load rear wheels; nose manuals load front wheels. Axle stalls turn along coping; rock stalls use the belly; nose/tail stalls load their respective tips. Wallrides turn the wheels into the wall. Ollies show tail pop followed by levelling. Reverts use a grounded crouch-driven 180-degree slide into the opposite normal/fakie stance.

## Contact and cartoon motion

The default new mount is now `stance = -1`, reversing the old body-facing
direction; explicit switch/revert behavior remains intact. Relaxed skating
uses standing idle as its silhouette reference. Instead of the old fixed
0.53 m pelvis-to-sole height (about 96° knees), the contact layer measures
unbent legs, ankle/sole offsets and foot spread to find a lightly bent stance.
The authored character now has roughly 25–35° knee flex, near standing idle's
15–20°, while keeping the same board contacts. Charge now uses that same
proportion-aware solve: a moderate 55° knee bend lowers the authored rig's hips
about 8–10 cm from relaxed ride, replacing the old 0.395 m squat endpoint.
The initial two-bone contact solve respects parent scale; its bounded local
refinement allows up to 64 iterations for nearly straight legs, exiting early
once the socket is within 1 mm.

`src/skateBodyMotion.ts` gives normal ride, charge, ollie and landing one
continuous damped spring. The load opens during early ascent, gathers the
knees around the actual apex, then relaxes for a cushion/rebound on contact.
The S05 tail-pop pitch builds over 50 ms toward a 31° nose-up angle. It
follows vertical velocity to hold the uphill board attitude through ascent
and level around the apex, instead of ending at a fixed quarter-second. Air entry does not
trigger a second contact compression. Ordinary board airs route to procedural
Skate, not the on-foot Jump/Fall; their exact landing frame also bypasses the
on-foot Land one-shot. Grab, flip and grind identities retain their separate contact poses. Manuals
use the standing-height solve with their own wheel contacts and soft arm corrections. The spring changes joint presentation, never physics.

The stance is now 25% narrower for idle/charge/ordinary ollies (0.75 m versus
1.00 m on the default deck); named tricks retain their contact-specific widths.
`src/skateOllieMotion.ts` restores the pre-contact-rewrite independent torso/limb
stretch, apex compression and landing rebound on top of the retained shallow
knee spring. Garment-only shorts bones follow the animated thighs so elongation
does not detach the shins. See [CHARACTER_ELASTICITY.md](CHARACTER_ELASTICITY.md).

`skate-charge-review.html?playtest&level=test-course&nocrt` is a local-only
actual-controller review, including the authored runtime, tap/full ollies,
held charge, both stances and campaign/park controls. Phase-pause buttons
inspect load, extension, apex and landing; no settings, clips or level saves
are written.

The board has a separate scale compensation parent. Its metre dimensions survive the body's nonuniform cartoon proportions without shearing. Hanger height, wheel radius, deck thickness and grip height come from the current skateboard settings. A selected support point anchors the board transform; torso lean can no longer exchange a nosegrind for a centre-balanced board tilt.

Feet and palms use actual rig sockets, two-bone IK and a bounded local-coordinate refinement. The latter removes the centimetre-scale error left by an ordinary world-space solve under stretched parents. Wrist orientation makes the palm face the edge and fingers curl underneath. The spine folds to make the short arms reach without scaling bones. Contact corrections happen after appearance/animation layers.

Contact events compress the knees and rebound with a damped curve that finishes in 0.65 seconds. A small continuing knee pulse adds motion to held poses. Grinds keep the contact fixed; manuals never wobble through flat into the opposite named manual. Feet lift and flick independently during flips. The Impossible rolls around the moving rear shoe; its contact shifts across the shoe and along the deck. Darkslide entry/exit uses a half-flip and foot clearance. Backflip rotates rider and board around the actual posed hips while the nose-up ollie is still ascending.

Input recipes, scoring, balance difficulty and movement tuning remain unchanged. Presentation timings are detailed in the repair notes below. Revert and completed half-shove orientation bookkeeping agree with the rendered deck.

## Verification

- `node tools/test-skate-charge-ollie.mjs`: 1,344 actual controller frames covering tap/full ollies in campaign/park and both stances. Exact position/speed/state parity with the no-authored-runtime controller; correct procedural ownership throughout air/landing; no deep two-legged squat; maximum sole error 1.48 mm. Constant-target spring agrees at 30/60/120 fps.
- `node tools/test-skate-contacts.mjs`: 64 grind cases across both stances, directions and flat/sloped rails; 32 grabs and releases; 12 manuals; both Darkslides; four lip stalls; four wallrides; 16 complete flip cycles; McTwist definition; actual revert input, plus relaxed/charged stance and release. 10,014 pose frames. Maximum sole error 1.15 mm; palm error 0.94 mm in the authored rig fixture.
- `node tools/test-skate-tricks.mjs`: all eight flips launched and landed on all four vert walls, both aerial specials, queues, same-tick catches, late bails and scoring/history boundaries.
- Input polish, SPECIAL, leg solver, animation IK, lip recovery and grind head stability checks pass. Head checks retain angular limits and allow the requested bounded knee bounce.
- The historical 3,603-frame recording lacks the newer absolute park settings. Under current replay defaults both the pre-change Player and this implementation traverse 59 grind frames, with exactly zero position or state differences. Updated the stale minimum-frame assertion; the new pose grid separately exercises sustained grinding. Its replay head turn peaks at 6.74 degrees, with no repeated flips.
- Production TypeScript/bundle checks pass, including an isolated source snapshot excluding concurrent rope/character edits. Real-browser catalogue and lite/full gameplay review cover visible contacts, complete Impossible and McTwist catches/landings, and console checks. No full repository suite was requested or run.

The numerical tolerances describe the authored fixture. The contacts also use current board geometry and rig transforms; arbitrary extreme Character Lab proportions still require their own visual review.

## S05–S07 review repairs

S05 now holds a stronger nose-up pitch through ascent. The leading knee follows the raised nose while the trailing leg stays open; the existing independent limb stretch, apex gather and finite landing rebound remain in place. Actual tap/full ollies in campaign and park controls, in both stances, reach up to 31.3° nose tilt with unchanged controller motion across 1,344 frames and at most 1.48 mm sole error. The posture check distinguishes this intended leading-knee lift from a two-legged squat.

S06 and S07 share the proportion-aware standing solve at a nominal 0.55 radian knee-flex target. On the review rig at neutral balance, the groin rises from about 0.42 m above the mean sole height to about 0.90 m; knees change from roughly 119° to about 26°/50–54°. The loaded rear/front wheels and both shoes retain their contacts. Shoulders make alternating small corrections, with delayed elbow/wrist motion and a smoothed response to the balance needle. Shared elasticity and the entry/exit spring remain active.

Catalogue revision 4 refreshes the sheet and unedited Lab studies while preserving authored repairs. The expanded contact check covers 10,206 pose frames, including both manual types, stances and balance extremes; worst sole error is 2.14 mm, palm error 0.94 mm. All 42 captures reconstruct and pass 1,890 playback samples. Build, contact-sheet review and actual-controller lite/full rendering pass with no console errors.

## S40 / S42 review repairs

S42 now uses the contact solver through the complete hang. The board spans the rail at 90°, with its belly supported above the rail and one curled hand around each truck hanger. The hanging anchor is 3.5 m below the rail; the same depth drives the ground-clearance probe. The body swings around the rail during entry and return, and the board passes beside the head during the release-to-feet handoff. Head bounds, including hair/ears, remain at least 0.41 m below the rail underside during the hold.

The shared under-rail elasticity profile lengthens upper-arm and forearm shafts independently: roughly 3.65×/3.85× in the hold, with extra reach during the swing and finite release. Arm controls allow 5.75×, and the rendered arm components allow that range composed with the existing 1.58× maximum authored arm proportion. Both rigid knobbles keep their shapes. A separate check verifies visible shaft endpoints as well as the semantic joints, preventing detached-looking elbows or wrists.

S40 now uses a ~0.68 m stance between the trucks and a proportion-aware upright pelvis. Feet follow a stable catch plane while the deck flips. The board carries its support offset into the exit and avoids adding a second flip pop over the real ollie. This removes the below-knee groin pose, excessive width and amplified exit bounce while retaining the inverted-deck contact and shared cartoon elasticity.

`tools/test-skate-hang-darkslide.mjs` drives 2,744 actual controller frames across both stances and travel directions. It checks the complete entry, hold, return, release and landing: both truck grips remain within 1 mm through the swing, head bounds clear the rail, visible arm shafts meet their joints, and Darkslide stays narrow with the groin above the knees. The existing 10,206-frame contact audit, 1,344-frame ollie regression, 1,890-frame review playback check, stretchable-bone integration and production build pass. Catalogue revision 5 refreshes unedited Lab captures and preserves user repairs.

## Facing-only wallride and staged S42 entry

Wallride acquisition now compares the rendered rider's horizontal forward axis with the inward wall normal, independently of velocity and head-only glances. The old approach-angle setting now describes the body-facing tolerance; a back-to-wall pose is always rejected. Speed eligibility includes vertical motion, and a vertical ride can continue through its apex. While attached, the body faces into the current wall normal, including on curved walls and during reverse travel. Ground contact, wall bounds, the existing timer, jump release and the facing rule still end the ride.

S42 now has a 0.72-second staged entry: the feet flick the board crosswise, the skater hops clear with tucked feet, the body drops beside the rail, and the hands catch the trucks late. Return and release have separate contact timing. Held upper-arm/forearm lengths are about 2.8×/3.0×, reduced from 3.65×/3.85×; the return uses a smaller reach extension as needed. Head clearance is about 8 cm below the rail underside, with the shared hanging anchor reduced to 3.15 m. Existing authoring limits remain available so saved custom poses remain valid.

`tools/test-wallride-facing.mjs` covers 360 straight/curved-wall cases across both sides, stances, five body-facing angles and six movement directions. It exercises 144 allowed catches and 2,880 native ride frames, including reverse, head-on, upward and downward travel, back-facing rejection, head-look independence and the continuation guard. `tools/test-skate-hang-darkslide.mjs` also checks the ordered foot-flick/jump/late-catch sequence, visible shoe clearance, continuous shafts, roughly 8 cm held headroom and truck-grip error below 2.4 mm through the return.

For local gameplay review, open `wallride-facing-review.html?playtest&level=codex-lab&lite` under Vite, or remove `lite` for full rendering. This test-only page exposes native facing and travel cases without saving settings or progress. Browser checks confirm a back-to-wall rejection and valid reverse/head-on/vertical rides; the sheet shows S42's flick, airborne beat and shorter-arm catch. Catalogue revision 6 refreshes S08/S42 and preserves authored studies. Focused wallride, hang/Darkslide, contact, ollie and review tests plus build pass; no full suite.

## S39 Tornado Twist

S39 keeps its pelvis high with a shallow knee spring, leans the torso back and extends the leading arm to the Weddle grip. Shared upper-arm/forearm elasticity reaches 2.1×/2.3× independently, preserving the planted shoes and hand without pulling the chest down. The pose and leading-hand contact persist through release, followed by the existing finite landing rebound. The move is now named **Tornado Twist** in gameplay, the Trick Guide, sheet and Lab. Its stable `the-900` ID, full 900° rotation, input and score remain unchanged.

`tools/test-tornado-twist-pose.mjs` exercises 396 native entry/spin/release/landing frames across both stances and two headings, plus 121 samples of the complete baked clip. It checks 4,117,218 actual skinned garment vertex positions against the board surface: minimum sampled clearance is 15.7 cm. During the held native pose, pelvis height is at least 86.4 cm above the mean soles and knee flex peaks at 50.7°. Sole/grip errors remain below 3.83/1.91 mm, with continuous rendered arm shafts. Every native spin completes and lands cleanly.

Catalogue revision 7 refreshes unedited motion and migrates the old automatic S39 label while preserving edited keys and custom names. The existing 10,206-frame contact audit, native trick regression, 1,890-frame review/migration check and production build pass. Lite/full gameplay browser runs land for 3,000 points with no console errors; the packaged sheet shows the high pelvis, backward lean and extended grip. No full suite was run.

## S34–S38: Backflip and lip-stall repairs

S38 is now **Backflip**. The raised-nose ollie starts a full backward somersault around the posed hips, with shoes planted on the board throughout. It retains the shared ollie segment stretch, compression and landing rebound. The old kickflip and backside yaw are removed; finishing no longer adds a half-turn to the landing. The later S38 refinement below adds a leading-hand grip at the compressed apex. The existing special command, 2,500 points and stable `kickflip-mctwist` identifier remain compatible. The automatic Lab name migrates to Backflip while user-authored keys and custom names survive.

All four lip stalls use the proportion-aware shallow leg solve with a narrower stance. Knee poles follow shoe orientation through the Axle Stall turn. Nose/Tail Stall no longer forces a 180° turn: either side input requests the tip stall, and the incoming physical board end selects its name. Normal/fakie deck orientation and anatomical stance survive the catch; reversing travel on the drop preserves the board's physical nose by updating its travel-relative offset.

The visible coping's centre is 5 cm above the analytic lip and its tube radius is 9 cm. The board and rider crest into the stall over 0.18 seconds, with a small unweighting arc. Deck surface clearance follows its normal, pointing inward during the climb and upward on the stall, and remains active through release. Both deck surfaces are sampled so curved kicks cannot intersect the tube between their nominal support points. A 15 mm allowance also protects playback interpolation; lip studies now retain 60 Hz capture samples.

`tools/test-skate-backflip-stalls.mjs` covers 48 native stalls across both pipe axes/sides, both stances, normal/reversed decks and balance excursions, plus four complete native Backflips. Across 5,180 controller frames and 38,098,648 skinned garment vertices, no sampled shorts/board intersections or reversed knee bends occur; sole error stays below 3.28 mm. The full crest/hold range peaks at 81.6° knee bend. `tools/test-skate-review-clearance.mjs` adds 605 samples and 4,971,890 garment vertices from the actual S34–S38 studies, including entry and release: stall shorts remain at least 17.5 cm above the deck, Backflip shorts at least 11.5 cm, and coping clearance at least 7.26 mm. These values describe the authored fixture, not arbitrary extreme Character Lab proportions.

## S26–S33 grind posture and slide angles

The eight ordinary grinds now use the proportion-aware standing-height solve, with the hips aligned to the deck plane and knees bending in the shoes' forward direction. This removes the low generic trick squat and the one-legged collapse caused by combining Smith/Feeble deck tilt with the old whole-body balance lean. The torso carries a smaller balance correction independently. Shared segment elasticity, finite contact compression/rebound and a restrained jump preload remain active; named hanger/deck support points and movement physics are unchanged.

Boardslide uses an 80° yaw and Lipslide 100°, mirrored through the existing entry direction and deck orientation. Both are 10° away from exact crosswise, with opposing leading ends in the ordinary orientation. Gameplay body yaw and board contacts share the same values. Darkslide keeps its existing 90° yaw, and the under-rail hanging pose keeps its separate constraints.

The final orientation is applied before the body's nonuniform proportion scale. Counter-rotating inside that scale skewed the leg frame during hard balance corrections and could detach a sole. The corrected order keeps both shoes planted while the pelvis stays high.

`tools/test-skate-grind-posture.mjs` passes 64 native cases across all eight styles, both stances/travel directions, flat/sloped rails and balance excursions: 9,200 controller frames and 75,605,600 skinned garment vertex positions. Per-style peak knee flex ranges from 46.2° to 67.8°, with pelvis height along the deck normal at least 82.2 cm above the mean soles. Minimum sampled shorts/board clearance is 15.77 cm through the complete entries, holds, ollie exits and landings; maximum sole error is 2.35 mm. Slide biases converge to +10°/-10°, and the contact audit checks the reversed-deck leading ends as well.

Revision 9's eight grind captures add 968 sampled playback frames with at least 17.39 cm shorts clearance. The expanded S26–S38 check passes 1,573 samples and 12,926,914 garment vertices, retaining the earlier stall and Backflip repairs. The 11,246-frame contact audit, 2,744-frame under-rail/Darkslide regression, head/render-restoration check, catalogue migration check and production build also pass. No full repository suite was run.

## S09 Revert

One native revert switches the current stance once and turns both rider and board exactly 180°. Its 0.52-second presentation crouches into a grounded slide, reaches the entering stance's trailing arm down and out, then rises into the new stance. Shared independent torso/leg compression and arm length controls supply the elastic motion. Revision 11 removes the earlier presentation hop; the original post-vert input window, speed tax, scoring and ride collision remain intact. An active revert cannot accept a second overlapping turn, and bail/death/map transitions clear its presentation.

The balancing wrist follows the forearm, accounting for the glove's actual finger axis (-Y), palm normal (-Z) and persistent hand orientation mount. This avoids treating the palm's contact axis as the finger direction and producing a sharply drooping hand.

The old S09 study changed the deck orientation without changing the captured stance. Revision 10 captures two separate native R2 inputs, with post-landing availability supplied for review: normal → fakie, then fakie → normal, separated by rolling beats. There is no reverse-stance snap at the loop boundary. Unedited Lab studies upgrade and authored changes remain preserved.

`tools/test-skate-revert.mjs` checks 16 native reverts across both initial stances, both deck orientations and two headings, plus eligibility from a real vert landing. Across 1,320 controller frames and 4,207,616 garment vertex positions, both turns remain exactly 180°, the deck stays on the ground, knees stay below 47°, sole error stays below 1.43 mm and shorts clearance stays above 40.8 cm. The down-and-out balancing hand stays within 8.6° of its forearm. Captured stance alternation, the expanded garment check and build pass.

## S42 fluid vertical drop

The under-rail transition now takes 0.48 seconds instead of 0.72. Board rotation, pelvis descent and arm reach overlap from the start, followed by a finite downward stretch and upward rebound at the catch. The hips track a vertical path relative to the moving rail. A brief spine tuck and independent torso stretch keep the large head clear; the turning board glides ahead along the rail while the body passes beneath it. Both truck grips remain fixed through the settled hang. Return uses the same vertical-path principle with its own coordinated contact timing.

The review loop is 4.2 seconds instead of 7.2: one catch/drop, hang, release and landing. It retains 60 Hz samples so the quick catch and rebound survive playback. The previous return-and-second-entry sequence is removed from the sheet loop; return remains available and covered in native gameplay tests.

The 2,744-frame native hang/Darkslide check verifies overlapping motion, less than 2.5 cm horizontal hip deviation, an observed catch dip/rebound, head clearance, sub-millimetre truck grips and continuous arm shafts in both stances/directions. The expanded capture audit covers S09/S26–S38/S42 at 1,815 times and 14,915,670 garment vertex positions. S42's sampled shorts/deck separation is at least 18.7 cm and head/rail clearance at least 6.19 cm. The native grounded Revert check, catalogue/migration check and production build also pass; no full suite.


## S38 simultaneous, elastic Backflip

The full backward rotation now uses a quintic easing curve with no delayed start. The raised nose stays loaded during the opening rotation, then blends level while rider and board continue turning together. The native review command completes 0.05 seconds after vert takeoff, within the ascending ollie. The move still completes exactly 360 degrees in 0.78 seconds and keeps its original command and 2,500-point score.

At inversion, the shared deformation controls shorten the torso and thighs to 0.60 and shins to 0.62 of their authored lengths. The free upper arm/forearm shorten to 0.68/0.70; the gripping arm keeps enough independent reach to plant the leading hand at the board's toe edge. These targets blend from the live ollie lengths, preventing compounded squash. The knees stay relatively open, and a finite extension rebound releases the grip into the landing. The whole skeleton's scale is unchanged.

The legs ease into the board plane before the body's nonuniform proportion scale. Ankle orientation is solved in that character frame, preserving the shoe socket offsets while short limbs converge. The existing coping surface correction also covers a charged jump's final ramp approach, preventing the raised deck from crossing the visible tube.

`tools/test-skate-backflip-motion.mjs` drives eight complete launches on four Jungle Cup walls in both stances: 660 controller frames and 5,292,392 skinned garment vertices. Feet and the held hand stay within 1 mm, sampled shorts clearance stays above 6.43 cm, and knee bend stays below 61.1 degrees. Apex pelvis-to-soles height falls below 47% of its launch height through segment shortening. Frame-to-frame body rotation stays below 12.1 degrees, and all eight cases land cleanly for 2,500 points with one multiplier.

Revision 12 replaces S38's controlled-phase study with a 60 Hz native vert launch, flip, landing and settle. The expanded captured clearance audit passes 1,815 samples and 14,915,670 garment vertices; S38 retains at least 6.43 cm shorts clearance and 1.70 mm coping clearance, including interpolated frames. Existing contact/trick checks, four additional native Backflips, all 42 editable captures and source-upgrade tests, and the production build pass. Full-render native gameplay, the packaged sheet and the Animation Lab were visually reviewed with no console errors. No full suite was run.


## S10 foot-driven Kickflip and independent board flight

Motion reference: [SkatePhysics — Smooth Kickflip (500fps SlowMo)](https://www.youtube.com/shorts/jmoDT8ICcbM), supplied by the user and reviewed through its pop, flick and airborne catch. S10's leading foot now sweeps up the raised nose and out past its corner. A brief angular acceleration follows that sweep, then the board coasts through most of a complete longitudinal roll before slowing for the catch. The trailing foot returns first, followed by the leading foot.

The deck now rotates about its own mid-thickness centre, rather than the wheel-support origin. That centre stays on the controller's flight path, independently of foot targets, pelvis position and segment deformation. The old drop-and-return offset is removed, and the raised-nose ollie does not reappear after the catch. This changes presentation only: input timing, the 0.34-second trick duration, scoring, gravity and movement remain unchanged.

The shared elasticity layer gathers the thighs/shins toward 0.88/0.84 and torso toward 0.94, then blends back into the existing ollie/landing stretch and rebound. The high pelvis follows the measured leg reach; the feet do the downward catch. Shoe orientation accounts for the scaled leg hierarchy, and visible-sole clearance protects the curved nose and the interpolation between the rapid departure keys.

`tools/test-skate-kickflip-motion.mjs` covers 16 native sequences across campaign/park controls, both stances, both deck orientations, and early/later input. Across 1,896 frames and 7,034,608 garment vertices, the board centre matches the controller flight exactly, shoes clear the deck, sampled shorts clearance stays above 19.85 cm, and foot-target error stays below 1.95 mm. The test also verifies the free angular coast, downward catch, complete rotation and clean 100-point landing with one multiplier. Controller position matches a player with presentation disabled throughout.

Revision 13 captures S10 from real flatground inputs at 60 Hz, with its charge, pop, flick, catch, landing and settle visible. The captured audit now covers 1,936 samples and 15,910,048 garment vertices, including Kickflip shoe clearance of at least 2.04 mm, shorts clearance of at least 21.13 cm and absence of upward catch acceleration. Existing contact, trick/score/chaining, ollie and all 42 playback/migration checks pass. Native lite/full rendering, the packaged sheet and Animation Lab were visually reviewed with no console errors. The production build passes; no full suite was run.


## S11 heel-driven Heelflip

Motion reference: [Adam Shomsky — Skateology: Heelflip (1000 fps slow motion)](https://www.youtube.com/watch?v=ggvnTbBPh-E), supplied by the user and reviewed through the heel release, free rotation and catch. S11 shares S10's independent deck-centre flight, angular impulse/coast/catch and staggered downward foot return. The leading foot travels through the opposite edge, reaches slightly farther sideways and raises its toes by up to 37 degrees, presenting the heel to the nose corner. It flattens again before the catch. One complete longitudinal roll runs opposite to Kickflip, with the same 0.34-second duration and 100-point score.

The shared flip elasticity retains the springy gather and landing rebound. Heelflip additionally stretches the leading thigh and shin during its outward heel reach, returning them as the foot retracts. Leg reach is measured using the actual toe-up ankle orientation. Visible-shoe fitting includes the rounded heel upper as well as the sole, protecting the curved board and captured interpolation; the board never follows these foot corrections. Movement, gravity and scoring are unchanged.

`tools/test-skate-kickflip-motion.mjs` now checks both flips across campaign/park controls, both stances, reversed boards and early/later inputs. It checks opposite starting edges and actual board rotations, a visibly raised leading toe/heel, angular coasting, independent deck-centre flight, downward catches, shoe/garment clearance, exact controller parity and clean 100-point landings. The angular measurement uses the current skate frame so existing steering bank is distinct from the deck's longitudinal rotation. Revision 14 captures S11 from native flatground inputs at 60 Hz; the expanded playback audit includes its shoes and flight curvature.


The paired native check covers 32 sequences, 3,792 controller frames and 14,069,216 skinned garment vertices. The current skate-frame flight path and movement remain exact; foot-target error stays below 4.12 mm, sampled shoes clear by at least 1.96 mm, and shorts clear by at least 19.85 cm. All sequences land for 100 points with one multiplier. S10's captured motion tracks are unchanged. Contact and trick/score/chaining regressions pass; the expanded capture audit and production build pass. The capture audit checks 2,057 samples and 16,904,426 garment vertices; S11 retains at least 2.04 mm shoe clearance and 21.13 cm shorts clearance. Native lite/full rendering, the contact sheet and Animation Lab were visually reviewed with no console errors. No full repository suite was run.


## S12 scooped, pitched Pop Shove-It

Motion reference: [Sketchydave — SloMo pop shove it](https://www.youtube.com/shorts/pzYhVOU4Auw), supplied by the user and reviewed from the tail pop through the airborne turn and front-foot catch. S12 now loads the trailing end and sweeps the rear foot sideways to drive a 180-degree board turn. The board retains the pop's pitch as it turns, with a small bank and rock from the off-centre scoop; those settle before the catch. The front foot guides and catches first while the rear foot returns afterward. This provides deliberate unevenness without adding random jitter or an extra flip.

The rear foot follows the actual rotating tail during the supported part of the scoop, then releases into its own foot path. Its toe presses through the tail and its thigh/shin briefly stretch to reach, using the shared independent elasticity controls. Measured shoe clearance uses the turning board's surface. The board rotates about its own centre and follows the unchanged gameplay flight, with no drop-and-return lift toward the feet. The rider does not turn with the deck. The final tilt and planted feet carry through the nose/tail swap and remain supported during the fall. The physical trailing end and pop pitch mirror with reversed board orientation. The trick remains one 180-degree board turn, 0.32 seconds and 100 points.

`tools/test-skate-shove-motion.mjs` drives 16 complete sequences across campaign/park controls, both stances, both deck orientations and early/later input. It checks the loaded tail, visible sideways scoop, tilted board flight, exact half-turn, unchanged rider stance, front-foot-first catch, shoe/garment clearance and controller parity. Across 1,896 frames and 7,034,608 garment vertices, foot targets stay within 1 mm, shoes clear by at least 1.96 mm and shorts by at least 18.47 cm. All cases land for 100 points with one multiplier. The centre follows the controller's skate frame exactly.

Revision 15 records the complete S12 sequence from native flatground inputs at 60 Hz. S10 and S11 capture tracks remain unchanged. The expanded captured audit checks S12's shoes and flight curvature between keys, alongside the earlier pose repairs. The captured audit passes 2,178 samples and 17,898,804 garment vertices; S12 retains at least 1.99 mm shoe clearance and 21.13 cm shorts clearance, including the catch handoff. Native paired flip/contact/trick checks, all 42 playback/migration checks and the production build pass. Native lite/full rendering, the sheet and Lab were visually checked with no console errors. No full repository suite was run.


## S13 moving Impossible wrap and arm choreography

Motion references: [Rodney Mullen Nollie Impossible](https://www.youtube.com/shorts/iXXefBf4AB4) and [Jonny Giger — PERFECT IMPOSSIBLE?!](https://www.youtube.com/shorts/MkFdGqVxECM), supplied by the user. Both were reviewed through the scoop, wrap and catch. The first is a nollie variation; S13 retains the ordinary rear-foot Impossible identity, 0.42-second duration, full rotation and 100-point score.

The old fixed material pivot under the sole is replaced by a moving shoe contact. The rear ankle traces a small loop, pitches its toes and steers the wrap axis. A smooth support point measured from the actual shoe moves from sole to edge and instep; it advances toward the toe cap as the grip turns downward, keeping the deck clear of the calf. The contacting point also slides along the deck. Contact is fitted against the overlapping shoe surface, and the free foot returns for the catch. The planted fall continues after the trick timer ends.

The free leg gathers through independent shortening while the rear leg retains reach. Both arms stretch into broad, unequal balance sweeps, then move forward and down into the catch; wrists follow the forearms. Impossible explicitly owns the skate presentation path, so early inputs no longer select the on-foot spin overlay and skip these deformation controls. Movement, gravity, input recipes and scoring are unchanged.

`tools/test-skate-impossible-motion.mjs` covers 16 native sequences across both stances/deck orientations, campaign/park controls and early/later input. Across 1,896 controller frames and 7,034,608 garment vertices, foot targets stay within 1 mm, sampled shoe clearance remains at least 3.85 mm, rear-shin clearance 3.73 cm and shorts clearance 6.07 cm. The contact moves around the shoe and along the deck, both arms spread visibly, the board inverts and completes the full wrap, and every case lands for 100 points with one multiplier. Controller position matches a player with presentation disabled.

Revision 16 captures S13 at 240 Hz with the same 60 Hz input edges and held controls, preserving this tightly coupled wrap through playback interpolation. Its keys use 0.00005 position/scalar and 0.0002-radian quaternion reduction tolerances. The expanded capture audit passes 2,299 samples and 18,893,182 garment vertices, checking both shins and the shoes during S13: shoe clearance is at least 1.47 mm, shin clearance 3.91 cm and shorts clearance 7.66 cm. S10–S12 motion tracks remain unchanged. Contact/trick checks, all 42 playback/migration checks and build pass; no full repository suite was run.


## S14–S15 foot-driven Varial flips

Motion reference: [SkatePhysics — Cinematic Varial Kickflip (Ultra Slow Motion), Taylor Jett](https://www.youtube.com/shorts/yNY5Qt1BaKs), supplied by the user and reviewed through the scoop, flick, free rotation and catch. S14 pairs a rear-foot backside scoop with the leading toe flick; S15 pairs the opposite frontside scoop with the toe-up heel flick established for S11. The scoop initiates yaw before the front foot releases the longitudinal roll. Each board completes one 180-degree shove and one full flip while the rider retains the incoming stance.

The feet push in opposite directions, then retract above the board. The rear shoe briefly follows the turning tail before release. The deck rotates about its own centre on the unchanged gameplay flight path; the feet descend for a staggered catch, with continuous tilt and support through the nose/tail handoff. The leading arm reaches higher and farther while the trailing arm bends and counters the scoop. Both sweep down toward the catch, with wrists aligned to the forearms. Shared independent elasticity supplies arm stretch, leg gathering, heel reach and the existing landing rebound. Early inputs explicitly retain this skate presentation. Inputs, durations, movement and the 300/350-point scores are unchanged.

`tools/test-skate-varial-motion.mjs` covers 32 native sequences across both stances, reversed decks, campaign/park controls and early/later inputs. Across 3,792 frames and 14,069,216 garment vertices, foot targets stay within 1 mm; sampled shoes clear by at least 1.93 mm, shins by 9.30 cm and shorts by 16.94 cm. The exact half-shove/full-roll directions, opposing foot motion, asymmetric arms, downward catch and clean scores pass. Controller position matches a player with presentation disabled and the deck centre matches its original flight path.

Revision 17 records both complete studies at 240 Hz with 60 Hz input edges. All 42 playback/migration checks pass, preserving authored studies. The expanded captured audit covers 2,541 samples and 20,881,938 garment vertices. S14/S15 retain at least 2.02 mm shoe, 9.37 cm shin and 21.62 cm shorts clearance between keys. S10–S13 capture tracks remain unchanged. Native contact/trick regressions and the production build pass. Native lite/full rendering, the packaged sheet and both Animation Lab studies were visually reviewed with no console errors. No full repository suite was run.


## S16 steep, foot-driven Hardflip

Motion reference: [@blackjessus — Hardflip In Slow Mo](https://www.youtube.com/shorts/1oQ3bEuIsTo), supplied by the user and reviewed through pop, steep board passage, airborne gather and landing. S16 now combines a frontside rear-foot scoop with a leading toe flick. The front foot releases and retracts promptly, clearing the nose as the deck tips close to vertical. The pitch settles while the board completes its frontside half-shove and full kickflip; the rider retains the incoming stance.

The board rotates about its own centre on the unchanged gameplay flight path. Both feet gather above and to the side of its steep passage, then descend for a staggered catch. Shared independent elasticity gathers the legs, extends the unequal balancing arms and blends into the existing landing rebound. The arms counter the scoop before sweeping down into the catch, with wrists aligned to the forearms. Early inputs keep the skate animation path; durations, controls, physics and the 300-point score remain unchanged.

`tools/test-skate-hardflip-motion.mjs` covers 16 native sequences across campaign/park controls, both stances, reversed boards and early/later inputs. Across 1,896 frames and 7,034,608 garment vertices, the actual deck completes the correct half-yaw/full-roll, the nose rises steeply, the feet clear and return downward, and every sequence lands for 300 points with one multiplier. Foot targets stay within 1 mm; sampled shoes clear by at least 1.93 mm, shins by 9.31 cm and shorts by 17.41 cm. Movement matches a player with presentation disabled and the deck centre retains its original flight path.

Revision 18 captures the complete S16 charge/pop/flick/flight/catch/landing sequence at 240 Hz with 60 Hz input edges. The shared scooped-flip presentation keeps the earlier Varial profiles unchanged.

The expanded captured audit checks 2,662 samples and 21,876,316 garment vertices, including S16’s shoes and shins between keys. Its captured shoe clearance stays above 2.02 mm, shin clearance above 9.40 cm and shorts clearance above 21.62 cm. S10–S15 and S17 motion tracks are unchanged. Native contact/trick regressions, all 42 playback/migration checks and the production build pass. No full repository suite was run.

Native lite/full gameplay, the packaged contact sheet and the S16 Animation Lab study were visually reviewed with no console errors.


## S17 scooped, heel-driven Inward Heelflip

Motion reference: [@Allthingslife30 — Slow motion inward heelflip](https://www.youtube.com/shorts/LGOwOynzn_g), supplied by the user and reviewed through setup, toe-up heel kick, tilted board turn, airborne gather and landing. S17 combines a backside rear-foot scoop with a leading heel flick. The front shoe raises its toes and clears the nose corner while the rear shoe briefly follows the turning tail. The deck pitches through release and levels while completing its backside half-shove and full heelflip. The skater retains the incoming stance.

The deck rotates around its own centre on the unchanged gameplay flight path. Both feet withdraw clear of its passage, gather above it and descend for a staggered catch. The trailing arm reaches higher while the leading arm opens forward, matching the reference’s unequal balance response; both sweep down into the catch with wrists following the forearms. Shared independent elasticity supplies heel reach, leg gathering, arm stretch and the existing finite landing rebound. Early inputs keep the skate presentation. Controls, duration, movement and the 350-point score are unchanged.

`tools/test-skate-inward-heelflip-motion.mjs` checks 16 native sequences across campaign/park controls, both stances, reversed boards and early/later inputs. Across 1,896 frames and 7,034,608 garment vertices, the heel rises visibly, the deck completes its correct half-turn/full-roll, the arms balance asymmetrically, and every case lands for 350 points with one multiplier. Foot-target error stays below 1 mm; sampled shoes clear by at least 1.92 mm, shins by 9.37 cm and shorts by 18.93 cm. Controller position matches a player with presentation disabled, and the deck centre retains its original flight path.

Revision 19 captures the complete native S17 charge/pop/flick/flight/catch/landing sequence at 240 Hz with 60 Hz input edges. The dense keys preserve the heel release and combined rotation through review playback.

The expanded captured audit covers 2,783 samples and 22,870,694 garment vertices. S17’s sampled shoe clearance remains above 1.95 mm, shin clearance above 9.49 cm and shorts clearance above 21.61 cm through playback interpolation. S10–S16 capture tracks remain unchanged. Native contact/trick regressions, all 42 playback/migration checks and the production build pass. No full repository suite was run.

Native lite/full gameplay, the packaged contact sheet and the S17 Animation Lab study were visually reviewed with no console errors.


## S09 deeper charge, downward upper arm and springy recovery

Revision 20 makes the grounded Revert load into a fuller charge-like crouch before the slide. The turn and limb envelopes now use quintic easing, with zero endpoint velocity/acceleration. A damped, finite rebound feeds the torso, individual leg lengths and reaching arm: the body compresses, rises slightly, dips and recovers into the new stance. The exact 180-degree rotation remains monotonic and the board stays planted throughout its original 0.52-second duration.

The balancing arm’s old elbow target was above the shoulder. It is now below the shoulder, with a flattened outward direction and a downward reach. The upper arm visibly lengthens more than the forearm, and its elbow remains below the shoulder through the held reach. The wrist follows the forearm. A small spine lean accompanies the crouch without moving the feet or changing the whole skeleton’s scale. Eligibility, stance switching, scoring, speed tax and movement physics are unchanged.

The strengthened native revert check covers 16 turns across both stances, both board orientations and two headings, plus a real vert landing. Across 1,320 frames and 4,207,616 garment vertices, hip compression reaches about 21 cm and knees stay below 61 degrees. The reaching upper arm stretches by up to 38%, with the elbow at least 36 cm below its shoulder during full reach. Every case shows a visible recovery dip of at least 1.42 cm, followed by a return upward. Both turns remain exactly 180 degrees, deck lift is zero, sole error stays below 1.42 mm and shorts clear the board by at least 26.98 cm. The balancing wrist stays within 7.5 degrees of its forearm.

S09’s native study now retains 60 Hz samples so the elbow path and finite bounce survive playback interpolation. Its two separated turns still show normal → fakie → normal with complete entries and exits.

The captured audit checks 2,783 samples and 22,870,694 garment vertices, now explicitly requiring the S09 elbow to remain below the shoulder between keys. S09’s captured shorts clearance remains above 28.12 cm. All other 41 captures’ motion tracks remain unchanged. Native contact/trick regressions, all 42 playback/migration checks and the production build pass. No full repository suite was run.

Native lite/full gameplay, the packaged sheet and the updated S09 Lab study were visually reviewed with no console errors.


## S18 upright Indy with a waist-driven reach

The user supplied an Indy reference image and requested upright legs, no shorts/board clipping, and hand reach supplied by bending at the waist. S18 now retains a standing-height pelvis and moderate knee bend, with both shoes aligned to the board plane. Its trailing hand still holds the toe edge between the feet.

Indy now authors its bend at the anatomical `torso-root` waist joint, with a controlled forward hinge and a sideways lean toward the grabbing shoulder. The spine remains neutral relative to the waist. This replaces the old corrective spine fold, which could invert the upper body when combined with the low generic grab squat. The hand reaches without adding arm length. The bend eases through the existing grab envelope and unfolds on release, while the shared grab elasticity retains independent torso/leg spring motion. The waist baseline is restored before the next gameplay pose.

Revision 21 replaces S18’s controlled-flight study with native flatground inputs: launch, grab entry, held toe-edge contact, release, landing and settle. It retains 60 Hz samples for the hand/foot contacts and the waist transition. Controls, physics, scoring and the other grab definitions remain unchanged.

`tools/test-skate-indy-motion.mjs` drives 16 native grab/release/landing sequences across both stances, reversed boards and all four vert directions. Across 1,320 frames and 16,850,224 sampled mesh vertices, knees stay below 51 degrees, the held pelvis stays above 75 cm relative to the soles, and the torso reaches through a roughly 104-degree waist bend. The shorts clear by at least 18.88 cm, shoes by 1.90 mm, and head surfaces stay clear of the board. Foot targets remain within 1 mm and held palm contact within 2.98 mm. Waist motion stays below 18 degrees per frame, and all cases release and land cleanly.

The expanded capture audit checks 2,904 samples and 23,865,072 garment vertices, including S18’s held hip height, knee bend and toe-edge palm contact between keys. S18’s captured shorts clear by at least 21.46 cm. The other 41 motion tracks are preserved exactly. Native contact/trick regressions, all 42 playback/migration checks and the production build pass. No full repository suite was run.

The final game was reviewed through the complete Indy entry, hold, release and landing in lite and full rendering, with no console errors. Subsequent work prioritizes gameplay animation over review-sheet enhancements.


## S19 seated-back Melon

Melon now keeps its hips above the board and shifts them toward the heel side, creating a seated-back pose with moderate knee bend. The torso folds at the anatomical waist; the leading hand reaches the heel edge between the feet while the trailing arm extends backward. In the normal stance this is the requested left-hand grab and right-arm counterbalance; the pose mirrors with the opposite stance. The shared waist/contact path preserves Indy’s existing values and retains independent segment elasticity, planted feet and smooth release.

Sixteen native sequences cover both stances, reversed decks and all four vert directions. Across 1,320 frames and 16,850,224 mesh vertices, knees stay below 55 degrees, shorts clear the board by at least 18.88 cm, feet stay within 1 mm and held grip within 2.91 mm. The backward arm reach, rearward hip placement, head/shoe clearance and clean release/landing all pass. Indy, contact/trick regressions, playback checks and the production build pass. Native lite/full gameplay review has no console errors. Revision 22 synchronizes S19’s existing study from gameplay; the other 41 motion tracks are preserved. No full suite was run.


## S20 seated Nosegrab with a forward reach

Nosegrab now keeps the pelvis seated above the deck, with a small heelward and tailward offset. The torso hinges toward the nose at the anatomical waist and the front arm reaches the tip. The physical nose remains the target when the deck is reversed; the nearer arm takes the grip and a shallower reversed-board lean protects head clearance. Feet remain planted, the shared elasticity is retained, and the torso unfolds through the normal release. Movement, inputs and scoring are unchanged.

Sixteen native sequences cover both stances, both deck orientations and four vert directions: 1,320 frames and 16,850,224 mesh vertices pass. Shorts clear the board by at least 18.88 cm, shoes by 1.93 mm and head surfaces by 1.09 cm. Foot targets remain within 1 mm and the nose grip within 2.95 mm. Rearward seating and forward arm reach are checked directly. Indy/Melon regressions, contact/trick checks, playback/clearance and build pass. Full in-game release and landing succeed without errors. Revision 23 synchronizes only S20; the other 41 motion tracks remain unchanged. No full suite was run.


## S21 seated Tailgrab

Tailgrab now shares Nosegrab’s seated support and waist-driven reach, mirrored toward the physical tail. The back arm holds the tail while the hips stay above the board; reversed decks use the nearer arm and corresponding waist lean. Both feet remain planted and the shared elasticity and normal release are retained. Gameplay inputs and movement rules are unchanged.

Sixteen native sequences across both stances, reversed decks and four vert directions pass 1,320 frames and 16,850,224 mesh vertices. Shorts clear the board by at least 18.88 cm, shoes by 1.93 mm and head surfaces by 8.48 cm. Foot targets remain within 1 mm and tail grip within 2.91 mm. The back-arm reach and supported seat are checked directly. Nosegrab regression, contact/trick checks, playback/clearance and build pass; the full in-game release and landing succeed without console errors. Revision 24 synchronizes only S21 from park inputs, preserving the other 41 motions. No full suite was run.


## S22 Method leg extension, arm clearance and inward palm

Method now uses independent thigh/shin extension through the shared elasticity controls, with eased entry and release. The pelvis stays supported while the waist supplies the reach. Its gripping elbow is guided below and outside the head, and the free arm extends back and down. The palm uses the affine-aware grip solve: the glove’s actual local -Z palm normal faces into the heel edge, while the fingers wrap underneath. Method retains its heel-side board tweak, inputs and scoring.

Sixteen native sequences cover both stances, reversed decks and all four vert directions. Across 1,320 frames and 16,850,224 mesh vertices, arm/head and leg/head clearance probes find no intersections through entry, hold and release. Leg controls stay visibly extended during the hold, palm alignment stays above 0.995 toward the board, held grip stays within 3 mm, feet within 1 mm, and shorts clear the board by at least 18.88 cm. Indy/Melon and general contact/trick regressions pass; captured leg-extension/palm checks, playback and the production build pass. Full in-game release/landing succeeds without console errors. Revision 25 synchronizes only S22 and preserves the other 41 motions. No full suite was run.


## S23 seated Mute with an upper-body fold

Mute now keeps the pelvis seated above the deck with a small heelward offset and moderate knee bend. The waist and spine share the forward fold instead of lowering the hips through the board. The leading hand retains the toe-edge grip, while the free arm returns farther from the head during release. Ordinary leg length and the shared elastic motion are retained. Backflip and Tornado Twist explicitly keep their existing special poses despite sharing the Mute grip.

Sixteen native cases across both stances, reversed decks and four vert directions pass 1,320 frames and 16,850,224 mesh vertices. Knees stay below 55 degrees, shorts clear the board by at least 18.88 cm, and feet and held grip remain within 1 mm. Arm/head and leg/head probes find no intersections through entry, hold and release. Backflip, special-trick and general contact regressions pass, as do playback/clearance and the production build. Full in-game release and landing succeed without console errors. Revision 26 synchronizes only S23; the other 41 captured motions remain unchanged. No full suite was run.


## S24 Stalefish knee load and side fold

Stalefish now loads its knees before the waist folds toward the trailing heel-edge grip. Supported hips shift back instead of collapsing into the deck; the free leading arm rises outward for balance. The grip uses the affine-aware palm contact and an outside/downward elbow path. Eased entry/release retain the shared independent elastic deformation and landing rebound.

Sixteen native sequences across both stances, reversed decks and four vert directions pass 1,320 frames and 16,850,224 mesh vertices. Knees remain below 60 degrees, shorts clear by at least 18.88 cm, held grip stays within 2.54 mm and feet within 1 mm. Arm/head and leg/head probes find no intersections through the grab. Mute, general contact/trick regressions, capture playback/clearance and build pass; the manual-angle test now normalizes world quaternions before comparing rotations under nonuniform scale. Full in-game release/landing succeeds without console errors. Revision 27 synchronizes only S24, preserving the other 41 captured motions. No full suite was run.


## S25 Japan Air with knees down and board behind

Japan now keeps the torso frame independent of the board, which rises and tilts behind the hips. The knees project forward of the feet and down from the hips, with the leading hand planted on the toe edge. A slight forward/side waist lean and independent shin and grabbing-arm extension preserve space around the shorts and head. The free arm counterbalances outside the head. Eased entry/release and a finite segment pulse preserve cartoon elasticity without changing movement physics.

Sixteen native cases cover both stances, both board orientations and all four vert directions: 1,320 frames and 16,850,224 mesh vertices pass. Shorts clear by at least 14.83 cm, head surfaces by 34.54 cm, and held grip and feet stay within 1 mm. Knee direction, board-behind-hips placement, inward palm orientation and full-phase arm/head and leg/head clearance pass. Stalefish/contact/trick regressions, capture playback/clearance and build pass; full-render entry/hold/release/landing succeeds without console errors. Revision 28 updates only S25, preserving the other 41 captured motions. No full suite was run.


## S09 continuous balance-arm entry and return

The revert now solves its downward balance-arm pose at full weight, then blends shoulder, elbow and wrist rotations together against the live riding pose. Previously, fading only the hand target still applied the full elbow pole, causing a backwards bend on entry and a snap when control returned to riding. Crouch/rebound, timing, grounded support and the 180-degree stance change remain unchanged.

A before/after native comparison reproduced a 33.62-degree arm jump. The repaired entry/exit boundaries stay within 1.29 degrees per frame across 16 reverts in both stances, both deck orientations and two headings. Full motion changes remain below 15.87 degrees per frame. Existing crouch, wrist alignment, sole and garment checks pass, along with contact regressions, capture playback/clearance and the production build. Full-render gameplay completes the revert without a bail or console errors. Revision 29 synchronizes only S09 and preserves the other 41 captured motions. No full suite was run.


## Near-limit balance arm corrections

Balance arms now integrate a continuous 1.1–1.7 Hz phase instead of multiplying total run time by the changing needle position. Danger, critical-state amplitude and arm spread ease in/out independently. The old two-wave flail could reach about 1.22 radians; the new correction is bounded below 0.28 radians. This is presentation-only: balance forces, input, grace and scoring are untouched.

The supplied Flats & Pipes replay reproduces five grind entries and 42 critical frames on the current level snapshot, but not its later Nosegrind/5-0 catches. Replaying all 32,798 inputs before/after preserves those entries and critical-frame counts, while peak near-limit arm change drops from 35.19 to 2.33 degrees per frame. Controlled critical toggles at early and 600-second clocks stay below 2.45 degrees per frame and settle after exit. Separate entry/contact checks verify Up → Nosegrind/front truck and Down → 5-0/rear truck in 16 stance, deck-orientation and travel-direction combinations; no binding swap was made because the reported inversion was not reproduced. Balance dynamics, general skate contacts, build and temporary full-render checks pass without console errors.


## Conventional grab silhouettes — S19, S22, S24, S25 rework

This supersedes the earlier posture descriptions for these four grabs. Correct hand contact alone did not make the old Method recognizable: its torso folded down toward the board. The new `src/skateGrabMotion.ts` profiles author the pelvis, torso and deck separately, with shared independent segment elasticity and finite entry/release pulses.

| Grab | Defining shape now preserved |
| --- | --- |
| Melon | Seated hips behind the feet, knees gathered in front, moderate waist fold and leading-hand heel grip. |
| Method | Open chest/back arch and an extended hip line, with bent legs drawing the board up behind the hips; leading-hand heel grip. The free arm returns as a complete chain to avoid crossing the head. |
| Stalefish | Legs move forward to open space beside/behind the rear knee; the trailing arm reaches through that space to the heel edge just inside the back foot, with a side fold and raised counterbalancing arm. |
| Japan | Leading-hand toe grip, raised board behind the hips and a forward/sideways knee tuck; the upper body folds forward instead of using Method’s open arch. |

The supplied photographs anchor the silhouettes. TransWorld’s [Stalefish lesson](https://www.skateboarding.com/archives/starting-point-stalefish-grab) also describes moving the legs forward to make room for the rear-hand reach. Indy, Mute, Nosegrab and Tailgrab keep their existing poses.

Validation now checks the defining geometry as well as contact. Sixty-four native sequences (5,280 frames, 67,400,896 mesh vertices) cover both stances, reversed decks and four vert directions. Revised grabs keep feet and held palms within 1 mm; shorts retain at least 3.56 cm deck clearance. Head/arm, head/leg and held arm/shorts probes report no intersections. The four approved grabs pass their existing regressions. General contacts, flip/chain/scoring checks, captured playback/clearance and production build pass. Revision 30 synchronizes only these four gameplay captures; the other 38 tracks are unchanged. No review UI changes or full suite.
