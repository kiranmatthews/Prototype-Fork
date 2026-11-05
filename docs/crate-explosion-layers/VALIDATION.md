# TNT fuse and layered explosions — 5 November 2026

The TNT tip uses a larger white-hot ember, two warm glow cards and 18 tapered,
volumetric sparks. The spray follows the existing burning braid and keeps a
visible width from every side. One instanced spark draw replaces the old line
draw; the added geometry is 146 triangles. The loaded TNT model is 25,390
triangles and Nitro is 23,242. Shared geometry remains intact at all distances.
The spark instance buffers are explicitly released when the level is disposed.

`Level.detonate` again emits the original `boomTnt` / `boomNitro` Gouraud
recipes, including their smoke children, at the original position and strength.
The existing painted fire/smoke/fracture treatment plays concurrently. Painted
billboards render at order 11, after the original puff batches at 10; both
retain world depth testing. Damage, chain triggering, rewards, three-second
fuse timing, Nitro's lack of a fuse, and checkpoint behavior are unchanged.

## Validation

- `node tools/test-explosive-bundles.mjs`: passes independent fuses/sparks,
  pause/reset, both legacy recipes plus painted layers, rendering order,
  one damage event per crate, legacy-only fallback, finite cleanup and GPU
  instance-buffer disposal. Uses the real `Level` path.
- `node tools/test-crate-art.mjs`: passes geometry budgets, all faces, bounded
  fracture pools and checkpoint exclusion. Its headless asset fallback counts
  are distinct from the loaded-model totals recorded by browser review.
- `node tools/test-nitro-clear-switch.mjs`: passes switch placement,
  tally/reset semantics and capture exclusion. Expected headless asset 404s
  occur in this existing fixture; real browser asset loading is clean.
- Native studio: mid/end fuse, front/back views, TNT and Nitro bursts at
  0.10/0.20/0.45 seconds; normal 480p readability; complete recorded motion
  sequences including cleanup. No console warnings or errors.
- Actual Player/Level fixture: lite and full renderer; 480p/CRT and MAX/native
  at 2560×1440. Both layers emit in the actual detonation path, reset works,
  effects clear, and checkpoint activation produces no explosion/debris or
  residual symbol. No failed assets or console warnings/errors.

Playably validated around 03:13 UTC, about 17 minutes after this follow-up
began. Evidence PNGs, diagnostic JSON, console captures and complete WebM
motion sequences are in this directory. `npm run build` (including typecheck and release asset preparation) and
`npm run check:release` pass: 2,332 files, 834,729,885 bytes within the
1,000,000,000-byte hosting budget. Publication details are recorded in the
task's local release handoff after deployment verification.

## Ownership and delivery

Owned runtime changes are `crateFuse.ts`, its budget import in `crateArt.ts`,
painted-layer ordering in `crateVfx.ts`, and two small `level.ts` hunks:
restore the existing puff call and release the new fuse instance buffers.
Review harnesses and the focused explosive test accompany the change.
No assets, level data, movement tuning, `main.ts`, or held animation work change.
The user's direct instruction retires coordinator delivery for this chat;
this isolated branch publishes and verifies the normal Pages workflow itself.
