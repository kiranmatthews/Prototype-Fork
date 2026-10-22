# School · Miami reference reconstruction

Source-owned free skate level: `school-miami`. Open `/?playtest&level=school-miami`; add `&lite` for a quick preview. The local review page at `/tools/school-review.html` provides an overview, landmark views, a full-render switch, and repeatable live-game checks. The level is exported through `src/levels/codex-lab.ts` and registered in the built-in level registry. It is a local reference session opened through the direct playtest URL; it is not added to campaign progression.

## Reference and scale

The supplied reference is VGCartography's oblique map of the original **Tony Hawk’s Pro Skater — School, Miami**. Its layout, rather than the later School II level, is the basis for this reconstruction:

- [VGCartography: School map](https://www.deviantart.com/vgcartography/art/Tony-Hawk-s-Pro-Skater-School-Map-947728299).
- [Planet Tony Hawk: original School guide](https://planettonyhawk.gamespy.com/View6a21.html?id=3&view=thps_faqs_guides.Detail), used to verify the starting canopy, stair/green-rail route, pools, and hill → gym roof → air conditioner → plank → long awning route.
- [HGW 2017: original PS1 School all-gaps footage](https://www.youtube.com/watch?v=UC1iKl9Va8g), used for the separate roof landing and original obstacle relationships.
- [Tom Hayes: original THPS walkthrough](https://www.supercheats.com/playstation/walkthroughs/tonyhawksproskater-walkthrough01.txt), used to cross-check the named gap/rail relationships.

`schoolMapPoint()` reverses the map's oblique projection, including elevation displacement. World units remain metres. The scale anchors are a 28 × 15 m basketball court, 0.76 m picnic-table tops, 3.2 m deep-pool transitions, and the existing skater. The upper court is Y=0, lower campus Y=−5, gym roof Y=7, and starting canopy Y=3.4.

**Precision limit:** one oblique image does not establish original collision dimensions or traversal timings. This is a calibrated reconstruction of the visible arrangement, using inferred heights and widths; it is not an extracted original level or independently verified centimetre-for-centimetre copy. Original game textures, score/tape challenges and loading portals are not reproduced. The gym is physically connected beneath its roof.

## Playable features

- Starting blue canopy, eight traced planters and five picnic-table locations. Four planters sit between the canopy and classroom; four sit beneath/in front of it. The native canopy drop connects to the forward planter's coping for Gimme Gap.
- Main classroom block, winding classroom wings, west planter descent, its low transfer wedge, and Long Ass Rail; the Hall Pass connection remains under review.
- Smooth downhill stair/handicap corridor, separate descending green handrail, long blue canopy and facing Kicker Gap ramps.
- Two excavated swimming pools with continuous curved transitions, flush rims, diving boards and Swim Team transfer rail. A charged ollie released at the lip clears directly into the other basin in either direction. The foundation has real holes, so no invisible floor spans a basin.
- Winding opposing halfpipe walls traced from the source coping lines, continuous outer perimeter quarter, Huge Rail corridor, rear playground, funboxes, mural rail and Park Gap return. The inner quarter has the small Mini Gap near the playground bend. Its narrow floor follows the space between the lips and connects to the pool deck. The 1.25 m transition rise is inferred from that footprint and the existing skater.
- Open drainage ditch with banked sides, low bed, end roll-outs and three arched footbridges. Ditch Slap clears the open trench between bridges in both directions. Crossing a bridge and skating beneath it use different real surfaces. A narrow wedge in the bed launches over the third footbridge and lands back on the yard.
- Accessible gym interior with a full-scale court and two long opposing quarterpipes. Roof deck, perimeter quarters, air conditioner and facing kickers, skylight, vent hips, dumpster rail gap and rear service quarter. A curved row of low garbage crates and its separated final crate occupy the rear corner.
- Separate fenced bonus roof across a real 4.5 m roof-edge gap, with its north/east quarter and small wedge. A charged forward vert exit from the gym coping reaches it.
- The service hill climbs from the rear alley toward the front of the gym, then turns left through a split in the east coping toward the air-conditioner kicker. Brake to cruising speed for that turn. The plank clears the north roof edge before descending onto the long awning.
- Five native checkpoint crates and out-of-bounds recovery. As a native free skate level, it has no finish gate that would terminate a line.

The work adds level data and local review tools. It does not modify `src/tuning.ts`, the movement controller, or the shared component builders. Explicit grind paths cover real lips/rails; incidental platform edges are opted out. Cosmetic treads, windows, court paint and tile skins do not add collision obstacles.

## Validation

Run `node tools/test-school-miami.mjs`, `npm run check:levels`, and `npm run build`. Do not substitute `check:all` for the focused workflow.

The School regression test builds the real level and player, validates editor JSON, raycasts supports/clearances, drives thirteen route cases, clears twenty-three jump/vert cases, and tests seven grind cases. It uses the same unit-clamped, two-decimal input axes as the game. It checks both directions across all three bridges, both Kicker Gap directions, both pool-air directions, the charged roof climb and braked top turn, the air-conditioner gap, Roof 2 Roof at two speeds, Over a Footbridge at two speeds, Mini Gap coping transfer and rollout, plank-to-awning landing, and both downhill-rail directions, both direct pool-to-pool transfers, both Ditch Slap directions, Garbage Ollie over the actual crate, and the complete dumpster rail transfer through a grounded rollout. Accepted cases have zero bails and finite positions. Tuning must remain unchanged.

Both lite and full rendering pass all thirty live cases (5,777 fixed steps each), including the banked checkpoint return. The review recorded one browser `ResizeObserver loop completed with undelivered notifications` layout notification during each sequence; this is retained in the evidence rather than suppressed. No skating check failed. The review tab also recorded one `MutationObserver.observe` error during reload; its cause has not been isolated. A fresh standalone full-render session with ordinary input produced no console errors or warnings (`school-miami-browser-fresh.json`). The review console entry is retained separately (`school-miami-browser-review-console.json`).

Swim Team requires the first landing after leaving one pool to occur inside the other basin; an intermediate landing on the shared deck fails. Dumpster Rail Gap requires the intended takeoff rail, the intended receiving rail for at least eight frames, and a grounded rollout. Garbage Ollie must pass above the real last crate. The four street transfers and Park Gap likewise require at least eight frames on the exact receiving rail followed by a supported landing. These checks prevent a nearby landing or a transient rail catch from being counted as the named gap.

The roof Mini Gap check requires both named copings and an ollie back onto the roof. Each full long-grind check requires reaching the end of its specific rail and landing on supported ground; it uses the ordinary balance axis, with no special or balance boost.

The browser review runs ordinary virtual-controller input through the real frame loop. A placement isolates each feature; the rider's trajectory is never corrected during a route. The one intentional exception is the fall probe after banking a checkpoint, which places the rider outside the campus and observes the native death/respawn cycle. The live sequence begins at the native spawn without a placement override, then covers the downhill, Kicker Gap, both pools, roof hill, winding halfpipe, gym entrance, roof gap, plank, rail and checkpoint recovery.

`tools/school-circuit.ts` adds a complete native-spawn circuit shared by the headless and live browser tests. It follows the canopy → Gimme Gap planter grind → downhill → Kicker Gap → rear perimeter → winding corridor → pool deck → west uphill → upper court. All 48 waypoints complete in 2,316 live fixed steps (38.6 simulated seconds), travelling 381.8 m with 21 frames on the intended planter rail and 525 frames grinding uphill on Long Ass Rail. A normal side ollie exits onto the upper court. There are no intermediate placements, velocity changes, or resets. The controller brakes to cruising speed before the narrow bends and to walking speed at the tight pool-end turn, using the ordinary grab/brake button.

Validation ran against the shared working tree, which contains unrelated runtime edits outside the School commits. `docs/performance/school-miami-runtime.json` fingerprints the tested movement/input/level files; repeat the checks after integrating the local commits with the intended runtime.

Evidence lives in `docs/performance/school-miami-physics.json`, `docs/performance/school-miami-browser-lite.json`, `docs/performance/school-miami-browser-full.json`, and `docs/art-reviews/school-miami/`.

## Remaining reference work

The third comparison adds the separate bonus roof, west-descent wedge and ditch launch ramp, and corrects the service hill direction. The fourth pass adds the curved garbage row and proves the direct Swim Team transfers, Ditch Slap in both directions, Garbage Ollie and the dumpster transfer through rollout. The remaining audit covers Hall Pass and rail-to-rail planter relationships, the planter chain, and remaining boundary/detail differences. The fifth pass narrows and shifts the roof Mini Gap toward its source corner, joins the west/north quarter around that corner, and lifts the plank clear of the receiving coping. Full Long Ass, Huge and Playground grinds now reach supported rollouts using normal balance input, without balance assists. The sixth pass corrects the halfpipe footprint from traced lips, rotates the rear picnic table to its source axis, narrows the rear classroom to clear the lane, and adds the supported pool-end connection. Funbox to Huge Rail, Funbox to Table, Funbox to Playground Rail, the west wedge to Long Ass Rail, and Park Gap now all reach their intended receiving rails and supported rollouts. Existing geometry for a name is not yet proof that its complete source transfer works. These remain part of the active recreation goal.

No original School `.psx`/`.trg` files or extracted mesh were found in this workspace. To remove dimensional uncertainty, the original School geometry or an extracted mesh would allow an independent comparison. [Neversoft Multitool](https://github.com/slfx77/neversoft-multitool) documents PSX geometry-to-glTF and TRG rail/spawn extraction. The [THPS native port](https://github.com/LANCommander/TonyWasAProSkater) likewise requires the user's own original game data and does not supply it. The older noclip viewer listed a THUGPro School port, but that renderer was removed and its historical public data URL is unavailable; it was not used as dimensional evidence.

With those files, compare a common court/roof scale, pool lips and floors, rail endpoints and slopes, jump takeoff/landing edges, and the service-hill/awning connections. Preserve the existing skater movement model while correcting geometry. Until that comparison is possible, treat this as a validated playable map reconstruction; strict original 1:1 fidelity remains unverified.

## Local delivery

Keep this result local under the repository's temporary slow-network workflow. Do not change `public/levels.json`, push, upload screenshots, or trigger Pages deployment. The local commit isolates these files and the two registration edits from unrelated work in the shared checkout.
