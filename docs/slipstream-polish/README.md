# Slipstream art polish

Seven real baseline views cover the entrance, enclosed flume, forest bend,
ruined reservoir, broken-platform pools, falling coils and coastal finish.
Each has its own ImageGen paintover in `concepts/`. These are art-direction
studies, not gameplay evidence. The latest user direction prioritizes overall
quality and cohesion; distant scenery and skybox matching are excluded.

The playable treatment uses brighter aqua enamel with restrained wear, broad
rounded ivory coping, warm sunlight and stronger teal bounce inside the flumes.
Sandstone surfaces unify the old ruins and maintenance decks. Existing Meshy
palms, hibiscus, ferns, broadleaf plants and flowering vines form compact gardens
at entrances, supported terraces, old masonry and tunnel walls. The 74 cliff
plants were fitted to the approved near rock triangles with vertical raycasts.
`garden-anchors.json` records those measured roots. New props are visual only.

All four edges of the waterpark mattes are feathered, including the upper edge
of alpha paintings. Wider borders and the existing depth-fog fade prevent
rectangular cut edges. Distant sky art is unchanged.

`screenshots.json` is the shared capture ledger. The review script refuses to
exceed 15 screenshots across every pass. Other gameplay tests disable image
capture. The `before/`, `iteration/`, and `after/` folders contain real browser
captures; the single iteration view is separate from the final seven views.

`art-direction.json` retains every paintover prompt and source. The generated
fiberglass source is in `tools/waterslide-island/polish/`; its 1024px WebP is the
only new runtime image. Meshy spending for this brief: **0 / 300 credits**.

`physics-baseline.json` fingerprints the original source at commit `18cbf33e`,
before the art changes. Numeric coordinates are canonicalized to one
micrometre to remove V8 trigonometric roundoff; Node 22 and 24 agree. The test confirms
that all 1,600 physical components, spawn, kill plane, camera rig, race route,
gaps and rules retain the original fingerprint. Decorative trim is kept within
the existing 100,000-triangle editor limit.

Regenerate rounded coping with `tools/bake-waterslide-trim.mjs`, the planted
cliff anchors with `tools/waterslide-island/bake-polish-gardens.mjs`, and the
published level entry with `tools/sync-slipstream.mjs` in that order.

The final captured review prompted two small cleanup changes: the service
decks and ruins now use Custard Creek's lighter sandstone, and the service
decks use the existing render-only depth bias to eliminate their coplanar
flicker against the slide. No additional screenshot was taken after reaching
the 15-image cap; the `after/` images show the pass immediately before those
two corrections.

Validation covers the original physics fingerprint, all 74 measured cliff
plant roots, 344 prop-foot probes, 48 trestle-foot probes, 528 tunnel rays,
3,075 column-clearance probes, editor portability, `npm run check:levels`,
and `npm run build`. The complete lite browser race finished all eight riders;
the player finished in 157.10 seconds with zero falls/deaths. Seven full-render
section visits recorded supported positions and no asset or console errors.
`race-lite.json`, `time-trial.json`, and `after/report.json` retain the evidence.
The post-cleanup visits are in `final-browser.json`; the full summary is in
`validation.json`. Open [the visual comparison gallery](review.html) to review
all seven sections alongside their built-in ImageGen paintovers.
