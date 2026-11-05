# Beach Street kite art

The user's woodie-car reference supplies the vintage flame palette and worn wood character. The two `*-reference.png` images were generated separately with the built-in imagegen tool, in a Crash 4 aesthetic, before Tripo modeling. Exact prompts are in `prompts.json`.

## Component budgets

- Canopy: Tripo web, Smart Mesh P2.0, triangle topology, target 8,000; exported **7,873 triangles**.
- Wooden control bar: Tripo web, Smart Mesh P2.0, triangle topology, target 2,000; exported **1,912 triangles**.
- Flying lines, bridles, guide hardware and attachment loops: manually built geometry.

No HD/Ultra generation, API credits, distance mesh replacements or runtime decimation.

## Rigging reference

[Ocean Rodeo kite manual](https://oceanrodeoeurope.com/web/content/6898?download=true&unique=b572a78b71e2966c8b7aaca670eb9c838d9ddda4), pages 11–12: four flying lines, two front bridle-supported attachments and two outer steering attachments. The game rig uses this topology, with reinforced canopy tabs and a center load-line guide on the wooden bar. Dimensions are adapted to the existing stylized rider and camera framing; this is game artwork, not equipment documentation.

The canopy and bar remain outside the character hierarchy so they do not alter player collision. Existing grip IK, kite movement and flyaway behavior stay owned by the runtime.

## Validation

`node tools/test-kite-art.mjs` checks the exported budgets and textures, six measured surface anchors, flying-line and bridle clearance through steering/wind/jump/portrait poses, leader continuity and flyaway/reset. `node tools/test-kite-controls.mjs` checks the actual player controls, hands, charge/jump, flips, grind, death, bonus dock and ordinary-level isolation. Both pass, as do production build/typecheck and release-size validation (838,128,479 bytes).

Chrome review covers the actual Beach Street scene at native MAX (3024 × 1724) and normal 720p. The kite loads before presentation, hand grip errors remain below 0.04 m, and steering, charged jump, flyaway and reset retain the attachments. The warning/error console is empty. Evidence is in `verification/`, including the full-resolution canopy, in-level wooden bar close-up, airborne state and normal game presentation. `review.html` and `game-review.html` are local authoring fixtures, excluded from the published game.

The generation used **260 Tripo web-plan credits**. Exact generated reference prompts and the built-in imagegen mode are recorded in `prompts.json`; task/export IDs, hashes and source references are in `provenance.json`.
