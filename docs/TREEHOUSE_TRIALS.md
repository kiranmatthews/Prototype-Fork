# Treehouse Trials

The authoritative reference is the user's nine-image strip, clarified as
“Ocean at the start, more length joining sections.” No Figma link is required.
The older pack's separate rail lesson is omitted. The order is ocean/treehouse,
downhill, coast, enclosed huts, shallow river, cave climb, cavern pipe, broken
rope bridge and jungle exit. Crate/enemy placement remains deferred.

## Continuous composition

The opening keeps its original framing with one spatially feathered hand-off.
The rest of the course uses one native follow rig and the ordered, smooth
camera spine. Eight overlapping per-scene shot volumes were removed. Camera
profile and open-horizon settings survive native copy/export/import.

The route gains 222m of actual connecting ground, reaching roughly 666m.
Small bends, planted verges, a longer cave gallery and a forest buffer separate
the set pieces. Native ramp gaps, stone contacts, rock treads, the 46m pipe and
single bridge rope retain their shapes. Movement tuning is unchanged.

An actual animated ocean borders the opening's curved sand shelves. Its extent
stops at the authored shore, and both distant matte horizons align with their
water heights. The coastal view has a clear porch frontage, cane and crab shack;
the next view closes into forest. Trees overlapping the hut roofs and floating
porch boards were removed or repositioned. Cloth and its posts move with each
complete assembly. Straw receives sunlight; warm window emission is limited
to vertical faces. Ground shoulders and distant earth close the forest edges.

The forest and coastal matte layers now have genuine transparent sky. New
versioned filenames avoid stale HTTP image copies. Their original dimensions,
alpha and complete mip chains are preserved in KTX2 and WebP. The live sky
supplies air behind the organic silhouettes, with no stock hill silhouettes
for this level. Source prompts and generated references are recorded under
`tools/treehouse-trials-assets/`.

## Asset recovery and budgets

The existing 33 Meshy models consumed 495 credits in the preceding art pass.
This revision spends no additional Meshy credits. Near/far meshes, shared
atlases, rooted leaf wind, pinned cloth, packed AO and streamed ownership remain.
The 25-family V2 kit has 80,367 near / 25,706 far triangles and a 61.67MiB
compressed texture budget. The active standalone matte/wood maps use 7.35MiB
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

`docs/treehouse-trials-scene-review.jpg` shows the nine current scene approaches.
`docs/treehouse-trials-continuous.webm` records one continuous native-input visit,
with no travel warps. That run finishes in 82.3s, clears all three dirt jumps,
walks the river stones, climb and pipe, and catches the bridge rope with zero
deaths or console errors. Maximum sampled camera rotation is 1.39 degrees per
simulation step. Scenery texture residency peaks at 117.69MiB in that run.

A separate real-browser observation deliberately interrupts the model, decoder,
reflection and ground-image downloads. All recover in the same visit without
horizontal movement, warp or reload, and without a GPU upload error. Ordinary
15cm balcony settling is allowed. Full-render desktop and phone-sized reviews
have supported positions and clean consoles. Physical-phone timing and thermal
performance remain unmeasured. The focused level/ownership/stream checks and
production build are the checks used; no full test suite is run.

Campaign progress retains `treehouse-trail`; menus show “Treehouse Trials.”
Existing edited local copies remain intact. Restore original in PROJECT when
an old local snapshot masks the source. Delivery uses the existing main/Pages
workflow and preserves other chats' changes.
