# CRT Guest parameter audit

## Result

The Fork control catalog is an exact match for its selected Libretro snapshot,
[`a62d9cda9140294d22b6da5e4ff4187365890d42`](https://github.com/libretro/slang-shaders/tree/a62d9cda9140294d22b6da5e4ff4187365890d42/crt/shaders/guest):

- Advanced: 133 controls across 170 declarations.
- HD: 130 controls across 179 declarations.
- Union: 143 controls, of which 120 are shared.
- No missing, extra, conflicting, range, step, label, declaration-location, or
  generated-uniform mismatches.

Run the reproducible check from the repository root:

```sh
node tools/audit-crt-guest-parameters.mjs
```

The audit reads the shader files selected by the two vendored `.slangp` graphs,
parses every `#pragma parameter`, and compares it with
`public/crt-guest/provenance/ParameterManifest.json`. `bogus_*` section headings
and the informational `info02` row are deliberately not controls. It also checks
that every manifest control occurs in the generated Advanced/HD GLSL and that
every generated `uParams_*` or `uGlobal_*` name is either a control or an
explicit shader-ABI field. The ABI allowlist covers pass dimensions/transforms,
frame count, the retained LUT constants and legacy upstream struct members; it
is checked for stale entries.

`public/crt-guest/provenance/AuthorReleaseParameterDelta.json` records the newer
author-release contract in machine-readable form. The same command validates
its schema, its base metadata against the manifest, every recorded pre-change
range, and the Advanced/HD/shared/union count arithmetic.

## The apparent zero-range problems

The current public guest.r release confirms that these lower bounds are
intentional, not port errors:

- `esrc` is an enum selecting Original History (`1`) or Source (`2`), not
  afterglow strength. `bth` is the afterglow threshold and starts at `1`.
- The actual afterglow amount is `AS`, which has always reached `0`.
- `HSHARPNESS` and `VSHARPNESS` are filter ranges and start at `1`.
  `SIGMA_HOR` and `SIGMA_VER` are blur sigmas and start at `0.10`; the shader
  divides by sigma squared, so zero is not a valid value.

See guest.r's immutable 2026 source for the
[afterglow source/threshold declarations](https://github.com/guestrr/Libretro-Retroarch-SLANG/blob/4034f18d2996dad33ab37ecc54602b5ff3620ff8/crt-guest-advanced-2026-06-22-release1/shaders/guest/hd/afterglow0.slang#L35-L43),
the [zero-capable `AS` strength](https://github.com/guestrr/Libretro-Retroarch-SLANG/blob/4034f18d2996dad33ab37ecc54602b5ff3620ff8/crt-guest-advanced-2026-06-22-release1/shaders/guest/hd/pre-shaders-afterglow.slang#L42-L49),
and the [HD filter declarations and sigma calculation](https://github.com/guestrr/Libretro-Retroarch-SLANG/blob/4034f18d2996dad33ab37ecc54602b5ff3620ff8/crt-guest-advanced-2026-06-22-release1/shaders/guest/hd/crt-guest-advanced-hd-pass1.slang#L54-L108).

## Delta to guest.r's 2026-06-22 author release

The comparison target is guest.r's public
[`crt-guest-advanced-2026-06-22-release1`](https://github.com/guestrr/Libretro-Retroarch-SLANG/tree/4034f18d2996dad33ab37ecc54602b5ff3620ff8/crt-guest-advanced-2026-06-22-release1)
at repository commit `4034f18d2996dad33ab37ecc54602b5ff3620ff8`.
This is a newer shader revision than the Fork's Libretro pin.

The author release has 138 Advanced controls, 134 HD controls, 125 shared
controls and a 147-control union. A mechanical comparison of the canonical
Advanced and HD graphs found the complete parameter-contract delta below.

### Added in both variants

| ID | Label | Default / min / max / step |
| --- | --- | --- |
| `segams` | Sega MS Blue Lift | `0 / 0 / 1 / 1` |
| `segapal` | Sega MD Pallete Fix (upstream spelling) | `0 / 0 / 1 / 1` |
| `BP1` | Raise Black Level | `0 / 0 / 25 / 1` |
| `bloomsamp` | Bloom Pixel Sampling | `0 / 0 / 2 / 1` |
| `ssharp` | Smart Sharpen Scanlines | `0 / 0 / 0.50 / 0.01` |

Sources: [Sega and split black-level controls](https://github.com/guestrr/Libretro-Retroarch-SLANG/blob/4034f18d2996dad33ab37ecc54602b5ff3620ff8/crt-guest-advanced-2026-06-22-release1/shaders/guest/advanced/pre-shaders-afterglow.slang#L87-L97),
[Advanced bloom/scanline additions](https://github.com/guestrr/Libretro-Retroarch-SLANG/blob/4034f18d2996dad33ab37ecc54602b5ff3620ff8/crt-guest-advanced-2026-06-22-release1/shaders/guest/advanced/crt-guest-advanced.slang#L103-L146),
and [HD bloom/scanline additions](https://github.com/guestrr/Libretro-Retroarch-SLANG/blob/4034f18d2996dad33ab37ecc54602b5ff3620ff8/crt-guest-advanced-2026-06-22-release1/shaders/guest/hd/crt-guest-advanced-hd-pass2.slang#L157-L200).

### Removed

- HD `HSHARP` (`Sharpness Definition`) was removed. It was HD-only, so there is
  no Advanced removal. `ssharp` has a different scanline-specific meaning and
  should not be treated as a simple rename.

### Changed ranges/defaults

| Control | Advanced change | HD change |
| --- | --- | --- |
| `BP` | Label becomes Lower Black Level; max `25 → 0` | Same |
| `SIGMA_H`, `SIGMA_V` | max `15 → 3`; step `.05 → .01` | Same |
| `SIGMA_HB`, `SIGMA_VB` | max `15 → 2`; step `.025 → .01` | max `15 → 3`; step `.025 → .01` |
| `SIGMA_HOR`, `SIGMA_VER` | Not present | max `7 → 1`; step `.025 → .01` |
| `MAXS` | Not present | default `.15 → .20` |
| `HARNG` | Not present | default `.20 → .30` |

The lower bounds remain unchanged. Authoritative declarations are in the
[Advanced glow passes](https://github.com/guestrr/Libretro-Retroarch-SLANG/blob/4034f18d2996dad33ab37ecc54602b5ff3620ff8/crt-guest-advanced-2026-06-22-release1/shaders/guest/advanced/gaussian_horizontal.slang#L61-L66),
[Advanced bloom passes](https://github.com/guestrr/Libretro-Retroarch-SLANG/blob/4034f18d2996dad33ab37ecc54602b5ff3620ff8/crt-guest-advanced-2026-06-22-release1/shaders/guest/advanced/bloom_horizontal.slang#L37-L44),
[HD glow/bloom passes](https://github.com/guestrr/Libretro-Retroarch-SLANG/blob/4034f18d2996dad33ab37ecc54602b5ff3620ff8/crt-guest-advanced-2026-06-22-release1/shaders/guest/hd/bloom_horizontal.slang#L37-L49),
and [HD reconstruction controls](https://github.com/guestrr/Libretro-Retroarch-SLANG/blob/4034f18d2996dad33ab37ecc54602b5ff3620ff8/crt-guest-advanced-2026-06-22-release1/shaders/guest/hd/crt-guest-advanced-hd-pass1.slang#L54-L84).

There are no other canonical Advanced/HD parameter additions, removals, label
changes, defaults, ranges or step changes between these two snapshots. The
2026 release also changes shader implementation code, so updating only the UI
manifest would make the controls disagree with the compiled shaders. A future
update should move the author shader source, generated GLSL, 147-control
manifest, preset migration and UI semantics together.
