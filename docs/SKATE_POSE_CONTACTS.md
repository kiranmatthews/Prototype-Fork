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
| Boardslide / Lipslide | Deck underside, perpendicular; entry path distinguishes them |
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
| Impossible | Full wrap around trailing foot |
| Kickflip McTwist | Kickflip catch, inverted backside 540, Weddle grip |
| The 900 | Two-and-a-half backside turns with Weddle grip |

References include [skatedeluxe's Hardflip lesson](https://www.skatedeluxe.com/blog/en/trick-tips/skateboard/flat/how-to-hardflip/), [Nollie Skateboarding's rear-foot Impossible lesson](https://nollieskateboarding.com/en/news/15884), and [Mike McGill's McTwist account](https://www.wbur.org/onlyagame/2012/11/10/skateboarding-mctwist). These are original procedural interpretations, not copied animation clips.

Manuals load rear wheels; nose manuals load front wheels. Axle stalls turn along coping; rock stalls use the belly; nose/tail stalls load their respective tips. Wallrides turn the wheels into the wall. Ollies show tail pop followed by levelling. Reverts rotate the rider and board through 180 degrees on supported wheels, preserving the reversed physical deck orientation.

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

Contact events compress the knees and rebound with a damped curve that finishes in 0.65 seconds. A small continuing knee pulse adds motion to held poses. Grinds keep the contact fixed; manuals never wobble through flat into the opposite named manual. Feet lift and flick independently during flips. The Impossible rotates around its measured rear-foot pivot. Darkslide entry/exit uses a half-flip and foot clearance. The McTwist finishes its kickflip before closing the grabbing hand, then rotates around the actual posed hips.

Input recipes, durations, scoring, balance difficulty and movement tuning remain unchanged. Revert and completed half-shove orientation bookkeeping now agree with the rendered deck.

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
