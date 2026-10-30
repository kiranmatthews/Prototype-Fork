# Cohesive Carlisle timber decks

Local art correction, 30 October 2026 NZDT. The user requested large, genuinely
three-dimensional timber surfaces in the style of the Merchant Wreck opening,
then explicitly excluded slippery slopes. This increment changes dry deck art
only. It preserves the complete source course, collision, friction, camera,
movement, spring impulses, net berths and mandatory grind gaps.

## References and construction

The primary style reference is the existing Merchant Wreck model, visible in
`docs/drowned-crown/excellence/whole-section-model-front.png` and
`docs/drowned-crown/final/02-cargo-jetty.png`. The user's additional
[Crash Bandicoot 4 reference](https://www.youtube.com/watch?v=0qpPHDN5nus&t=100s)
was reviewed around 1:40 and 3:13: broad joined dock surfaces, irregular plank
seams within the platform, and substantial outer construction.

Imagegen supplied `references/broad-deck.png` and the revised
`references/chunky-deck.png`. Tripo Studio P2 generated and textured the complete
assemblies. The playable kit uses the second, deeper model: chunky bevels,
carved grain, nail heads, solid plank sides and deep cross timbers. Broad quays
use the first P2 model. The H3.1 comparison is a local source export only.

The runtime applies one physical scale equally to X, Y and Z. A wider deck gets
adjacent modules; a short end is cropped to the existing footprint. No plank is
stretched across a platform or flattened to fit its collision slab. Joining
edges are trimmed to the actual plank surface instead of the projecting
under-beams, eliminating wide channels between repeated modules. Original GLBs
and original texture bytes remain available alongside the fixed join crops.
The walking tops are within 4.2 cm of their unchanged native contacts; modeled
undersides reach about 1.65 m below them. Net openings and gaps are cut from the
same source top triangles. All 18 slippery slopes retain the wet navy material
and source grip/gravity values. Moving decks and boats retain their prior art.

Whole modules are instanced per scenery chunk. Every view and reflection uses
the same geometry; there are no reduced-detail or distance-based substitutes.
The previous individual-board renderer and flattened fitting experiments were
rejected and are not part of this increment; temporary evidence was archived
outside the repository under `/tmp/carlisle-rejected-boardwalk/`.

## Provenance and cost

`credits.json` records three completed model tasks and two texture steps:
325 existing Studio plan credits, balance 24,810 → 24,485. Combined known cost
with the earlier props/cone work is 1,105 of the user's authorized 3,000 credits.
No API credits were purchased. `public/props/carlisle-decks/provenance.json`
records original and fitted hashes, counts and task IDs. Source comparison
exports remain locally ignored; the selected original and joined P2 models are
tracked. `tools/prepare-carlisle-deck-tile.py` reproduces the join cuts.

## Local review

Play: http://127.0.0.1:5483/?playtest&level=carlisle-coast&art=harbour

Model comparison: http://127.0.0.1:5483/art/carlisle-shipyard/deck-replacement/review.html

`validation/fit.json` checks all 45 dry mesh footprints and 335,169 geometry
samples for unsupported timber overhangs, finite positions and contact height.
`validation/browser.json` records the compiled native/normal browser review,
all 18 actual wet materials, keyboard walking, main/bonus reload and console
errors. `validation/browser-lite.json` records the lite pass.
`../integration/source-validation.json` verifies exact main/bonus gameplay
fingerprints and the twelve unchanged environment props. These are bounded
visual and preservation checks, not a new full-course completion claim.

The work remains local under the user's publication hold.

## Revised chunky-deck image brief

Use the actual Merchant Wreck mesh as the style reference: fat hewn timber,
deep carved grain, orange-brown wood and dark nail heads. One complete broad
8 m × 12 m assembly, about 1.2 m deep, with fourteen rows of solid 0.28 m thick
planks. Broad level walking faces, strong bevels, deep splits and visible end
grain; narrow seams and restrained crown, no more than 0.08 m top variation.
Include deep longitudinal beams and cross timbers below the deck. No posts,
rails, legs, scenery or characters. Isolated 35-degree three-quarter view.

## Exact Imagegen prompt

Use case: stylized-concept. Asset type: image-to-3D reference for one cohesive large wooden dock deck module in a stylized 3D platform game. The supplied image is the exact STYLE reference, from the beginning of Merchant Wreck: match its sculpted chunky bevels, warm orange-brown oak, broad carved grain, rounded chips, simple dark iron nail heads and hand-painted shading. Change the OBJECT to a broad rectangular DECK PLANE, approximately 16 metres wide by 24 metres long, with a shallow substantial timber underside about 0.65 metres thick. One single connected complete deck assembly, not a pile of separate boards. The top is a level, uninterrupted walking plane assembled from around 26 rows of broad flat planks with staggered joins, varied lengths and restrained naturally irregular edges. Planks are solid flat sawn timber with thick bevelled ends, NOT rounded logs, corrugated strips or swollen cushions. Subtle carved grain, few well-placed nail heads, narrow closed dark seams, warm coherent timber palette. Include substantial side fascia and recessed cross timbers below the walking plane, but NOTHING above the walking surface: absolutely no rails, posts, fences, legs, ropes, crates, lamps, water, characters, background scene, text, arrows or labels. Keep all deck corners and its full silhouette visible. Isolated three-quarter overhead product view from the front-left at about 55 degrees elevation, on a clean light neutral grey background, even diffuse studio lighting without theatrical orange lighting, no bloom. Match the reference's craftsmanship and visual language closely, with clear painted bevel highlights and chunky edge damage; do not replace it with photographic generic wood texture or a thin flat tile. This is a single large production mesh reference, not a concept sheet or multiple views.
