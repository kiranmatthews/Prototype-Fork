# Roo painted blink textures

Derived locally from the existing owner-controlled Meshy BoolieRoo head and
its original UVs. Ownership/provenance:
[`../meshy-boolieroo-head/provenance.json`](../meshy-boolieroo-head/provenance.json).
No original texture or geometry was replaced in the source asset directory.

- `base-clean.webp`: 512² lossless colour atlas. Conservative low-contrast
  seam colour reconciliation and two-pixel UV gutters; original markings kept.
- `paint-coordinates.png`: 256² RGBA data map, decoded on CPU once and shared.
  R encodes absolute mesh X (0.02–0.18), G encodes Y (0.23–0.35), B encodes Z
  (0.01–0.19), A identifies paintable eye surfaces. Non-eye texels are zero.
- `manifest.json`: source hash, unchanged triangle count, sizes and seam metric.

`src/character/rooBlinkPaint.ts` authors the accepted warm lid, crease and moving
dark lash into each player's reusable 256² RGBA CanvasTexture. This adds one
sampler to the existing material, no geometry or draw call. Texture uploads
occur only when the quantized closure changes. The original raised lash ridge
and head silhouette remain fixed; at close zoom the compact paint has a soft
or pixelated edge. Hair obscures some profile views.

Gameplay uses an independent cosmetic random stream per player: 2–6 seconds
open between blinks, with each blink lasting 0.2–0.4 seconds (34% closing,
12% closed hold, 54% reopening). Pause freezes it; switching to Skull resets it
open and suppresses painting. Geometry, UVs, movement and collision are unchanged.
