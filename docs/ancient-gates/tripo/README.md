# Ancient Gates — Tripo native scenery

Five ImageGen reference images guided five original stylized tiki assets. The
main valley and Gatekeeper's Hoard use complete three-dimensional scenery.
Two new panoramic mattes now sit behind that preserved scenery. Existing Meshy trees, beams, paving and cornices retain their native
ratios. Repeated short pieces form long spans; connected tiki foundations bear
the decks and arch feet. Tree roots intersect a measured surface on the cliff
mesh, with an embedded moss-rock plinth. The upper bonus gallery retains its
clear return underpass.

| Runtime model | Native triangles | Packed bytes | Credit source |
|---|---:|---:|---|
| Guardian gateway | 8,505 | 515,612 | CLI bonus: 110 |
| Sandstone buttress | 4,209 | 283,976 | Studio P2 trial: 0 |
| Support pier | 4,250 | 769,064 | Studio Max: 100 + 30 texture |
| Tiered shrine | 9,188 | 644,380 | Studio Max: 100 + 30 texture |
| Tropical planting | 4,239 | 406,092 | Studio Max: 100 + 30 texture |

The runtime set totals 2,619,124 bytes. All decoded vertex and index buffers are
byte-identical to the original exports: Meshopt storage compression and WebP
atlases do not remove geometry. There are no distance-dependent mesh substitutes,
including in reflections. Colour atlases remain 2K.

Studio consumed 390 Max credits (25,200 → 24,810). The CLI consumed 220 of the
1,000 bonus credits (780 left): the shipped 8K gateway cost 110, and an earlier
40K job already submitted before the user's triangle-budget correction cost 110.
That first model is excluded from the release. No credit top-up was purchased.
See [generation.json](generation.json) for task IDs and settings,
[native-assets.json](native-assets.json) for bounds/counts/hashes, and
[storage-packing.json](storage-packing.json) for exact geometry verification.

The installed CLI 0.8 `game-mobile` preset requests 15K faces plus an FBX
conversion; `game-pc` uses an adaptive face count. This browser game instead uses
explicit 4K–10K targets and native GLB. The user's Chrome extension setup enabled
the remaining reference uploads and Max-plan generation in Tripo Studio.

## Validation

- `npm run check:levels` passed; the final compacted level data, real GLTF loader,
  Ancient Gates layout and scenery-clearance checks also passed.
- `node tools/ancient-gates-tripo/test-native.mjs HEAD` verifies all 3,050 static prop
  placements preserve measured aspect ratios, 238 static pier stacks connect from the
  canyon floor, every original 3D component is preserved, the new background planes sit
  behind it at their native image ratio, and each new mesh is below 10K triangles. Gameplay component hashes are unchanged apart from colour,
  texture and the explicitly selected cosmetic asset fields.
- Full-render Chrome review covered all 12 main sections and six bonus sections
  at MAX/native (3024 × 1516 drawing buffer). Every sampled safe platform was
  grounded, asset streaming completed, and there were no asset or console errors.
- Actual right-arrow walking, K/L checkpoint shortcuts, pit recovery and the
  finish trigger were checked at normal 720p. The finish displayed COURSE CLEAR.
  Final lite-mode readiness was checked separately.
- The production build and release-size checks pass. The authored level pack
  remains below its existing 64 MiB bound. No global size limit was relaxed.

[Browser telemetry](browser-native.json) records each view. Selected screenshots
are in [evidence](evidence/). The local-only review UI is
`tools/ancient-gates-tripo/review.html`; it is not a production entry point.
References and their exact prompts are under
`tools/ancient-gates-tripo/references/`. Original high-resolution export files
remain locally in the ignored `generated/runtime-originals/` folder.

Timing: brief start 2026-10-29 09:34:26 UTC; first browser-playable art by about
10:18 UTC (~44 minutes); final route-wide native and gameplay smoke by 10:51 UTC
(~77 minutes). This includes image generation, Studio/CLI generation and export,
integration, packing and visual fixes. Publication is handled by the active release coordinator after local handoff.


## Follow-up: doors and moving mechanisms

The additional pass replaces 25 primitive mechanism surfaces: two trap doors,
three ferries/lifts, six falling steps, three phase pads, three crushers, the
Aqueduct kicker, three restored main-course stairs and four restored bonus
masonry assemblies. Complete native Meshy planks, beams, paving and iron links
are combined with the existing Tripo piers and canyon rock. No additional models
were generated and no additional credits were consumed.

The visual assemblies follow the original collision bodies as siblings. This
keeps spin interaction bounds, ground contact and editor queries unchanged.
Chains connect to supported rails, shortening or lengthening with lift motion;
falling decks release their chains. Restored galleries carry rear supports and
cantilevers, leaving the route below open. Inactive phase/switch art follows the
authored state. Loading failures retain the original surface as a fallback.

The native mechanism fixture loads real GLBs and compares original and decorated
motion/collision over door opening/reset, crumble fall/return, phase cycles and
switch reveal/reset. All seven mechanism types pass. Every instance retains its
measured aspect ratio. Existing spin-contact/crossing and phase-material-lifetime
regressions also pass. See [mechanisms-validation.json](mechanisms-validation.json).

The follow-up browser pass used MAX/native (1630 × 1610 drawing buffer) and
normal 720p presentation. All 21 main and four bonus assemblies loaded, actual
player input opened and crossed the timber gate, switch restoration worked, and
the player walked beneath the restored gallery. Native views also covered the
falling steps, lift, crushers, phase platforms and bonus causeway. Each sampled
state had no asset or gameplay error. [Browser evidence](browser-mechanisms.json)
retains one older unattributed IAB MutationObserver log at 11:10 UTC; there were
no further console errors during the 11:17–11:22 UTC full-render review.

Final required level checks and production build pass. Release output is
999,907,406 / 1,000,000,000 bytes (92,594 bytes spare), offline version
`f5e50add832f102d26a4`; the source pack is 67,053,735 / 67,108,864 bytes.
No global bound was relaxed. A separate fresh production-tab pass could not
acquire shared full-render capacity after the successful build; the coordinator
owns the final combined production/deployment smoke. The completed source
browser checks above remain the local visual evidence.

Follow-up timing: request continued at about 10:55 UTC; playable mechanism pass
by 11:10 (~15 minutes), full/native and normal behavior review completed by
11:22 (~27 minutes). Final build/packaging finished around 11:27 UTC. Changes
remain local for the active release coordinator; neither this chat nor its
scripts push or deploy them.


## 30 October NZDT: additional far-background mattes

This increment adds a sunlit jungle valley panorama to the main course and a
shaded ruin/ravine panorama to the hoard. Four overlapping main panels and two
bonus panels use the generated 3:1 ratio, behind the full extent of all existing
3D scenery. The camera far plane is extended only enough to include that layer.

All 3,050 existing static native props, 238 connected pier stacks, 15 gateways,
background trees, shrines, rocks and 25 mechanisms are preserved. No 3D model,
scenery component, transform, support assembly or gameplay component is removed
or replaced. The preservation test compares every non-matte component against
commit `9ec6b8af`, including its order and complete serialized data. Runtime
mechanism code and all GLB files are unchanged.

Built-in ImageGen generated both images at 2172×724. The runtime WebP files
retain that resolution, totaling 284,774 bytes. Their exact prompts are in
[matte-prompts.json](../../../tools/ancient-gates-tripo/references/matte-prompts.json).
Project assets:

- `public/ancient-gates/valley-panorama-v2.webp`
- `public/ancient-gates/hoard-panorama-v2.webp`
- Original PNGs: `tools/ancient-gates-tripo/references/valley-matte-v2.png` and
  `tools/ancient-gates-tripo/references/hoard-matte-v2.png`.

The earlier two background files also remain at their original public paths.
Their storage is re-encoded at the same dimensions to keep the release within
its existing size budget; exact original bytes remain under
`tools/ancient-gates-tripo/references/previous-mattes/`. No scenery file is
removed. No Tripo credits were used by this increment.

Current visual evidence is in [matte-revision](matte-revision/): full/native
main-course and hoard views, normal-resolution walking beneath the preserved
gallery, successful 21/21 and 4/4 mechanism readiness, and zero console or asset
errors. These screenshots show the original scenery with only the backgrounds
added. Preservation, native ratio, layout and clearance checks pass. Required
level/build/release checks are recorded in the revision's validation record.

Timing: request began around 11:46 UTC; the corrected additive version was
playable around 12:07 UTC (~21 minutes); full/native and normal review finished
by 12:11 UTC. Publication belongs to the active release coordinator.
