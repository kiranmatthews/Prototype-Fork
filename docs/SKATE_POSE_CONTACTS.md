# Skate pose contact audit — September 2026

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
| Darkslide | Inverted griptape; feet on underside beyond trucks |

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

The board has a separate scale compensation parent. Its metre dimensions survive the body's nonuniform cartoon proportions without shearing. Hanger height, wheel radius, deck thickness and grip height come from the current skateboard settings. A selected support point anchors the board transform; torso lean can no longer exchange a nosegrind for a centre-balanced board tilt.

Feet and palms use actual rig sockets, two-bone IK and a bounded local-coordinate refinement. The latter removes the centimetre-scale error left by an ordinary world-space solve under stretched parents. Wrist orientation makes the palm face the edge and fingers curl underneath. The spine folds to make the short arms reach without scaling bones. Contact corrections happen after appearance/animation layers.

Contact events compress the knees and rebound with a damped curve that finishes in 0.65 seconds. A small continuing knee pulse adds motion to held poses. Grinds keep the contact fixed; manuals never wobble through flat into the opposite named manual. Feet lift and flick independently during flips. The Impossible rotates around its measured rear-foot pivot. Darkslide entry/exit uses a half-flip and foot clearance. The McTwist finishes its kickflip before closing the grabbing hand, then rotates around the actual posed hips.

Input recipes, durations, scoring, balance difficulty and movement tuning remain unchanged. Revert and completed half-shove orientation bookkeeping now agree with the rendered deck.

## Verification

- `node tools/test-skate-contacts.mjs`: 64 grind cases across both stances, directions and flat/sloped rails; 32 grabs and releases; 12 manuals; both Darkslides; four lip stalls; four wallrides; 16 complete flip cycles; McTwist definition; actual revert input. 9,414 pose frames. Maximum settled sole error 1.00 mm; palm error 0.98 mm in the authored rig fixture.
- `node tools/test-skate-tricks.mjs`: all eight flips launched and landed on all four vert walls, both aerial specials, queues, same-tick catches, late bails and scoring/history boundaries.
- Input polish, SPECIAL, leg solver, animation IK, lip recovery and grind head stability checks pass. Head checks retain angular limits and allow the requested bounded knee bounce.
- The historical 3,603-frame recording lacks the newer absolute park settings. Under current replay defaults both the pre-change Player and this implementation traverse 59 grind frames, with exactly zero position or state differences. Updated the stale minimum-frame assertion; the new pose grid separately exercises sustained grinding. Its replay head turn peaks at 6.74 degrees, with no repeated flips.
- Production TypeScript/bundle checks pass, including an isolated source snapshot excluding concurrent rope/character edits. Real-browser catalogue and lite/full gameplay review cover visible contacts, complete Impossible and McTwist catches/landings, and console checks. No full repository suite was requested or run.

The numerical tolerances describe the authored fixture. The contacts also use current board geometry and rig transforms; arbitrary extreme Character Lab proportions still require their own visual review.
