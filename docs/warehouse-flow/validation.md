# Warehouse flow rebuild — validation

The competition camera and movement tuning are unchanged. Every rendered session uses normal Gamepad input, the actual fixed-step/render loop and the real spawn. The runner never places the player, forces a heading, changes the camera, or steps the world itself. `skatepark: true`, `alwaysSkate: false`, no `cameraRig`, fresh-profile park FOV 49.

## Complete course results

Both full-render plans start from the real spawn, earn all five tokens in different orders, and reach the real finish gate. Both have **zero bails, deaths, render snaps or browser errors**. They use clearly named walking connectors where appropriate; these are completion/access proofs, not uninterrupted combo claims.

| Full-render plan | Pickup order | Time | Actual finish | Gallery return |
| --- | --- | ---: | --- | --- |
| [East first](plans/collectathon-east-first.json) | 3 → 4 → 5 → 1 → 2 | 67.62 s | Yes | Grounded on return bank |
| [West first](plans/collectathon-west-first.json) | 5 → 1 → 2 → 3 → 4 | 83.93 s | Yes | Grounded on return bank |

The final visual audit caught a gallery exit undershooting its bank. Extending the bank nose from z=-33 to -36 fixed that handoff. Both final runs explicitly assert the real ground component, with supported contact near `[-47, 3.146, -33.475]`; merely falling underneath no longer satisfies the check. Original [bank-contact](evidence/gallery-bank-contact.png) and [five-token exit approach](evidence/five-goal-exit-approach.png) captures are saved alongside the route evidence. The immediate finish-frame canvas was black during the normal transition; actual completion is verified by native state telemetry, not that discarded image.

## Play evidence

- **Central session:** Impossible → Manual across the first pad, floor and central hip → Nosegrind on the north island's ordinary grindable rim. Three-action combo banks **2,304 points**, with 104 observed manual frames and 76 grind frames, zero bails/deaths/resets. The rim is an emergent line, not mislabeled as the authored rail. A separate authored North Manual Link variant banks **1,890 points** with a Boardslide. These two acceptance runs use lite rendering.
- **West session in the final full run:** Maintenance → carved return → Loading gap → floor connector → bank-fed Gallery grind → south return. **38.02 s**, 449.2 m, three tokens, **no stops, bails, deaths or resets**. Earlier complete-order testing exposed the Loading checkpoint crate's intrusion into the floor connector; it was moved four metres aside before this final run.
- **East session, full render:** Workshop gap → explicit walking/hop/remount setup → bank-fed Crane rail → west descent to the floor. **21.40 s**, 226.6 m, two tokens, zero bails/deaths/resets. Walking here is intentional access evidence; it is not claimed as an uninterrupted skating transfer.
- **Miss/recovery, lite:** deliberately omit the Workshop ollie, use the native ledge catch/clamber, leave the receiver's side to the lower space and return to the local approach. **19.03 s**, no token awarded, no bail/death/reset. The first recovery is a ledge rescue, not a fictitious landing inside the gap.

Exact session summaries, config, native probes and source hashes are in [validation.json](validation.json). Rendered commitment frames are in [evidence/](evidence/). Branch-level notes record visibility and limits separately.

## Mechanical and material checks

`check:levels` and the production build pass. Focused native checks cover source normalization, supported spawn and all checkpoints, a closed physical enclosure, five distinct goals and actual gate contact, both halfpipe pump directions at three stations, every authored rail's catch, ordinary deck grind boundaries, collectible underside rejection and reset semantics.

The native ramp fix rejects unreachable overhead support only during grounded queries. A synthetic fixture reproduces the reported false landing at the maintenance-underpass position, then checks stable standing, both-direction walking/board passages, valid uphill riding and a real ceiling bonk. Historical recorded inputs and rim crossings use a frozen version of their original geometry, so the course is free to change while the original collision regression remains meaningful. Shared walking, rotated floor seams, Blockworks ramp collision, surface behavior and ground-query checks also pass.

Art checks preserve native geometry, triangle contacts, grind edges, transforms and primitive dimensions. Halfpipe UVs derive from its actual profile and remain correct after translation/rotation/shape changes. All 144 original Meshy wall sections use their original atlases; the backing has no texture and the browser requests **zero repeated brick maps**. Full rendering also passes finite environment/reflection checks, compressed asset loading, repeated level transitions, graphics recovery and bounded texture/geometry residency. No new generated textures or paid assets were used.

## Reproduce

Start the game server, then provide its URL to the scripts below. The browser scripts accept `PLAYWRIGHT_MODULE` when Playwright is supplied outside this checkout.

```sh
npm run check:levels
npm run build
node tools/test-warehouse.mjs
node tools/test-warehouse-collision.mjs
node tools/test-warehouse-art.mjs
node tools/warehouse-branch-probe.mjs
node tools/warehouse-flow.mjs http://127.0.0.1:5332/
node tools/test-warehouse-browser.mjs http://127.0.0.1:5332/
node tools/test-warehouse-replay-browser.mjs http://127.0.0.1:5332/
node tools/test-warehouse-art-browser.mjs http://127.0.0.1:5332/
```

## Limits

Automated route feedback knows destination coordinates; it cannot prove first-time discovery or subjective fun. The normal camera's actual commitment frames were reviewed, but point visibility is not semantic readability. Video recording adds overhead; frame-time samples here are functional evidence, not a controlled performance benchmark. The direct diagonal Workshop-to-Crane air did not pass and is not advertised as a line; the accepted east route includes walking. The independent high branches, continuous west route and connected central trick session are the demonstrated improvements.
