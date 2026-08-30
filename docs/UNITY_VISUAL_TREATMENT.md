# Unity visual treatment web port

The **LOOK** tab is the browser's one shared visual-treatment stack. It
replaces the former single-neighbourhood glow and midpoint RGB grade with a
Unity-shaped HDR bloom pyramid, colored vignette, selectable tone mapping and
a change-driven 32³ color-grading LUT. The controls are global presentation
settings; they do not affect gameplay, collision, replay determinism or level
data.

Per-level values are intentionally not persisted yet. The Default, Coast,
Bonus and Meshy buttons are literal source-reference presets that can be
selected while reviewing any level. A later per-level layer can point at the
same settings schema and render passes instead of creating another
post-processing system.

## Source authority

The reference project uses Unity 6 with URP 17.5.0, linear working color,
RGBA16F-capable HDR camera buffers and a 32³ LDR grading LUT. The audited source
is:

- `Assets/Settings/PC_RPAsset.asset`
- `Assets/Settings/Mobile_RPAsset.asset`
- `Assets/Settings/SampleSceneProfile.asset`
- `Assets/Game/Data/SourceLevelPorts/BeachfrontRun_Showcase1Post.asset`
- `Assets/Game/Data/SourceLevelPorts/BonusLevel_Atmosphere.asset`
- `Assets/Game/LookDev/Generated/MeshyLookDev_Volume.asset`
- `Assets/Game/Editor/SourceLevelPortSceneBuilder.BonusLevel.cs`
- `Assets/Game/Editor/MeshyLookDevSceneBuilder.cs`
- URP 17.5.0 `BloomPostProcessPass.cs`, `Bloom.shader`,
  `ColorGradingLutPass.cs`, `LutBuilderLdr.shader` and Core `Color.hlsl`

The browser implementation is split by responsibility:

- `src/unityBloom.ts` owns thresholding, the HDR mip pyramid and additive
  composite;
- `src/unityColorLut.ts` builds the 1024×32 RGBA8 representation of the 32³
  internal LUT;
- `src/unityPost.ts` owns vignette, exposure, tone mapping, LUT lookup and
  dithering;
- `src/visual-treatment/settings.ts` owns clamped versioned settings and the
  source presets;
- `src/visual-treatment/panel.ts` owns the one grouped **LOOK** interface;
- `src/coastpost.ts` fixes their order relative to SMAA, the gameplay HUD, CRT
  Guest and the final display transfer.

## Source profiles

Both Unity quality tiers inherit the same Neutral tone mapper, default bloom
and vignette. PC renders at scale 1.0; Mobile uses scale 0.8. The local Coast
profile is shared by Beachfront Run, Coastal Street Run and Island Hopper.

| Unity profile | Bloom intensity | Threshold (gamma) | Scatter | Grade overrides | Vignette |
| --- | ---: | ---: | ---: | --- | --- |
| Quality default | 0.25 | 1.00 | 0.50 | Neutral tone map | Black, intensity 0.20, smoothness 0.20 |
| Coast | 0.30 | 1.00 | 0.70 | Neutral defaults | Inherits the quality-default vignette |
| Bonus | 0.68 | 0.78 | 0.78 | -0.18 EV, +5% contrast, -4% saturation, filter `(0.72, 0.88, 1.00)` | `(0.199, 0.124, 0.699)`, intensity 0.46, smoothness 0.78 |
| Meshy | 0.16 | 1.05 | 0.55 | -0.22 EV, +22% contrast, +18% saturation | Black, intensity 0.22, smoothness 0.72 |

All four source rows use white bloom tint, clamp 65472, half-resolution start,
six iterations and HQ filtering. Their white balance,
lift/gamma/gain, split tone and channel mixer remain identity. No source level
uses non-identity color curves or shadows/midtones/highlights.

The Bonus source also modulates the authored 0.68 bloom intensity with a slow
0.22 Hz presentation pulse. The browser's global preset deliberately stores
the stable authored value: the Bonus backdrop already retains its independent
window/emission pulse, while level-specific post modulation belongs with the
future per-level settings layer.

## Render order

The active browser order is:

```text
linear HDR world
  → Unity SMAA High
  → UnityBloomPass
      HQ prefilter → Gaussian down pyramid → scatter up pyramid → additive bloom
  → UnityPostPass
      colored vignette → exposure → tone map → 32³ LDR LUT → 8-bit dither
  → Canvas2D gameplay HUD
  → optional CRT Guest
  → OutputPass display transfer
```

Bloom therefore sees the unclamped HDR scene. Vignette and grading affect the
combined scene and glow. `OutputPass` remains the sole linear-to-display
transfer, and the gameplay HUD stays after LOOK but before CRT.

## Bloom parity

The bloom prefilter preserves the important URP behavior:

1. Convert the user threshold from gamma to linear.
2. Start at half or quarter resolution.
3. Run Unity's HQ 13-sample prefilter.
4. Measure brightness with `max(r, g, b)`, not luminance.
5. Use the hardcoded knee `threshold × 0.5` and Unity's quadratic soft
   threshold.
6. Clamp only the bloom source, then keep the pyramid in RGBA16F.
7. Downsample with the optimized bilinear equivalent of Unity's symmetric
   nine-weight Gaussian kernel.
8. Recombine levels with `0.05 + 0.90 × scatter`; HQ mode uses Core's cubic
   B-spline reconstruction collapsed into four hardware-bilinear samples,
   rather than a sixteen-fetch Catmull-Rom filter.
9. Luminance-normalize the tint, multiply by intensity and add the result to
   the original HDR source.

At six mips the pass issues 17 fullscreen draws: one prefilter, ten separable
downsample draws, five upsample draws and one composite. Work falls rapidly at
each level, and there is no depth, stencil or MSAA storage in the bloom
targets.

### Browser performance bounds

- Bloom is completely skipped when disabled or intensity is effectively zero.
- Targets allocate lazily on first use, resize only when required and dispose
  with the composer.
- The first bloom level is capped to a 960-pixel longest edge before building
  lower mips. This is the deliberate browser guard against Retina/fixed-output
  fill-rate spikes; Unity itself starts from an uncapped half-resolution
  buffer.
- Source presets use six mips, while the advanced control permits two through
  eight. The runtime hard cap is eight.
- Half and quarter starts are selectable. All source presets use half.
- The HQ toggle controls bicubic upsample/composite filtering. The stable
  13-sample prefilter remains enabled for both custom quality choices.
- `?lite` and two-player scissored rendering retain the explicit direct path.

The Coast source profile also contains bloom-derived screen-space ghosts and
streaks. Those are not part of this shared bloom pass: the former coast-only
lens-flare target chain remains retired, and CRT Guest retains its own separate
source-authored glow stages.

## Color grading

The LUT is a 1024×32 RGBA8 strip encoding a 32³ cube, matching the Unity LDR
layout. A setting change marks it dirty; the next active render rebuilds it
with one tiny GPU draw. Static frames only perform the normal two bilinear
strip samples needed to interpolate adjacent blue slices.

The implemented LUT order is:

1. CAT02 LMS white balance from temperature and tint.
2. Alexa LogC contrast around `ACEScc_MIDGRAY = 0.4135884`.
3. RGB color-filter multiplication.
4. Adobe-style gamma-2.2 split toning with SoftLight.
5. A 3×3 percentage channel mixer.
6. Shader-space lift, gamma and gain.
7. HSV hue shift and global saturation.
8. Clamp into the LDR LUT output range.

Lift, gamma and gain are exposed as the prepared shader-space values used by
the final LUT operation:

```text
graded = graded × gain + lift
graded = sign(graded) × abs(graded)^gamma
```

They are not Unity's inspector trackball encoding. Identity is lift 0, gamma 1
and gain 1. Master/RGB curves, secondary hue/saturation curves and
shadows/midtones/highlights are deliberately omitted because every audited
source profile leaves them neutral.

Post exposure remains outside the LUT as `2^EV`, as it does in URP's LDR path.
The **None** tone-map choice still saturates before LUT lookup. **Neutral** is
the source-used Hable/Hejl/Frostbite curve with Unity's constants and white
level 5.3. The optional **ACES** choice is a compact fitted display curve for
live exploration, not Unity's full ACES/AP0/AP1 grading workflow; no source
preset selects it.

## Vignette and dither

The vignette follows the URP equation rather than a black radial smoothstep.
It supports source color, center, intensity, smoothness and optional rounded
aspect correction. Unity scales intensity by 3 and smoothness by 5 before the
radial power curve; the browser does the same.

Unity uploads vignette color directly, so the Bonus purple triplet is retained
as authored. Color-filter and bloom-tint settings instead retain recognizable
Unity/HTML-picker sRGB triplets in storage, convert them to linear at upload,
and, for bloom, luminance-normalize the converted tint. The three controls are
therefore intentionally not interchangeable.

The final pass retains the deterministic generated 16×16 blue-noise rank
texture. It applies Unity's triangular noise distribution at one 8-bit code
value in perceptual sRGB, converts back to linear, and leaves the final display
transfer to `OutputPass`.

## Controls and persistence

The **LOOK** panel groups:

- tone mapper, exposure, contrast, saturation, hue, white balance and filter;
- direct lift/gamma/gain;
- split shadow/highlight colors, balance and the 3×3 channel mixer;
- bloom intensity, gamma threshold, scatter, clamp, tint, HQ filtering,
  starting resolution and maximum iterations;
- vignette color, center, intensity, smoothness and rounded mode.

Settings persist under `solProtoVisualTreatment.v2`. Version-1 settings migrate
once: exposure and grade multipliers become the new percent/EV fields, while
the retired pixel-radius bloom control maps to normalized scatter. Invalid or
out-of-range stored values are clamped before use. Resetting to neutral disables
all non-neutral activity, so an ordinary native one-player level can remain on
the direct presentation path.

## Diagnostics and verification

In a running game, inspect:

```js
window.__game.getLookDiagnostics()
```

The bloom object reports `active`, `mipCount`, every target size, draw count
and estimated bytes for the two RGBA16F pyramids. The LUT object reports
`dirty`, `rebuildCount`, `width` and `height`. For a six-mip source preset,
`drawCount` should be 17; changing only grading should increment
`rebuildCount` once, then leave it stable across subsequent frames.

Useful isolation queries are:

- `?lookdiag` — expose the live LOOK diagnostic object in a hidden
  `#look-diagnostics` probe for browser harnesses;
- `?nosmaa` — skip Unity SMAA;
- `?rawoutput` — skip the final vignette/grade/dither draw while leaving the
  separate bloom stage available for inspection;
- `?nolut` — bypass the internal grading LUT;
- `?nodither` — bypass only the final dither;
- `?lite` — use the low-cost direct renderer.

Run the focused and aggregate gates before publishing:

```sh
npm run check:look
npm run check:ocean
npm run build
```

Then smoke-test neutral/off plus all four Unity presets in a real browser.
Confirm that bloom diagnostics stay bounded at the current DPR, LUT rebuilds
stop when controls stop moving, the Bonus vignette is purple rather than
black, Meshy thorns bloom without washing the stone bridge, and the console
contains no framebuffer or shader errors.
