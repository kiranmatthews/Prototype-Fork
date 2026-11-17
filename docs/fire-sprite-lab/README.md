# Fire Sprite Lab / Ember Court

Open **Labs → Fire Sprite Lab**, or use `/?playtest&level=ember-court`. This now opens **Ember Court · Fire Lab** in the normal Bone Man game. The old lab URL redirects into that level; there is no separate movement controller on the published route.

Run, jump, double jump, spin and use the board with the normal game controls. The existing character, movement tuning, camera, input, checkpoint/respawn and finish systems own gameplay. A broad courtyard and low side terraces give room to move around torches, the basin, altar, ritual circle, trap, lantern, offering bowl and hearth. An open entrance, tall temple archway and roofless sanctuary keep the game camera clear. The lab omits the automatic time-trial pickup so exploring cannot accidentally start a timed run. This is an inspection arena, not a campaign challenge or crate collection course.

Press **M** to show/hide the ordinary debug tabs. **LOOK** controls Unity bloom/color treatment, **CRT** controls the display effect, and **RENDER** controls resolution (including MAX/native). **TUNER**, **SPIN**, **BOARD** and **TEXT** remain available. The normal game pause menu also offers **Show Debug Menus**. Existing saved effects settings apply.

The accepted torch/altar assets, shared imagegen palette and Jak heat pass are preserved. The basin now has a separate broad source animation. `src/levels/ember-court.ts` owns cloneable source-level geometry; `EmberCourtPresentation` owns art/texture loading and disposal only. The previous isolated authoring viewer remains in source for historical reference; it is no longer the Fire Sprite Lab entry point.

## V5: continuous source motion, shared imagegen colour

V4's 144 independently generated cels were rejected for flickering and inconsistent repainting. Further tests using clean input frames still changed neighbouring contours and detail. The user explicitly authorized preserving the source sequence's motion and using imagegen for shared artwork instead of generating every cel independently.

Two supplied **64-frame** flipbooks from [Thomas Iché / Unity Labs](https://unity.com/blog/engine-platform/free-vfx-image-sequences-flipbooks), released under CC0, supply the existing torch, altar and other arrangements. The basin uses a separate **200-frame Small Camp Fire simulation from [JangaFX](https://jangafx.com/software/embergen/download/free-vdb-animations)**, also CC0. There are **328 unique source frames across three motions**. The Unity raw 480-frame exports have unsuitable end joins; their packaged 64-frame flipbooks remain in use. The JangaFX source includes a continuous 200-frame cycle.

Unity source pixels remain unchanged. The campfire volumes are projected into sprites with one fixed orthographic camera and a uniform scale, using only their flames channel. One native 1254×1254 built-in imagegen painting supplies six sampled colours, shared by every frame. The material maps source intensity through this fixed palette and alpha curve, keeping colour bands consistent throughout the motion. Screen compositing prevents overlapping flames from washing out to white. Hue transforms reuse this material across the collection.

The Unity cycles play at 48 fps (1⅓ seconds); the basin plays all 200 frames at 30 fps (6⅔ seconds), matching the cadence of its supplied preview. These are not claims about Crash 4's asset rate. Varied phases and rates separate the neighbouring flames. There is no time-varying procedural shape deformation, frame-by-frame exposure adjustment, imagegen inbetweening, optical flow or default crossfade.

## Native assets and arrangements

The supplied Flame02 sheet is 2048×1024, with 128×256 frames. Flame03 is 1024×512, with 64×128 frames. These are their native packaged resolutions; no upscaling or downscaling is performed. Enlarging them exposes the source's limited detail. Original TGAs, converted PNG sheets and individual native cells are retained under `art/fire-sprites/v5/source/`.

`pack-source-cycles.mjs` verifies the complete TGA-to-PNG conversion, then losslessly packs the unchanged sheets as WebP. It decodes the result and checks exact alpha and every visible RGB value. Each cycle uses one constant foot anchor, avoiding per-frame registration jitter. Every sprite retains its source aspect, including the basin. Its width is always height × source width / source height. World scale also scales the heat source. There are no distance-based substitutions.

The collection has 32 anchored body instances: 1 torch, 1 basin flame, 7 altar tongues, 10 ring flames, 2 outlet-rooted jet tongues, 1 spirit flame, 5 spiral flames and 5 hearth tongues. The courtyard adds 7 torches, for 39 instances. The miniature whole-flame particle emitter is removed. Small natural fragments inside the recorded source frames remain. The jet is rooted at its outlet instead of moving copies of a whole flame through space.

The temple basin uses one billboard of a genuinely broad campfire simulation. Interacting tongues emerge from the source’s broad fuel bed; no existing torch is widened, repeated, or given a flared mesh. The sprite is an ordinary four-vertex plane, and the same native aspect applies in the game and source review. The 512×512 orthographic renders retain one camera, origin and material throughout. Packing removes only a constant rectangle of transparent padding, without resampling or geometric changes. The original VDB archive is retained locally; all 200 rendered PNGs, source hashes, render recipe and runtime atlas are retained in the repository. See [basin source notes](basin-source/README.md).

The shared `FlameHeatDistortion`, `writeTorchHeat`, heat attachment and Jak distortion implementations are unchanged. Their existing framebuffer refraction retains foreground depth protection. Game pause freezes fire and heat on the level clock. Fixed coloured lights illuminate the study contexts.

## Files and reproduction

- Native shared painting: `art/fire-sprites/v5/clean-pilot/120.png`.
- Exact built-in imagegen prompt: [clean-120.txt](v5/prompts/clean-120.txt).
- Selected/rejected imagegen records: [generation.json](v5/generation.json).
- Current runtime sheets, manifest, painting and attribution: `public/fire-sprites/v5/`.
- Unity source pixel audit: [native-audit.json](v5/native-audit.json).
- Basin source render/loop audit: [motion-audit.json](basin-source/motion-audit.json).
- Work, visual findings and validation: [WORK.md](v5/WORK.md).

With `sharp` available, or `SHARP_MODULE` pointing to its module entry:

```sh
node tools/fire-sprite-lab/pack-source-cycles.mjs
node tools/fire-sprite-lab/pack-basin-source.mjs
npm run build
npm run check:release
```

The local [basin source review](basin-source/review.html) compares the uncoloured projection with the actual game material and supports exact stepping across the 200-frame join. The earlier [motion comparison](v5/review.html) shows the user's torch recording beside rejected v4 and the actual v5 material, with normal/slow playback and exact frame stepping. The recording is a style and motion target; its phase does not match the new source. Reference footage and comparison captures stay in the ignored `v5/reference-media/` directory and are not shipped. The review page is a local authoring bench, not part of the published site.

Rejected v4 and superseded v2/v3 assets are retained under `art/fire-sprites/`, outside the published runtime. Historical provenance records retain their original path names. Source fidelity checks, frame counts and performance are technical evidence; they are not substitutes for visual motion review.
