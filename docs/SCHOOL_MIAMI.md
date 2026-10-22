# School · Miami reference reconstruction

Source-owned free skate level: `school-miami`. Open `/?playtest&level=school-miami`; add `&lite` for a quick preview. The local review page at `/tools/school-review.html` provides an overview, landmark views, a full-render switch, and repeatable live-game checks. The level is exported through `src/levels/codex-lab.ts` and registered in the built-in level registry. It is a local reference session opened through the direct playtest URL; it is not added to campaign progression.

## Reference and scale

The supplied reference is VGCartography's oblique map of the original **Tony Hawk’s Pro Skater — School, Miami**. Its layout, rather than the later School II level, is the basis for this reconstruction:

- [VGCartography: School map](https://www.deviantart.com/vgcartography/art/Tony-Hawk-s-Pro-Skater-School-Map-947728299).
- [Planet Tony Hawk: original School guide](https://planettonyhawk.gamespy.com/View6a21.html?id=3&view=thps_faqs_guides.Detail), used to verify the starting canopy, stair/green-rail route, pools, and hill → gym roof → air conditioner → plank → long awning route.
- [Tom Hayes: original THPS walkthrough](https://www.supercheats.com/playstation/walkthroughs/tonyhawksproskater-walkthrough01.txt), used to cross-check the named gap/rail relationships.

`schoolMapPoint()` reverses the map's oblique projection, including elevation displacement. World units remain metres. The scale anchors are a 28 × 15 m basketball court, 0.76 m picnic-table tops, 3.2 m deep-pool transitions, and the existing skater. The upper court is Y=0, lower campus Y=−5, gym roof Y=7, and starting canopy Y=3.4.

**Precision limit:** one oblique image does not establish original collision dimensions or traversal timings. This is a calibrated reconstruction of the visible arrangement, using inferred heights and widths; it is not an extracted original level or independently verified centimetre-for-centimetre copy. Original game textures, score/tape challenges and loading portals are not reproduced. The gym is physically connected beneath its roof.

## Playable features

- Starting blue canopy, eight traced planters and five picnic-table locations. Four planters sit between the canopy and classroom; four sit beneath/in front of it. The native canopy drop connects to the forward planter's coping for Gimme Gap.
- Main classroom block, winding classroom wings, west planter descent and Long Ass Rail / Hall Pass lines.
- Smooth downhill stair/handicap corridor, separate descending green handrail, long blue canopy and facing Kicker Gap ramps.
- Two excavated swimming pools with continuous curved transitions, flush rims, diving boards and Swim Team transfer rail. The foundation has real holes, so no invisible floor spans a basin.
- Winding opposing halfpipe walls, continuous outer perimeter quarter, Huge Rail corridor, rear playground, funboxes, mural rail and Park Gap return. The inner quarter has the small Mini Gap near the playground bend; a continuous flat lane joins its independently swept sections.
- Open drainage ditch with banked sides, low bed, end roll-outs and three arched footbridges. Crossing a bridge and skating beneath it use different real surfaces.
- Accessible gym interior with a full-scale court and two long opposing quarterpipes. Roof deck, perimeter quarters, air conditioner and facing kickers, skylight, vent hips, dumpster rail gap and rear service quarter.
- Eased service-hill climb and broad roof-entry bend. The plank clears the north roof edge before descending onto the long awning.
- Five native checkpoint crates and out-of-bounds recovery. As a native free skate level, it has no finish gate that would terminate a line.

The work adds level data and local review tools. It does not modify `src/tuning.ts`, the movement controller, or the shared component builders. Explicit grind paths cover real lips/rails; incidental platform edges are opted out. Cosmetic treads, windows, court paint and tile skins do not add collision obstacles.

## Validation

Run `node tools/test-school-miami.mjs`, `npm run check:levels`, and `npm run build`. Do not substitute `check:all` for the focused workflow.

The School regression test builds the real level and player, validates editor JSON, raycasts supports/clearances, drives thirteen route cases, clears eight jump/vert cases, and tests three grind cases. It uses the same unit-clamped, two-decimal input axes as the game. It checks both directions across all three bridges, both Kicker Gap directions, both pool-air directions, the charged roof climb, the air-conditioner gap, Mini Gap coping transfer and rollout, plank-to-awning landing, and both downhill-rail directions. Accepted cases have zero bails and finite positions. Tuning must remain unchanged.

Both lite and full rendering pass all thirteen live cases (3,348 fixed steps each), including the banked checkpoint return. The review recorded one browser `ResizeObserver loop completed with undelivered notifications` layout notification during each sequence; this is retained in the evidence rather than suppressed. No skating check failed.

The browser review runs ordinary virtual-controller input through the real frame loop. A placement isolates each feature; the rider's trajectory is never corrected during a route. The one intentional exception is the fall probe after banking a checkpoint, which places the rider outside the campus and observes the native death/respawn cycle. The live sequence begins at the native spawn without a placement override, then covers the downhill, Kicker Gap, both pools, roof hill, winding halfpipe, gym entrance, roof gap, plank, rail and checkpoint recovery.

`tools/school-circuit.ts` adds a complete native-spawn circuit shared by the headless and live browser tests. It follows the canopy → Gimme Gap planter grind → downhill → Kicker Gap → rear perimeter → winding corridor → pool deck → west uphill → upper court. All 44 waypoints complete in 1,747 live fixed steps (29.1 simulated seconds), travelling 375.3 m with 21 frames on the intended planter rail. There are no intermediate placements, velocity changes, or resets. The controller brakes to cruising speed before the narrow bends, using the ordinary grab/brake button.

Evidence lives in `docs/performance/school-miami-physics.json`, `docs/performance/school-miami-browser-lite.json`, `docs/performance/school-miami-browser-full.json`, and `docs/art-reviews/school-miami/`.

## Remaining reference work

The second comparison found missing or insufficiently verified details that still need a geometry pass: the separate roof-to-roof bonus area, the smaller west-descent transfer ramp, the ditch ramps used to jump over a footbridge, and the remaining named rail/air transfers. These are part of the active recreation goal; the passing circuit does not establish that all source features are present.

No original School `.psx`/`.trg` files or extracted mesh were found in this workspace. To remove dimensional uncertainty, the original School geometry or an extracted mesh would allow an independent comparison. [Neversoft Multitool](https://github.com/slfx77/neversoft-multitool) documents PSX geometry-to-glTF and TRG rail/spawn extraction. The [THPS native port](https://github.com/LANCommander/TonyWasAProSkater) likewise requires the user's own original game data and does not supply it. The older noclip viewer listed a THUGPro School port, but that renderer was removed and its historical public data URL is unavailable; it was not used as dimensional evidence.

With those files, compare a common court/roof scale, pool lips and floors, rail endpoints and slopes, jump takeoff/landing edges, and the service-hill/awning connections. Preserve the existing skater movement model while correcting geometry. Until that comparison is possible, treat this as a validated playable map reconstruction; strict original 1:1 fidelity remains unverified.

## Local delivery

Keep this result local under the repository's temporary slow-network workflow. Do not change `public/levels.json`, push, upload screenshots, or trigger Pages deployment. The local commit isolates these files and the two registration edits from unrelated work in the shared checkout.
