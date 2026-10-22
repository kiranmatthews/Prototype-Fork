# Mall · New York

Source-owned reconstruction of the original 1999 THPS Mall for the fork's existing skater. Select **Mall · New York** in MENU, or open `/?playtest&level=mall`. Add `&lite` for the fast renderer. The shared Geometry Lab and published `public/levels.json` are unchanged by this task.

Arrow keys/WASD steer; hold Space to build speed and release to ollie; E grinds; F spins. K/L move between the five checkpoint stops. M shows the developer controls if MENU is hidden.

## Reference and scale

The supplied VGCartography cutaway is the primary layout reference. A [higher-resolution copy on VGMaps](https://www.vgmaps.com/Atlas/PSX/TonyHawk%27sProSkater-Mall.png) helps locate the upper/lower routes, elevator recess, crossed rails and plaza. The original PlayStation [walkthrough by Tom Hayes](https://www.cheatcodes.com/guide/faq-walkthrough-tony-hawks-pro-skater-playstation-15891/) identifies the car-to-upper-rail approach and fountain-to-gallery sequence. [Original PS1 gameplay by Marcanine](https://www.youtube.com/watch?v=n0kosmzFb0A) supplies direct visual checks: the entrance transition around 9:13, straight paired beams at 14:31, and the elevated reward at 14:36. The earlier THAW Classic guide is not used as dimensional evidence for the 1999 level.

The authored route is approximately 412 metres long and descends 25 metres. Ordinary rails are approximately 0.7–1.0 m above their floor; the lower light beams are 1.25 m above the atrium floor. The entrance quarter has a 3.2 m radius; elevator quarters and the paired exit banks use 3 m radii. The blue plaza banks rise 2.2 m. The 12 m fountain gap, upper rail catch and mezzanine landing were tuned through geometry against the existing charged ollie and momentum. No movement tuning or player code was changed by this task.

The third pass restores the separate left escalator into the Flying Leap, three long fountain-side planters with grindable rims, and the letter position on the lower light beam. Crossrails are now straight diagonals. Source gameplay around 6:12–6:22 also shows the blue bank feature, side awnings, raised passage over the final stairs, banked stair throat and narrow parking doors; these replace the earlier sculpture and isolated exit quarter interpretation. Their exact profiles remain inferred from those views.

Dimensions are inferred from the reference and verified for this skater; the image provides no metric survey or original collision mesh. This is not a certified mesh-identical or dimension-exact extraction. Original textures and THPS challenge logic are not imported: native fruit marks the letter locations, a crystal rewards the hidden rail line, and native checkpoints handle recovery. The five directory signs are scenery.

## Layout and collision

| Section | Authored features |
| --- | --- |
| Entry and fountain | Entrance return quarter, descending entry, central uphill escalator, octagonal fountain, gap directly over the fountain, coffee grind, three grindable planters, car jump and uphill access bank |
| Gallery and atrium | Separate second uphill escalator, 16-stair descent, Flying Leap from three upper approaches, straight paired upper/lower light beams, elevated ollie reward, straight water channel, opposing elevator quarters |
| Lower mall | Escalator with four handrails, curved concourse, straight crossed rails |
| Outdoor plaza and exit | Raised side ledges and awnings, blue bank trough, mezzanine and raised passage, narrow 32-stair descent with opposing side transitions, parking doorway |

All 194 components use the editor contract; 40 grind paths include coping. The upper beams have rectangular light housings, and the first three sections share a high ceiling that clears the chase camera above the gallery. Continuous sampled floor meshes share endpoints. Stair nosings are visual over a smooth collision envelope, and decorative geometry does not introduce unintended grinding edges. Ordered camera nodes follow the bends. The only shared runtime addition lets an invisible gate with an explicit width finish across its doorway; default and visible warp pads retain their existing trigger.

## Validation

Six input-only, spawn-to-finish routes use production Player/Level code without position, velocity or tuning overrides. The browser adapter feeds the normal gamepad input path. Focused surface/recovery tests use explicit initial placements, separately from continuous route evidence.

| Route | Simulation time | Lowest grounded speed after acceleration | Result |
| --- | ---: | ---: | --- |
| Main ground bypass | 18.07 s | 22.97 m/s | Finished, zero bails/deaths |
| Fountain/Flying Leap/reward | 19.00 s | 22.87 m/s | Fountain crossed, upper beam caught, reward ollie, finished |
| Car/upper beam/reward | 19.03 s | 16.51 m/s | Car cleared, bank climbed, upper beam and reward, finished |
| Coffee/lower beam | 18.88 s | 21.05 m/s | Coffee and lower light beams caught, finished |
| Second escalator/Flying Leap/reward, lite and full-render browser | 19.15 s | 22.97 m/s | Left escalator climbed, upper beam and reward, finished |
| Mezzanine | 18.28 s | 22.97 m/s | Jump landed on exit apron, finished |

The three quarters and both sides of the exit transition climb and return to supported ground without a bail. Entering an exit bank across its stair handrail requires an ollie; the fixture uses that input. Both blue banks pass with normal longitudinal run-ups and supported landings. Spawn and all five checkpoint supports pass. Actual MENU selection, K/L warps, a deliberate pit death and checkpoint respawn pass in Chrome with no console errors. Normal play spends a reserve life; the headless endless-death fixture counts deaths instead. Backward checkpoint warps update `currentSpawn` while retaining the most recent banked snapshot, matching the existing runtime.

The car route loses speed naturally while climbing its five-metre bank; the tests require it to retain at least 15 m/s. The second escalator permits the same uphill allowance and currently retains more than 22 m/s. Other routes retain at least 18 m/s after acceleration. A negative control rides the upper beam without an ollie and correctly misses the elevated reward. Tests identify the actual named rails, preventing a nearby fountain rim from being counted as a light-beam catch or an arcade side ledge as a crossrail.

`check:levels`, TypeScript and production Vite build pass using their package commands with the installed Node runtime (npm was unavailable). The full suite was not run. Browser review includes lite and full rendering with the normal chase camera, including the new escalator and exit overpass. The final local build is `e85e64eca9e9bdc8513c`.

Evidence: [validation.json](mall/validation.json), [second escalator](mall/second-escalator.png), [suspended atrium](mall/atrium.png), [outdoor plaza](mall/plaza.png), [exit](mall/exit.png). The [cutaway](mall/cutaway.png) and [plaza inspection](mall/plaza-inspection.png) use inspection cameras with roof, foreground wall and fog hidden; gameplay screenshots retain the normal camera and scenery. The fountain image is retained from the preceding pass.

Reproduce with `node tools/test-mall.mjs` and `--route=upper`, `--route=car`, `--route=coffee`, `--route=escalator`, `--route=mezzanine`; use `--route=upper --no-secret-ollie` for the reward negative control; `node tools/test-mall-surfaces.mjs`; and, with Playwright available, `node tools/mall-browser.mjs <local-url> --route=escalator --full` plus `node tools/mall-smoke.mjs <local-url>`. Set `PLAYWRIGHT_MODULE` to an absolute installed module if it is outside the repo. Browser `--visual-pauses` is inspection only; continuous results are saved separately. Keep the completed work local under the temporary slow-network workflow.

## Fidelity still requiring evidence

The route tests demonstrate playable connections and safe landings. They do not prove a dimension-exact recreation. The first concourse's oval planter and short Rail Combo poles still need authoring. The upper reward currently supports an ollie and re-catch on one beam; the source's true beam-to-beam transfer remains to be validated. Hall lengths and widths, deck elevations, transition radii, beam heights and entrance/exit contours remain estimates. The supplied cutaway hides some surfaces and supplies no measurement scale. An original PS1 Mall mesh/collision export, or calibrated plans and views, would resolve those uncertainties. The goal remains open.
