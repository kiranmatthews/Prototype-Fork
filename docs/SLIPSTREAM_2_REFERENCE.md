# Slipstream 2: Rude Awakening end-zone study

Study date: 5 October 2026. This is the reference work for the requested on-foot temple opening. The skate aqueduct that follows is an original Slipstream continuation. World-unit dimensions below are authoring choices for this prototype; they are not measurements of Crash 4.

## Evidence and method

The final temple was inspected directly in two gameplay recordings in a browser, seeking through the route and comparing individual paused frames. The second recording was also replayed at 0.25× around the paired moving decks. A separately published still was inspected to cross-check the wall composition. The recordings have different collectible pacing, so their timestamps cannot be substituted for one another.

### ProsafiaGaming: primary spatial pass

[Crash Bandicoot 4 walkthrough, part 1](https://www.youtube.com/watch?v=NUpRkHjFpqM). Directly inspected frames:

| Time | Visible evidence |
| --- | --- |
| [5:30](https://www.youtube.com/watch?v=NUpRkHjFpqM&t=330s) | Last interior stone passage. |
| [5:40](https://www.youtube.com/watch?v=NUpRkHjFpqM&t=340s) | Exposed round skull pillars above a deep ravine; crates complicate the crossing. |
| [5:45](https://www.youtube.com/watch?v=NUpRkHjFpqM&t=345s) | Supported wall-foot landing and small rising stone shelves. |
| [5:55](https://www.youtube.com/watch?v=NUpRkHjFpqM&t=355s) | Broad right shelf and side-on wall composition. |
| [6:00](https://www.youtube.com/watch?v=NUpRkHjFpqM&t=360s) | Staggered lower climb towards the left. |
| [6:05](https://www.youtube.com/watch?v=NUpRkHjFpqM&t=365s) | Left refuge; next timed deck lies to its right. |
| [6:10](https://www.youtube.com/watch?v=NUpRkHjFpqM&t=370s) | Mid-wall jump between projecting decks. |
| [6:15](https://www.youtube.com/watch?v=NUpRkHjFpqM&t=375s) | Right refuge and crate overhead. |
| [6:20](https://www.youtube.com/watch?v=NUpRkHjFpqM&t=380s) | Upper leftward return. |
| [6:25](https://www.youtube.com/watch?v=NUpRkHjFpqM&t=385s) | Summit shelf, stacked crates, and rightward exit. |

The wall reads as three switchback passes, with a stable shelf at each reversal. Pale fixed steps alternate with bronze/teal projecting mechanisms. Narrow dark openings and descending vines separate heavy masonry masses. The camera keeps upcoming landing surfaces visible above the player.

### YTSunny: independent route and motion check

[Rude Awakening 100% walkthrough](https://www.youtube.com/watch?v=NhDCcDg_UOc). Directly inspected frames:

| Time | Visible evidence |
| --- | --- |
| [5:29](https://www.youtube.com/watch?v=NhDCcDg_UOc&t=329s) | Wall-foot stair approach. |
| [5:34](https://www.youtube.com/watch?v=NhDCcDg_UOc&t=334s) | Wide right-hand checkpoint shelf. |
| [5:39](https://www.youtube.com/watch?v=NhDCcDg_UOc&t=339s) | Lower leftward climb; enemy occupies the left refuge. |
| [5:44](https://www.youtube.com/watch?v=NhDCcDg_UOc&t=344s) | Player stands on the left timed deck of the middle traverse. |
| [5:45](https://www.youtube.com/watch?v=NhDCcDg_UOc&t=345s) | Airborne towards the right timed deck; usable top is exposed. |
| [5:49](https://www.youtube.com/watch?v=NhDCcDg_UOc&t=349s) | Right refuge, projectile enemy, and suspended crates. |
| [5:54](https://www.youtube.com/watch?v=NhDCcDg_UOc&t=354s) | Upper return reaches the summit crate shelf. |

Slow playback confirms the mechanisms change their exposed depth; the decorative brackets remain fixed. Upper and lower mechanisms need not present usable tops simultaneously. The two broad enemy shelves punctuate traversal and permit a pause before the next commitment. Crates extend the action upward without replacing the basic shelf route. Exact mechanism periods and world dimensions were not established from these samples.

### Still and written cross-check

[Gamepressure final-wall screenshot](https://www.gamepressure.com/crash-bandicoot-4/gfx/word/120049000.jpg) was opened directly. It shows thin stone shelves, separate bronze mechanisms, wall gaps, and bracket housings in one composition. Its [walkthrough](https://www.gamepressure.com/crash-bandicoot-4/rude-awakening/z2da49) distinguishes the collapsing skull-pillar crossing from the timed summit platforms. [Neoseeker sections 6–7](https://www.neoseeker.com/crash-bandicoot-4-its-about-time/walkthrough/Rude_Awakening) likewise describes the ravine approach followed by left/right/left climbing. Neoseeker's full page was unavailable to the browser fetch; its indexed section text was only supplementary evidence.

## Design conclusions

The useful reference is a rhythm of commitments and refuges. For this prototype, the opening should alternate a small supported jump, a timed landing, a wider place to settle, another timed landing, and a balcony that announces the reversal. Repeated rows alone would create a ladder; different ledge widths, mechanical depths, and architectural intervals make the ascent legible.

The ravine approach and the wall climb serve different purposes. The approach establishes the cost of falling and precise footing. The wall concentrates the route into a clear side-on composition. The Slipstream adaptation can use a short entry court and the first rising ledges to teach this distinction without reproducing an entire preceding Crash cave or adding enemy combat to a request for pure platforming.

The side view should show at least the current surface, the next landing, and the next refuge. A broad empty shaft beneath each traversal exposes the height gained. A moving deck needs a fixed architectural anchor: a housing, a shadowed recess, or a corbel makes motion understandable. A decorated cube moving in open space communicates a ferry instead.

## Original prototype adaptation

The source-owned level is `src/levels/slipstream-2.ts`. It uses the existing `platform`, `mover`, `wall`, `checkpoint`, `camnode`, `decor`, `wumpa`, and `crate` components for the opening. Its geometry uses the shared movement model.

The validated temple geometry is:

| Element | Chosen prototype value / role |
| --- | --- |
| Entry support | 7 × 6 m court at 150 m elevation. |
| Main route | Three ascending passes across approximately 32 m of facade. |
| Ledge rhythm | Six ledges per pass; two timed ledges, four fixed ledges. |
| Height step | 1.8 m between successive jump targets. |
| Centre spacing | Approximately 4.8 m along each pass. |
| Fixed target footprint | Generally 3.2 × 3.8 m; the central resting ledge widens to 4 m. |
| Timed target footprint | 3.2 × 3.8 m, using the existing depth-axis mover. |
| Retraction geometry | Centre 2 m behind the fixed-ledge lane; 3 m travel amplitude in depth. |
| Facade collision | Three invisible 0.3 m thin boundaries, each with 19.8 m collision height. |
| Refuges | Wide 7 × 6 m balconies at pass ends, with supported checkpoints. |
| Corner transfers | Supported balconies carry the player between passes. |
| Height reward | Summit approximately 37.8 m above the entry, followed by a clear board-mounting deck. |
| Camera | One authored side-on volume over the facade plus the ordered route lane. |

Native traversal verifies the authored jumps, supported collision, moving-platform carry, and connected summit balconies. The evidence below distinguishes these simulation results from visual browser review and publication.

The intended visual language is original pale sandstone with moss, turquoise accents, projecting cornices, vertical pilasters, and vines. The reference's dimensional hierarchy transfers well: very large facade masses, medium refuge shelves, small jump targets, and thinner mechanical supports. It does not require copying its skull motifs, sculpture, textures, or other assets.

Per-mover recesses and corbels now align with each mover's actual height, replacing a single ornamental line near the top of every tier. A shallow dark block behind the target and three progressively narrower visual blocks beneath it provide the architectural anchor with existing primitives. The recesses, corbels, pilasters, facade panels, and cornices use scenery-only `decor` blocks so these ornaments cannot introduce an unintended route or prevent a moving landing.

## Motion and collision verification

`mover.p.y` is its top surface; `platform.p.y` is its centre. Confusing those conventions changes the climb height. `decor` block positions are also centres, while `ruinblock` positions are bases. The latter currently adds real ground and wall collision despite an outdated scenery-only comment in its builder; do not treat every decorative component as non-colliding. The mover's `speed` is angular frequency: a value of 0.85 gives a roughly 7.4-second sine cycle, rather than 0.85 seconds per cycle. `phase: Math.PI` opposes another deck on the same frequency; different frequencies drift over a long run.

The initial 3.8 m deep deck with only 1.35 m displacement retained an exposed surface throughout the cycle. The revised centre lies 2 m behind each fixed-ledge lane and travels 3 m each way. With row depth denoted by Z, the facade front is Z−3 m: the extended deck reaches Z+2.9 m, while its fully retracted front reaches Z−3.1 m. Thus the entire deck disappears geometrically behind the facade by 0.1 m. Facade masonry spans the row's reference height minus 7.4 m through plus 12.6 m, covering both mechanisms and the final refuge height.

Geometric occlusion does not itself remove native mover collision. The final level adds a thin facade boundary that prevents concealed rides. The waiting-rider test begins supported on the first mechanism, lets it retract without player input, and verifies loss of support, no wall-interior penetration, and one fatal fall. The mechanism centre reaches Z−4.999992 m, proving the complete 3 m inward stroke. All six mechanisms share this geometry; the complete journey lands on every one. The idle-rider failure test specifically covers the first mechanism rather than claiming six independently tested failures.

The native journey uses the course camera direction through every reversal and supported corner transfer. Architectural collision was reviewed separately: ruin buttresses cannot bridge the 12.6 m tier rise, and aqueduct piers do not span the missing road segments. The scenery-only corbels and recesses add no supporting shortcut.

The moving sequence should remain readable after an imperfect approach. A player who arrives just as a deck recedes needs a stable place to wait. The useful challenge is seeing a landing window and committing to it; avoid demanding a blind jump towards a completely hidden surface. Finite waits and generous refuges are particularly valuable before the long, speed-dependent skate section begins.

## Original skate continuation

After the on-foot summit, twelve flights interrupt the winding aqueduct. Their final clear centreline widths range from 28 m to 33.898 m. Each run-up permanently descends 14 m over 40 m, immediately followed by a 9 m long kicker rising 2.5 m and a 6 m flat launch shelf. The descent earns speed through the existing gravity-track rules; geometry supplies the energy rather than a boost component. A flat lip makes simply rolling off insufficient.

The amber stripe spans stations a−9 through a−7, centred 8 m before each gap edge a. It teaches the player to release the charged jump on the rising face. The native pilot releases at a−7.75. The launch markers sit beside the stripe and the fruit arc exposes the intended airborne direction.

Length is measured consistently along the ordered 3D lane from supported spawn to the authored finish plane, excluding road beyond the finish and any pre-spawn lane. The sequel is 2,494.560 m against the original Slipstream's 1,222.736 m: 2.040×, or approximately twice as long. The road's horizontal authoring range is 2,330 m; that number alone is not the complete playable course length. The measurement is implemented in `tools/slipstream-course-length.mjs`.

## Native acceptance evidence

The frozen level source SHA-256 is `1ab7f313e6c999f838d7e85fadaeabcf4a2971e541edc8c58b25e00ce08b5fc7`. Three native reports were checked against that source before recording these results:

| Check | Verified result |
| --- | --- |
| Complete input journey | 9,570 frames / 159.5 s; finish reached with zero deaths and no runtime errors. |
| Temple route | All 24 supported route landings, including all six retracting mechanisms. |
| Skate route | All twelve airborne gap landings and all sixteen ordered checkpoints. |
| Twelve fast charged probes | Every gap clears at measured release speeds of 33.666–34.014 m/s. |
| Twelve slow charged controls | Every gap fails at measured release speeds of 11.090–11.573 m/s. |
| Twelve rolling controls | Every gap fails when the jump is held but never deliberately released. |
| Idle retraction control | Support is lost, wall penetration is prevented, full retraction occurs, and the rider falls. |
| Published editor snapshot | Native journey verifies equality with source-owned level data. |

The three checks are `tools/test-slipstream-2.mjs`, `tools/test-slipstream-2-gaps.mjs`, and `tools/test-slipstream-2-retraction.mjs`. The gap checks exercise all 36 cases rather than inferring the twelve-gap requirement from one representative flight. They demonstrate dependence on speed and deliberate charge release; they do not establish the minimum viable speed or every possible timing window.

The user subsequently approved more forgiving huge-drop judgement. Tuning version 25 raises the apex-to-touchdown descent threshold from 12 m to 24 m and retains the 20 m/s impact threshold. `tools/test-huge-drop-bail.mjs` verifies nine natural flat drops: on-foot 12/20/23.99 m drops remain safe, 24/24.01/40 m drops bail, and the board boundary likewise distinguishes 23.99 m from 24/24.01 m. An aligned 30.473 m ramp descent remains safe because its measured impact into the surface normal is only 2.683 m/s. Five checks of the actual saved-settings loader verify untouched historical defaults adopt 24 m while deliberate distance and impact overrides survive.

The complete journey, all 36 flight controls, and retraction test were rerun under the final 24 m default with unchanged successful results. `docs/performance/slipstream-2.json` fingerprints the level, Player, and final tuning sources; its recorded tuning SHA-256 is `f06c99fede5097695309dd9a2e1b8d28fe3dac1e615335aa91fc63d45d4f5759`.

Browser visual review, console inspection, and deployed-page verification are separate release evidence recorded in `docs/LEVEL_ITERATIONS.md`. The Crash recordings establish the temple reference; the prototype's own traversal evidence establishes its skate flights.
