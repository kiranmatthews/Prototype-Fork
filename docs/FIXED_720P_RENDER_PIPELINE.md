# Fixed-resolution presentation pipeline

The **RENDER** panel controls a two-resolution presentation path. Its shipped
default is the requested **720p input → 2× CRT output → fixed 60 FPS**.

## Resolution graph

For a 16:9 viewport the default graph is:

```text
World + ocean reflection/refraction + SMAA + optional LOOK bloom/grade
                          1280 × 720
                               ↓
             gameplay 3D + Canvas2D HUD overlays
                               ↓
                  CRT Guest HD reconstruction
                          2560 × 1440
                               ↓
                    final display transfer
```

The base height is fixed while its width follows the live viewport aspect, so
portrait and ultrawide layouts keep their authored camera composition. The
panel offers 540p, 720p and 900p base heights plus 1×, 2× and 3× CRT output.
At 16:9 the 720p outputs are therefore:

| Scale | Input | CRT output |
| --- | --- | --- |
| 1× | 1280×720 | 1280×720 |
| 2× | 1280×720 | 2560×1440 |
| 3× | 1280×720 | 3840×2160 |

The renderer uses pixel ratio 1 in fixed mode because the chosen output is
already expressed in physical pixels. The canvas remains CSS-sized to the
viewport.

Coarse-pointer/touch presentation deliberately bypasses fixed mode. A short
landscape phone therefore uses its native-aspect DPR renderer instead of
allocating a roughly 3K-wide 720p×2 target for an ~850px viewport. The saved
desktop preference is retained and becomes active again on a fine-pointer
layout.

## What runs at the base resolution

- the main world render;
- Unity SMAA High;
- active LOOK bloom, colored vignette, tone mapping, 32³ grading LUT and
  dither;
- the ocean opaque color/depth prepass;
- ocean refraction, depth tint, caustics and intersection inputs;
- planar reflection (30% of the base, 384×216 at 720p);
- flying fruit, the small 3D HUD icons and the complete gameplay HUD injected
  immediately before CRT.

The gameplay HUD surface includes counters, score/clock, results, combo and
balance readouts, centre messages, damage/death fades and GAME OVER. MENU,
TUNER, editor/studio tools, touch controls, the CRT and RENDER panels, build
stamp and capture badges remain sharp browser overlays. Two-player split
remains on the native scissored direct path until it has two independent
pre-CRT surfaces. `?lite` also keeps its existing low-cost native fallback.

The same no-swap insertion pass is present in desktop native post mode, so
disabling the fixed-resolution optimization while leaving CRT enabled does not
move the gameplay HUD back above CRT. Touch keeps its established responsive
DOM HUD above the world/CRT instead; this prevents desktop 720p typography and
CRT corner distortion from replacing the phone layout.

When a desktop canvas changes dimensions, `GameHudSurface` disposes the old
WebGL CanvasTexture allocation before uploading the resized canvas. WebGL2
texture storage is immutable; without that reallocation a portrait HUD bitmap
survived rotation and stretched across the landscape viewport.

## CRT reconstruction

CRT Guest now tracks source and output dimensions independently:

- encoded/stock/pre/linear/history targets use the base size;
- glow/bloom keep their authored quality kernels;
- HD reconstruction is `outputWidth × inputHeight`;
- main and deconvergence run at final CRT output size;
- `OutputPass` remains the sole display transfer.

Changing only output scale does not invalidate source-resolution temporal
history. Changing the base resolution or switching native/fixed mode does.

## Fixed 60 FPS

The simulation is unchanged: it still advances in deterministic 1/60-second
steps. `PresentationFrameLimiter` gates `requestAnimationFrame` presentation
work to 60 Hz, accumulating wall time across skipped callbacks. Synthetic tests
cover 60, 120, 144 and 240 Hz sources. Disabling the control restores one render
per browser animation callback.

## Controls and diagnostics

Use the fixed **RENDER** launcher on desktop. On touch it lives under the
right-side **TUNER → PRESENTATION TOOLS** palette with the other developer
panels, leaving the face-button region clear. Settings persist under
`solProtoRenderQuality.v1`:

- fixed pre-CRT resolution on/off;
- 540p / 720p / 900p base height;
- 1× / 2× / 3× CRT output;
- fixed 60 FPS on/off;
- restore shipped defaults.

Add `?renderdiag` to expose the hidden `#render-diagnostics` JSON probe. It
reports settings, computed sizes, actual drawing buffer, composer resolution,
ocean native/effective/prepass sizes, frame-limiter counts and rendered frames.
It also reports gameplay-HUD Canvas2D time, texture uploads, GPU texture
reallocations and composite draws.
`?crtdiag` continues to expose per-target CRT diagnostics.

## Baseline measurements

At a 1280×720 viewport with CRT Guest HD / Apple TV:

| Mode | CRT-owned targets |
| --- | ---: |
| Native 2560×1440 | ~252 MB |
| 720p → 1× | ~68 MB |
| 720p → 2× | ~119 MB |
| 720p → 3× | ~200 MB |

These figures exclude the scene composer and ocean targets, whose largest
screen-space passes also fall from 2560×1440 to 1280×720 in fixed mode.
