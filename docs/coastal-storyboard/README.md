# Coastal and Rooftop Deliveries

[Open the 17-section comparison gallery](index.html).

The gallery contains fourteen main-route sections and three bonus sections,
each with the original player view, the final no-signage Imagegen storyboard,
and the playable rebuild. All raster generation used the built-in Imagegen
tool. Exact prompts and reusable component references are in
`tools/coastal-town-assets/`.

The live town uses sixteen separate Meshy-generated models (240 credits),
two shared code-authored structural primitives, six generated sky/scenery/
surface images, and small authored surfboard, festival and clock details.
Storefronts are editable assemblies. No store signage or advertising was
created for the playable level; that space is reserved for the owner.

The road and bonus puzzle geometry are checked against the published source
before the rebuild. Coastal has a level-specific wider camera framing and a
deeper offshore sand bed; global movement tuning is unchanged. The current
public runtime uses a closer bonus camera than the original capture revision.

Validation covers component/asset structure, unchanged road and crate puzzle
data, editor import/export with 256 spare component placements, required
level checks, themed bonus flow and a production build. Chrome input smoke
tests cover the first canal jump, checkpoint, pit respawn, finish, bonus
movement/jump and return. Full-render review covers all 17 sections and
requires no console or asset errors. Reports are in `docs/performance/` and
`review-full.json`.

Initial local timing: approximately 102 minutes from prompt to the first
playable art pass. Subsequent modularisation, visual repairs, current-main
integration and publishing are recorded in `docs/LEVEL_ITERATIONS.md`.

Deployment verified at 2026-10-13T09:14:08.969Z against commit `78903ea769185826dc1064212dacb541e51bd586`.

- [Pages workflow](https://github.com/kiranmatthews/Prototype-Fork/actions/runs/38371741138): successful.
- [Play Coastal](https://kiranmatthews.github.io/Prototype-Fork/?playtest&level=coastal-street-run).
- [Play Rooftop Deliveries](https://kiranmatthews.github.io/Prototype-Fork/?playtest&level=bonus-coastal).
- [Public comparison gallery](https://kiranmatthews.github.io/Prototype-Fork/coastal-town/storyboard/index.html): 17 sections, all 51 images loaded.
- Both full-render views are grounded, use the Coastal town sky and painterly
  materials, and show `Codex/sol fork · build 10-13 09:02 UTC`. No browser
  console or asset errors. `deployment.json` records the exact checks.
- Source and final asset files are in the chat's attached `coastal-storyboard`
  worktree. A separate original-asset backup is retained in the primary
  checkout under `.img2threejs/coastal-storyboard-01a1331c/`.
