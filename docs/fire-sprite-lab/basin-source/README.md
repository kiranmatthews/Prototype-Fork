# Independent broad basin source

The user rejected `e2cb1117`: widening Flame02 and flaring its lower mesh was spatial distortion of an existing narrow fire. That method is removed entirely. The basin now uses one genuinely broad source animation on a normal four-vertex billboard at its native aspect. The rest of the lab retains the accepted v5 assets, normal Bone Man gameplay/debug tabs, shared imagegen palette and existing Jak heat pass.

## Source and reproduction

[Small Camp Fire by JangaFX](https://jangafx.com/software/embergen/download/free-vdb-animations) is supplied under CC0 as 200 VDB volumes. [Original archive](https://www.mediafire.com/file/9xx9icyomy2txv7/SmallCampfireVDB.zip/file). The complete archive and extracted volumes are retained in the ignored `art/fire-sprites/basin-source/` cache; their hashes are in that directory’s tracked `provenance.json`. The EmberGen preset is retained but is not executed or modified.

`tools/fire-sprite-lab/render-basin-source.py` renders the source’s `flames` channel with Blender 5.2. The fixed orthographic view, uniform 0.01 unit conversion, volume sampling and one shared emission/density material apply to every frame. Smoke is omitted from this flame asset. There is no re-simulation, frame fitting, flow interpolation, geometric warp or per-frame exposure adjustment. A first low-opacity export was too faint in the game material and was replaced by one fixed calibrated density for the entire sequence.

All 200 native 512×512 projections are retained as PNGs. `pack-basin-source.mjs` removes only the constant all-frame transparent margin and packs the result as lossless WebP. It checks every visible RGB and alpha value after decoding. Source registration remains fixed at the physical fuel-bed origin. Sprite width is derived from its cropped source dimensions and the single world height, so cropping does not stretch the drawing.

With the original archive extracted under `art/fire-sprites/basin-source/original/`, run from the repository root:

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python tools/fire-sprite-lab/render-basin-source.py
SHARP_MODULE=/path/to/sharp/index.js node tools/fire-sprite-lab/pack-basin-source.mjs
```

The original Unity packer retains `basin/cycle.json` when rebuilding the other cycles. The runtime includes all 200 campfire frames at 30 fps, lasting 6⅔ seconds. Its source motion is separate from Flame02/Flame03, and it reuses the same six-colour imagegen painting. No new imagegen cels are generated.

## Review

`review.html`, served through the local Vite server, shows source projection and actual game material together, with pause, step, slow playback and a loop-boundary button. `motion-audit.json` compares alpha changes between consecutive frames and across 199→0. These measurements supplement visual inspection; they are not an aesthetic acceptance claim.

The previous `wide-basin/` screenshots document the rejected stretched method. Current source/game evidence belongs here.
