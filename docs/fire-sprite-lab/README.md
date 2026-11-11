# Fire Sprite Lab

Open `fire-sprite-lab.html` from **Labs → Fire Sprite Lab**. Eight arrangements reuse three separately authored flame families. Select a card, drag to orbit, and use **Single drawn flame** to inspect its source cycle. Pause, scrub or step the drawings; ¼ speed exposes the sequence and seam. Hue presets, grid, heat strength and 720p/MAX rendering remain available. Frame blending is off by default. Reduced-motion preferences start paused.

## Longer drawing cycles

The current revision has **108 distinct original PNG cels: 36 narrow, 36 medium and 36 broad**. Each cel was produced in a separate built-in imagegen call. It retains the twelve original keys per family and adds 24 individually generated drawings between neighbouring poses. Larger pose changes received more intermediate drawings, with coverage across the cycle and its closing transition. One narrow cel needed a separate imagegen edit to restore a transparent background; its rejected version and repair input are recorded.

The supplied Crash 4 torch and brazier recordings inform the connected bright base, hollow red upper lobes, independent inner colour shapes, pinching necks and rising separated tips. [The reference study](v2/reference-study.md) contains the observations. The footage does not establish the original drawing count, source texture or exact loop period. The drawing direction is Looney Tunes/Tex Avery. These are newly generated interpretations; the supplied recordings remain local.

- Final ordered sequences: [v3/sequence.json](v3/sequence.json).
- Source contact sheets: [narrow](v3/narrow-contact-sheet.png), [medium](v3/medium-contact-sheet.png), [broad](v3/broad-contact-sheet.png).
- New file hashes, prompts and reference versions: [v3/generation.json](v3/generation.json), with exact prompts in [v3/prompts](v3/prompts).
- Original twelve keys per family: `public/fire-sprites/v2/{narrow,medium,broad}/01.png` through `12.png`; provenance in [v2/generation.json](v2/generation.json).
- New native PNGs: `art/fire-sprites/v3/{narrow,medium,broad}/`.
- Runtime manifest and lossless pages: `public/fire-sprites/v3/`. Manifest frame paths are repository source paths, not hosted download URLs.

Base playback is **36 drawings per second over one second**, an authoring choice. Arrangements can vary playback rate or phase. The additional frames change the silhouette and internal colour shapes; they are not repeated poses, crossfades or optical-flow images. Optional frame blending remains available for comparison.

## Native art and runtime

`tools/fire-sprite-lab/pack-cycles.mjs v3` packs the original full canvases into lossless WebP atlases. Narrow and medium remain 1254 × 1254, broad 1774 × 887. Four pages each serve narrow and medium; five serve broad. Every page is at most 4096 pixels per axis. Packing verifies exact alpha and all RGB values at nonzero alpha against each original. WebP may normalize invisible RGB at alpha zero; the original PNGs are retained unmodified. No trimming, resizing, mipmap replacement or distance-based substitute is used.

The retired v2 atlases and manifest are preserved under `art/fire-sprites/v2/` rather than shipped alongside their replacements. The original v2 PNG keys remain public and also supply the exhibit thumbnails. This keeps the larger native cycles within the existing Pages hosting budget.

Each drawing has a measured foot anchor that registers its quad without changing its silhouette. Canvas aspect ratio is preserved. The material uses luminous additive blending, hue transforms and translucent red tips. Optional interpolation accounts for both frames' foot anchors and blends premultiplied colour; it is off by default. The shader supports up to 64 drawings and eight texture pages per family through static sampler branches.

The eight arrangements use 99 camera-facing instances. Body counts are 1 torch, 3 bonfire, 2 curtain, 10 ring, 6 jet, 1 spirit flame, 5 vortex and 1 ember bed; the remaining instances are sparks. Source view shows one unrotated drawing without sparks or arrangement motion.

The shared `FlameHeatDistortion`, `writeTorchHeat` and Jak distortion topology are unchanged. Their framebuffer pass refracts the world behind the sprites with foreground depth protection. The collection uses at most 234 heat pockets and a focused exhibit at most 36, under the existing 512-pocket limit. Pause freezes drawing playback and heat on the same clock.

## Validation and reproduction

With an installed `sharp` package, or `SHARP_MODULE` pointing to its entry point:

```sh
node tools/fire-sprite-lab/pack-cycles.mjs v3
node tools/fire-sprite-lab/review-cycle.mjs docs/fire-sprite-lab/v3/narrow-cycle.json /tmp/narrow-review
```

The review tool produces native animated WebPs, a contact sheet, the last/first comparison and transition measurements. It does not invent, interpolate or align source drawings. `sequence-cycles.mjs` is an authoring aid for selecting gaps and recording generated cels; the completed sequence is protected against accidental reinitialization or extra insertion. The initial `timing-plan.json` is historical; `sequence.json` is authoritative.

All 108 hashes are distinct and match the retained PNGs. All atlas cells passed pixel verification. Every drawing was stepped in the full native browser renderer, including 36→01 for each family. [Browser contact sheets](v3/browser) show all native-rendered poses. Review also covers lite/full rendering, all eight arrangements, source mode, ¼ speed, hue, heat and 720p/MAX. The frozen heat fixture changes 1,101 pixels above a three-channel-value threshold; zero-strength and disabled heat are pixel-identical. The production page reports 108 drawings and has no console warnings or errors.

[Validation details](v3/validation.json) include the production build/type-check, tool-directory check and 991,918,868-byte release-size pass. The standalone browser harness now derives the last frame from the slider instead of assuming twelve frames; this revision was reviewed with the connected browser. Gameplay, level data, movement and existing game torches are unchanged.
