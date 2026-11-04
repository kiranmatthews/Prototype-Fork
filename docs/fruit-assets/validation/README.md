# Fruit asset validation — 5 November 2026

Validated runtime source: `ca93c1bf18b1f2d4c01ecc2838036a1957e717fe` on base `4f5639b21a698b1fb85114bd5f735dc412e1ab7b`. Subsequent delivery changes add documentation and this evidence only.

## Checks

`checks.json` records successful commands and their immutable source revisions. The milk and collection checks ran at `2ee9aba9`; the following commit only corrects the cluster fixture and local browser harness to use native level construction and editor precision. Runtime fruit source is identical between those revisions.

- `npm run check:milk`: complete geometry, outward closed fruit/leaf surfaces, physical material/shader compatibility, shared resources, six variants, morph continuity, instanced morph parity and depth isolation.
- `node tools/test-character-interactions.mjs`: actual Player contact, attraction, HUD credit, spin/death, snapshots, run modes and two-player ownership.
- `node tools/test-fruit-clusters.mjs`: all 24 Jungle and 30 Banana Bay additions are supported, reachable, spaced clear of crates, captured by the editor, hidden for trials and restored by soft reset.
- `npm run check:levels` and `npm run build`: pass. No full suite was run.

Command logs remain in the local validation directory (ignored by the repository's existing `*.log` rule). The saved JSON and screenshots are committed.

## Browser evidence

The browser used the same source and real game Level/Player path. The local runtime harness warps to supported approaches, then supplies ordinary forward/spin input; it does not award fruit or mark pickups collected.

| Evidence | Result |
| --- | --- |
| `collection-native.jpg`, `peach-skin-detail.jpg` | Six complete sculpt/crown variants; soft peach surface at 2560 × 1440 |
| `shade-back.jpg`, `sunset-crown.jpg` | Cool shade and warm sunset; closed leaf undersides, attached crowns and stalks |
| `jungle-lite-collected.json` | Arrival cluster: 6 collected, 6 credits, 0 deaths |
| `jungle-full-collected.json` | Homeward cluster, full rendering: 6 collected, 6 credits, 0 deaths |
| `banana-bay-collected.json` | Coast cluster, full rendering: 6 collected, 6 credits, 0 deaths |
| `jungle-crate-result.json` | Crate broken, reward collected, no stranded flights, 0 deaths; the continued walk also collects nearby existing fruit |
| `jungle-trial-hidden.json`, `jungle-trial-restored.json` | Six live cluster members hide and return without being consumed |
| `jungle-respawn.json` | Supported ordinary respawn |
| `jungle-normal-canvas.json` | Full 1280 × 720 drawing buffer |
| `banana-bay-native-canvas.json` | Full 2560 × 1440 drawing buffer; the quality helper reports CSS dimensions for MAX, so the canvas is checked directly |
| `jungle-fruit.jpg`, `banana-bay-fruit.jpg` | Loose clusters in the real scenes with shadows and scenery |
| Four `*-console.json` files | Empty warning/error lists |

The studio gallery additionally exercised crate-release and collection-flight motion at 720p. Full geometry stays present in the existing shadow/reflection/instancing paths; no distance-based mesh substitution was introduced. Existing scenery, movement tuning, checkpoint/finish layout and public level pack are unchanged. This scoped review does not claim a new end-to-end playthrough of every level.

The dev terminal repeated an existing Carlisle manifest import warning outside this asset scope; the browser consoles and production build passed. The review tab and guarded dev process were closed after saving evidence.
