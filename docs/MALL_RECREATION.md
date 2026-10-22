# Mall · New York

Source-owned reconstruction of the original 1999 THPS Mall for the fork's existing skater. Select **Mall · New York** in MENU, or open `/?playtest&level=mall`. Add `&lite` for the fast renderer. The shared Geometry Lab and published `public/levels.json` are unchanged by this task.

Arrow keys/WASD steer; hold Space to build speed and release to ollie; E grinds; F spins. K/L move between the five checkpoint stops. M shows the developer controls if MENU is hidden.

## Reference and scale

The supplied VGCartography cutaway is the primary layout reference. A [higher-resolution copy on VGMaps](https://www.vgmaps.com/Atlas/PSX/TonyHawk%27sProSkater-Mall.png) helps locate the upper/lower routes, elevator recess, crossed rails and plaza. The [Planet Tony Hawk Mall walkthrough](https://planettonyhawk.gamespy.com/View74d8.html?id=5&view=thaw_faqs_guides.Detail) corroborates the order of the fountain gap, Flying Leap, suspended-rail reward, coffee grind, escalators and final mezzanine.

The authored route is approximately 412 metres long and descends 25 metres. Ordinary rails are approximately 0.7–1.0 m above their floor, elevator quarters rise 3 m, and the exit quarter rises 2.7 m. The 12 m fountain gap, upper rail catch and mezzanine landing were tuned through geometry against the existing charged ollie and momentum. No movement tuning or player code was changed by this task.

Dimensions are inferred from the reference and verified for this skater; the image provides no metric survey or original collision mesh. This is not a certified mesh-identical or dimension-exact extraction. Original textures and THPS challenge logic are not imported: native fruit marks the letter locations, a crystal rewards the hidden rail line, and native checkpoints handle recovery. The five directory signs are scenery.

## Layout and collision

| Section | Authored features |
| --- | --- |
| Entry and fountain | Descending entry, uphill escalator, octagonal fountain, upper gap/landing, coffee grind, car-display bank |
| Gallery and atrium | 16-stair descent, Flying Leap, paired upper and lower suspended rails, long blue channel, recessed opposing elevator quarters |
| Lower mall | Escalator with four handrails, curved concourse, crossed rails with tangent entries/exits |
| Outdoor plaza and exit | Raised side ledges, blue bank sculpture, mezzanine alternative, 32-stair descent, return quarter and glass exit |

All 178 components use the editor contract; 34 grind paths include coping. Continuous sampled floor meshes share endpoints. Stair nosings are visual over a smooth collision envelope, and decorative geometry does not introduce unintended grinding edges. Ordered camera nodes follow the bends. The only shared runtime addition lets an invisible gate with an explicit width finish across its doorway; default and visible warp pads retain their existing trigger.

## Validation

Four input-only, spawn-to-finish routes use production Player/Level code without position, velocity or tuning overrides. The browser adapter feeds the normal gamepad input path. Focused surface/recovery tests use explicit initial placements, separately from continuous route evidence.

| Route | Simulation time | Lowest grounded speed after acceleration | Result |
| --- | ---: | ---: | --- |
| Main route, full-render browser | 18.68 s | 22.97 m/s | Finished, zero bails/deaths |
| Upper fountain/Flying Leap, lite browser | 19.12 s | 22.87 m/s | Upper rail caught, crystal collected, finished |
| Coffee Grind, production runtime | 18.80 s | 22.97 m/s | Coffee rail and crossrail grinds, finished |
| Mezzanine, production runtime | 18.58 s | 22.97 m/s | Jump landed on exit apron, finished |

All three verts climb, launch and return to supported ground without a bail. Spawn and all five checkpoint supports pass. Actual MENU selection, K/L warps, a deliberate pit death and checkpoint respawn pass in Chrome with no console errors. Normal play spends a reserve life; the headless endless-death fixture counts deaths instead. Backward checkpoint warps update `currentSpawn` while retaining the most recent banked snapshot, matching the existing runtime.

`check:levels`, TypeScript and production Vite build pass using their package commands with the installed Node runtime (npm was unavailable). The full suite was not run. Browser review includes lite, full rendering and a separate paused visual inspection. Two blank capture frames in the first full pass were recaptured successfully during visual inspection; no rendering fix or performance claim is inferred from that observation.

Evidence: [validation.json](mall/validation.json), [fountain](mall/fountain.png), [suspended atrium](mall/atrium.png), [outdoor plaza](mall/plaza.png), [exit](mall/exit.png). The [cutaway](mall/cutaway.png) is an inspection camera with roof, foreground wall and fog hidden; gameplay screenshots retain the normal camera and scenery.

Reproduce with `node tools/test-mall.mjs` and `--route=upper`, `--route=coffee`, `--route=mezzanine`; `node tools/test-mall-surfaces.mjs`; and, with Playwright available, `node tools/mall-browser.mjs <local-url> --full` plus `node tools/mall-smoke.mjs <local-url>`. Set `PLAYWRIGHT_MODULE` to an absolute installed module if it is outside the repo. Browser `--visual-pauses` is inspection only; continuous results are saved separately. Keep the completed work local under the temporary slow-network workflow.
