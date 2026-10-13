# Drowned Crown — composition continuation

**The full visual-excellence goal remains unfinished. These changes are local and unpublished.** The ship's main forms and cabin framing have been refined, but all thirteen sections still need a final material/lighting comparison against their storyboards.

The outdoor route now follows a curved masonry shore on narrower piers close to the sea. The fort stands on a measured, sculpted headland made from the existing paid Meshy rock asset. A rounded rock shelf on the port side provides the wreck reveal before the route returns to the gangway. Four sculpted masses replace the repeated cavern-wall grid. Physical staggered boards, shaped stone edges, stone foundations extending below the tide, chart-table supports, and restrained candle effects replace the flat overlays and oversized placeholders.

Harbour and cavern share the existing reflected-ocean renderer. Terrain alone defines this level's shoreline; dock supports no longer cut holes in the water. Native-coordinate reflections now align with their real objects, verified against independently projected mirror points for perspective and orthographic cameras. Movement tuning is unchanged.

## Current player views

The [local gallery](http://127.0.0.1:5195/drowned-crown/storyboard/index.html) compares thirteen storyboards, thirteen original views and six current views. The earlier local repair capture is retained separately, keeping the total at twenty player-view images.

- [Customs quay](../final/01-customs-quay.png)
- [Smugglers fissure](../final/04-smugglers-fissure.png)
- [Port-side wreck reveal](../final/06-moonpool-reveal.png)
- [Captain's cabin](../final/08-captains-cabin.png)
- [Flooded hold](../final/10-flooded-hold.png)
- [Royal vault](../final/13-royal-vault.png)

## Validation

`validation.json` records the checks. The complete native-Player and full-render Chrome journeys reach the gate with all six checkpoints and zero deaths. The optional grotto, cabin and powder room, 24 body-clearance sweeps, pit/checkpoint respawns, mast collision, focused level checks, build, and ocean resource/tuning checks pass. Browser consoles are clean. No full suite was run.

The derived headland has 5,760 near triangles and 1,941 far triangles, one original atlas material, valid indices, finite UVs/normals and measured bounds. Its original Meshy task and source/output hashes are recorded in the asset provenance.

## Generation and spending

This continuation has spent **zero additional Meshy credits**. One new headland reference was produced with built-in imagegen; the tool does not report a separate image-generation credit charge. The existing 435-credit production pass remains separately recorded.

- [New headland reference](../../../tools/drowned-crown/excellence/references/headland.png)
- [Exact imagegen prompt](../../../tools/drowned-crown/excellence/imagegen-prompts.json)
- [Requested 400-credit cap and empty Meshy ledger](../../../tools/drowned-crown/excellence/tasks.json)

The proposed 15-credit Meshy job did not run. Automatic approval review rejected it because the 400-credit spending authorization arrived through goal context rather than a direct user confirmation. The approval question remains pending. Billable calls are guarded until that confirmation arrives; there are no in-flight Meshy jobs.

## Ship refinement

The sterncastle now has tapering planked sides, a curved roof, matching side galleries and a close cabin camera that clears the mast. Hull ribs follow the vessel's flare; exterior gunports sit on the hull surface. Dark underplanking supports the worn boards and closes their apparent voids. The paid panel mesh was fitted as inward-facing bracing, with real cuts for the bow passages. Its original atlas is reused. The derived model's vertices sit 0.07–0.69 m inside the hull surface instead of floating outside it.

`ship-validation.json` records the full Chrome run and focused cabin traversal, including the stash interaction. The 24 body-clearance sweeps, optional-room checks, level checks and build pass. This pass spent zero Meshy credits and made no imagegen calls. Generation approval is still pending.
