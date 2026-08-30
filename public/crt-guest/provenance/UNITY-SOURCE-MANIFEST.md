# CRT Guest Advanced / HD internal Unity port

This directory is **internal-demo-only**. The project owner states that explicit
permission has been granted to build and demonstrate this port internally.
Commercial release terms are still to be determined. Do not publish or ship a
non-development build without written release-license clearance covering the
shader authors' contributions and the four LUT binaries.

## Canonical source

- Repository: <https://github.com/libretro/slang-shaders>
- Revision: `a62d9cda9140294d22b6da5e4ff4187365890d42`
- Presets: `crt/crt-guest-advanced.slangp` and
  `crt/crt-guest-advanced-hd.slangp`
- Unity translation generator: `Tools/CRTGuestPort/generate_crt_guest_unity.py`
- Translation: GLSL/Slang fragment stages -> Vulkan SPIR-V with glslang ->
  Shader Model 5 HLSL with SPIRV-Cross -> deterministic Unity binding rewrite.
- Runtime dependencies: none. The generated shaders compile ahead of time.

The exact selected upstream shader files are retained in `UpstreamSource/`.
`ParameterManifest.json` captures all 143 case-sensitive union controls, their
canonical ranges/defaults, variant membership, and consumer locations.

## Preset checksums

- `crt-guest-advanced.slangp`:
  `eb597473e15639e9dec4f11a18d4a789f5f901e9368816d4e5114b09b51c2d19`
- `crt-guest-advanced-hd.slangp`:
  `1cf2a61bce42a6fd6679f3bbf50b0a94194dcf7e498b6b3abdf9572aefcc7e40`

## LUT checksums

- `trinitron-lut.png`:
  `bcc8c237eb39ed2a632554959cb4c5e0dd52b59a4922745b46b7525fc6b6b61a`
- `inv-trinitron-lut.png`:
  `2acb6633e4dede7f36e3e62b7aa9d0ed76ecfbc5cb7ed7f3f8813dddec0e9145`
- `nec-lut.png`:
  `86ec3d2e21138845cb73500e915425582b991e173a4149fa192a62d798382b59`
- `ntsc-lut.png`:
  `a23ae9d27d6d5f9073d4a84678187f54758b329387c47686294ea979dcde6d03`

## Deliberate platform adaptations

- Transparent-black border sampling is explicit instead of relying on sampler
  border state.
- Texture reads use explicit LOD to remain valid in bounded/dynamic sampling
  loops on Metal and console compilers.
- Unity linear post-process color is encoded before the Guest chain and decoded
  back to Unity linear color before URP's final display conversion.
- The upstream HD pass-1 `global.VSHARPNESS` / `global.SIGMA_VER` typo is bound
  from its declared push-constant parameter block.
- Temporal feedback is maintained with persistent per-camera ping-pong RTHandles
  and reset on allocation/resolution changes.

Keep the written internal permission record with production legal records; it
is not embedded in source control here.
