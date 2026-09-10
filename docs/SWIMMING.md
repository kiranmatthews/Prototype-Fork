# Jungle Ruins swimming

Walk back toward the camera from the Jungle Ruins spawn to reach the sandy cove. Normal direction controls move through shallow water and transition automatically into surface swimming. Release direction to tread water; hold Jump while moving for a faster stroke. Swim toward the rising beach to stand up and walk out. The board stows on water entry and normal walking/skating controls return on land.

The moving stroke sits 35 cm deeper than the initial visual review, following the user's correction. Treading water retains its independently tuned height. Source animation controls the body; a critically damped spring follows the ocean's real CPU wave sample. Ground clearance and separate enter/exit depth thresholds prevent shore flicker. Water entry clears incompatible grabs, flips, slides, vert orientation, board and knockdown state. It ends the pending trick combo without consuming a life. Run timers and ordinary collisions/hazards keep their existing ownership. The camera follows the swimmer instead of anchoring to the seabed; the landing X is hidden in water.

## Motion and licence

The author-uploaded [free Standard pack](https://opengameart.org/content/universal-animation-library) contains `Swim_Fwd_Loop` and `Swim_Idle_Loop`. Both are CC0; no paid files or new licence purchase were required. The original 2025 pack uses Blender DEF bone names, which the existing Quaternius importer now maps to the equivalent modern UAL names. It retains the source's 30 FPS clock and transfers 22 semantic joint rotations through bind-world deltas to the procedural player's canonical rig, plus cyclic pelvis translation. Runtime poses blend over 0.3 seconds. Catalog revision 20 adds the two clips to older saved animation suites while preserving edited clips.

Exact archive/file/licence hashes and conversion metadata are in `public/animations/quaternius-swimming/provenance.json`; the original licence is beside it. Generated source modules are `src/animation/quaterniusSwimFwd.generated.ts` and `src/animation/quaterniusSwimIdle.generated.ts`.

## Level data and tuning

`src/levels/jungle-shore.ts` owns the beach/seabed mesh, palms, headlands and ocean spec. The existing rear perimeter opens into the cove and continues around its sides and far edge. The original Jungle Ruins course, spawn, pits, checkpoints and gate remain in place. The ocean and shoreline survive editor capture/reload.

`CustomOceanData.swimBounds` opts a water presentation into gameplay using world XZ bounds `[minX, minZ, maxX, maxZ]`. Values must be finite, ordered and within the existing level-coordinate limits. Oceans without this field keep their prior gameplay behavior. Water height comes from `CoastWater.heightAt`, the same wave function as the renderer. Full ocean passes are active near the cove in full rendering, and the lighter mode resumes deeper in the jungle.

`src/swimming.ts` owns this first swimming profile:

| Setting | Value |
| --- | ---: |
| Normal / fast swim speed | 4.2 / 6.2 m/s |
| Acceleration / release response | 5 / 4 s⁻¹ |
| Enter / leave swimming depth | 1.4 / 1.04 m |
| Idle / moving root immersion | 1.65 / 1.33 m |
| Buoyancy response | 7 s⁻¹ |

Foam and entry droplets use fixed pools with shared geometry. They reset on respawn and release their resources on a level change.

## Focused verification

`npm run check:swimming` covers source loops and catalog migration, 30/60/120 Hz buoyancy/drag, the real spawn → wade → swim → idle → shore route, a fast airborne/knockdown entry, five fast approaches to water boundaries, reset and editor capture. `npm run check:levels` covers the shared schema, geometry and existing Jungle enclosure. `npm run build` remains a type check and production bundle; the full suite is opt-in.

Local browser review: `/swimming-review.html?playtest&level=jungle`, with optional `&lite`. Buttons drive the real player loop, including a continuous stroke circuit and a side view. Normal controls restores manual play. This QA entry is excluded from the production bundle.
