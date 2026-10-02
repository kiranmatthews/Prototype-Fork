# Side-view crate courses: layouts and all-box solutions

These three original side-view courses translate the resource and action-order relationships in [the research dossier](PLATFORMER_PUZZLE_RESEARCH.md) into the fork's existing movement and crate toolkit. They are available immediately on the existing **Island 2** main map and Level Select, and as direct `?playtest&level=...` links. Clearing the exit and earning the all-box gem are different goals, as in Crash. The intended perfect routes below collect every breakable crate and both/four checkpoint boxes.

| Course | Breakable boxes | Checkpoint boxes | Main ordering demand |
| --- | ---: | ---: | --- |
| Crate Primer | 20 | 2 | Use a wooden arrow before consuming it; reach the upper key before crossing its outline bridge. |
| Switchyard | 24 | 2 | Collect upper targets before collapsing finite supports; activate an upper return route before going back for it. |
| Clockwork Gauntlet | 32 | 4 | Retain a launcher across two separate state changes: clear Nitro, activate the far circuit, then return for the final high row. |

The table counts the main route only. Each course now has a dedicated themed bonus reached through a final-court alcove: Apprentice Storehouse (6 boxes), Signal Cabin (9), and Furnace Reserve (10). Complete-course all-box totals are therefore 28, 35, and 46; an ordinary main-route finish does not earn that gem without the linked bonus. See [bonus stages and return flow](BONUS_FLOW.md).

The counts exclude ordinary metal, metal arrows and permanent switches. TNT and Nitro count. The linked bonus count comes from its actual authored layout. Campaign crystal placement remains the normal shared behavior.

## Exact source maps

These are generated from the actual level components, in world metres. They show authored starting positions; crates may fall, disappear or materialize during play. Dashed surfaces and boxes begin absent. They are original layouts, not claimed pixel-perfect copies of commercial levels.

| Course | Whole route | Dependency rooms |
| --- | --- | --- |
| Crate Primer | [Overview](puzzle-maps/crate-primer-overview.svg) | [Conserve the launcher and reach the key](puzzle-maps/crate-primer-key-room.svg) |
| Switchyard | [Overview](puzzle-maps/switchyard-overview.svg) | [Upper-before-lower finite stack](puzzle-maps/switchyard-upper-first.svg), [outward switch and upper return](puzzle-maps/switchyard-return-room.svg) |
| Clockwork Gauntlet | [Overview](puzzle-maps/clockwork-gauntlet-overview.svg) | [Fuse tower](puzzle-maps/clockwork-gauntlet-fuse-room.svg), [Nitro clear and second return](puzzle-maps/clockwork-gauntlet-double-return.svg) |

Regenerate with `node tools/render-puzzle-maps.mjs`. Source lives in [puzzle-trilogy.ts](../src/levels/puzzle-trilogy.ts); `PUZZLE_ACTIONS` and `PUZZLE_SECTIONS` describe intended actions without driving gameplay.

## Crate Primer

The opening boxes are on permanent floor. The grunt admits spin or stomp; the turtle rejects a spin; the later spiker rejects a stomp. These are distinct action choices, rather than three differently painted contact hazards.

At **x35**, the wooden arrow is the height resource for the visible life box at **bottomY9.8**. Bounce first and collect the high target. Return to permanent floor, then destroy the arrow. Spinning the arrow first spends the tool before claiming its dependent reward. The next crossing is now two upright timber leaves at **x42** and **x50**, with a safe stone pier between them. Spin each timber directly, wait for it to settle horizontally, and cross the permanent footing. The wooden rewards sit on the route you have changed; checkpoint59 banks both deployed bridges.

At **checkpoint59**, bank the completed first section before attempting the mandatory key room. The arrow at **x63, bottomY0.6** leads to the thin shelf at **topY8**, spanning **x66–74**. Collect the two upper boxes and hit **!72**. That switch makes the **x80–100** bridge real. Return left, remove the conserved arrow, then cross. This separates three actions that initially look equivalent: jumping on a crate, attacking a crate, and activating a switch. Only the correct ordering retains access to both the route and every box.

After **checkpoint104**, the TNT/wood/TNT cluster at **x107,109.4,111.8** permits selective collection and a fuse retreat. The wood lies far enough from either TNT for a deliberate centered spin; a blast later clears the cluster. Read the next landing before lighting the fuse. Use the permanent arrow at **x121** for the gap, defeat the spiker using the compatible attack, and hit the green switch at **x138** to clear all three Nitro before the final reward and exit.

## Switchyard

The opening two striped crates share **x5**, with bottoms **0** and **0.96**. They are finite supports for the overhead life at **9**. Reach the upper target while both supports exist, then clear the striped crates. Repeated bounces decrement the support's hit budget; a spin clears it immediately. The puzzle does not pretend five bounces are mandatory when the shared rules allow another attack.

An ordinary stepping box and a short jump reach the admission life perch; there is no second arrow nearby to erase the finite-stack height budget. The spiker on the first switch balcony cannot become a convenient stomp launch. Keep **arrow32** until the high shelf **x34–40, topY9** has been reached, its reward collected, and **!38** activated. The resulting bridge connects to the paired turtle/spiker lesson and **checkpoint78**.

On the upper workshop, the TNT at **x101, bottomY2.8** supports wood at **3.76**. The high life box at **11.8** should be collected using the intact upper support before removing the stack. Lighting the fuse before planning that ascent starts spending the same support needed to reach the cap. Escape onto permanent floor and let the explosion settle, then read the spinner's opening. Spin the workshop drawbridges at **x120** and **x126.5** into horizontal footing, using the middle pier between them. They remain open for the return trip.

At **checkpoint134**, begin the return puzzle with **arrow136** intact. First travel right to **!147**. It materializes both the onward bridge **x151–169** and the high return shelf **x138–145, topY11.2**, with three upper boxes floating at **bottomY12.4**. Go back to the arrow, use it to claim the new upper row, descend, and only then destroy the arrow. Continuing straight over the new bridge gives an ordinary clear route but leaves a deliberate all-box task behind. A charger, green clearing switch, crumble crossing and final attack-rule reprise complete the course.

## Clockwork Gauntlet

The opening arrow and overhead life reprise the preservation rule. A relay of metal arrows and a breakable cap then leads to **checkpoint41**. The TNT/wood/TNT column at **x47** has an overhead life at **9.8**. The intact top TNT supplies the extra starting height; its fuse is a commitment window, not an instruction to attack indiscriminately. Claim the upper target and reach refuge before the supports disappear. Activate the local circuit and bank at **checkpoint80**.

Turtle and spinner timing precede two phase crossings. **Lit pads are solid; dark pads are absent.** Their phases are half a cycle apart, with a permanent rest island between them. Observe from supported floor, use a solid window, and leave before the warning ends. The upright timbers on the far edges of the phase gaps can be jump-spun into permanent return shortcuts. They cover the otherwise cycling footing once deployed. A charger and vertical receiver lead to another outward/return circuit: conserve **arrow162**, activate **!170**, return for the new upper boxes at **bottomY13.6**, above a shelf at **topY12.4**, then clear the arrow.

The final dependency loop begins at **checkpoint195**. Keep **arrow216** for two jobs:

1. Reach the high green switch at **x221, topY12.4**. It clears the entire three-wide, three-high Nitro wall at **x225–227**.
2. Drop, collect the reward at **x232**, and advance to the separate **!233.5**. It creates the high return gallery spanning **x200–211**, with three floating boxes at **bottomY13.6** above the **12.4** shelf. Clear any surviving final TNT and defeat the sentry at **x249** before the return trip; this removes its projectiles while the launcher remains intact.
3. Return left using the still-intact arrow. Clear the upper gallery, come back right, and destroy the arrow last.

The late switch is outside the Nitro and final TNT blast reach: the green clear must not silently activate it from afar. The high galleries also account for the fork's ledge grab and the extra launch height of a permanent `!` box; a simple ground jump onto a nearby switch must not erase the resource dependency. The final section combines familiar TNT selection, a sentry telegraph, finite footing and a permanent finish landing. Defeating the sentry before the backward sweep is a deliberate enemy-order solution; another route may dodge its shots instead.

## Retry and verification

Death restores the current checkpoint's saved crate and switch state. A checkpoint before a room permits a local retry. Banking after an incomplete all-box section preserves that choice, so restart the level for a fresh perfect attempt. This is documented because an ordinary finish remains possible after some all-box failures.

The focused pilots feed ordinary input into the production Player and Level. They check actual crate survival and destruction, not merely the HUD number. Separate negative runs exercise early support destruction, native ledge reach, explosive state changes and respawn. The real Chrome pass also checks the rendered character's framing and console errors, in lite and full rendering. Level validation, campaign selection checks and the production build complete the handoff; the full regression suite is not part of normal publication.

Research and testing exposed a shared tally defect: explosions queued an intact ordinary metal crate as a broken-box reward. The same error occurred when a spun enemy struck steel. Both narrow fixes queue only crates actually destroyed. The regressions light a real TNT fuse and spin a real enemy into a steel/wood row; wood counts while steel survives without inflating the tally. Movement tuning remains unchanged.

Bonus-stage all-box gems now appear on the supported approach before the finish pad. The old tangent placement put them outside a one-line course's depth boundaries, so clearing all boxes could finish without awarding the gem. A real-input regression checks collection before finish; ordinary wide-course placement is unchanged.

The courses now use the normal shared eastbound side-scroll camera: the custom fixed view, enlarged follow distance and authored airborne-follow override have been removed. Spin-deployed timber changes stay latched during the run and are banked at checkpoints; a fresh run restores the starting layout. The Great Gate inspired the direct plank interaction; this deliberately persistent version follows the requested change rather than copying its temporary N. Sane timing.

The earlier full-motion evidence describes the initial layouts. The camera/hinge follow-up was checked with the focused spinbridge contact/rotation/walk/checkpoint smoke and a normal-POV browser view; it did not rerun the full course matrix.
