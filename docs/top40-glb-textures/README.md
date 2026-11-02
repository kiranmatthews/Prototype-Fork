# Top-40 GLB texture reduction and pig removal

The selection is pinned to the first 40 files in the size catalogue for
`aa5fe946a09f483f72e4605617e822d7e05b4dec`. Those entries contained 32 GLBs;
removing Pig Matron and Pig Guard leaves 30 models and 104 embedded images.
The exact paths, ranks and previous release sizes are in
[`tools/top40-glb-textures.json`](../../tools/top40-glb-textures.json).

Colour and emissive images now have a maximum dimension of 1024 pixels;
normals and other maps have a maximum dimension of 256 pixels. Colour resizing
uses bicubic filtering in linear light with premultiplied alpha and a restrained
sharpening pass. Normals are filtered as vectors and renormalized; data maps
stay linear. Nothing is upscaled. Both GPU textures and portable fallbacks
receive the same limits, including complete GPU mip chains.

The resized PNG intermediates ran through the installed ImageOptim blocking
CLI with lossy palette conversion temporarily disabled. Decoded pixels were
verified identical afterward, and the previous ImageOptim preference was
restored. The PNG batch decreased from 84,228,971 to 79,301,520 bytes before
lossless WebP / UASTC KTX2 encoding. KTX2 colour metadata now correctly uses
sRGB/BT.709 for colour and linear/unspecified primaries for data maps.

Original surviving authoring GLBs remain in `public/`. The build applies the
reviewed, hash-checked image payloads from `release-textures/top40/`, then runs
the existing shared-texture and lossless geometry packaging. CI needs neither
ImageOptim nor a new image encoder. Non-image buffer bytes, meshes, materials,
UVs, transforms, collisions, skinning and animations are preserved. This
explicit texture-resolution reduction does not add geometry simplification.

Pig Matron and Pig Guard, their exclusive weapon, audio and runtime behavior
are removed. All seven Rooftop Relay placements are removed from source and
the published pack. Catering crates remain. Legacy editor imports retain
their levels while discarding those retired actors. Other published level
entries are unchanged.

## Measured release size

| Measure | Decimal MB |
| --- | ---: |
| Previous build | 999.17 |
| New build | 803.49 |
| Saved | 195.68 |
| Free below the 1,000 MB gate | 196.51 |

The 30 selected models account for 167.04 MB of the saving; the retired
models, sounds and runtime account for the remainder. Exact bytes and each
model's before/after size are in [`sizes.json`](sizes.json). The new package
contains 1,844 files. All 770 standalone image assets and the image payloads
inside 388 unselected models are unchanged.

## Validation

- TypeScript, focused resampling and top-40 GLB invariants pass, including
  unchanged geometry bytes, compressed-source offsets, virtual decoded
  offsets, image limits, full mip chains and repeatable image replacement.
- Existing release-texture checks, retired-pig migration / standard enemy
  checks, ordinary enemy gameplay checks and `npm run check:levels` pass.
- Refresh Rooftop Relay's exact stock certificate after removing its seven
  actors. The first public build retained a redundant 9.6 MB snapshot on Linux
  because its certificate still described the old actors. The existing
  `check:level-sync` regression reproduces this stale-certificate failure;
  recertification preserves the exact source snapshot and restores portable
  compaction, including the bounded runtime-roundoff tests.
- `npm run build` and `npm run check:release` pass. Local build:
  `Codex/sol fork · build 11-02 00:43 UTC`; offline version
  `a4f1a6041418d61f3eb4`.
- Chrome renders all 30 models in 48 GPU/portable cases at native 1280×960.
  Geometry and material mappings match source; texture limits, rendering and
  the console are clean. See [`browser-report.json`](browser-report.json).
- Chrome checks Rooftop Relay in lite/full rendering, and Rooftop Relay,
  Treehouse Trail and Drowned Crown at MAX/native 1440×900 and normal CRT
  presentation. Supported spawns, checkpoint, fall respawn and finish pass;
  no retired assets are requested. See [`game-report.json`](game-report.json).

Focused tools: `test-top40-resampling.py`, `test-top40-glb-textures.mjs`,
`test-top40-release-scope.mjs`, `test-top40-textures-browser.mjs` and
`test-top40-game-browser.mjs` under `tools/`. Browser tools accept the base URL
and evidence directory; `PLAYWRIGHT_MODULE` may select an installed Playwright.
The scope check compares with a pre-change release payload manifest supplied
as its first argument. `prepare-top40-glb-textures.py --help` describes the
optional authoring-only image regeneration workflow. No full suite was run.

Full logs, baseline hashes and native/normal screenshots are retained in the
ignored shared release evidence directory
`.release-queue/evidence/01a195ed-5cfe-7ea2-a6a0-20d780fd99cd-top40-textures/`.
Publication and public browser evidence are recorded in the owning release
handoff after deployment.
