# Unity spin effects and orbital-ring lab web port

The browser now uses Unity's current production spin sculpture and orbital
rings in normal play, plus a separate ground-hugging ring treatment for spins
started while skating on the ground. The complete look-dev lab is available at
`spin-lab.html` and through the in-game **SPIN** tab. This is a presentation
port: Square/F timing, hit reach, cooldown, audio, collision, scoring, air
correction, and slide-cancel behavior remain owned by the existing web
simulation.

## Port authority

Unity commit `3da0720580085f802880a5771b011921edf6e193` is the accepted source:

- `SpinSmearPresenter.cs`
- `SpinOrbitalRingSettings.cs`
- `SpinOrbitalRings.cs`
- `SpinPresentationRules.cs`
- `FoxCharacterPresenter.cs`
- `SpinRingTuningLab.cs`
- `SpinRingTuning.unity` and its deterministic scene builder
- the saved version-1 `spin-orbital-ring-tuning.json`

Those files and the saved tuning agree on the current six-ring, 22-segment
look. Several older Unity tests still assert the superseded 48-segment and
fading-handoff implementation and are not parity authority.

## Production sculpture

The retired `SourceSpinSmearGlb.bytes`/`public/models/smear.glb` is no longer
loaded. Production uses the static `WhirlwindVixen020205` Meshy sculpture:

- one UV-mapped mesh, 91,530 triangles / 274,590 indices
- web Y-up bounds approximately `1.505909 × 1.903363 × 1.115345 m`
- opaque, backface-culled, unlit base-color presentation
- no skeleton, animation, colliders, physics, shadows, normal map, or metallic map
- neutral scale `(1.15, 1.5, 1.15)`, bottom-aligned to the rider

Every authoritative 60 Hz step rotates the sculpture by
`(30 × 2.399) / 60` radians. Squash/stretch is
`sin(step × stepRadians × 2) × .09`, applied as opposing horizontal/vertical
scale around the neutral fit.

The model fails soft: until its asynchronous asset is ready, the normal rider
remains visible and the procedural rings can still render.

## Orbital rings

The ring treatment is evaluated directly from Unity's CPU equations. It is
one dynamic textureless mesh with:

- six rings × five Gouraud rows × 22 segments = 660 vertices
- 3,168 indices / 1,056 triangles
- per-vertex linear HDR color and alpha
- double-sided `SrcAlpha + One` additive blending
- depth test on, depth write off, fog-aware gameplay material, no shadows

The five rows are transparent edge, glow, line, glow, transparent edge. The
port preserves the uint32 ring hash, JavaScript-style rounding, seeded tilted
planes, lane/depth transform, shared/wave/jag contour, independent self-spin,
current, pulse, radial travel, and per-ring palette interpolation.

The character sculpture disappears immediately when the attack ends. Its
rings remain full-size/full-alpha for exactly 15 fixed ticks using Unity's
post-spin current/pulse values, then hide without a shrink or fade.

Grounded skate spins use a second, independently tuned textureless mesh:

- three rings × five rows × 28 segments = 420 vertices / 672 triangles;
- cool cyan/violet/pink palette, low tilt and a 2.1 m board/lower-leg footprint;
- separate geometry, pulse, distortion, per-ring overrides and browser storage;
- active only for the grounded attack itself, with no post-spin linger.

## Presentation routing

One route is latched at attack start:

- on-foot and rope spins use the sculpture plus character-height rings;
- a spin begun while `ride + grounded + freeSkate` uses the native rider/deck
  rotation plus the dedicated low rings. Holding X to pump/charge does not
  suppress it;
- board air, grabs, grinds and wallrides retain native rider/deck motion without
  a halo;
- death, bail, respawn, or a rewound presentation clock clears the effect.

If the board appears during a character spin or its 15-tick handoff, that
sequence permanently promotes to the effect-free board route. Dismounting
again cannot flash the halo back on; the next independent on-foot attack may
start a fresh character route normally. Likewise, a grounded-skate route that
leaves the ground permanently becomes effect-free for that attack, and a spin
started in board air cannot flash grounded rings when it lands.

## Lab and tuning

The standalone lab keeps the 36 m checker arena, 57° camera, Day background and
fog-free look-dev stage. It presents persistent and looping instances for both
character and grounded-skate rings, plus a board-air specimen that remains
explicitly halo-free.

Two tabs at the top of the right panel—**CHARACTER SPIN** and **GROUND SKATE**—
select independent settings stores. Each tab exposes every ring control:
per-ring height/radius and four
palette slots with HSV/hex editing; geometry, stroke, motion/distortion,
radial travel, current/pulse, palette cycle, and self-spin. It supports reset,
copy, profile-specific JSON download/import, and live autosave. The original
character key remains `solProtoSpinOrbitalRingTuning.v1`; the new ground profile
uses `solProtoGroundedSkateSpinOrbitalRingTuning.v1`. Both shared instances
update the lab, P1, and P2 without clobbering each other.

Unity's adjacent Punky skeletal recovery clip is not a ring/smear lab asset and
has no compatible target on the browser's procedural rigid-part rider; it
remains character-animation-pipeline work rather than being approximated here.

## Web assets and provenance

| Asset | SHA-256 |
| --- | --- |
| `whirlwind-vixen.glb` | `9ce1697301045b5e307a30a2624116f2372a007afe4b81196fac2aafd9f2bf26` |
| `whirlwind-vixen.webp` | `892d93031e384699b315ef759fa18d7c5f5d9b65c66e302baff0f0dc9f1ae17f` |

The 1.8 MB GLB is geometry/UV/indices only. The 2048 px WebP mirrors Unity's
WebGL texture cap. The normal and metallic/smoothness maps are intentionally
not published or loaded.

The source FBX/base atlas are byte-identical to the project's recorded Meshy
download, but that archive contains no standalone license file. They are
already promoted project-owned source; preserve this provenance and re-audit
rights before reusing the derivatives outside this game.

Reproducible converters live in `tools/spin-effects/`.

## Verification

```sh
npm run check:spin-effects
npm run build
```

The spin check executes both TypeScript settings stores and ring evaluators,
gates their independent topology, hash-derived planes, HDR color output,
production asset hashes and GLB bounds/counts, grounded/air route latching,
panel tabs, preload, and lab instances.
