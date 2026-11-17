# Waterfall Climb and The Hidden Spillway

Ninth campaign course, reviewed against the crate bible on 14 November 2026. Work began around 08:16 UTC and the layout was stable around 08:23. Native/browser pilot corrections extended validation and packaging to approximately 27.3 minutes, beyond the requested 15-minute main plus five-minute bonus budget.

| Measure | Before | After |
|---|---:|---:|
| Main counted cargo | 17 | 110 |
| Main collectible clusters | 17 | 33 |
| Main mean cluster size | 1.00 | 3.36 |
| Main single crates | 17 | 0 |
| Main enemy kinds / placements | 1 / 2 | 1 / 2 |
| Bonus counted crates | 22 | 46 |
| Bonus mean cluster size | 1.29 | 2.71 |
| Bonus single crates | 12 | 4 |

Every authored checkpoint section now has ten cargo boxes. Existing banks, fixed receivers, rail-mounting shoulders and rest balconies hold the harvests; mover decks, drum launch columns, fragile main-route footing and fast skating curves stay clear. The two hoppers remain unchanged: the first debuts on the broad cedar-root bank, the second repeats beside the upper-pool cache. Two masks prepare those encounters. Safe-line lives and masks that could not protect against falling become ordinary supplies. The parent tally is 166: 110 cargo + ten checkpoints + 46 bonus.

The Hidden Spillway retains its timed wheel, ferry, two crumble beams and treasury reveal. Small stacks and walls frame those mechanisms; each crumble beam keeps just one cargo crate to collect while moving. The bell life now sits at Y=13.8 above the arrow on the Y=2.4 balcony. The held-arrow/double-jump route reaches it; tested floor and neighboring-crate approaches fail after destroying the launcher. The safe-line treasury life becomes supplies. Two outlined platform boxes previously ignored the outline flag; identical mesh boxes now let the gray switch reveal both supports and six crates. A skipped-switch attempt reaches the dead state, and retry restores every crate, closed spin bridge and outlined surface.

## Verification

[Validation](validation.json), [before](audit-before.json), [after](audit-after.json), [authored checkpoint counts](authored-sections.json), [cargo and patrol checks](native-cargo.json), [river route](native-river.json), [ascent route](native-ascent.json), [bonus route](native-bonus.json), [wrong-order and retry](native-order.json), [browser](browser.json), and [geometry preservation](geometry-preservation.json).

Two continuous native sections cover the complete main route, joined at the existing Thunder Pools checkpoint. Together they ride all five movers, grind both rails and use all four drums without death. The ascent finishes with 76 collected cargo/checkpoint boxes. Separately, 33 supported approach scenarios harvest all 110 cargo crates without death; sixty hopper patrol samples stay over their banks. No single continuous main all-box run is claimed.

Native and normal-loop browser bonus previews collect all 46, earn the preview gem and finish without death. Main browser checks cover the opening's ten cargo boxes and first checkpoint, one staged kill-plane fall with recovery, and a separately staged finish. All eight full-render 1280×720 views and both lite finishes were inspected, with clean consoles. Actual bonus play continues to bank toward the parent tally.

The generic audit projects onto the camera lane, which cannot order the stacked, reversing ascent reliably. Its apparent empty checkpoint section is resolved by the authored action-order check: eleven sections of ten crates. Its legacy reach heuristic also cannot identify the high bell's measured held-arrow/double-jump connection; positive native/browser and negative lost-arrow runs supply the evidence. All 110 main crates have support and no footprint overhangs.

Geometry comparison proves 845 main non-crate/enemy components and 124 bonus components unchanged, with both enemy placements unchanged. The two intentionally activated outline supports retain their original dimensions, positions and materials. Movement, animation, native art, hazards and the published editor pack are preserved. Required level checks, layout support, production build, release-size check (952,666,803 / 1,000,000,000 bytes), and diff checks pass. Publishing is authorized and awaits GitHub authentication.
