# Stomped Coral Crab

The normal Coral Crab (`grunt`) uses a new Meshy carcass after a top-face stomp. The live rig compresses briefly, then the flattened model settles on the floor with bold X eyes. It remains harmless until a fresh spin or rope spin flings it through the existing enemy-debris simulation. The kill scores once, respawn restores the live model, and direct spin kills retain their original presentation. Ghost and Nightworks variants are excluded.

## Asset and generation

- Runtime model: [`public/enemies/crab-stomped.glb`](../../public/enemies/crab-stomped.glb).
- Source and final hashes, measured bounds and preparation details: [`crab-stomped.provenance.json`](../../public/enemies/crab-stomped.provenance.json).
- Reference: [`references/crab-stomped.png`](references/crab-stomped.png), edited from the existing living crab with **built-in ImageGen**. No fallback image service was used. The exact prompt is in [`reference-prompt.txt`](reference-prompt.txt).
- Meshy job: `01a16053-fa22-7291-b055-38ac86610b69`, T2 Smart Topology, **15 credits consumed**. [`tasks.json`](tasks.json) records the request and result. The wrapper composes the existing official Meshy CLI adapter.
- Meshy delivered **15,620 triangles** and three embedded **2048 × 2048** PBR maps. Preparation adds eight triangles to cap three measured pinholes, for **15,628 triangles**. Every original vertex, normal, UV, index, material and texture remains intact; no decimation, LOD or texture resizing.
- A uniform parent transform grounds and fits the model to a 2.8 m footprint with 0.871 m height. No movement tuning changes.

The downloaded source remains in the ignored authoring folder `.img2threejs/crab-carcass/crab-stomped.glb`. After retrieving that exact source, reproduce the packed asset with:

```sh
python3 tools/crab-carcass/prepare.py
```

`prepare.py` validates the reviewed source SHA-256 and preserves its original binary data. The Meshy wrapper accepts the existing adapter's commands; set `ENEMY_MESHY_CLI` to the installed official CLI entry point when running it on another machine. Do not resubmit the completed generation to reproduce the packed asset.

## Verification

`node tools/test-crab-carcass.mjs` covers native stomp/bounce, persistence, harmless contact, fresh spin ownership, launch/crate collision, lifetime, one-time scoring, reset, variant isolation and actual GLB metadata. Existing enemy-runtime, enemy-assets, enemy-gameplay and turtle-shell tests pass. `npm run build` passes TypeScript and Vite.

Real Chrome checks pass on the production preview in lite and full rendering. A declared test fixture aligns the airborne player over the crab; native input, movement, gravity and contact then perform the stomp. Real F input flings the carcass. Reset and direct-spin death are also checked. Native full rendering is **3840 × 2160** with fixed rendering disabled, all 15,628 triangles and all original 2K maps present, and no page, console or WebGL errors. The user's saves are untouched.

Evidence: [`docs/performance/crab-carcass.json`](../../docs/performance/crab-carcass.json). Final native-resolution image: [`docs/art-reviews/crab-stomped-native.png`](../../docs/art-reviews/crab-stomped-native.png). Additional local views are in `/private/tmp/crab-carcass-browser/`.

The combined offline preview on port 6265 was rebuilt as `3f798b077012c5f305dd`. No push, publication or deployment was performed. The requested Meshy generation was the only new model purchase.
