# Reviewed release textures

Original authoring models and provenance remain in `public/`. Only the web
production build uses these reviewed image encodings. It repacks the same GLB
URLs before calculating offline-cache hashes and records original/release hashes
in `dist/provenance/release-textures.json`. Geometry, UV coordinates, rigs,
animations, scene hierarchy, materials and collision remain unchanged.

The user authorized sharp texture downsizing and more aggressive data-map
reduction. `tools/release-texture-policy.json` records limits and exceptions:

- Drowned Crown colours: normally at most 2048 pixels, using linear-light
  Lanczos filtering and restrained local sharpening. Normal maps use linear
  vector filtering and renormalization, normally at most 512. Packed
  roughness/metalness uses linear filtering, normally at most 256. The ship and
  repeated boardwalk retain 1024 normals and 512 packed maps after close-up
  review. Transparent colour maps retain their original dimensions.
- Five Crown colour maps failed the smaller encoding's quality gate and keep
  their approved full-resolution encoding: exterior ship, coastal headland,
  oak arch, stern gallery and cavern skylight.
- Blockworks keeps existing Lanczos-4 UASTC mip levels verbatim, normally at
  colour 2048 / normal 512 / packed data 256. The rivet deck and metal wedge
  retain their full 4096 colour maps. These two and the grind rail retain
  1024 normals and 512 packed maps. Original mip payloads are not recompressed.
- Carlisle harbour (`props/carlisle*`): colour maps normally at most 1024
  (the shrimp boat keeps 2048 after a close-up review),
  normals 512, packed metallic-roughness 256. The 1024 cap was set in the
  November 2026 GPU-memory review (the deck, shrimp boat and shipyard kit were
  shipping 8192² and 2048² colour maps costing up to 341 MB each on the GPU). The
  fish market and repair shed are owned by the top-40 stage. Packed-data JPEGs
  are the one JPEG role besides base colour that this pipeline encodes; they are
  stored losslessly at the reviewed size.
- Resized colour maps use the `resizedColor` entry of the policy: WebP quality
  95 and a sanity floor of PSNR >= 30 dB, 99th-percentile error <= 32, maximum
  <= 128. The strict gate below was calibrated for unresized originals; a
  resized colour map is measured against its sharpened, resized reference, which
  is far noisier, and the 8192 -> 1024 harbour maps reach only 32–36 dB at the
  highest lossy quality. The resize itself is the authorized loss, so these are
  judged by paired captures (`carlisle-review.json`,
  `docs/PERFORMANCE_QUICK_WINS.md`). Lossless fallback remains for a map that
  misses even this floor.
- Other WebP candidates retain their original dimensions. JPEG base colours
  must have encoding PSNR >= 40 dB, 99th-percentile RGB error <= 8 and maximum
  error <= 64. These codec metrics compare against the filtered reference when
  resized. PNG/data maps are encoded losslessly relative to that reference.
  Unresized lossless maps retain exact original RGBA pixels. Metadata/precision
  incompatibilities, insufficient savings and failed quality gates keep the
  original encoding. Existing texture-decoder fallback behavior remains intact.

`manifest.json` pins every original model, source image and encoded payload by
SHA-256 and records measured results, mip selections and the reviewed policy.
`review.json` also records rejected candidates. WebP files are deduplicated by
hash outside `public/`; selected KTX mip chains are rebuilt from originals, so
no second set of KTX blobs is committed. CI needs only Node. JSON -0 bounds
serialize as 0; underlying vertex/UV/animation bytes remain exact.

Prepare a new candidate batch with the existing local Pillow/numpy runtime:

```sh
python3 tools/test_texture_resampling.py
python3 tools/prepare-release-textures.py --cache /tmp/texture-cache --out /tmp/texture-candidates --resize-drowned
node tools/prepare-release-mips.mjs --review=/tmp/texture-candidates
node tools/test-release-textures.mjs --review=/tmp/texture-candidates
node tools/test-release-textures-browser.mjs http://127.0.0.1:5198/ --review=/tmp/texture-candidates --out=/tmp/texture-review
```

The cache avoids repeated encoding; decoded pixel measurements are recomputed.
Review overview/detail captures and the worst differences before accepting the
batch. Keep original assets. Use the existing Khronos `ktx validate` command on
new mip-chain outputs. The bundled KTX-Parse writer needs its level payloads
reordered to the canonical smallest-to-largest physical order; the release
helper does this and verifies every retained mip byte and descriptor.

After acceptance, run `npm run build`, `npm run check:offline`,
`npm run check:release`, built-file integrity checks and affected game previews.
Use `--built` on the browser tool to also check actual preview responses against
the reviewed GLBs. A comma-separated `--only` selects changed models. Drowned
Crown requires lite checks followed by native 4K loading, traversal and recovery.
Evidence: `docs/drowned-crown/release-texture-check.json`.

Downsizing reduces image memory as well as hosted bytes; report measured results
rather than inferring frame-rate improvements. Desktop packaging retains its
original models. All work stays local under the temporary slow-network rule.

Offline consolidation: the symmetric rigged frog in `enemies/hopper.glb` keeps
its original embedded textures and complete geometry. The conversion entry for
the superseded frog was removed; its reviewed texture is not applied to the
new skin. Other approved conversions and their hash checks remain unchanged.
