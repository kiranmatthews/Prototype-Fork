# Airborne cargo — Carlisle Coast

Seven occasional crate formations across the existing 55 trampoline transfers.
These are native floating crates, with ordinary spin/headbutt/stomp, stacking,
settling and nitro rules. No movement, camera, trampoline or surface changes.
The first 500 metres remain the existing introduction.

| Bounce | Formation | Wood | Nitro | Route |
| --- | --- | ---: | ---: | --- |
| Lift and skip · 2 | Parcel cloud | 7 | 0 | Small right-side bundle |
| Surf sockets · 3 | Starboard gap | 4 | 5 | Reward to the right of a contiguous nitro row |
| Beacon chimney · 4 | Hanging steps | 9 | 0 | Three-tier stepped cluster on the left |
| Dredger discharge · 2 | Split row | 4 | 6 | Two short rows with a broad centre opening |
| Stack leap · 2 | Hanging pallet | 6 | 0 | Two-by-three parcel group |
| Storm fingers · 3 | Crosswind row | 4 | 5 | Steer right, collect beyond the bar, return to the landing |
| Rigging · moving rebound | Port gap | 6 | 6 | Left-side stack beside the late nitro row |

Total: 40 breakable parcels, 22 nitros and one native green clear switch at the
home harbour, station 3986 on the left. The clear switch keeps the all-crate
route achievable without touching live explosives. Level total: 270 crates.

Anchors were measured from actual held-Jump player flights, about 0.2 seconds
before each apex. They use source-owned station coordinates, not per-frame
homing or a new physics mode. Nitro end clearances and the Storm reward's
forward offset are deliberate: spinning and turning back toward the catch must
not graze the explosive end of the row. Main gameplay data with the `Air cargo`
components removed has the exact prior SHA256 fingerprint.

## Verification

- `baseline.json`: native trajectory measurements used for placement.
- `native.json`: 28 collection/bypass runs across two machinery phases, with
  safe landings; direct Storm-row impact kills; finish switch clears 22 nitros.
- `native-physics.json`: all 55 existing transfers, neutral held/unheld launches
  with zero lateral drift, and rigid moving-platform carry.
- `lite-browser.json`: real arrow-key/held-Jump/F-spin collection and landing.
- `full-browser.json`: compiled native-resolution keyboard runs and all seven
  formations under the actual harbour lighting.
- `normal-browser.json`: the Storm row at normal 480p/CRT presentation.
- `validation.json`: final check results and unchanged runtime source hashes.

`npm run check:levels` and `npm run build` passed. No full suite was run.
Native tests include all affected jumps; browser playtests are bounded checks,
not a claim that the entire four-kilometre course was played in one run.

Local testing: http://127.0.0.1:5483/?playtest&level=carlisle-coast&art=harbour

No generated assets, paid services, publication or shared editor-pack changes.
