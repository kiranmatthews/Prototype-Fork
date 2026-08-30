# CRT Guest WebGL2 generator

This directory contains the pinned corresponding Slang source and the
reproducible generator for the internal CRT Guest Advanced / Advanced HD web
port.

Source: `libretro/slang-shaders` commit
`a62d9cda9140294d22b6da5e4ff4187365890d42`. The selected upstream shaders are
GPL-2.0-or-later; see `public/crt-guest/provenance/` before distributing a build.

## Generate and verify

Prerequisites:

- `glslangValidator`
- `spirv-cross`
- Python 3.10 or newer

The checked-in output was generated and validated with glslang `16.5.0` and
SPIRV-Cross `1.4.357.0`. `--check` compares the complete generated text, so a
toolchain change that alters code generation is explicit rather than silent.

From the repository root:

```sh
python3 tools/crt-guest-web/generate.py
python3 tools/crt-guest-web/generate.py --check
```

The generator verifies the pinned preset and LUT hashes, extracts all 22
fragment stages, bounds upstream dynamic loops to 512 iterations, compiles each
stage to Vulkan SPIR-V, emits GLSL ES 3.00 with SPIRV-Cross, then applies the
WebGL binding adaptations and validates every final fragment again with
`glslangValidator`.

Generated files live under `src/crt-guest/generated/`. Each `.glsl` file is a
standalone, versioned shader. `shaders.ts` also exports version-stripped strings
for Three.js `RawShaderMaterial` with `glslVersion: THREE.GLSL3`.

## Deliberate WebGL adaptations

- `params` and `global` aggregates become ordinary `uParams_*` and `uGlobal_*`
  uniforms.
- The pinned HD reconstruction typo is corrected so `VSHARPNESS` and
  `SIGMA_VER` come from the parameter block.
- Out-of-range sampling returns transparent black.
- Stock, Afterglow, and non-LUT PreShader reads use manual point sampling via
  `texelFetch`; the PreShader LUTs and every later stage use `textureLod`.
- Implicit samples become explicit LOD-zero samples. Existing nonzero LOD
  expressions are retained.
- Dynamic Gaussian/reconstruction loops have the same 512-iteration bound as
  the Unity port.
- Frame-count uniforms are floats, matching the Unity material binding.
- The authored `shadowMask = -1` no-mask sentinel clamps the preparatory mask
  width lookup to index `0`; upstream otherwise reads array index `-1` before
  reaching its no-mask guard, which is undefined in WebGL GLSL.

Do not hand-edit generated GLSL or `shaders.ts`; change `generate.py` and
regenerate.
