# Unity spin effects and orbital-ring lab web port

The browser now uses Unity's current production spin sculpture and orbital
rings in normal play. The complete look-dev lab is available at
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

## Presentation routing

One route is latched at attack start:

- on-foot and rope spins use the sculpture plus character-height rings;
- any spin with a visibly attached board—ride, air, grab, grind, or
  wallride—retains the native rider/deck motion without a spin halo or
  orbital-ring treatment;
- death, bail, respawn, or a rewound presentation clock clears the effect.

If the board appears during a character spin or its 15-tick handoff, that
sequence permanently promotes to the effect-free board route. Dismounting
again cannot flash the halo back on; the next independent on-foot attack may
start a fresh character route normally.

## Lab and tuning

The standalone lab reproduces Unity's 36 m checker arena, exact persistent
preview location/bounds, 57° camera, Day background, and fog-free look-dev
stage. It also includes a looping production sculpture so the 0.30 s web
attack and 15-tick ring handoff can be judged without gameplay input.

The right panel exposes every Unity control: per-ring height/radius and four
palette slots with HSV/hex editing; geometry, stroke, motion/distortion,
radial travel, current/pulse, palette cycle, and self-spin. It supports reset,
copy, JSON download/import, and live autosave under the fork-isolated key
`solProtoSpinOrbitalRingTuning.v1`. The same settings instance updates the lab,
P1, and P2.

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

The spin check executes the TypeScript settings and ring evaluator, gates the
exact topology, hash-derived planes, HDR color output, production asset hashes
and GLB bounds/counts, player routing, panel, preload, and lab entry.
