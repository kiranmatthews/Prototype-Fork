# Fire Sprite Lab

Open `fire-sprite-lab.html` from **Labs → Fire Sprite Lab**. Eight arrangements reuse three separately authored flame families. Select a card to isolate it, drag to orbit, and use **Single drawn flame** to inspect its source cycle. Pause, scrub or step the drawings; ¼ speed exposes the sequence and its seam. Hue presets, grid, heat strength and 720p/MAX rendering remain available. The default uses discrete cels without frame blending. Reduced-motion preferences start paused.

## Recording-driven revision

The first 16-cell atlas was rejected for visual quality. The current art follows the user's supplied Crash 4 torch and brazier recordings. [The reference study](v2/reference-study.md) records timestamped observations: a connected luminous base, broad changing red masses and holes, independent inner colour shapes, rising separated tips, and overlapping lobes at different phases. The footage does not establish the original source texture, exact drawing count or exact loop period.

There are **36 selected original PNG drawings**, each generated in its own built-in imagegen call: twelve narrow/tall, twelve medium/upright and twelve broad/low. The three base drawings were generated independently. Looney Tunes/Tex Avery was the explicit drawing direction. Medium 10 and broad 11 were redrawn after the first contact-sheet review to distribute large changes over successive poses.

- [Narrow sequence](v2/narrow-contact-sheet.png), [medium sequence](v2/medium-contact-sheet.png), [broad sequence](v2/broad-contact-sheet.png).
- [Every selected file, SHA-256, prompt and input version](v2/generation.json); exact prompts in [v2/prompts](v2/prompts).
- Originals: `public/fire-sprites/v2/{narrow,medium,broad}/01.png` through `12.png`.
- Runtime manifest: `public/fire-sprites/v2/cycles.json`.

The chosen base playback rate is 18 drawings per second (a 2/3-second cycle), an authoring choice rather than a measured Crash 4 rate. Some arrangements vary that rate or offset their phases. These are newly generated interpretations, not extracted game artwork. The supplied recordings remain local and are not published.

## Native art and runtime

`tools/fire-sprite-lab/pack-cycles.mjs` packs all original RGBA pixels unchanged, and verifies every decoded atlas cell against its input. Narrow and medium canvases are 1254 × 1254; broad canvases are 1774 × 887. Two pages per family stay below 4096 in either dimension. No trimming, resizing, alpha cleanup, mipmap replacement or distance-dependent substitutes are used. Native originals are retained alongside the packed pages.

A measured foot anchor for each drawing removes registration drift by moving its quad; it does not normalize the changing silhouette. Width/height stays at the native canvas ratio. The old shader wobble and body pulse are removed. The material uses luminous additive blending, hue shifts and slightly translucent red tips. Optional frame interpolation compensates for each frame's foot anchor and blends premultiplied colour; it is off by default.

The exhibition uses 99 camera-facing instances over eight emitters, sharing six native texture pages. Body counts are 1 torch, 3 bonfire, 2 curtain, 10 ring, 6 jet, 1 spirit flame, 5 vortex and 1 ember bed. The remaining instances are small rising sparks. Source view shows one unrotated drawing without sparks or arrangement motion.

`FlameHeatDistortion`, `writeTorchHeat` and the shared Jak distortion topology are unchanged. The existing framebuffer pass refracts the world behind the flames with foreground depth protection. One or two streams per exhibit use at most 234 pockets for the collection and 36 for one exhibit, below the existing 512-pocket limit. Pause freezes drawing playback and heat on the same clock.

## Validation and reproduction

Run the focused authoring checks with an installed `sharp` package, or set `SHARP_MODULE` to its entry point:

```sh
node tools/fire-sprite-lab/pack-cycles.mjs
node tools/fire-sprite-lab/review-cycle.mjs docs/fire-sprite-lab/v2/narrow-cycle.json /tmp/narrow-review
```

The second tool produces native lossless animated WebP previews, a contact sheet, the last/first comparison and a report of each transition. It does not invent, interpolate or align source artwork. Numeric differences locate potential problems; they do not establish artistic fidelity.

Browser evidence for this revision is in [v2/browser](v2/browser). All 36 source poses were stepped in the real full renderer, including wrap from 12 to 01. Review includes lite and full rendering, all eight arrangements, source view, hue, ¼ speed, frame blending, orbit, heat, 720p/MAX and compact layouts. The frozen heat fixture changes 940 screenshot pixels above a three-channel-value threshold; zero-strength versus disabled heat and repeated paused captures are pixel-identical. The browser console is clean. These runtime checks are distinct from the visual reference study.

The existing standalone focused harness `tools/fire-sprite-lab/browser.mjs <base-url>` has been updated for the new cycle count and controls. The current revision's interactive review used the connected browser rather than that CLI harness. Production validation uses `npm run build`, `npm run check:release` and `node tools/test-tool-directory.mjs`. Gameplay, level data, movement and existing game torches are unchanged.
