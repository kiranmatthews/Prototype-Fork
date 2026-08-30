# Fixed-resolution presentation pipeline

The **RENDER** panel controls a two-resolution presentation path. Its shipped
default is the requested **720p input → 2× CRT output → fixed 60 FPS**.

## Resolution graph

For a 16:9 viewport the default graph is:

```text
World + ocean reflection/refraction + SMAA + coast post
                          1280 × 720
                               ↓
                    gameplay 3D HUD overlays
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

## What runs at the base resolution

- the main world render;
- Unity SMAA High;
- the coast-only Unity bloom/lens-flare/grading stack;
- the ocean opaque color/depth prepass;
- ocean refraction, depth tint, caustics and intersection inputs;
- planar reflection (30% of the base, 384×216 at 720p);
- flying fruit and the small 3D HUD icons injected immediately before CRT.

DOM HUD text and developer panels remain sharp browser overlays. Two-player
split remains on the native scissored direct path until it has two independent
pre-CRT surfaces. `?lite` also keeps its existing low-cost native fallback.

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

Use the fixed **RENDER** launcher. Settings persist under
`solProtoRenderQuality.v1`:

- fixed pre-CRT resolution on/off;
- 540p / 720p / 900p base height;
- 1× / 2× / 3× CRT output;
- fixed 60 FPS on/off;
- restore shipped defaults.

Add `?renderdiag` to expose the hidden `#render-diagnostics` JSON probe. It
reports settings, computed sizes, actual drawing buffer, composer resolution,
ocean native/effective/prepass sizes, frame-limiter counts and rendered frames.
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
