# Blockworks · haunted island art job

The user requested a complete player-view storyboard followed by a Meshy and
ImageGen rebuild. The art direction is a haunted Crash 2-inspired castle in an
abandoned theme park on a tropical island. The eight connected districts retain
their current gameplay geometry and camera path.

## Execution and evidence

The resumable state is `tools/blockworks-art/job.json`. The active goal resumes work. The prior heartbeat is no longer registered in the app. The isolated checkout is `/Users/kiki/Documents/ChatGPT/Prototype Fork/.img2threejs/blockworks-haunted-park`
on `codex/blockworks-haunted-park`; the original working folder has unrelated
uncommitted work. No publication is complete until the actual deployment is checked.

1. Capture overlapping views along the route, plus roof tiers, rails, foundry
   branches, aerial targets, movers and the finish. Use the production player
   camera. Save world coordinates, camera matrices and source hashes beside the
   images. Inspection placements are not gameplay traversal evidence.
2. The user has advanced to production using the accepted 89 reviewed storyboards
   spanning all eight districts. Eleven additional late-crown views are optional
   expansions, not a production gate. Keep their exact capture and review ledger.
3. Derive a small reusable asset kit from the completed storyboard. Use the
   established official Meshy CLI adapter with named, journaled operations.
   Preserve supplied topology, textures and UVs. The user authorized up to 1,000 Meshy credits total. Record reservations and actual charges in meshy-tasks.json. No credit purchases.
4. Generate the sky, distant scenery mattes and supporting textures with imagegen.
   Integrate them with restrained lighting and fog matched to the storyboard.
5. Compare actual gameplay and storyboards from identical saved camera views.
   Check loading, draw calls, clear landing silhouettes, camera clearance,
   supported spawn, pits, checkpoints and the finish. Run focused tests,
   `check:levels` and a build; do not run `check:all`.
6. Log elapsed prompt-to-playable time, commit only this job's files, deploy via
   `origin/main`, verify the public `Codex/sol fork` stamp and disable the heartbeat.

## Style continuity

User clarification: ImageGen is expected to vary distant scenery between views.
Prioritize the playable foreground, nearby castle pieces, local plants and props.
One coherent level-wide skybox and a shared set of world-placed scenery mattes
own the horizon and distant islands, castles and rides. Do not regenerate a
storyboard or rebuild an area merely to reconcile its far-background objects.
Use distant storyboard content as atmosphere and palette guidance only.

The greybox and saved camera matrices remain authoritative for geometry. Small
concept simplifications are implementation notes, not a reason to iterate images
indefinitely. Fix material cues that misrepresent gameplay (especially ice under
the player) and major foreground omissions; never follow a generated image into
changing collision or the route. Read `storyboard-ledger.json` review notes.

Chunky, deliberately crooked castle masonry and exaggerated rounded bevels;
weathered plaster, purple slate roofs, faded carnival paint and oxidized brass;
lush palms and jungle reclaiming deserted rides; distant tropical sea and island
silhouettes; violet blue dusk, pale turquoise moonlight and small warm amber lamps.
Use readable medium-value playable surfaces and darker scenery silhouettes.
The mood is spooky, playful and abandoned, with painted texture detail rather
than photographic noise. Reuse the same masonry scale, roof color, plant shapes,
light direction and weathering language in all districts.

The ice sections remain visually identifiable as cold, glossy enchanted water
or frost. The foundry switches and conditional steel routes remain legible.
Decorative towers, foliage and ride silhouettes stay outside playable and camera
clearance. Do not add obstacles, fill gaps or change jump lengths to match art.

## Baseline limitation

Before any art edits, the existing whole-journey pilot failed at frame 203,
station 47.18, against the newly added opening moa. That historical pilot must
be adapted to the current encounter for final traversal validation. Its failure
must not be described as an art regression or concealed by removing enemies.

## Component construction requirement

The user explicitly rejected manually tiled foreground shaders. The provisional
texture shader was removed. All 15 Meshy models have succeeded and are packed
with original topology, UVs and textures; 225 of the authorized 1,000 credits
have been consumed. Five generated tile studies are archived in material-studies
and are not referenced by the runtime. Actual Meshy deck/roof/metal/ice/aqueduct
components now fit the native route, plus ten reusable scenery components.
Shared sky and three world-anchored alpha mattes remain ImageGen assets.

Integration is still in progress. Do not claim visual parity or publication.
The aqueduct support feet extend beyond its riding surface: the runtime fits
the measured riding Z span (12–88% of normalized depth), not the full feet.
Check its joins in the native camera before acceptance. Surface fitting keeps
the original Meshy UVs and topology; native collision geometry remains intact
as a render-only proxy. Conditional surfaces must stay ghosted until their
actual switch activates, and movers carry their modules as native children.

## Validated release candidate

The kit is integrated with the current main branch, retaining upstream rail,
edge-grinding and world-collision changes. All new render geometry explicitly
opts out of scenery collision; the 1,432 native gameplay components match
`physics-baseline.json`. The continuous journey passed with 20,619 frames, six
checkpoints, no resets/deaths and unchanged movement tuning. Full-render browser
aqueduct traversal and supported-spawn, pit death/respawn, checkpoint, switch
visibility and finish-gate smoke cases passed without console errors.

One hundred refreshed player-camera captures are in `after/`. The same accepted
foreground material vocabulary and generated meshes repeat across districts;
distant ImageGen objects were not regenerated to match individual storyboards.
The old underlay is hidden only visually so chasms read as open air. Capture
095 now uses supported crown-roof height rather than an embedded inspection pose.
Asset inspection metadata was recorded after capture; GLB bytes and runtime
source were unchanged by that metadata review. Use `audit.html` locally to
compare concepts with current renders.

Blockworks already publishes through the source-owned `codex-lab` registry
entry. It is not a `public/levels.json` editor-pack entry; adding a second copy
would duplicate ownership and inflate the near-limit pack.

All ImageGen work used the built-in tool. Final runtime assets live in
`public/blockworks-art/`; reference images are in `docs/blockworks-art/prop-references/`.
`asset-prompts.json`, `environment-prompts.json` and `image-ledger.json` retain
the complete prompts, outputs and hashes. `meshy-tasks.json` records every
provider operation and its 15-credit charge; no purchases or plan changes.

## Published verification

The initial verified release is commit `db59c5a42fc23bd38ce95d0f8bcd2cf90ee32454`.
[Pages workflow 38260868289](https://github.com/kiranmatthews/Prototype-Fork/actions/runs/38260868289)
succeeded. A fresh browser verified the public level at 2026-10-12 14:28 UTC:
`Codex/sol fork · build 10-12 14:21 UTC`, all 15 models and four environment
images ready, matching deployed asset hashes, real keyboard movement on
supported ground, no deaths and no console errors. The machine-readable proof
and screenshot are under `docs/blockworks-art/deployment/`. The final foreground attachment follow-up lowers lantern bases into masonry,
plants smaller foliage at the wall edges, and respects narrow facade dimensions
inside the native lift-guide footprint. It preserves the same geometry contract
and Meshy assets; final public verification is recorded in the job ledger.
