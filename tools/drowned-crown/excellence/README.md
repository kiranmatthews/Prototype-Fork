# Drowned Crown asset production

The user directly approved **up to 400 additional Meshy credits**. This continuation has consumed **210**, leaving **190 unused**. The earlier 435-credit pass is recorded separately in `../tasks.json`. No jobs are in flight; no credit purchase or plan change was made.

| Job | Credits | Result |
| --- | ---: | --- |
| Smart Topology headland | 15 | Rejected on visual inspection; not shipped |
| Meshy 7 headland | 30 | Fitted coast and fort foundations with open mine passages |
| Meshy 7 cavern buttress | 30 | Sea-gate shoulders, alcove rockwork and foundations |
| Meshy 7 royal hull | 30 | Fitted decks, cabin and traversal openings |
| Meshy 7 Crash 4 cavern rock | 30 | Painted rock masses, derived canopy and mine shell |
| Meshy 7 Crash 4 skylight ring | 30 | Actual openings through the cavern roof |
| Original-UV royal hull retexture | 10 | Warm oak, burgundy trim and gold on both original fitted LODs |
| Complete Crash 4 boardwalk section | 30 | Imagegen-guided complete deck, piles, beams, lashings and rail remnants |
| Provider quad remesh and rebake | 5 | 30,705 triangles; original generated appearance retained |

`tasks.json` retains provider task IDs, actual consumed credits, reference hashes and the direct approval. The official Meshy CLI owns authentication, submission journaling and provider status. The wrapper reserves credit before submission, refuses duplicate named jobs and requires uncertain submissions to be reconciled by operation ID. An early unsupported-parameter request was rejected without a task or charge.

## References and provenance

The built-in **imagegen** tool produced the reference images; no API or CLI Imagegen fallback was used. Exact prompts and original storyboard references are retained in [imagegen-prompts.json](imagegen-prompts.json) and [crash4-asset-prompts.json](crash4-asset-prompts.json). The latter includes the painted hull guide, derived from the existing hull reference and the new moonpool storyboard.

- [Headland reference](references/headland.png)
- [Cavern reference](references/cavern-buttress.png)
- [Original royal hull reference](references/galleon-hull.png)
- [Painted hull guide](references/crash-galleon-painted.png)
- [Measured runtime asset manifest](asset-manifest.json)
- [Exported model audit](model-audit.json)
- [Hull texture-transfer proof](crash-galleon-painted-transfer.json)

Source downloads and unfitted authoring meshes remain in the attached worktree’s ignored `.img2threejs/drowned-crown/excellence/` directory. Keep that directory when archiving the worktree. Original paid assets remain available alongside the selected derivatives.

## Geometry and textures

`prepare_models.py` welds coincident glTF seam vertices before reducing meshes in Blender, while preserving per-corner UVs. `pack_models.py` compacts textures and writes measured registrations. Hero models retain 4K base-colour atlases and near/far meshes. The runtime uses original UVs instead of applying repeating rock tiles.

`fit_headland.py` shapes the coast, measures the fort footprints and clears the mine and grotto. Its wider interior clearance sits behind the painted mine shell; the sea-gate mouth, exterior bounds and measured fort anchors are preserved. `fit_royal_hull.py` retains the hold ceiling and opens the boarding, descent, bow and powder-room passages. UV-aware clipping removes original triangles without inventing Boolean caps. It is used for passage cuts, not for slicing the visible mine lining.

`fit_crash_mine.py` bends twelve **closed** rock masses around the authored mine and grotto. It fits their stepped upper envelope to the tunnel height, joins UV-seam positions before recalculating winding, and leaves the junction open. Both LODs remain closed. The initial cut-rock experiment was rejected after native 4K review exposed torn surfaces. The corrected shell uses no additional provider credits.

`prepare_retexture_input.py` submits only the fitted near hull to Meshy with original UVs enabled. `apply_retexture_maps.py` verifies normalized position/UV correspondence, then transfers only the resulting maps and material onto the original near and far hulls. Positions, UVs, normals and indices remain byte-identical. The packed runtime dimensions also match the original hull exactly, preserving its placement and passage clearances.

`fit_crash_canopy.py` assembles the rock kit into a ceiling with two round skylights aligned to the rings and light shafts. Its lowest surface clears the tallest 51 m mast. Large surrounding wall masses extend below water. The enclosure continues behind the scenery. The grotto and vault floors reuse original repository meshes and provide matching support surfaces. Coin spills reuse complete connected coins and gems from the paid treasure asset.

## Existing Meshy timber reuse

The ship deck, ramps and bridge now place the existing Meshy `plank-split`, `plank-worn` and `plank-chipped` models. `beam-hewn` supplies lamp mounts. `../reuse_meshy_boards.py` verifies the original boardwalk manifest hashes and adds only a root axis rotation. Original mesh data, UVs, texture bytes and material definitions are unchanged. The runtime uses ordinary non-solid decor instances over the unchanged authored support meshes. No new Meshy job was submitted. Provenance is in `../meshy-board-reuse.json`; byte and gameplay parity evidence is in `docs/drowned-crown/excellence/meshy-board-check.json`.

One pending built-in Imagegen board-atlas request completed before it could be stopped. Its result was rejected after the user required existing Meshy boards. It is recorded as `discarded-deck-atlas` in `crash4-asset-prompts.json`, is not copied into public assets, and has no game consumer. No board texture or board geometry was authored for the accepted replacement.

The enclosed treasury now uses layered instances of the existing complete coin-spill mesh, original treasure chests and warmer room lighting. Its central approach remains clear.

## Verification

Player-view reviews use native **3840 × 2160**, Max quality, with both world and output buffers checked. Imagegen art is inspected at its own native resolution, without upscaling. The gallery labels game captures and concept art separately.

`audit_models.py` checks ten exported models, verifies both LODs of four uncut rock/ring/shell models are closed, tests body-height mine centre lines, confirms the hull geometry is unchanged and checks both skylights remain open with ceiling geometry between them. Focused route and browser checks establish traversal and safety; they do not establish full storyboard parity. Cabin materials, deck surfaces, water and prop staging still need visual refinement.

## Complete boardwalk section proof

The user redirected the work toward larger cohesive sections after the individual-board pass. The new reference uses the foreground bridge in [this actual Crash 4 production render](https://www.romaindurand.com/crash). The external render is retained privately for style reference, not shipped. The exact built-in Imagegen prompt and selected 1536 × 1024 output are recorded in `crash4-asset-prompts.json` and `references/crash-boardwalk-section.png`.

The first local reduction from Meshy’s 1,117,392-triangle original produced triangular shading artifacts. It was rejected. The accepted asset uses Meshy’s own quad remesh and texture rebake (14,000 requested quad faces, 30,705 GLB triangles), with no local near-mesh simplification. `pack_boardwalk_section.py` preserves every remeshed geometry, UV and normal accessor, rotates the root to the route axis and packs the provider’s maps. The retained base-colour atlas is 4K. There is no self-authored visible board geometry or board paint.

One complete section replaces the first near cargo-jetty bank. The walking proxy is sampled from the generated deck, and attachment uses the measured deck ends instead of the protruding beam bounds. The native path remains an editable invisible backup. The complete model is not yet rolled out across the rest of the level.
