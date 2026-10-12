# Blockworks · haunted island art job

The user requested a complete player-view storyboard followed by a Meshy and
ImageGen rebuild. The art direction is a haunted Crash 2-inspired castle in an
abandoned theme park on a tropical island. The eight connected districts retain
their current gameplay geometry and camera path.

## Execution and evidence

The resumable state is `tools/blockworks-art/job.json`. The recorded phase controls resumption. The prior heartbeat is no longer registered in the app. The isolated checkout is `/Users/kiki/Documents/ChatGPT/Prototype Fork/.img2threejs/blockworks-haunted-park`
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

The first release was validated and published below. Literal 1:1 visual parity was not established by that release.
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

The final functional release is `d9a2769032b1b877b9322ba47d3cc7a9e267e081`.
[Pages workflow 38269188841](https://github.com/kiranmatthews/Prototype-Fork/actions/runs/38269188841)
succeeded. A fresh browser verified the public level at 2026-10-12 15:33 UTC:
`Codex/sol fork · build 10-12 15:25 UTC`, all 15 models and four environment
images ready, matching deployed asset hashes, the final attached-lantern data,
real keyboard movement on supported ground, no deaths and no console errors.
The machine-readable proof and screenshot are under `docs/blockworks-art/deployment/`.
Final bookkeeping commits contain this proof and the verifier only; no game
or runtime changes follow the verified functional release.

The prior heartbeat was already removed from the app. Pausing its recorded ID
returned not found, and no local automation file remains. The app has no active goal record in this continuation. The user subsequently requested a higher-fidelity pass, recorded below.


## Higher-fidelity continuation

The user requested closer accuracy to the storyboards after the first published
release. This pass replaces the regular small paving with large irregular
Meshy flagstones, raises visible chipped coping, gives the aqueduct a thinner
smooth riding shell and larger flush plates, and adds slender castle spires,
open gothic viaducts, connected jungle shelves and abandoned coaster trestles.
The roof walks use the same flagstone material as their foreground references.

Seven additional Meshy components and two 4k Meshy retextures used 125 credits,
bringing actual cumulative charges to 350 of the authorized 1,000. Twenty-four
provider outputs are archived; the assembled level loads eighteen selected
models. `meshy-tasks.json` records every operation before submission and every
actual charge. No purchase or plan change occurred.

The flagstone retexture still had thin contour-like edges. Built-in ImageGen
repainted an exact orthographic render of that actual Meshy deck. Blender baked
the repaint into its original UV atlas; the packer changes only the albedo image
buffer. Meshy vertex, index and UV buffers remain intact. This is component
paint, not a repeating procedural terrain shader. The source render, paint and
baked atlas are saved under `docs/blockworks-art/component-paint/`; complete
prompts and hashes are in the normal ImageGen ledger. `paint_meshy.py` records
the reproducible render/bake workflow.

The assembly alternates the orientation of physical deck modules, retains
full-sized stones on narrow landings and fits the Meshy aqueduct continuously
to the unchanged native quarter-circle profile. The previous abrupt relief
threshold caused transverse shading ribs and has been removed. Coping uses
the actual highest roof's width, stops at route boundaries and leaves native
grind lines clear. Each lamp now resolves its own supporting road position,
including height changes and the start of gaps.

Lighting uses a warm key, cool opposing fill and small amber lamp pools. A
single revised ImageGen panorama gives the whole abyss turquoise mist. Existing
world-placed far mattes remain the common distant-world authority. Nearby Meshy
scenery fades before the native 230m fog limit; the original checkpoint
visibility constraint remains intact.

All 100 views are reviewed at the game's existing MAX/native setting, 1600×900;
the prior release's saved before images used its default 720p internal render.
Both sets use the production player camera. Inspection placements are distinct
from the continuous input journey and browser gameplay checks. Do not infer a
pixel-perfect metric from these images: native route geometry, pickups, moving
platform state and shared distant-world coherence remain authoritative over
ImageGen's per-image inventions.

Current validation and publication evidence is recorded in `job.json` and
`docs/blockworks-art/fidelity-review.json`. The prior release's verification
above remains historical evidence, not proof of this later pass.


The higher-fidelity code release is `8fbca1d835527181b75c142f3b5094c52a6e2319`.
[Pages workflow 38284510953](https://github.com/kiranmatthews/Prototype-Fork/actions/runs/38284510953)
succeeded. Public verification at 2026-10-12 17:44 UTC confirmed
`Codex/sol fork · build 10-12 17:41 UTC`, all eighteen selected models ready,
the final 634 coping / 148 lamp / 319 foliage placements, matching new surface
and spire provenance hashes, supported real keyboard movement and zero browser
errors. Evidence is in `docs/blockworks-art/deployment-fidelity/`. The final
bookkeeping commit adds this evidence and makes the offline paint helper always
start from the downloaded Meshy original; it does not alter the verified runtime.

This is a verified fidelity improvement, not a certified literal 1:1 replica.
The review ledger keeps remaining differences explicit for further work.

## Sculpted stone and dedicated wedge continuation

The next detail pass responds to the user's requests for real imperfection in
stone platforms and a dedicated wedge model. A new Meshy paving component has
24 individually modeled stones, with thick chipped sides and an irregular
perimeter. Runtime fitting seats the existing blocks together at their joints,
retains their top relief, and overlaps internal component joins. Exposed ends
keep the Meshy outline. It does not generate a tiled stone shader or substitute
flat painted geometry.

All nineteen wedge ramps now use dedicated Meshy models: fourteen rough stone
wedges and five riveted teal metal wedges. The packer measures each model's
riding plane. The runtime fits its toe, rear landing, width and horizontal base
to the original native ramp. A recessed, untextured mortar bed inside the stone
wedge closes small open Meshy seams without altering its exposed outline.
The same models also retain their complete wedge shape as loose editor props.

This pass also adds real Meshy grind tubes and supported posts, rounded aqueduct
coping, broad riveted freight decks, hanging ivy, steel blocks and marked/spent
switch variants. Instanced crate artwork follows the native crate transform
and activation/reset state; the original crate remains the interaction and
collision owner. Unsupported rail posts are omitted. Foliage remains attached
to the masonry and outside the roof landing clearance.

Built-in ImageGen repainted exact renders of the aqueduct shell, new flagstones
and stone wedge. Blender baked those paints into the original Meshy UV atlases.
The aqueduct uses a temporary unrolled projection for painting only. Transparent
paint margins are excluded from the bake. Packed vertex, normal, UV and index
arrays were compared exactly against all 33 archived provider outputs; the
render-only path fitting and stone seating happen separately at load time.
The common sky and distant mattes are unchanged in this pass.

Eight new generated components and one retexture cost 130 credits, bringing the
job to 480 of the authorized 1,000. The level uses 25 selected models. Two earlier
unsupported-option requests were proven rejected by the official CLI journal
before corrected submissions; their zero-charge records remain in the ledger.
No credits were purchased and no plan was changed.

Evidence is in `docs/blockworks-art/detail-review.json`, `stone-shape/`, the
updated `after/` capture set and `review-sheets/`. The clay render removes stone
textures and normal maps to show the actual modeled relief. The native gameplay
signature still matches all 1,432 components of the authored physics baseline.
This pass's continuous full-browser journey was recorded before the final
stone/wedge replacements; final shape probes, focused native wedge ascents,
switch/reset checks and full-render gameplay smoke separately validate those
cosmetic changes. Capture placements remain inspection evidence, not traversal.

The sculpted-stone code release is `db49431f40dd9e7eb6ca83e7089c9f2d600b469d`. A concurrent
Custard update retained it and published revision `5be125734efca74b33e0561902161c1501864c45` through
[Pages run 38313385502](https://github.com/kiranmatthews/Prototype-Fork/actions/runs/38313385502). The earlier queued run was
canceled by workflow concurrency after its regression checks had passed.

A fresh browser verified the public page at 2026-10-12T22:10:18.213Z:
`Codex/sol fork · build 10-12 22:05 UTC`, all 25 models ready, all fourteen stone/five metal
wedges present, seven downloaded GLB byte hashes matching the approved assets,
supported real keyboard movement, no deaths and no console errors. Exact proof
and screenshot are in `docs/blockworks-art/deployment-detail/`. The complete
100-view capture retains its actual pre-integration source hash; later Custard/
Nightworks commits left Blockworks runtime/data/art identical. The final
bookkeeping commit adds only release evidence and job documentation. No active
heartbeat remains to disable.
