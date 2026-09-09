# Trick input, animation and scoring audit

Source audit and implemented changes for the September 9, 2026 trick brief. The user explicitly waived browser/visual review for this release; verification below is automated.

The reference inspected is the pinned THUG source already used for Jungle Cup. No external implementation or animation assets are copied into the prototype.

## Source evidence

- [Score history and depreciation](https://github.com/thug1src/thug/blob/d8eb7147663d28c5cff3249a6df7d98e692741cb/Code/Sk/Modules/Skate/score.cpp): `DEPREC_VALUES` is 100, 75, 50, 25, 10. New tricks use landed history plus current-combo uses. Landing commits current uses; bailing discards them. Duration tweaks change the trick's raw value before depreciation. THUG separates four stance histories; this prototype currently has one history per named trick.
- [Air-trick grammar and values](https://github.com/SwagSoftware/kisak-thug/blob/98b4e24921446ccd4b157453e25697f9574f0053/Scripts/game/skater/airtricks.q): eight directional slots for Square and Circle, short command windows, distinct flip and grab scripts, grab entry/hold/release, and ongoing hold scoring. Basic flips start at 100; ordinary grabs commonly start at 300. Script animation assets are not available here, so authored prototype durations are not claimed to match measured THUG clip times.
- [Character loadouts](https://github.com/SwagSoftware/kisak-thug/blob/98b4e24921446ccd4b157453e25697f9574f0053/Scripts/game/skater/protricks.q): mappings vary by loadout. The reference freestyle flip set uses left Kickflip, right Heelflip, up Impossible, down Pop Shove-It, and four distinct diagonal flips.
- [Grind definitions](https://github.com/SwagSoftware/kisak-thug/blob/98b4e24921446ccd4b157453e25697f9574f0053/Scripts/game/skater/grindscripts.q) and [physics accrual](https://github.com/thug1src/thug/blob/d8eb7147663d28c5cff3249a6df7d98e692741cb/Code/Sk/Components/SkaterCorePhysicsComponent.cpp): styles have different base/tweak values; continued contact adds value to the same trick. Rail reuse has separate anti-farming treatment in the reference.

## Problems reproduced or identified in the old implementation

- Neutral Square already starts and lands a flip during vert in the actual Player simulation. Chaining shares the on-foot attack's cooldown, however, and Square adds 0.5 m/s near the apex. A new trick must not alter the approved ballistic arc.
- Ordinary flips are rejected during grab entry/hold/release; grabs can start while a flip is still underway. Inputs need explicit ownership and a short catch/release buffer.
- A shove-it and a varial both yaw the deck a full 360 degrees. The foot-contact solver then seats the rider on that rotating deck instead of letting the feet separate for the trick.
- Grab labels, poses and depreciation buckets follow the live stick after entry, so rotating can change the grab and refund/reprice its base points.
- All five flips pay the same 110 points. Held grabs add only 16 points per second and grinds 24; duration points bypass depreciation entirely.
- Repetition history is cleared after every bank and stops at 25%. Landing a fresh combo therefore restores full trick value indefinitely.

## Implemented flip loadout

`src/skateTricks.ts` supplies gameplay, editor/gate hints and the in-game **TRICK GUIDE**. The five existing authored trick IDs remain valid, while their hints follow the corrected controls. This uses the reference freestyle flip layout, with neutral Square retained as a convenient Kickflip alias.

| Direction + Square (keyboard F) | Trick | Base | Animation time |
| --- | --- | ---: | ---: |
| Left or neutral | Kickflip | 100 | 0.34 s |
| Right | Heelflip | 100 | 0.34 s |
| Up | Impossible | 100 | 0.42 s |
| Down | Pop Shove-It | 100 | 0.32 s |
| Down + left | Varial Kickflip | 300 | 0.40 s |
| Down + right | Varial Heelflip | 350 | 0.42 s |
| Up + left | Hardflip | 300 | 0.42 s |
| Up + right | Inward Heelflip | 350 | 0.44 s |

A short direction tap selects the trick. Continuing to hold left/right also rotates the rider using the existing air-turn rules. Direction is captured at the button edge, including buffered input, so releasing/changing the stick during the catch does not change the queued trick.

Square deck tricks have their own input path. The park does not start the ordinary body attack or apply its upward correction. A late press buffers for 0.18 seconds through a flip catch; the pre-ollie chord remains 0.10 seconds. Square during an ordinary grab starts its existing release, then performs the queued flip. A still-held Circle cannot grab the flipping deck again. A late Circle press can likewise wait for the flip catch, provided Circle remains held. Holding Square does not automatically repeat flips. A direction already consumed by an ordinary trick cannot seed a later special: Left+Square then Right+Square remains Kickflip then Heelflip even with a full meter.

The deck uses its local frame in street and vert air. Kick/heel rolls have opposite signs; shove-its yaw 180 degrees; varials combine a half-shove and full flip. Completed half-shoves retain their deck orientation. Impossibles include a rear-foot orbit, while hardflips and inward heels use a steeper scoop. Feet tuck/flick above the stable catch plane, and only then does the deck rotate. The sole solver cannot pull the rider through a rotating board. A catch that finishes on the landing tick scores exactly once; an unfinished park flip bails. Ordinary non-park late-flip forgiveness is retained.

## Grab loadout

These are a custom, consistent loadout, rather than a claim that every THUG character used the same diagonals. Names and poses remain latched from entry through release; rotating cannot rename the grab, refund an old usage count, or reprice its base.

| Direction + Circle (keyboard Q) | Grab | Base | Initial hold rate |
| --- | --- | ---: | ---: |
| Right or neutral | Indy | 300 | 500/s |
| Left | Melon | 300 | 500/s |
| Up | Nosegrab | 300 | 500/s |
| Down | Tailgrab | 300 | 500/s |
| Up + left | Method | 350 | 550/s |
| Up + right | Mute | 350 | 550/s |
| Down + left | Stalefish | 350 | 550/s |
| Down + right | Japan | 350 | 550/s |

Release before landing: the existing 0.15-second return animation is part of the landing requirement. The park's down + Circle remains a Tailgrab in air; the other levels retain their authored slam behavior where applicable.

## Grind loadout

Triangle (keyboard E) catches the rail. A fresh press with a direction changes style, with at least a quarter second between changes. Left/right catches choose Boardslide or Lipslide from the actual approach over the rail.

| Direction + Triangle | Grind | Base | Initial hold rate |
| --- | --- | ---: | ---: |
| Neutral | 50-50 | 100 | 300/s |
| Up | Nosegrind | 125 | 330/s |
| Down | 5-0 | 125 | 330/s |
| Left/right | Boardslide | 200 | 400/s |
| Left/right over the rail | Lipslide | 200 | 400/s |
| Up + left/right | Crooked Grind | 150 | 360/s |
| Down + left | Smith Grind | 150 | 360/s |
| Down + right | Feeble Grind | 150 | 360/s |

Duration grows the existing trick's points without adding multipliers. Below 4 m/s, grind duration pay is proportional to travel speed; a stationary rail earns no hold points. Manuals, lip stalls and wallrides retain their existing base/initial tick values but now obey the same repetition and long-hold rules.

## Specials and animation boundaries

| Command with SPECIAL lit | Trick | Base | Duration |
| --- | --- | ---: | ---: |
| Left, right + Square | Kickflip McTwist | 2,500 | 0.78 s |
| Right, down + Circle | The 900 | 3,000 | 0.90 s |
| Left, right + Triangle | Darkslide | 1,800 | held; initial 500/s |

The McTwist now combines a backflip and half-twist around the hips, with a deck flip, and carries the completed half-turn into landing. The 900 owns its full rotation rather than accepting ordinary steering during the move. Their included rotation does not mint a second trick multiplier. Darkslide inversion occurs after foot seating so its inverted deck cannot drag the rider below the rail.

These remain procedural animations. Grab shoulder/elbow poses approximate the named silhouettes; exact hand-to-deck attachment and original Neversoft clip reproduction are not implemented. Visual polish and hand contact could not be reviewed on the locked desktop, and the user requested this release proceed without that review. No emulator timing comparison is claimed.

## Scoring and repetition

Each named trick pays 100%, 75%, 50%, 25%, then 10% of its value. Counts include previous landed combos in the current run and earlier uses in the active combo. A clean bank commits the pending counts once. A bail discards only the pending counts; it neither penalizes unlanded attempts permanently nor refreshes landed history. Hard restart, level start and each new competition run reset history. Soft respawn retains it, and a suspended parent level's history is restored on return from a bonus stage.

Base and duration points use the same captured repetition factor. Rounding is applied to the cumulative raw value, retaining fractional increments even at the 10% floor. Duration ticks do not add combo multipliers. World rewards such as boxes and fruit stay outside trick depreciation and SPECIAL income.

Hold rates are prototype balance choices, not a literal copy of frame-dependent reference script increments. They stay at their initial rate for two seconds, then decline gradually with continued holding. The integrated duration value is `rate × [2 + 6 ln(1 + (seconds − 2) / 6)]` after two seconds. Hold scoring remains unbounded; the existing unlimited final-combo overtime is preserved.

Examples before combo multiplication:

- First Kickflip: 100. The same move after banking it: 75. Bailing that second attempt leaves the next attempt at 75.
- A fresh 50-50 held for two seconds at normal travel speed: 700. Its next use with the same duration: 525.
- A fresh one-second Indy: 800. Holding it longer increases its value, while changing the stick does not create another grab or multiplier.
- A ten-second fresh 50-50: about 2,225, versus 3,100 without the long-hold reduction.

The competition's 12,000-point clean-run target is unchanged. Rotation scoring retains the prototype's existing per-180 bonus and grab merge rule; this release does not reproduce the full reference stance/nollie/spin-multiplier system. Variety and linking receive most of their reward through the existing combo multiplier.

## Verification

`tools/test-skate-tricks.mjs` runs all eight flips through real vert takeoffs and clean landings on all four walls (32 cases). It checks apex gravity, attack-cooldown independence, captured input directions, buffered flip/grab chains, non-repeating holds, latched grabs, finite poses, catch orientation continuity, same-tick catches, late-flip bails, both aerial specials, and the full bank/bail/reset/bonus-return history lifecycle. The maximum rider-root offset observed during ordinary flips is 0.160 m. Duration tests cover multiplier ownership, rounding, frame subdivision, softening and zero-speed pay.

The competition suite also passes its 24 reference vert returns, 24 terminal contacts, 3,117 supplied replay frames, 19,200 stress frames, grind-camera handoffs, 49 bail-recovery cases, varied-park routes, unlimited overtime and controller-menu checks. The new guide is covered by controller-open/back/focus tests. All repository checks, TypeScript and the production bundle passed. The final focused rerun also passes the ordinary-command consumption guard, preventing accidental specials from consecutive ordinary tricks.

For future visual review, `/trick-review.html?playtest&level=jungle-cup` provides actual vert routes, all flip/grab selections, buffered chains, specials, grind accrual, pause/one-frame controls and side/front/follow views. This entry is local-only and is not included in the production build.

## Grabless rotation feedback correction — 2026-09-09

Degree-only rotations were scored internally but excluded from `comboHasTrick`, hiding their live plate and cash-in callback and failing to own competition overtime. They now use the same visible combo lifecycle as other scored tricks. A bare board rotation projects its pending score once it reaches the normal landing-tolerance window around a half-turn; a 90-degree quarter turn does not advertise a landable 180. Actual payment still requires a judged landing, and a bail discards the pending award.

Jungle Cup credits player-controlled vert rotations from 180 degrees. Its automatic drop-in turn is tracked separately and adds no spin credit. Legacy non-park pipe minimums remain intact. Existing per-half-turn points, repeat decay, sketchy reduction and combined grab/spin behavior are preserved. `check:bare-spins` exercises real ollie 180 and vert 180/360 input in both directions, visible pending/landed scores, one cash-in/multiplier, exact awarded points, overtime and bail/no-spin guards. The local `spin-review.html?playtest&level=jungle-cup` exposes pause-at-air/landing review controls without completing or saving an event.
