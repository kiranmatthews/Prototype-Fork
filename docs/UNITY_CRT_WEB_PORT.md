# Unity CRT Guest web port

The fork now carries a literal WebGL2 translation of the internal Unity CRT
Guest Advanced / Advanced HD presentation suite. The first implementation is a
parity baseline, not the later efficiency pass: it keeps the canonical stages,
intermediate formats, temporal feedback and saved high-cost glow settings.

## Source of truth

- Canonical repository: `libretro/slang-shaders`
- Pinned revision: `a62d9cda9140294d22b6da5e4ff4187365890d42`
- Presets: `crt-guest-advanced.slangp` and
  `crt-guest-advanced-hd.slangp`
- Unity behavior oracle:
  `CrtGuestRendererFeature.cs`, `CrtGuestRuntimeSettings.cs`, the generated
  143-control catalog, and `CRTGuestInternalStartupPreset.json`

The corresponding Slang sources, preset files, parameter manifest, notices and
GPL text are retained under `tools/crt-guest-web/upstream/` and
`public/crt-guest/provenance/`. The four LUT PNGs are byte-identical to Unity.

`tools/crt-guest-web/generate.py` performs the deterministic translation:

1. select the fragment half of each pinned Slang stage;
2. fix the two pinned HD parameter-block references also corrected by Unity;
3. compile through glslang and SPIR-V Cross to GLSL ES 3.00;
4. flatten `params` / `global` blocks into WebGL uniforms;
5. replace unsupported border samplers with explicit transparent-black reads;
6. preserve per-stage point/linear sampling (LUTs are always linear);
7. bound dynamic radius loops to 512 iterations with their original exit test;
8. validate all emitted shaders again with glslang.

Run `npm run check:crt-generated` on a machine with `glslangValidator` and
`spirv-cross` after changing the retained source or generator. Ordinary builds
use the checked-in generated GLSL and do not require those tools.

## Runtime graph

`src/crt-guest/pass.ts` is an EffectComposer pass placed after the coast-only
Unity post stage and before Three's `OutputPass`:

```text
Scene -> SMAA High -> [Unity coast post] -> CRT Guest -> OutputPass
```

CRT Guest performs 14 fullscreen draws per processed frame:

1. linear scene to Guest sRGB/RGBA8;
2. Stock twice;
3. temporal Afterglow;
4. PreShader/LUT grading;
5. Advanced Average Luminance or HD Linearize;
6. Advanced Linearize or HD Reconstruction;
7. Gaussian horizontal and vertical;
8. Bloom horizontal and vertical;
9. Main scanline/reconstruction stage;
10. Deconvergence/mask/noise/output stage;
11. Guest sRGB back to linear for Three's final display transfer.

The pass owns full-resolution RGBA8 afterglow and average-luminance ping-pong
histories. Histories clear after allocation, physical resize, enable/variant or
preset changes. Advanced generates the required pre-pass mip chain. Linear,
glow, bloom, reconstruction, main and deconvergence targets use RGBA16F.

The source and output dimensions can now be decoupled. The shipped presentation
path feeds CRT a 720p world/water frame and lets its reconstruction/main stages
produce a selectable 1×/2×/3× result. See `FIXED_720P_RENDER_PIPELINE.md`.

Kernel quality changes only intermediate dimensions:

| Quality | Kernel size |
| --- | --- |
| Exact | 800 × 600 |
| Balanced | 600 × 450 |
| Apple TV | 400 × 300 |

The default is the Unity playtest preset: **enabled, HD, Apple TV**, including
its 42 authored overrides and 29×34 magic-glow radii.

## Controls

The fixed **CRT** launcher opens a sharp Shadow DOM tuning panel. `F10` toggles
it as a convenience (`F8` and `F9` remain replay/video capture). The panel
exposes the exact 143-case-sensitive union catalog, showing only controls the
current Advanced or HD variant consumes. It supports:

- enable, variant and quality switching;
- stepped sliders and direct numeric entry;
- current/all defaults and the saved startup look;
- copy/paste plus JSON file save/load;
- version/source-checked transactional preset import;
- `solProtoCrtGuestPreset.v1` browser persistence.

The panel is presentation-only. It does not touch gameplay tuning, replay data
or deterministic simulation.

For console/browser verification, `window.__game` exposes
`crtGuestSettings`, `crtGuestPanel`, and `getCrtDiagnostics()`. Diagnostics
include support/fallback reasons, active variant/quality, target dimensions,
estimated target bytes, draw count, history state and runtime failures.
`?crtdiag` mirrors the same object into the hidden `#crt-diagnostics` probe for
automation. `crt-review.html` is a standalone animated color-bar/checker/glow
surface that exercises the real pass and tuning panel without gameplay state.

## Fallbacks and deliberate first-port limits

- `?nocrt` disables the real CRT pass.
- `?crtdiag` exposes live machine-readable pass diagnostics in the game page.
- `?lite` keeps the existing direct low-cost render path.
- `?nosmaa` isolates CRT without SMAA.
- `?nopost` disables shared Unity LOOK routing, not CRT. The retired
  coast-specific lens-flare chain remains absent; LOOK's Unity-shaped HDR
  bloom and CRT Guest's source-authored glow/bloom are separate stages.
- WebGL2, `EXT_color_buffer_float`, linear float sampling and a complete
  RGBA16F framebuffer are required. Missing support fails closed to an
  unprocessed copy/direct frame and records the reason in diagnostics.
- Two-player scissored rendering remains on the explicit direct path.
- Flying fruit, the small 3D HUD icons and the Canvas2D gameplay HUD are
  inserted after Unity grading and before CRT. Developer/tool panels, touch
  controls and capture diagnostics remain sharp DOM overlays. Lite and
  two-player direct rendering retain their explicit DOM fallback.

The old CSS scanline/vignette overlay has been removed, so it cannot double the
real mask or bias before/after comparisons.

## Verification

Run:

```sh
npm run check:crt
npm run build
```

Then smoke-test `/?lite`, `/?nocrt`, and one full-render pass. In the full pass,
open the CRT panel and verify enabled/disabled, Advanced/HD and all three
qualities; inspect `window.__game.getCrtDiagnostics()` for `active: true`,
`lastDrawCount: 14`, stable history advancement and no runtime failure.
