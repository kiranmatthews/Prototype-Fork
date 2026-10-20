# Treehouse Trail

The authoritative reference is the user's nine-image strip, clarified as
“Ocean at the start, more length joining sections.” No Figma link is required.
The older pack's separate rail lesson is omitted. The order is ocean/treehouse,
downhill, coast, enclosed huts, shallow river, cave climb, cavern pipe, broken
rope bridge and jungle exit. Crate/enemy placement remains deferred.

## Continuous composition

The opening starts on the supported treehouse balcony with no arrival warp pad. Ordered camera nodes follow all four landings down the stairs, then align with the opening halfpipe's negative-Z axis. The reference photograph guides the scenery; it does not replace this gameplay route. The original follow composition has one spatially feathered hand-off.
The rest of the course uses the native follow rig and the ordered, smooth
camera spine. The straight downhill has one gently feathered elevated follow
composition, ending before the first bend, so the preceding dirt lip stays low
in the view. Eight overlapping per-scene shot volumes were removed. Camera
profile and open-horizon settings survive native copy/export/import.

The route gains 234m of connecting length, reaching roughly 678m.
Stronger bends, planted verges, a longer cave gallery and a forest buffer separate
the set pieces. Native ramp gaps, stone contacts, rock treads, the 46m pipe and
25m bridge rope retain native movement and collision behavior. Movement tuning is unchanged.

An actual animated ocean borders the opening's curved sand shelves. Its extent
stops at the authored shore, and both distant matte horizons align with their
water heights. The coastal view has a clear porch frontage, cane and crab shack;
the next view closes into forest. Trees overlapping the hut roofs and floating
porch boards were removed or repositioned. Cloth and its posts move with each
complete assembly. Straw receives sunlight; warm window emission is limited
to vertical faces. Ground shoulders and distant earth close the forest edges.

Three new built-in ImageGen layers provide complete transparent grove,
canopy-ridge and hanging-vine silhouettes. They replace incomplete old forest
and cave cards. Staggered placement, foreground planting and the turning exit
provide depth. The layers use fog, mipmapped KTX2 and original-alpha WebP
fallbacks. Sources and exact prompts are in
`tools/treehouse-trials-assets-v2/repair-mattes/`; the runtime manifest is
`public/treehouse-repair/manifest.json`. Encoding adds only transparent padding
to 1944×812 for GPU block alignment.

## Contact and scenery repair, 6 October

- All stair flights, exposed landing edges and balcony returns have visible
  balustrades paired with continuous containment faces. Grounded posts, cross
  bearers, diagonal braces and stringers support the cabin and landings. The
  bottom landing is raised 12cm clear of the soil.
- The three downhill depressions have supported, nonlethal beds. Their old
  invisible reset boxes are removed. A fitted perimeter prevents escape
  through the outer scenery while preserving openings and supported travel.
- River stones and the main rock stair masses use exact accepted GLB triangles
  as collision data, with a 2cm sole clearance. `tools/bake-treehouse-contacts.mjs`
  records source hashes and reproduces the baked contact module. Natural summit
  slabs and a buried rocky berm close the exposed gallery join.
- Continuous world-space loam UVs and wavy painted verges remove rectangular
  material boundaries. The native ocean gets full reflection/refraction/depth
  passes and 128 lateral wave segments; occlusion skips its passes inland.
- Foliage LODs dissolve across a 24m distance band instead of switching whole
  cells. A 320m camera range, fog, curved joins and foreground planting hide the
  distant course. The single follow camera remains continuous after the opening. Its 70%
  airborne vertical follow keeps the rope jump and descent jumps in frame.
- The 46m halfpipe has separate timber decks, warm coping, trestles, fern
  shoulders and an asymmetric rock arch with measured riding clearance. Roof
  edges are irregular. The broken bridge's single rope spans 25m; its anchors,
  far abutment, river and downstream course move together.

## Asset recovery and budgets

The existing 33 Meshy models consumed 495 credits in the preceding art pass.
The dense-enclosure revision adds two original models for 30 more existing
credits: 35 models and 525 credits across the Treehouse art passes. No credits
were purchased. Near/far meshes, shared
atlases, rooted leaf wind, pinned cloth, packed AO and streamed ownership remain.
The 25-family V2 kit has 80,367 near / 25,706 far triangles and a 61.67MiB
compressed texture budget. The active standalone matte/wood maps use 13.38MiB
of ASTC4x4 storage; the shared stream reflection uses 2.01MiB.

Rejected asset leases can be acquired again. Scenery cells retry with bounded
back-off, even while the player is still. Decoder initialization retries a
dropped WASM download without poisoning later images. A textured GLB cannot
silently pass without its authored albedo/normal maps; portable original
atlases remain available. Stream materials receive a recovered reflection,
and recovered ground images update their existing tiled copies. Placeholder
GPU storage is retired before full-size pixels upload. Disposal cancels
future retries and prevents late image loads reviving an old level.

## Actual review

Current screenshots are in `docs/treehouse-repairs/`. The continuous native-input
run in `docs/performance/treehouse-repair-continuous.json` starts at the balcony
and reaches the gate in 86.37s with no travel warps, deaths or console errors.
The review controller counter-steers the normal grind balance meter on the
longer rope; it does not change physics, position or speed. Maximum sampled
camera rotation is 0.94 degrees per simulation step in the latest integrated enclosure run.

Focused browser evidence covers 28 outward stair/landing/balcony pushes, 22
course-edge pushes, walking through all three nonlethal pits, and 81 rays
against actual rendered stone triangles. Measured sole clearance is 1.99996–
2.00005cm. The summit gap was found during the close visual review and closed. A final
264-frame native approach/jump/grind/landing review confirms the airborne
camera correction: projected head stays below NDC Y=0.413 and feet above
−0.300, with no death or console error.
The five full-render 1280×720 scene samples (120 rendered frames each) have
16.7ms medians and 18.0–18.4ms p95 on this desktop. Physical-phone timing and
thermal performance remain unmeasured. Performance, contacts and boundary
records are the `docs/performance/treehouse-repair-*.json` files.

The merged production bundle also passes desktop and 390×844 portrait smoke
checks, including real keyboard movement, all repaired asset markers and clean
consoles. The required `check:levels` scripts and production type-check/bundle pass. The
image fixture recognizes all three new matte files. No full test suite was run.
Earlier asset interruption/recovery evidence remains valid for the unchanged
bounded-retry code and is retained separately.

Campaign progress retains `treehouse-trail`; menus show “Treehouse Trials.”
Existing edited local copies remain intact. Restore original in PROJECT when
an old local snapshot masks the source. Delivery uses the existing main/Pages
workflow and preserves other chats' changes.

## Dense bush enclosure, 7 October

`src/levels/treehouse-enclosure.ts` adds 386 scenery components: continuous
rising forest floors, densely filled understory, staggered middle/far trees,
overhanging boughs, layered matte thickets and cavern planting. Sampling uses
world metres so the extended joins receive the same density as the set pieces.
Porch clearances and the intentional coastal water opening remain open. The
forest recedes through overlapping layers rather than ending at an empty bank.

The bridge approach's inside rock wall and roof now leave room for the actual
camera path. Old low crowns after the river are reseated on the forest bank;
the halfpipe's close fern is moved beyond the lens. All playable supports,
river/climb contacts, barriers, rope, reward positions and movement tuning are
retained. Camera framing is level data; no new camera runtime is added.

The new thicket and bough have 4,993 / 5,861 near triangles and 1,597 / 1,944 far
triangles, one atlas apiece, full GPU mipmaps and JPEG fallbacks. Their combined
compressed texture estimate is 3.34MiB. Four measured stems connect the bough's
hanging leaves and move with their tip-weighted wind. The built-in ImageGen
understory matte adds approximately 2MiB. Public hashes and billing live in
`public/treehouse-trials-v3/provenance.json`; original images and exact prompts
are in `tools/treehouse-trials-v3/`.

The route was inspected at **154 forward camera stations, five metres apart**
over the **764.3m ordered route**, plus **60 native left/right camera-peek views**.
The eight forward and three peek sheets are in `docs/treehouse-enclosure/`.
These are held composition surveys; the independent continuous native-input
run proves traversal. That final run finishes in **84.33s**, zero deaths and
console errors, with a maximum sampled camera turn of **0.94°** per step.

The final six full-render 1280×720 samples have **16.7ms medians** and
**p95 at or below 18.5ms**, after removing redundant background shadow casting. Scene
texture residency peaks at **125.05MiB** in the moving run. The production
bundle also passes desktop and 390×844 portrait checks, with working keyboard
movement and all three new asset kinds loaded. Physical-phone performance is
unmeasured. Focused level checks and the production build pass; no full suite.
See `docs/performance/treehouse-enclosure-*.json` for the recorded evidence.

The final clearing review also closes the eastern ground edge with planted
earth, three trees, lower thickets and a matte. Three taller crowns behind
subsequent bends fill distant sightlines without crossing the playable path.

## Reference opening, 8 October

The high rectangular cabin now has a red-and-cream sail roof with pinned cloth motion and matching shadow deformation. Compact stairs retain native ramps, supported landings and safety rails. The native opening halfpipe has been restored (10 October): two 4.2m transitions and a 5.8m open-ended spine parallel to the approach camera. The 46m cavern pipe is preserved. The beach-to-forest material transition, shoreline slope, path-side planting, overhead crowns, supporting trunk, surfboard and driftwood are authored together. Both existing Moa encounters remain in place.

The new texture sources, exact built-in ImageGen prompts and rejected Meshy submission are recorded in `tools/treehouse-trials-v4/`. Meshy created no new model or credit charge because the account plan blocks generation. Visual and native traversal evidence is in `docs/treehouse-reference-opening/`.

## Opening gameplay restored, 10 October

The level's player-facing name is **Treehouse Trail**; the `treehouse-trail` ID and progression keys stay stable. Set `startWarpPad: false` in level data to preserve its authored balcony arrival. This boolean is validated and survives copy/export/import; other campaign levels retain automatic arrival pads.

The art postprocessor now retains the existing native halfpipe and original opening follow camera. It no longer injects a rotated quarterpipe, beach spawn, or flat beach camera. The restored route descends the stairs and approaches at X=14 along negative Z, keeping both transitions visible and skateable. Ground tint and planting follow that same clear approach. The existing canvas roof, animated canopy, shoreline, other scenery and downstream course remain.

The sky gradient is slightly deeper blue (`#2b83bd` / `#8ec1d6`). Local lighting and movement tuning are unchanged in this correction. Full-render native stair/approach and skating evidence is in `docs/treehouse-opening-flow/`.
