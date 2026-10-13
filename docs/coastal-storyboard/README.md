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

Deployment verification will be recorded here after the Pages workflow and
the public browser check complete.
