# Milk cartons

Plain `wood` crates now use the procedural milk carton from the supplied references. Existing level files keep their crate kinds and authored positions. Specialized reward, bounce, metal, TNT and nitro crates retain their distinct art and rules.

`src/milkCarton.ts` owns the cream cube, red vector MILK print, small rounded edges and satin cardboard material. The shader adds restrained paper-fibre colour and roughness variation, faded at distance to avoid shimmer. The four vertical faces carry the print; the lid and base stay blank. Each body is 0.96 m wide, with its original collision box. The gable adds 0.384 m of visual height and includes sloped shoulders, inset triangular gussets and a bevelled sealed strip. Geometry and the 512 px print are shared; body materials stay independent for time/boost face changes. The HUD counter uses the same complete carton, fitted into its existing slot.

Only the highest live, solid crate in a support column unfolds. Other crate kinds also cover their carton support. Outline ghosts do not carry weight and never show an opaque spout. Exposure refreshes when crates break, materialize, move or reset, including simultaneous changes whose solid count is unchanged. Existing crate settling, rails, collision and reward logic remain authoritative.

The downstroke is constrained directly to the descending movement sole, with a 2 mm clearance. Stationary weight holds the fold stationary. The top uses the same rendering interpolation as the character, and the existing stomp's snap to the cube lid completes the fold. The body holds its size for that impact interval before the existing pop effect. Near an on-foot carton landing, a small presentation correction seats the visible shoe soles on the movement feet; it fades out through the bounce and never moves the collider or changes jump velocities. The existing 8 cm support-overlap margin prevents incidental contact with a neighbouring box from pressing its spout. Spring motion is used only when the lid is released or the covering crate disappears.

This is a stylized game prop with geometric folding, not a simulation of paper thickness or material failure. The unseen rear print is inferred from the stack reference. No external model, image-generation service or new runtime dependency is used.

## Verification

Run `node tools/test-milk-cartons.mjs` for 336 direct weight-contact samples at 30/60/120 Hz, slow/fast descent, held weight, side misses, independent neighbours, mixed stacks, outline materialization, resets, time/boost face restoration, stack settling and three actual character landings. The landing cases measure the visible sole vertices, the final flat lid, unchanged collision bounds, one reward and the original bounce.

The existing crate-jump, life/multi-hit, crate-rest-surface, character-interaction, gameplay-HUD and fixed-render-pipeline checks also pass. `npm run build` remains the TypeScript + production bundle gate; the full suite is not part of this iteration.

For local visual review, open `/tools/carton-review.html` on the development server. It uses the actual `Level` and `Player` classes, provides a reference stack, four orthogonal viewpoints, top/bottom destruction, slow motion and contact-frame stepping, and does not write saved levels. `/tools/carton-game-review.html?playtest&level=codex-lab` adds a temporary stack and review controls to the full game renderer. The review HTML files are intentionally excluded from production entry points.
