# Fixed-resolution presentation pipeline

The **RENDER** panel controls a two-resolution presentation path. Its shipped
default is **720p input → 1× output → fixed 60 FPS**. The game's Options
presets (540P, 720P, 1080P) always set both input and output to the named
physical short edge, with pixel ratio 1 on desktop and touch devices.

## Resolution graph

For a 16:9 viewport the default graph is:

```text
World + ocean reflection/refraction + SMAA + optional LOOK bloom/grade
                          1280 × 720
                               ↓
             gameplay 3D + Canvas2D HUD overlays
                               ↓
                  CRT Guest HD reconstruction
                          1280 × 720
                               ↓
                    final display transfer
```

The short edge is fixed while the other dimension follows the live viewport
aspect. Rotating the same viewport transposes the input/output buffers and
preserves their pixel counts. Portrait 720×1280 and landscape 1280×720 have
the same density and raster cost; device pixel ratio never multiplies a preset.
The authoring panel offers 540p, 720p, 900p and 1080p inputs plus 1×, 2× and 3× output.
At 16:9 the 720p outputs are therefore:

| Scale | Input | CRT output |
| --- | --- | --- |
| 1× | 1280×720 | 1280×720 |
| 2× | 1280×720 | 2560×1440 |
| 3× | 1280×720 | 3840×2160 |

The renderer uses pixel ratio 1 in fixed mode because the chosen output is
already expressed in physical pixels. The canvas remains CSS-sized to the
viewport.

Touch and desktop use the same sizing rules. An iPhone 14 Pro-sized CSS
viewport (393×852 or 852×393), at DPR 1, 2 or 3, selects these physical buffers:

| Preset | Portrait | Landscape |
| --- | --- | --- |
| 540P | 540×1171 | 1171×540 |
| 720P | 720×1561 | 1561×720 |
| 1080P | 1080×2341 | 2341×1080 |

The Canvas element still fills the CSS viewport; the browser scales the already
rendered image to the screen. MAX retains the existing native viewport×DPR
path (DPR capped at 2). Deliberate authoring output scales and a 900p input
appear as CUSTOM in Options instead of claiming a regular preset. Changing
the authoring panel refreshes an already-open Options label immediately.
Activating CUSTOM selects the regular 540P preset.

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
balance readouts, centre messages, damage/death fades and GAME OVER.
Game-owned menus and touch ink also share the pre-CRT surface. Developer
MENU/TUNER, editor/studio tools, the CRT and RENDER panels, build stamp and
capture badges remain sharp browser overlays. Two-player split retains its
scissored direct path but its canvas still obeys the selected physical preset.
`?lite` is an explicit software smoke-test mode and keeps its half-viewport
native fallback; assess resolution presets without that query.

The same no-swap insertion pass is present in desktop native post mode, so
disabling the fixed-resolution optimization while leaving CRT enabled does not
move the gameplay HUD back above CRT. Responsive layout continues to use CSS
coordinates, independently of render density, in both orientations.

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
- 540p / 720p / 900p / 1080p physical short edge;
- 1× / 2× / 3× CRT output;
- fixed 60 FPS on/off;
- restore shipped defaults.

State version 2 uses that same storage key. Loading a V1 preference preserves
its input preset, enabled/MAX choice and 60 FPS choice, and normalizes the
formerly hidden/device-specific output multiplier to 1×. V2 preserves
explicit authoring scales. Corrupt or unavailable storage still uses defaults.

Add `?renderdiag` to expose the hidden `#render-diagnostics` JSON probe. It
reports settings, computed sizes, actual drawing buffer, composer resolution,
ocean native/effective/prepass sizes, frame-limiter counts and rendered frames.
It also reports gameplay-HUD Canvas2D time, texture uploads, GPU texture
reallocations and composite draws.
`?crtdiag` continues to expose per-target CRT diagnostics.

## Verified resource reductions

`tools/test-render-resolution-browser.mjs` uses real Options taps and same-tab
rotation, captures the renderer's actual target dimensions and GPU viewports,
and checks world/SMAA, CRT history/output and ocean prepass/reflection sizes.
It also checks persistence, CUSTOM labels, split-screen sizing and supported
spawn, movement, checkpoint, pit respawn and finish in the source geometry lab.

At a 852×393 viewport, full-render Beachfront with CRT Guest HD / Exact:

| Preset | Main buffer pixels | Estimated CRT target storage | Ocean reflection |
| --- | ---: | ---: | --- |
| 1080P | 2,528,280 | 130,032,000 bytes | 702×324 |
| 720P | 1,123,920 | 65,505,600 bytes | 468×216 |
| 540P | 632,340 | 41,666,400 bytes | 351×162 |

540P reduces main/world/SMAA/output and ocean prepass pixels by approximately
75% versus 1080P. Reflection pixels fall by 75%; CRT target storage falls by
68%. CRT's upstream blur kernels retain their separate quality setting, so
its total memory scales less than the main buffer area. Scene geometry, draw
counts and simulation remain unchanged; these figures describe raster work
and target memory, not a promised percentage increase in frame rate.

Run with `PLAYWRIGHT_MODULE`, `RESOLUTION_BROWSER=webkit`, `RESOLUTION_DPRS=3`
and `RESOLUTION_OUTPUT` to select the local runtime, engine, DPR matrix and
report directory. Browser emulation is evidence for pixel sizing and resource
use; it does not measure the physical iPhone's GPU timing or battery drain.

## Historical measurements

Before the short-edge/1× default change, at a 1280×720 viewport with CRT Guest
HD / Apple TV:

| Mode | CRT-owned targets |
| --- | ---: |
| Native 2560×1440 | ~252 MB |
| 720p → 1× | ~68 MB |
| 720p → 2× | ~119 MB |
| 720p → 3× | ~200 MB |

These figures exclude the scene composer and ocean targets, whose largest
screen-space passes also fall from 2560×1440 to 1280×720 in fixed mode.
