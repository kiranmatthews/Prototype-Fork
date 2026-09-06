# Gem and crystal specular rendering

## What the historical sources establish

- At approximately 1:41 in the original **PlayStation Underground Vol. 1,
  Issue 4** making-of, Jason Rubin explicitly describes a custom specular
  renderer for Crash 2's gems and contrasts it with flat-shaded rotating
  objects. [Original interview, archived video](https://www.youtube.com/watch?v=EBgo9EkzcQ0&t=101s).
- The PS1 GPU accepts per-vertex RGB on Gouraud-shaded polygons; its GTE
  provides normal/colour matrix operations and fixed-point vector arithmetic.
  This is the cheap shading substrate, not proof of which particular specular
  equation Naughty Dog used. [GPU specification](https://psx-spx.consoledev.net/graphicsprocessingunitgpu/),
  [GTE specification](https://psx-spx.consoledev.net/geometrytransformationenginegte/).
- Gavin and Stephen White describe moving suitable work into preprocessing
  and using a lean runtime, including the extensive Crash 2 engine rewrite.
  [Their 1999 technical retrospective](https://all-things-andy-gavin.com/2011/03/28/crash-bandicoot-teaching-an-old-dog-new-bits-part-3/).

The interview does **not** disclose the highlight equation, lookup tables,
normal treatment, or blend-pass layout. The sources inspected do not establish
those implementation details separately for Crash 3. This is an independently
authored, PS1-budget-inspired approximation, **not a bit-exact reconstruction
of Naughty Dog's renderer**. No original game code, meshes or textures ship.

## Implementation

`src/collectibleSpecular.ts` replaces the painted matcaps and translucent inner
cores with one closed, opaque shell. The crystal retains its five-sided,
asymmetric silhouette; gems retain the octagonal table, crown and pavilion.
Hidden internal caps are gone. Small face-centre fans provide enough vertices
for a readable highlight gradient without adding a dense mesh.

Facet normals provide the broad body shading. A separately authored optical
normal rolls toward each corner's averaged normal inside a cut, but stays
discontinuous across cuts. Three fixed camera-space highlight directions cover
the crown, long crystal faces and gem pavilion. View-relative studio lighting
keeps small rewards readable in world, HUD and map cameras.

All specular evaluation runs **per vertex**. Eighth/thirty-second-power lobes
use repeated multiplication, with no texture lookup, transcendental `pow`,
light loop, cube map, reflection render target or per-fragment normal math.
Untinted white/cool highlights are added after body colour, so the green gem
can flash white without losing its green identity. Normal material opacity,
cloning, fog and colour management are retained. Modern depth and anti-aliasing
remain; PS1 precision artifacts are not imitated.

Only rotation/view changes move the highlights: there is no artificial glint
clock, per-frame CPU vertex update or texture upload. The existing world-only
halo sprites and collection bursts remain; HUD/map consumers still strip the
halos. Time relics, missing-reward silhouettes, progression and pickup rules
are unchanged.

## Measured cost

Isolated Chrome test, one crystal + clear gem + green gem, world halos removed
as in the HUD/map, identical renderer/camera and rotation:

| Geometry pass | Before | After |
| --- | ---: | ---: |
| Draw calls | 10 | 3 |
| Submitted triangles | 188 | 158 |
| Shell materials sampling matcaps | Yes | No |
| Translucent inner meshes | 4 total | 0 |

The crystal is 30 triangles; each gem is 64. This is a **70% reduction in draw
calls for these three assets**, not a claim of a 70% whole-game FPS gain or a
measurement of PS1 cycle cost. The browser and original console are different
execution environments.

## Validation

`tools/test-collectible-specular.mjs` checks closed/manifold geometry, outward
winding, preserved heights/scaling, bounded optical normals, shader injection,
material cloning/HUD fade isolation, and the absence of runtime specular texture
lookups. Browser reviews cover multiple rotations and the real world, map/HUD,
touch and CRT routes. The full 92-command production build passed.
