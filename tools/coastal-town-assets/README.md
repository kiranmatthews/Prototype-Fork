# Coastal and Rooftop Deliveries art production

The deliverable has 17 sections: fourteen main-route views and three bonus
views. Each began with a real player-camera capture. Built-in Imagegen
redrew the views in the same friendly seaside-town style. The owner then
requested no store signage and modular construction; the final storyboard
copies and every production model follow those instructions.

Open `docs/coastal-storyboard/index.html` to compare the original view,
storyboard and rebuilt level. Final review images are WebP. Original
generated PNGs are retained locally in `.img2threejs/coastal-town/art-originals/`.

## Editable assembly

- `src/levels/coastal-town-art.ts` owns the street/bonus placement helpers.
- `src/coastalTownAssets.ts` registers separate component models and mattes.
- Each storefront has its own editor group. Walls, mouldings, roofs,
  windows, doors, awnings, balconies, corner trim and plants remain separate.
- The same kit constructs the bonus's rooftop supports and rear town.
- No store advertising is supplied. The level validation test reserves
  capacity for at least 256 further owner-authored components.
- Original road grades, gaps, rails, actors, checkpoints and bonus crate
  decisions are compared with the pre-art published source in
  `gameplay-baseline.json`. Coastal has its own wider player framing; global
  movement tuning is unchanged. The offshore sand slab is deeper to prevent
  the current ocean shader from treating the whole bay as shallow foam.

## Provenance and reproduction

[Storyboard prompts](storyboard-prompt-set.json), [signage revision](signage-revision.json),
[modular references](modular-prompts.json) and [scenery prompts](scenery-prompts.json)
retain the final prompt history. All raster work
used the built-in Imagegen tool. No API-key image-generation fallback was used.

`meshy_jobs.py` composes the repository's official Meshy CLI adapter. A
named reservation and stable operation ID are saved before each submission.
All 16 image-to-3D tasks succeeded, consuming 240 credits. Credentials and
signed provider responses remain outside committed/public files. Never
blindly retry an unknown provider outcome.

To rebuild existing tasks without new generation:

1. Run `python3 tools/coastal-town-assets/meshy_jobs.py download NAME`.
2. Run Blender in background mode with `prepare.py -- NAME` for the original
   Meshy geometry, UVs, measured proportions, far mesh and review views.
3. Run `make-body.py` and `make-trim.py` in Blender for the two source-owned
   structural primitives. These consume no provider credits.
4. Run `pack.py NAME` with Pillow. Set `COASTAL_TOKTX` to Khronos toktx and
   run `compress_gpu.py` for the optional GPU textures. JPEG fallbacks remain.
5. Run `registry.py` to refresh measured registry entries.
6. Run `node tools/test-coastal-town.mjs`, the `check:levels` package script,
   and the `build` package script. No full-suite run is required.
7. Run `node tools/coastal-town-browser.mjs --lite` for real keyboard gap,
   checkpoint, pit, finish and bonus-return checks. Omit `--lite` for full
   rendering; `--visual` records render timing without repeating input checks.
8. Run `node tools/coastal-storyboard-capture.mjs --after` for the 17 final
   player views, then `package-art.py` to update the comparison gallery.

The browser tools default to port 5264 and accept `COASTAL_BASE` for the
production build or public deployment. The capture tool also accepts a
comma-separated `COASTAL_SCENES` selection.
