# Country Club art and shared racing

Country Club retains 18 independent, varied tee–fairway–green–cup layouts, with numbers and flags only at cups. Twelve complete greens remain outside the racing corridor. Its roughly 3.95 km downhill race retains seven sharp turns, six water carries, 23 boosts at 56–64 m/s, 18 excavated track pits and 30 golf bunkers. Movement tuning is unchanged.

## Visual iteration

Two built-in ImageGen paintovers of actual screenshots established the art direction: honey gravel, mown greens, sculpted trees, cream sand, blue sky, wooded hills and terracotta architecture. Compare [boost target](art-reviews/country-club-art/target-boost.webp), [bend target](art-reviews/country-club-art/target-bend.webp), [playable boost view](art-reviews/country-club-art/after-boost-start.webp) and [playable bend](art-reviews/country-club-art/after-bend.webp). The paintings remain aspirational references; the playable scene is shown separately, without claiming pixel parity.

1. Add generated turf/gravel/sand textures, warmer lighting, measured umbrella pines, planted verges and a dressed clubhouse. Review found angular leaves, a hazy sky and blank hills.
2. Generate a fuller oak and a clear cloud sky; replace most pines, improve landscape framing and keep the racing corridor open. Inspect the oak from front, quarter and rear. Preserve its detailed 61,915-triangle near mesh; use a 3,714-triangle distant LOD.
3. Add continuous wooded horizon aprons, bunker grass lips, rounded limestone kerbs, beveled blue boost inlays with visible chevrons, and clean curved terracotta roofs. Inspect gameplay and fixed views after the changes.

All added scenery is non-colliding. Both runtime trees share the existing scenery loader, instancing, distance LOD and streaming. No new movement system or tuning is introduced. Exact paintover prompts are in [prompts.json](art-reviews/country-club-art/prompts.json); asset prompts and the credit ledger are under `tools/country-club-assets/`.

## Shared Slipstream gameplay

`buildCountryClubRace` supplies navigation and jump metadata to the existing `SkateRace` controller. It owns all eight riders, countdown, items, combat, minimap, race recovery, crystals/box rewards, results and solo time trials. Four-wide mystery rows sit on supported straights away from bends, pits, jumps and boost pads. Legacy adventure checkpoint/fruit/crystal/clock components are removed from this race variant.

Two small shared fixes were necessary: rotate the starting grid with the course tangent, and let a grounded rider select reachable terrain below overhead non-vert road meshes in race levels. The latter fixes an actual ride/air oscillation that prevented two rivals finishing a wipeout. Its two recorded positions failed before the fix and recover normally afterward; ordinary air contact checks are retained.

## Validation

[Validation evidence](art-reviews/country-club-art/validation.json) records:

- All eight riders finish through normal input in full-render Chrome. Human: **104.967 seconds**; last rival: **194.900 seconds**. No deaths, fall resets or console errors. Results successfully start a one-rider time trial.
- A separate eight-rider native run finishes all racers; two lower-floor wipeout fixtures pass.
- All 18 numbered cup flags, 18 distinct green silhouettes, 36 tee markers and twelve fully separate greens pass. Audit 5,661 fast-lane support samples, 1,650 landscape samples, 92 boost corners and 108 enemy patrol samples.
- All eighteen deep track pits permit ordinary-input recovery. Required level checks and build pass; the full suite was not run.
- Relevant shared regressions pass: ragdoll recovery, solid-player contacts and every Slipstream jump after a stopped fall return. Exact old stock snapshots upgrade; edited saves stay edited.

## Assets and low-bandwidth delivery

Meshy spent **45 of 300 authorized existing credits**: 15 on the umbrella pine and 30 on the oak. Runtime manifests retain source hashes and measured bounds. The models use original near geometry and UVs; a separate reduced far mesh and JPEG atlas packing reduce runtime transfer.

The temporary slow-network policy now keeps completed changes and validation local. Defer every push, upload and deployment until the user says the network is good again. Keep the original PNG mockups, intermediate screenshots, reference images and downloaded source GLBs local for now. Do not re-upload them or run new remote asset jobs merely to duplicate existing evidence. Authoring references remain in this task worktree's `tools/country-club-assets/references/` and `.img2threejs/country-club-art/`.

Prompt-to-first complete full-render proof: **479.6 minutes** by UTC wall timestamps (2026-10-17 10:18:47 to 18:18:22). Release integration and the later resume/publish request followed.

Release integration: preserve all ten other published entries and the latest Drowned Crown, Rooftop, jungle, warehouse, cart and frog work. The combined level checks, build, native eight-rider race and production lite/full browser smoke pass. [Release evidence](art-reviews/country-club-art/release-check.json). Estimated outgoing Git pack: 7.5 MB; large originals stay local.

Deployment compatibility correction: restrict the new overhead reach filter to non-vert open roads in shared race levels. Preserve analytic halfpipes, two-sided floors and all recorded non-race movement. The 51-case world-vert audit (4,344 air frames), walking support, 44 floor/overhang/underside cases, both Country Club wipeout fixtures and the original 4,636-frame skating/audio replay pass. All eight racers finish again, and the remaining stability, competition UI, cart and production-build gates pass locally. The reproduced Country Club recovery cases join the existing deployment movement gate. Follow-up uploads contain source/evidence only; art assets are reused.


## Distant woodland image scenery · 2026-10-19

The outer ridges now use three transparent woodland images baked locally from the existing oak and pine assets. Eighty two-triangle panels form two overlapping depth bands, replacing 270 individual ridge-tree models. The images total **222,668 bytes**; the complete ridge set drops from **925,776 far-LOD triangles to 160**. This is a geometry budget comparison, not a measured frame-rate claim. The 222 course-side tree placements retain their current 3D geometry, shadows, instancing and LOD.

The cards face the estate, use the existing fog-aware, alpha-tested matte path and remain non-colliding with no shadow passes. Their lower edges are seated against the actual triangulated hills; 5,200 independent ray samples confirm no floating roots. The hill apron stays low-poly 3D for the terrain silhouette and occlusion. All other level data is identical, including the 18 varied numbered golf holes, full-speed racing line and ten pursuing carts. Untouched previous stock saves adopt the update while edited saves remain intact.

Reproduce the artwork from the repository root with Blender's `--background --python tools/country-club-assets/bake_woodland.py`, then run `tools/country-club-assets/pack_woodland.py` with the local Pillow runtime. Source hashes, seeds and texture sizes are in `public/country-club-art/woodland.json`; no new asset service or network transfer is involved. [Validation and local screenshot paths](art-reviews/country-club-art/woodland-images.json).
