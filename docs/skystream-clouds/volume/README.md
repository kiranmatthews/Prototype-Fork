# Full volumetric Skystream — 29 October 2026 NZDT

The main course now uses density-rendered cumulus throughout, following the
bonus platform renderer's merged billows, small curls, noise erosion, extinction
and soft scattering. The earlier opaque mesh plus wisps remains an explicit
comparison fixture. It is not a distance fallback. Every gameplay and reflection
view uses the same full density field. Smooth contact, the route and three loop
orientations, skybox, lower blue gradient and sun effects are unchanged.

![Full density along the road](road.png)
![The horizontal loop's vertical cloud wall](wall-loop.png)

## Implementation

`src/cloudRoadVolume.ts` bends a deterministic 128 × 64 × 192 R8 field along
6,784 authored frames. Its longitudinal period is 23 m. Quaternion interpolation
keeps the density's cross-section continuous through rolls and the wedding band.
The thin central crown stays close to the independent riding surface; taller
billows sit at the shoulders. None of the 188 proxy boxes enters contact queries.

Camera rays integrate the full density on a fixed 0.2 m grid, terminating at
99.5% opacity. Pixel jitter is static; there is no temporal accumulation. Neighboring
chunks evaluate the same samples, and the first visible density assigns the
integral to one chunk. Extending the sampling domain across that boundary removes
the straight seams caused by cutting a translucent integral into separate pieces.
The proxy geometry is only a culling/ray domain, never a visible box surface.

Two optimizations retain that appearance:

- Bake eight-step sunlight transmission into fixed-resolution RG8 atlases along
  every road frame. The two channels hold direct and broad transmission. Manual
  slice interpolation matches a trilinear volume. Atlas dimensions stay within
  2,048 pixels; the original long 3D light texture would exceed WebGL2's minimum
  guaranteed depth. The density remains at its full resolution.
- A shared empty-space distance field skips confirmed empty intervals on the
  same ray grid. It uses a conservative L1 distance bound, subtracts a filtering
  margin and accounts for coordinate stretch. Occupied samples retain their
  original spacing. No camera-distance quality change is involved.

The GPU data contains 1,572,864 density bytes, 1,572,864 empty-distance bytes,
29,265,920 baked-light bytes and 217,088 frame bytes: **31.12 MiB** before proxy
geometry and driver overhead. All materials lease the shared fields. Disposing
the level releases both shared textures and all 50 frame/light textures exactly
once. No new assets, packages or per-frame cloud allocations are required.
Three.js's existing MIT SimplexNoise addon supplies the procedural noise.

The sunlight bake follows the authored fixed sun and approximates each short
light ray in its local road frame. It is not a full multiple-scattering solver.
The periodic density, finite integration spacing and baked illumination are
fixed authoring choices, not distance-based substitutions.

## Performance and checks

[Final controlled Chrome measurements](gpu-comparison.json), isolated cloud pass:

| View | Resolution | Full volume, no empty skips | Full volume, skips |
| --- | --- | ---: | ---: |
| Road | 1152 × 720 | 42.06 ms | 19.78 ms |
| Road | 1600 × 1000 | 79.66 ms | 37.92 ms |
| Upright loop | 1152 × 720 | 26.34 ms | 13.99 ms |
| Upright loop | 1600 × 1000 | 50.46 ms | 25.98 ms |
| Wall loop | 1152 × 720 | 31.95 ms | 18.40 ms |
| Wall loop | 1600 × 1000 | 60.39 ms | 35.83 ms |

These are local GPU medians, not whole-game frame rates or portable performance
promises. Each GPU query is drained separately; the game's normal animation
loop is frozen during the comparison. Eight samples per variant use alternating
ABCCBA order. An earlier undrained batch included GPU queue pressure and is not
used. The older mesh/wisp fixture measures about 0.4–0.8 ms with this method;
the full-volume renderer deliberately spends substantially more GPU time.

The [first raw prototype](first-pass.json) used different integration bounds and
had seams, so its timings are historical rather than a strict optimization A/B.
Baked lighting and compact quaternion frames were introduced before the final
seam-free comparison above.

At 800 × 500, empty skipping changes zero bytes in the road view, seven in the
upright view and 27 in the wall view, each by at most one byte value out of 255.
A fixed camera produces identical pixels on successive frames. MAX/native and
normal CRT presentations were visually reviewed. No shader or console errors
occurred. The regular presentation still benefits substantially from 720p.

Focused checks:

```sh
node tools/test-cloud-road-volume.mjs
node tools/test-cloud-road-lighting.mjs
node tools/test-skystream-clouds.mjs
node tools/test-skystream.mjs
node tools/skystream-cloud-volume-browser.mjs http://127.0.0.1:5187/
npm run build
npm run check:release
```

The volume checks cover crown coverage/clearance, periodic boundaries, finite
orthonormal loop frames, deterministic reloads, occupied-voxel skip protection,
portable atlas size and resource disposal. The actual native course completes
all 67 boxes, seven checkpoints, four gaps and three loops with no deaths or
bails; deliberate fall recovery returns to the earned checkpoint. No level
source or movement tuning changed, so the full level pack audit was not rerun.

The packaged full-render Chrome route also passes all 67 boxes, seven checkpoints,
four gaps and three loops without deaths, bails, console errors or failed requests.
See [production route evidence](production-route.json). The 20:08 UTC build fits
the release budget at 997,089,046 bytes; later documentation-only packaging does
not change the validated runtime sources.
