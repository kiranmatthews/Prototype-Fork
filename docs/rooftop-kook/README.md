# Rooftop Relay — Kook Town

An ongoing affluent Outer Banks art and gameplay pass: cedar-shingled estates, green and coral metal roofs, ivory trim, columned clubhouses, hydrangeas, striped parasols and coastal trees. The course stays on rooftops. Analytic height fog hides the missing ground and follows the downhill grade; there are no visible fog planes, roads or sea surface below it.

References combine [Netflix’s Outer Banks location guide](https://www.netflix.com/tudum/articles/outer-banks-filming-location-guide), Tannyhill/Lowndes Grove, Kiawah’s Island Club and [Nags Head’s residential design guidance](https://nagsheadnc.gov/DocumentCenter/View/370/Residential-Design-Manual-PDF). Original ImageGen screenshot studies are in [studies](studies/). Provenance and credits are documented in the [art kit](../../tools/rooftop-kook-assets/README.md).

## Current playable changes

- Forty-four main roofs, nine branch roofs, six district checkpoints and one finish gate. The redundant finish checkpoint and directional arrows are removed.
- Final districts add 6.8 m, 8.2 m and 9.6 m transfers, wider approaches and roof pitches up to 10.2 m. The opening stays at its original height. The first four districts retain 364 of 365 original gameplay component geometries; one transition pit footprint follows the edited next district. See the [geometry comparison](validation/preservation.json).
- Convex roof spines grind through the existing surface-edge system. They add no obstacle collision, so ordinary landings do not cause a rail bail. Movement tuning is unchanged.
- Roof UVs follow each roof’s pitch and longitudinal direction. An ImageGen height map gives standing seams a light-responsive bump surface. Branch materials use depth bias to prevent coplanar flashes at merges.
- Supplies occupy terrace margins, masks precede later challenges, and rewards follow large transfers. Metal catering cases provide actual bullet cover while leaving the centre lane and branch junctions open.
- Three courtyard encounters contain three Karen lookouts and four Kook gunners. Lookouts require sustained sight, visibly wind up, then screech. Alarms wake only their own courtyard’s gunners. Gunners wake, aim, commit to a target, fire a visible projectile, and reload. Cover, interrupting the lookout, and spinning or stomping enemies provide counterplay. Defeating a gunner clears its shots; resets restore the encounter.
- New Meshy wet-weather characters retain native geometry, PBR maps and skeletons. Imported gestures blend with individual spine elasticity and planted hand/foot contacts. The heirloom shotgun is also a native Meshy asset; supplemental finger joints curl the original hand surface around it. Alerts, gun cues and the rain loop are original synthesized audio.
- Wind-driven rain, roof splashes, restrained camera beads and wet metal/paving traction support the brewing cyclone. Native 2560×1440 review includes continuous three-angle enemy motion and actual alarm, firing and cover interactions.

## Global rendering policy

Distance-based geometry replacement is disabled in shared scenery, Blockworks, hazard and Hollowwake tunnel renderers. Native geometry remains in main views and reflections. Legacy distance-LOD metadata is ignored; offscreen streaming and invisible shadow proxies still work. No visible THREE.LOD controllers remain in the reviewed level families.

## Verification

Focused checks cover safe landing/grind catches on all 18 pitched roofs, alarm visibility and interruption, group isolation, attack timing, real crate cover, and resets. Native controller runs complete the main and crystal routes with zero deaths and unchanged tuning. Both enlarged late districts also pass on foot using the existing double jump.

Chrome review uses MAX resolution at 2560×1440 with CRT disabled for inspection, without changing the user’s preferences. Production evidence includes traversal, screenshots, checkpoint recovery and a seven-level check of geometry at several distances. Release gates are check:levels, TypeScript/Vite build and the existing 1 GB hosting budget; no unrelated check:all run.

Reports live in [validation](validation/), [enemy review](enemies/), [native roof views](native/) and [global detail review](native-global/). Older reports may precede later iterations; build stamps and source hashes identify the reviewed version.
