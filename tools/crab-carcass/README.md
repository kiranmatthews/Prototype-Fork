# Stomped Coral Crab

Normal Coral Crabs (`grunt`) leave a flattened Meshy carcass after a descending stomp. The face has two dark X marks directly on a continuous surface, with no eyeballs, eye whites, eye stalks or eyebrows. A fresh spin or rope spin flings the harmless carcass through the existing debris simulation. The kill scores once, reset restores the living crab, and direct side-spin kills retain their original presentation. Ghost and Nightworks variants are excluded.

## Meshy asset

- Runtime model: [`public/enemies/crab-stomped.glb`](../../public/enemies/crab-stomped.glb).
- Exact source, binary and packed hashes: [`crab-stomped.provenance.json`](../../public/enemies/crab-stomped.provenance.json).
- Reference: [`references/crab-stomped-x-only.png`](references/crab-stomped-x-only.png), made with built-in ImageGen; exact prompt: [`reference-x-only-prompt.txt`](reference-x-only-prompt.txt). This is generation reference material, not a hand-authored runtime texture.
- Meshy image-to-3D, Meshy surface repair, then Meshy retexture: **35 new credits** (15 + 10 + 10). The generation ledger retains the original 15-credit superseded model separately. No credit purchases.
- Final Meshy delivery: **16,160 triangles** and three embedded **2048 × 2048** PBR maps. Every byte of the delivered binary is preserved. No locally authored geometry, texture edits, runtime eye paint, decimation, LOD or texture resizing.
- A uniform parent transform grounds and sizes the artwork to **2.8 × 0.797 × 2.726 m**. It does not change movement tuning.

The exact final source is stored in the ignored authoring folder `.img2threejs/crab-carcass/crab-stomped-x-only-final/downloads/model.glb`. After restoring that downloaded source, reproduce the packed asset with:

```sh
python3 tools/crab-carcass/prepare.py
```

`prepare.py` validates the recorded download hash, adds only a uniform fit/grounding parent and provenance, and preserves the complete Meshy binary. `meshy_jobs.py` composes the existing official Meshy CLI adapter. `tasks.json` records all three successful jobs and their costs. Do not resubmit completed generation jobs to reproduce the packed asset.

## Contact and verification

Crab stomps use a swept descending sole crossing with 25 cm of edge overlap, so a fast fall cannot skip the small combat box. A genuine landing takes precedence over a simultaneous spin or invincibility contact. Rising contacts, clear misses and side spins keep their existing behavior. The initial bounce starts above the new carcass box.

`node tools/test-crab-carcass.mjs` passes edge/fast contacts, a moving patrol, simultaneous attacks, negative side/rising cases, bounce, persistence, harmless contact, fresh spin and rope-spin ownership, fling/crate collisions, lifetime, scoring, resets, variant isolation and actual asset provenance. TypeScript and the Vite production build pass. The packed and production GLBs are byte-identical.

Real in-app browser checks pass stomp and fresh-spin fling in both lite and full rendering. The existing QA page's declared fixture places an airborne player above the enemy; native gravity and combat contact complete the stomp. Its F action performs the spin. Both captures retain four lives, zero deaths and one 100-point kill. The generic probe label does not detect corpse-to-flung transitions; the visible before/after engine state explicitly changes from `crab-carcass` to `crab-carcass-flung`.

Review front, quarter, side and top at original **3840 × 2160** resolution. The full-game check has a native **3510 × 2010** game viewport inside that review page, with fixed rendering disabled. No browser warnings or errors. The production model is also checked on port 6265.

Evidence: [`docs/performance/crab-stomp-x-only.json`](../../docs/performance/crab-stomp-x-only.json). Final production image: [`docs/art-reviews/crab-x-only-native.jpg`](../../docs/art-reviews/crab-x-only-native.jpg). Full-render gameplay: [`docs/art-reviews/crab-x-only-gameplay-native.jpg`](../../docs/art-reviews/crab-x-only-gameplay-native.jpg).

The combined offline preview at port 6265 was rebuilt as `af9c699be6e5df487610`. No push, publication or deployment.
