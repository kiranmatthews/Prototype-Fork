# Beachside Run + Island Hopper

Eight geometry-guided hero targets and four art passes turn the existing
courses into one bright daytime beach-and-lagoon journey. First playable art
pass: approximately **31.6 minutes from the prompt**. Visual refinement,
traversal checks, editor portability and publication follow that first pass.

The final route has seven beach boardwalk sequences, a continuous departure
pier, five islands, two original ramp jumps, two original rope crossings,
eight checkpoints and one final gate/crystal. Island Hopper is translated
780 metres along negative Z; its gameplay dimensions, gaps and actors remain
unchanged. Its underwater piles use the authored seabed foundation to bound
editor work. Movement tuning is unchanged.

The hero targets guide golden layered cliffs, broad palms, orange hibiscus,
cream sand, honey oak and a turquoise sea. The level uses a high neutral sun,
blue skylight, warm ground bounce and real shadows on the sand. The wider
authored camera shows the sky and island succession. Assets are shared and
instanced, with near/far geometry and existing streaming/culling.

The original full-resolution ImageGen outputs are in `heroes/`; every exact
hero prompt is in `prompts.json`. Model/sand prompts, credit ledger, reference
images and reproducible processing scripts are in `tools/sunny-beach-assets/`.
Both new Meshy models cost **30 credits total**. No Codex reset was needed.

The public comparison gallery is `public/sunny-beach/gallery/index.html`.
It distinguishes generated art targets from actual gameplay and provides all
eight before/target/playable comparisons. Gameplay retains the browser game's
rendering and geometry fidelity; the hero images are not baked into the level.

Validation evidence is in `qa/`. Checks cover native keyboard movement,
158 supported samples across the connection, real input traversal of both
jumps and both rope grinds, checkpoint activation, water death/respawn, finish,
clean console/WebGL state, source geometry preservation, and editor captures.
The source-level check also verifies one finish, one crystal, camera ordering,
LOD assets and the 30-credit ledger. The existing focused level and boardwalk
checks and TypeScript/Vite build are required before publishing; no full suite.

The native export includes all scenery, five foam rings, the sunny sand and
ocean look. Generated woodpath rails are omitted from native capture because
their source component rebuilds them; this prevents duplicate rails and keeps
the extended course within the existing editor work limits.
