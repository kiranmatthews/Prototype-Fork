# CRT Guest Advanced / HD WebGL2 port

This web translation is based on the selected source snapshot from
`libretro/slang-shaders` at revision
`a62d9cda9140294d22b6da5e4ff4187365890d42`.

The complete selected Slang corresponding source and both canonical preset
graphs are retained in this directory under `UpstreamSource/`, with the
generator-owned copy at `tools/crt-guest-web/upstream/`. Generation is performed
by `tools/crt-guest-web/generate.py` using `glslangValidator` and `spirv-cross`.
The generated GLSL is under `src/crt-guest/generated/`.

The translated shader work remains GPL-2.0-or-later. See `GPL-2.0.txt`,
`THIRD-PARTY-NOTICES.md`, and `UNITY-SOURCE-MANIFEST.md` in this directory. The
source project records this suite as internal-demo-only while separate release
terms remain unresolved; do not treat its presence in this prototype as public
or commercial redistribution clearance.

The four LUT binaries under `/crt-guest/lut/` are byte-identical to the pinned
Unity/internal source assets. Their hashes are recorded in `LUT-SHA256SUMS.txt`.

WebGL-specific changes are limited to resource binding, deterministic sampler
selection, transparent-black border emulation, bounded dynamic loops, the
pinned HD parameter-block typo correction, an array-safe preparatory lookup for
the authored `shadowMask = -1` no-mask sentinel, and color-pipeline wrapper
stages. The sentinel adaptation only clamps the otherwise out-of-bounds width
lookup made before Guest's no-mask guard; mask modes `0..14` and the canonical
parameter contract are otherwise retained.
