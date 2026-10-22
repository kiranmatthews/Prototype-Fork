# Mall · New York

Source-owned reconstruction of the original 1999 THPS Mall for the fork's existing skater. Select **Mall · New York** in MENU, or open `/?playtest&level=mall`. Add `&lite` for the fast renderer. All work remains local under the slow-network workflow.

Arrow keys/WASD steer; hold Space to build speed and release to ollie; E grinds; F spins. K/L move between the five checkpoints. M shows developer controls if MENU is hidden.

## Reference and scale

The supplied VGCartography cutaway is the primary layout reference. The [higher-resolution VGMaps image](https://www.vgmaps.com/Atlas/PSX/TonyHawk%27sProSkater-Mall.png), [original PS1 footage by Marcanine](https://www.youtube.com/watch?v=n0kosmzFb0A), [Planet Tony Hawk guide](https://planettonyhawk.gamespy.com/Viewf1e2.html?id=5&view=thps_faqs_guides.Detail) and [Tom Hayes's PlayStation walkthrough](https://www.cheatcodes.com/guide/faq-walkthrough-tony-hawks-pro-skater-playstation-15891/) resolve obscured surfaces and route connections. Later remakes are not dimensional evidence for this reconstruction.

World units are metres. The main station chain is now 466 m long, with the folded entrance preceding its lower lane. Spawn is at Y=30; the parking floor is Y=-10. Scale is checked against the existing skater's body, ollie, grind and vert behaviour. Dimensions remain inferred from images and footage; these tests do not establish an exact match to the original mesh.

## Playable arrangement

| Section | Current geometry and connections |
| --- | --- |
| Folded entrance | Upper ramp to gold quarter, descending return lane to blue quarter, then lower lane through glass doors. Both quarters have 3.2 m radii. |
| First concourse | Offset up escalator and adjacent water trough; centered oval bench; directory; lower aisle beneath the raised island. |
| Fountain and gallery | Launch into a real intermediate passage, then landing bank to the gallery. Separate second up escalator, car kicker/access bank and Coffee Grind remain usable. |
| Flying Leap and atrium | Straight paired upper/lower light beams, actual upper-beam reward transfer, water channel and elevator quarters. |
| Lower mall | Broad escalator, lower arcade and two straight diagonal crossrails with separated crossing heights. |
| Courtyard | Four broad battered tree planters on low ledges; continuous wall quarters; two raised curved canopy roofs; shallow blue pool between tan launch/landing wedges. |
| Exit mezzanine | Flat upper passage above a descending lower approach; separate lower corridor with low grindable side ledges. The rear wedge provides a demonstrated ollie onto the mezzanine. |
| Stairs and parking | Separate 32-stair flight, two handrails and small wall-base fillets; glass doorway; parking room with two column rows and the finish beyond it. |

Pass 12 replaces the narrow courtyard hedge boxes with four 3.5 × 5.8 m battered tree planters at s=336/365, u=±7.5. Their tops are Y=1.35 on 0.3 m ledges. The long inside grinds are at u=±5.65. The courtyard facade is 5.8 m high with a window band. The pool's side banks now meet the raised ledges continuously.

The pool is 0.8 m deep with a 10.4 × 7 m footprint and 1.15 m tan wedges. The closed canopy roofs now rise from 3.55 to 4.75 m, plus their small end curvature. Their height was checked against the rendered character, including the taller pose on a raised side ledge. Four edge grinds remain distinct. Inner roof grinds transfer onto the lower ledges when grind stays held; outer edges run off onto the wall transitions. A straight roof line outside each rear tree returns to the courtyard floor.

Original footage at 6:16–6:22 establishes the corrected exit order. The last directory is centered before the raised passage. The lower approach drops to Y=-3; its ledged corridor runs from s=388 to 410. The mezzanine spans s=377–408 at Y=2.8 with its soffit at Y=2.6. The separate 32-stair flight descends over s=414–432 to Y=-10. The doorway is at s=438 with 6.2 m clear width, followed by the parking room and gate at s=463. The former long courtyard access ramp and oversized exit halfpipe were removed. Small 0.65 m wall-base fillets now sit beside the stairs. These measurements remain inferred.

Low follow views clear the mezzanine and parking ceilings. A closer stair view keeps the camera above the uphill floor behind a descending skater. All are local camera components. Shared movement, rail, collision, camera runtime and tuning files are unchanged in this iteration. Native checkpoints, collectibles and the finish are used; the original directories and glass currently have pass-through visual representations.

## Validation

Local build `3ba2261de64b2be4408b` contains 497 components and 52 grind paths. `check:levels`, TypeScript and production build pass. The full suite was not run. Native runs precede the last camera-arm adjustment; an exact source comparison confirms that only its vector/distance and comment changed afterward. All Chrome checks use the final source.

Nine native-input runs complete from the actual spawn without a bail or death: main, controlled/fast fountain, car, Coffee Grind, second escalator, mezzanine, underpass and pool. The main route finishes in 25.95 seconds and retains at least 22.56 m/s after the entrance. The mezzanine route retains at least 22.37 m/s, records 76 supported frames on the upper passage and first lands beyond the final stair after its second ollie. These are measurements of this skater, not original-game timing claims.

Focused tests verify both courtyard walls, four long ledge grinds, both coping ollies, pool roll/jump outcomes, roof skating and four canopy grinds. Both 22.03 m exit ledge grinds and both 23.04 m stair handrail grinds return to supported ground. The entrance trough fixture, spawn/checkpoint support, level-data contract and pit recovery pass. Surface probes distinguish the upper mezzanine, its underside and the lower corridor/parking floors.

Five complete Chrome runs use matching source and the ordinary game camera: lite main, full main, full fast fountain, full mezzanine and full pool. They have no console errors, sightline obstructions or rendered-head intersections with the courtyard/exit roofs. The minimum measured exit camera distance is 5.56 m. Four full-render section replays reproduce two wall returns, the pool roll-through and pool jump, including their reward outcomes and native end positions. MENU selection, K/L warps and normal reserve-life pit recovery pass.

Earlier entrance charged-air, oval-bench seam, combo-transfer, fountain timing and structural section results retain their original build provenance in [validation.json](mall/validation.json). Geometry before the courtyard is unchanged here and all complete routes are repeated. The existing broader rail-air-transfer test's torso-orientation failure was reproduced against its pre-change baseline in pass 4; it remains an unrelated known limitation.

## Evidence and reproduction

[Courtyard](mall/plaza.png), [lower exit approach](mall/exit-underpass.png), [mezzanine](mall/mezzanine.png), [exit corridor](mall/exit.png), [stairs](mall/exit-stairs.png), [parking](mall/parking.png), [pool jump](mall/pool-jump.png), [basin roll-through](mall/pool-roll.png), and [wall return](mall/courtyard-return.png) use the normal game camera. Screenshots are sampled during continuous runs. The [cutaway](mall/cutaway.png) and [plaza inspection](mall/plaza-inspection.png) use inspection cameras with foreground walls, roof and fog hidden.

Run `node tools/test-mall.mjs --route=<name>` for the nine routes above; use `upper`, `upper-fast`, `car`, `coffee`, `escalator`, `mezzanine`, `underpass`, `pool` or `main`. The focused tools are `test-mall-surfaces.mjs`, `test-mall-courtyard.mjs`, `test-mall-pool.mjs`, `test-mall-exit.mjs` and `test-mall-details.mjs` in `tools/`. `mall-browser.mjs <local-url> --route=<name> --full`, `mall-courtyard-browser.mjs <local-url>` and `mall-smoke.mjs <local-url>` reproduce Chrome checks. Run native courtyard/pool tests before their browser replays. Set `PLAYWRIGHT_MODULE` to the installed module when it is outside the repo.

## Remaining fidelity work

The main obstacle sequence and playable routes are reconstructed, but exact original metric dimensions and timings remain unverified. The source guide's wallride/jump approach to the mezzanine still needs a dedicated native-input check. Architectural contours, storefront massing, source materials, directory/glass break-through presentation and remaining silhouette differences need a final comparison. The goal remains active; playable route tests alone do not establish a 1:1 recreation.
