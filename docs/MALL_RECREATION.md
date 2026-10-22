# Mall · New York

Source-owned reconstruction of the original 1999 THPS Mall for the fork's existing skater. Select **Mall · New York** in MENU, or open `/?playtest&level=mall`. Add `&lite` for the fast renderer. The shared Geometry Lab and published `public/levels.json` are unchanged by this task.

Arrow keys/WASD steer; hold Space to build speed and release to ollie; E grinds; F spins. K/L move between the five checkpoint stops. M shows the developer controls if MENU is hidden.

## Reference and scale

The supplied VGCartography cutaway is the primary layout reference. A [higher-resolution copy on VGMaps](https://www.vgmaps.com/Atlas/PSX/TonyHawk%27sProSkater-Mall.png) helps locate the upper/lower routes, elevator recess, crossed rails and plaza. The original PlayStation [walkthrough by Tom Hayes](https://www.cheatcodes.com/guide/faq-walkthrough-tony-hawks-pro-skater-playstation-15891/) identifies the car-to-upper-rail approach and fountain-to-gallery sequence. [Original PS1 gameplay by Marcanine](https://www.youtube.com/watch?v=n0kosmzFb0A) supplies direct visual checks: the entrance transition around 9:13, straight paired beams at 14:31, and the elevated reward at 14:36. The earlier THAW Classic guide is not used as dimensional evidence for the 1999 level.

The authored route is approximately 412 metres long and descends 25 metres. Ordinary rails are approximately 0.7–1.0 m above their floor; the lower light beams are 1.25 m above the atrium floor. The entrance quarter has a 3.2 m radius; elevator quarters and the paired exit banks use 3 m radii. The blue plaza banks rise 2.2 m. The fountain gap, upper rail catch and mezzanine landing were tuned through geometry against the existing charged ollie and momentum. Movement tuning, forces and the authored steering model remain unchanged. The earlier closed-rail support allows a round grind to cross its seam. The structural pass uses existing mesh and wall primitives without new runtime changes.

The third pass restores the separate left escalator into the Flying Leap, three long fountain-side planters with grindable rims, and the letter position on the lower light beam. Crossrails are now straight diagonals. Source gameplay around 6:12–6:22 also shows the blue bank feature, side awnings, raised passage over the final stairs, banked stair throat and narrow parking doors; these replace the earlier sculpture and isolated exit quarter interpretation. Their exact profiles remain inferred from those views.

The fourth pass adds a 4.2 m round planter to a widened first concourse, moves the first directory onto that island, and adds the two short outward-facing combo poles. A charged lateral ollie links the left pole to Coffee Grind and the right pole to a planter rim. The elevated reward now has an actual transfer between the two separate upper light beams, validated from all three upper approaches.

The fifth pass closes the raised decks with skirts and soffits, gives the escalators solid bodies, adds masonry supports, and preserves the lower routes beneath the first island and upper gallery. The second fountain island now has an approach bank. Three joined ceiling meshes replace the overlapping roof boxes, and the atrium walls meet that roof. Exit-passage supports sit outside the banked stair route. Source footage at 1:12–1:15 confirms the offset first escalator and lower aisle; 5:15 shows the open passage and masonry below the second gallery.

Dimensions are inferred from the reference and verified for this skater; the image provides no metric survey or original collision mesh. This is not a certified mesh-identical or dimension-exact extraction. Original textures and THPS challenge logic are not imported: native fruit marks the letter locations, a crystal rewards the hidden rail line, and native checkpoints handle recovery. The five directory signs are scenery.

## Layout and collision

| Section | Authored features |
| --- | --- |
| Entry and fountain | Entrance return quarter, descending entry, central uphill escalator, round planter loop, short side-combo poles, octagonal fountain, gap directly over the fountain, coffee grind, three grindable planters, car jump and uphill access bank |
| Gallery and atrium | Separate second uphill escalator, 16-stair descent, Flying Leap from three upper approaches, straight paired upper/lower light beams, elevated ollie reward, straight water channel, opposing elevator quarters |
| Lower mall | Escalator with four handrails, curved concourse, straight crossed rails |
| Outdoor plaza and exit | Raised side ledges and awnings, blue bank trough, mezzanine and raised passage, narrow 32-stair descent with opposing side transitions, parking doorway |

All 347 components use the editor contract; 43 grind paths include coping. The upper beams have rectangular light housings, and the first three sections share a high ceiling that clears the chase camera above the gallery. Continuous sampled floor meshes share endpoints. Stair nosings are visual over a smooth collision envelope, and decorative geometry does not introduce unintended grinding edges. Ordered camera nodes follow the bends. An invisible gate with an explicit width finishes across its doorway; default and visible warp pads retain their existing trigger. Rails explicitly marked `closed` now close their path and wrap grind distance at the seam. Open rails still run off their ends, and a sharp closing corner still launches the skater instead of silently redirecting them.

## Validation

Six input-only, spawn-to-finish routes use production Player/Level code without position, velocity or tuning overrides. The browser adapter feeds the normal gamepad input path. Focused surface/recovery tests use explicit initial placements, separately from continuous route evidence.

| Route | Simulation time | Lowest grounded speed after acceleration | Result |
| --- | ---: | ---: | --- |
| Main ground bypass | 18.12 s | 22.97 m/s | Finished, zero bails/deaths |
| Fountain/Flying Leap/reward, full-render browser | 18.75 s | 22.86 m/s | Fountain crossed, beam-to-beam transfer held for 20 frames, reward, finished |
| Car/upper beam/reward | 19.03 s | 16.51 m/s | Car cleared, bank climbed, opposite beam held for 28 frames, reward, finished |
| Coffee/lower beam | 18.90 s | 21.05 m/s | Coffee and lower light beams caught, finished |
| Second escalator/Flying Leap/reward | 18.83 s | 22.97 m/s | Left escalator climbed, opposite beam held for 18 frames, reward, finished |
| Mezzanine | 18.30 s | 22.97 m/s | Jump landed on exit apron, finished |

The round planter passes more than two laps in both directions from low-speed placements. A separate run from the actual level spawn catches it at 22.34 m/s and completes 2.12 laps across two seams; the current full Chrome run repeats the 290-frame result without a bail or console error. The focused side-combo tests begin on the reachable concourse, use normal charged lateral ollies with partial stick input, catch the intended lower rails for 261/152 frames and reach supported ground. These are section fixtures, not continuous spawn-to-finish combo routes.

The three quarters and both sides of the exit transition climb and return to supported ground without a bail. Entering an exit bank across its stair handrail requires an ollie; the fixture uses that input. Both blue banks pass with normal longitudinal run-ups and supported landings. Spawn and all five checkpoint supports pass. Actual MENU selection, K/L warps, a deliberate pit death and checkpoint respawn pass in Chrome with no console errors. Normal play spends a reserve life; the headless endless-death fixture counts deaths instead. Backward checkpoint warps update `currentSpawn` while retaining the most recent banked snapshot, matching the existing runtime.

A sideways input fixture now stops at the first escalator body instead of passing through it. Separate input fixtures pass beneath the first concourse and second gallery. An upward ray finds the gallery soffit at Y=16.35; a jump beneath it returns to the lower floor. All 477 upward probes find the joined roof. These checks verify structural contact and passage clearance independently of the six fast routes. The ordinary finish pilots now approach the central stair line; an earlier outside-bank line also completed, but briefly obscured the skater with the bank. That outer camera case remains open.

The car route loses speed naturally while climbing its five-metre bank; the tests require it to retain at least 15 m/s. The second escalator permits the same uphill allowance and currently retains more than 22 m/s. Other routes retain at least 18 m/s after acceleration. A negative control rides the upper beam without an ollie and correctly misses the elevated reward. Tests identify the actual named rails, preventing a nearby fountain rim from being counted as a light-beam catch or an arcade side ledge as a crossrail.

`check:levels`, TypeScript and production Vite build pass using their package commands with the installed Node runtime (npm was unavailable). The full suite was not run. Browser review includes the complete fountain/Flying Leap/central-stair route in both render modes and the planter laps in full rendering, all with the normal chase camera. The final local build is `1699536471361e61c273`.

The broader existing `test-rail-air-transfer.mjs` reports `Boardslide 1 -1 torso faced opposite input`. Running that same test with the three shared source files restored in an isolated Vite transform to their pre-pass contents reproduces the identical failure. The new closed-seam, sharp-corner and open-rail checks pass. The unrelated torso-orientation issue is retained as a known validation limitation; its implementation is not part of this commit.

Evidence: [validation.json](mall/validation.json), [round planter in full rendering](mall/planter.png), [concourse inspection](mall/concourse-inspection.png), [second escalator](mall/second-escalator.png), [suspended atrium](mall/atrium.png), [outdoor plaza](mall/plaza.png), [exit](mall/exit.png). The [cutaway](mall/cutaway.png) and [plaza inspection](mall/plaza-inspection.png) use inspection cameras with roof, foreground wall and fog hidden; gameplay screenshots retain the normal camera and scenery. The fountain image is refreshed from the current full-render run.

Reproduce with `node tools/test-mall.mjs` and `--route=upper`, `--route=car`, `--route=coffee`, `--route=escalator`, `--route=mezzanine`; use `--route=upper --no-secret-ollie` for the reward negative control; `node tools/test-mall-surfaces.mjs`; `node tools/test-mall-combos.mjs`; `node tools/test-mall-structures.mjs`; and, with Playwright available, `node tools/mall-browser.mjs <local-url> --route=upper --full` and `--route=planter --full` plus `node tools/mall-smoke.mjs <local-url>`. Set `PLAYWRIGHT_MODULE` to an absolute installed module if it is outside the repo. Browser `--visual-pauses` is inspection only; continuous results are saved separately. Keep the completed work local under the temporary slow-network workflow.

## Fidelity still requiring evidence

The route tests demonstrate playable connections and safe landings. They do not prove a dimension-exact recreation. The new planter and combo poles are playable, but their precise source dimensions and the first escalator's full side profile still need comparison. The source’s lower water trough beside the first escalator and the side-access contours need further comparison. The new receiver bank, deck thicknesses and supports are reference-derived estimates. The camera outside the final bank still needs review. Fountain sculpture, storefront massing and the concourse silhouette also remain visibly simplified. Hall lengths and widths, deck elevations, transition radii, beam heights and entrance/exit contours remain estimates. The supplied cutaway hides some surfaces and supplies no measurement scale. An original PS1 Mall mesh/collision export, or calibrated plans and views, would resolve those uncertainties. The goal remains open.
