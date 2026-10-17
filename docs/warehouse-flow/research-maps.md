# THPS spatial study for Warehouse / Five Lines

Research conducted for the request to improve flow, arrangement and readability. This is a design study, not proof that the revised level is good. Browser playtesting must prove the resulting geometry.

## Evidence and limits

The reference target is the console THPS 1/2 maps and their 1+2 versions, not the substantially different GBA maps. Six original-map renders were visually inspected in a browser: Warehouse, Hangar, School II, Marseille, Burnside and Chicago Skate Park. These are original game geometry presented and annotated by VGCartography, hosted by VGMaps; they are useful spatial artifacts but are neither Neversoft design documents nor surveyed metre-scale plans. No dimensions below are claimed to be original THPS measurements.

Two 1+2 gameplay recordings were sampled in a browser, including Hangar at 0:35, 0:37, 0:40, 0:45, 0:47, 0:50, 0:52, 0:55, 1:00, 1:05, 1:10 and 1:15, and School II at 1:08. The expanded Hangar sampling follows one scoring session through its bank-out; it is not a claim of continuous frame-by-frame viewing or full-video review. Written gap/objective guides cross-check names and connections. Primary developer interviews establish design intent only where the developer actually states it. All recommendations are our interpretation.

### First-party and developer evidence

- [Mick West, CoRecursive, “Code, Kickflips and Crunch Time”](https://corecursive.com/game-programming-with-mick-west/), section beginning 37:31: the early downhill prototype ended at an open area with a small halfpipe. Testers remained there experimenting instead of restarting. West says the game shifted toward skating around a level. **Implication:** the session itself has to be rewarding before objectives supply a reason to travel.
- [Ralph D’Amato, October 2000 interview](https://planettonyhawk.gamespy.com/Viewf473.html?id=38&view=Articles.Detail): he explicitly distinguishes placing individual pipes/rails from arranging objects to invite a difficult-looking connection. He also describes demo feedback as important and removal of confusing trick text. **Implication:** evaluate relationships and clarity, not object count or theoretical reachability.
- [Josh Tsui, THPS HD interview](https://www.soundandvision.com/content/sv-interview-robomodo-president-josh-tsui-talks-tony-hawk-pro-skater-hd): original placement and scale were retained; improved visibility in School II let players anticipate lines rather than rely on old fog-limited memory. Extra pedestrians were rejected because they could obscure the next grind. **Implication:** sightlines are functional geometry. An ornate scene that hides the receiving surface harms play.
- [Activision’s Warehouse demo description](https://blog.playstation.com/2020/08/12/tony-hawks-pro-skater-1-2-warehouse-demo-everything-you-need-to-know/): manuals, reverts, spine transfers, acid drops, wallrides and wallplants are explicit combo connectors. **Implication:** ramps, flats and rails must be sequenced with the actual available movement model. Do not copy a THPS line that depends on a move this prototype does not implement.
- [Activision Tours documentation](https://support.activision.com/tony-hawks-pro-skater-1-2/articles/the-tony-hawks-pro-skater-1-2-tours): score, letters, object interactions, gaps and collectibles coexist; competition parks are a separate format. **Implication:** free session routes should remain useful after the five pickups are gone.

## Warehouse: a compact room with many readings

Sources: [original geometry map](https://www.vgmaps.com/Atlas/PSX/TonyHawk%27sProSkater-Warehouse.png), [1+2 objective and gap verification](https://www.pushsquare.com/guides/tony-hawks-pro-skater-1-plus-2-warehouse-all-park-goals-gaps-and-challenges).

**Observed structure.** The elevated entry feeds two wide slopes into a shared room. The halfpipe is a strong central mass, with an obvious secret room above it. Small kickers occupy the other floor region. Wall transitions point riders back into that room. Low rails, quarter-pipe coping, high rails and decks create several reachable heights without requiring a long access road. The map's gap connections include kicker-to-kicker, kicker-to-ledge, deck-to-rail, taxi-to-halfpipe and high-rail-to-lower-coping sequences. The tape asks for a specific halfpipe launch into the overhead room.

**Interpretation.** This is not five independent attractions scattered in a building. A single object is read as a ramp, obstacle, launch, landing and route divider. The halfpipe is large enough to orient around but does not consume every circulation option. Failure to reach a high line generally returns the rider to useful lower surfaces in the same session area. Higher skill changes which adjacent surface receives you; it does not chiefly increase travel distance.

**Application.** Put a recognizable halfpipe/hip combination near the main floor hub. Keep an outside ground lane and at least two cross-court connections. Give each elevated target a visible launch directly below or opposite it. The equivalent of the secret room should be an enticing local transfer, not the final stop after an entire building-length ramp and an elevator. Place the first reward where the initial overview makes its approach and receiving deck understandable.

**Do not copy blindly.** Warehouse's exact dimensions rely on THPS acceleration and air control. “Looks compact” is not a licence to crowd this prototype's slower steering. Work from measured approach time and turn radius.

## Hangar: two rooms, three dominant obstacles, one connected vocabulary

Sources: [original geometry map](https://www.vgmaps.com/Atlas/PSX/TonyHawk%27sProSkater2-Hangar-MulletFalls%2CMT.png), [1+2 recording by BenedictPlays](https://www.youtube.com/watch?v=G0lVkzgKEJU), [objective/gap verification](https://www.pushsquare.com/guides/tony-hawks-pro-skater-1-plus-2-hangar-all-park-goals-gaps-and-challenges).

**Observed structure.** Plane/halfpipe and helicopter zones sit side by side. The entry roll-in points at the halfpipe, its arched rail, and the far quarter-pipe. At 1:10 the recording shows the rail's exit facing a clear flat run-out and a visible quarter-pipe objective. At 1:15 the plane's wing is visibly part of a ramped passage rather than mere decoration. The divider has multiple traversable/transferable locations. Elevated lights form an additional connecting network. The plane, helicopter and halfpipe each support a named hangtime gap. The helicopter also opens the external tape area; another propeller opens the wind tunnel.

**Interpretation.** The two zones have distinct silhouettes while sharing a small movement grammar. A novice can skate around the aircraft; an intermediate rider crosses them; an expert uses overhead lights. Difficulty layers overlap in plan view. The room boundary itself supplies transfers, so changing districts can be a trick instead of dead travel. Landmarks explain route names and help retain orientation after a turn.

**Application.** Make our crane and loading dock functional spatial anchors. One readable split should offer a low line and a higher transfer, both returning to the same district. Put any high rail above an already useful floor line; missing it should reveal another skating opportunity. Join zones with a broad opening and an optional bank/rail transfer alongside it. The bridge should be crossable through, under and over where collision allows.

**Do not copy blindly.** Helicopter activation is a discovery payoff, not a prerequisite for all ordinary circulation. Avoid forcing a lift wait or scenery interaction into the main loop. Keep complex new triggers out of this geometry revision unless they materially improve the five-goal brief.

## School II: districts and shortcuts, not one enormous empty room

Sources: [original geometry map](https://www.vgmaps.com/Atlas/PSX/TonyHawk%27sProSkater2-SchoolII-SoutherCali.png), [1+2 recording by BenedictPlays](https://www.youtube.com/watch?v=wJtARfuwoLs), [objective/gap verification](https://www.pushsquare.com/guides/tony-hawks-pro-skater-1-plus-2-school-ii-all-park-goals-gaps-and-challenges).

**Observed structure.** The start branches into a stair/rail descent and the awning/library side. Connected courtyards provide different silhouettes: planters and covered benches, the library, the gym and lower buildings. The five letters follow a progression through neighboring courts; the roll-call objective names three specific rails. TC's roof gap links two low buildings. The tape is reached by building speed at a quarter-pipe and launching from a planter toward the library roof. Higher roofs, gym and Carlsbad area form additional branches. The 1:08 video frame shows low planter edges, the next quarter-pipe and nearby buildings together: objects define the space without hiding all its exits.

**Interpretation.** Large area becomes learnable through districts and identifiable connectors. A stair set, ramp and rail can share endpoints while asking different skills. Roofs provide a second reading of known ground, not a separate unrelated level. Objectives turn landmarks into navigational vocabulary. The core route still makes sense while a difficult roof challenge remains unsolved.

**Application.** If retaining substantial warehouse footprint, divide it into at most three useful session districts, each identifiable by a strong existing asset and a different obstacle silhouette. Connect adjacent districts directly. A high branch should cut a corner or return across familiar floor. At least three goals should have independent approaches from normal floor skating, so failure on one does not invalidate work on another.

**Do not copy blindly.** The timed gym opening is obscure to an unbriefed player. Our brief prioritizes readability; use a visible opening and local clue instead of importing a hidden timing dependency. Do not reproduce School II's size without its density of meaningful surfaces.

## Marseille: continuous terrain with optional longer chords

Sources: [original geometry map](https://www.vgmaps.com/Atlas/PSX/TonyHawk%27sProSkater2-Marseille%2CFrance.png), [1+2 gap verification](https://www.pushsquare.com/guides/tony-hawks-pro-skater-1-plus-2-marseille-all-gaps-and-collectibles), [contemporary console guide](https://planettonyhawk.gamespy.com/View8305.html?id=3&view=thps2_faqs_guides.Detail).

**Observed structure.** The main irregular pool connects to a group of smaller rounded bowls. Hips and humps intervene between nearby transitions. A flatter street area with small stairs, curving rail, funboxes and dumpsters sits alongside; it is not miles away. The conspicuous crossbar spans the central transfer region. Gap pairs include rail-to-ledge, rail-to-box and box-to-box, while major air gaps traverse the pool mouth or crossbar. The same narrow extension supports increasing height thresholds. The secret fountain sits outside the main competition terrain and is unnecessary for an ordinary session.

**Interpretation.** Curved ground does much of the routing. The easy option follows the terrain; the hard option cuts across it. Several difficulty levels use the same visible destination. Boundary and coping are active surfaces, so turning around is productive. The perimeter deck offers an alternate street route close enough to re-enter the bowls. The important distinction is between a continuous transition network and a decorative round island with empty floor around it.

**Application.** Keep the lower lap continuous and make its corners usable banks/quarters. Build one central hip whose different faces actually point toward adjacent receiving surfaces. Offer a short chord through the loop for expert transfers. Put the street line beside the bowl with shared entry/exit space. A miss should take the longer low route rather than wedge the rider against a slab side.

**Do not copy blindly.** A full closed perimeter bowl around a huge room is only a boundary, not an interesting session. Avoid making a 500-metre coping lap the strongest uninterrupted combo solely because all interior objects are disconnected.

## Diagnosis of the current source

Read directly from `src/levels/codex-lab.ts` before redesign:

- The room is 176 × 252 metres, with a 48-metre shell. The three floor islands cluster near the center while the long service climb runs near the right edge. Much of the distance between landmarks offers no authored connection.
- The service route travels from approximately `(60, 0, -43)` to `(40, 18, -160)` before the loft transfer. The next goals depend on 28-metre gantry and 32-metre roof paths. The five stated challenges collapse into two floor branches followed by a three-stop vertical progression.
- The source already contains good local ingredients: dock launch/landing, halfpipe, low banks, curved rails, catch terrace and safe floor. The failure is predominantly arrangement: the parts do not consistently hand speed and sightline to one another.
- Gate and spawn share an 8-metre balcony. Returning to the finish requires re-solving an access route even after the goals. A finish position near the floor hub would make completion readable and preserve optional return-to-balcony skill play.
- Greybox route arrows carry too much responsibility. Arrows cannot repair a receiving deck hidden by another deck or a rail that exits toward an unrelated obstruction.

These are source-level findings. They do not establish precise steering, speed, camera occlusion or collision behavior; measure those in the actual runtime.

## Proposed spatial grammar

These are original recommendations for this prototype, not numerical claims about THPS.

1. **Three session loops, several short crossovers.** A central street figure-eight, a compact vert loop and a dock transfer loop should overlap at clear decision areas. Each loop should include at least three meaningful obstacle beats and allow continuation in either direction. A rider should be able to abandon a collectible attempt and resume a combo locally.
2. **Every important object has a predecessor and successor.** Author run-up → takeoff/rail entry → action → receiving surface → run-out → next choice as one unit. Keep the first straight portion of the run-out clear. Offset supports, pillars and decoration out of these envelopes rather than hoping collision handling saves them.
3. **Low route always works; higher route shortens or enriches it.** Ground travel connects the districts. The optional high route adds a transfer, grind or elevated manual and then rejoins. Do not require a slow lift, 180-degree stop or walking through an awkward seam to stay in the main skate flow.
4. **Five rewards test five different relationships.** Candidate briefs: dock gap with broad receiver; halfpipe-to-gallery air or coping transfer; raised rail transfer over a safe floor; short manual/ledge sequence; diagonal hip-to-crane shelf transfer. Distinct difficulty should come from approach, alignment and timing, not five copies of “climb farther.” Keep each challenge's failure route skateable.
5. **Read the receiver before commitment.** From the competition camera at the approach, the launch edge and destination must both be identifiable. At landing, show either the next obstacle or a clear turn. Use silhouette, edge contrast and existing landmark props; do not solve this by changing the requested camera.
6. **Limit competing visual information.** Keep hero props at district boundaries, backgrounds or deliberately skateable landmarks. Protect the foreground approach zone. Reuse current original-material wall sections; no new self-authored large texture tiles and no further paid asset spend required.
7. **Walking remains a valid choice.** Board mounting is optional, but the skating route must work without dismounting. Check pedestrian access and competition-camera framing separately; walking should not switch the level into a different camera or become a workaround for broken ramps.

## Verification that would prove an improvement

| Concern | Required evidence |
| --- | --- |
| First impression | Full-render competition-camera approach capture shows a useful first move, one main landmark and a second route choice without a briefing. |
| Flow | Three uninterrupted loops driven from actual inputs, each with at least three distinct obstacle connections and no unplanned stop, reset or dismount. Test both directions where claimed. |
| Combo continuity | Input-driven sequences connect air → landing/manual or grind → another obstacle using implemented mechanics. Mere nav-point reachability is not evidence of a combo. |
| Five goals | Each goal has a recorded floor-access approach, the actual precision action, pickup and a continuous exit. Record which goals can be attempted independently. |
| Recovery | Deliberately undershoot, overshoot and miss laterally at every goal; recover to a useful skating line without collision trapping or manual respawn. |
| Readability | Compare identical competition-camera viewpoints before/after. Check that clutter and overhead structures do not hide the near landing or next rail. |
| Scale | Measure time between useful actions, not only world size. Long empty coasts are defects unless they provide necessary setup for a clearly visible upcoming action. |
| Stability | Keep replay-collision coverage, supported spawn, all five pickups, checkpoint reset, gate, optional walking and graphics/context recovery. |

Passing old waypoint tests only proves the old traversal contract. The revised course needs tests that exercise its new adjacency, actual combo transitions and miss recovery. Artist screenshots or an overhead plan alone cannot prove the user's requested feel.

## Additional comparison: Burnside

Sources: [visually inspected original geometry](https://www.vgmaps.com/Atlas/PSX/TonyHawk%27sProSkater-Burnside.png), [1+2 named-gap cross-check](https://www.pushsquare.com/guides/tony-hawks-pro-skater-1-plus-2-burnside-all-gaps-and-collectibles).

**Observed in the map.** A broad central floor connects surrounding transitions, a raised circular pool, a smaller hump and a funbox. Bridge columns constrain particular corridors; the floor continues around them. Coping changes curvature, height and direction. The small ramp and rectangular pool face each other. The circular pool sits beside a tall wall transition, with ground-level routes around their mass.

**Documented connections.** The funbox launches through or onto a bridge support; the small ramp transfers into the rectangular pool; the circular pool transfers toward the tall quarter-pipe; greater speed carries over the circular pool. These use the same few objects at different reach levels. Three adjacent barriers also form a grind sequence.

**Inferred adjacency graph** (arrows mean a spatial opportunity, not a claim that a particular run was observed):

```text
central floor → small ramp → rectangular pool → its transition → central floor
central floor → funbox → bridge opening / bridge grind → central floor
central floor → circular pool ↔ tall transition
                            ↘ longer air across pool → floor
outer ledge → barrier 1 → barrier 2 → barrier 3 → outer transition
```

**Design consequence.** The big floor is useful because its edges and central objects propose destinations across it. Borrow this relationship, not merely “put a bowl in a large space.” A bridge column must sit beside a launch/landing envelope or form an explicit visible obstacle; scattered unavoidable support collisions are not equivalent to Burnside's authored bridge challenges. Low misses have a possible floor receiver, but the diagram alone cannot prove they avoid every column or landing bail.

## Additional comparison: Chicago Skate Park

Sources: [visually inspected original geometry](https://www.vgmaps.com/Atlas/PSX/TonyHawk%27sProSkater-SkatePark.png), [1+2 named-gap cross-check](https://www.pushsquare.com/guides/tony-hawks-pro-skater-1-plus-2-skate-park-all-gaps-and-collectibles).

**Observed in the map.** A kidney pool occupies one side, a halfpipe another. Funboxes, a low wall/rail pair and raised rails occupy the middle; wall transitions and a walkway surround them. Rafters run above the sessions. These are separate recognizable shapes with open ground connections, rather than separate floors requiring a climb sequence.

**Documented connections.** Pool-to-walkway, pool-to-raised-rail and walkway-to-raised-rail create a small network around the same landing structures. The halfpipe's outside quarter-pipe launches toward its interior, hanging light or rafter, with a longer air clearing the whole pipe. A wall and adjacent rail provide different heights of the same lateral jump.

**Inferred adjacency graph:**

```text
pool ↔ walkway → raised rail pair → center floor
  ↘ pool hip ↗                  ↘ funbox → wall transition
center floor → halfpipe outside quarter → halfpipe → center floor
                                      ↗ light / rafter grind ↘
center floor → low wall or lower rail crossing → center floor
```

**Design consequence.** A recognizable quarter-pipe can be an entry, reversal and launcher to several skill layers. Our gantry should be a destination from nearby active terrain and offer a controlled drop back to it. It should not need a remote service-road commute first. Leave the center-floor alternatives visible between objects. Preserve the distinction between ordinary low circulation and a deliberate high-risk rafter attempt; neither the original map nor a guide proves every high miss is harmless.

## Prototype constraints: copy relationships, not trajectories

The following comes from the current project source, inspected directly: `src/carveGrip.ts`, `src/skateSteering.ts`, `src/tuning.ts` and the corresponding ride/air/revert/transfer code in `src/player.ts`. These are default-source calculations, not measurements of the user's browser tuning or live performance. The replay compatibility curve may deliberately differ.

### Steering envelope

Dry-ground grip blends linearly from 360 degrees/second at rest to 60 degrees/second at the 23 m/s maximum charging speed; higher speed holds the 60-degree endpoint. For constant speed and maximum steering, the ideal planar radius is `r = v / radians(grip(v))`:

| Speed | Turn-rate limit | Ideal radius | Travel for a 90-degree turn |
| --- | ---: | ---: | ---: |
| 12 m/s cruise | 203.5 degrees/s | 3.38 m | 5.31 m |
| 18 m/s | 125.2 degrees/s | 8.24 m | 12.94 m |
| 23 m/s charged | 60 degrees/s | 21.96 m | 34.50 m |
| 30.5 m/s downhill ceiling | 60 degrees/s | 29.13 m | 45.75 m |
| 32 m/s transition ceiling | 60 degrees/s | 30.56 m | 48.00 m |

These are lower-bound geometry estimates, not guaranteed drivable radii. Slopes, acceleration, friction, steering onset, contact projection and camera-relative input change a real run. A six-metre bend may work beautifully at cruise and fail at full charge. Therefore validate high-speed loops separately; do not make every corner tight and compensate by retuning movement.

Input also distinguishes a screen-back pull against forward travel from lateral or diagonal carving. The former brakes and eventually dismounts when walking is allowed. A proposed “turnaround” that requires pulling straight back is not equivalent to an uninterrupted skate turn. Use a transition return, a sufficiently broad carve or a tested grind connection when promising uninterrupted flow.

### Available connectors and important differences

| Mechanic | Current implementation evidence | Level-design consequence |
| --- | --- | --- |
| Ground ollie | Default tap/full vertical velocities 6.5/11; 0.4-second full charge. Source comments report roughly 0.56/1.68 m peaks for those flat-board cases. | Low ledges need the right launch. Do not assume a casual tap reaches every metre-high box. A full charge consumes about 9.2 m of travel at 23 m/s. |
| Committed board air | The ordinary steering branch excludes skatepark board airs; the default air-control tuner is also zero. | Point the launch at the receiver before commitment. A spin is not a midair route correction. Widen landing tolerance instead of relying on late air steering. |
| Rail-to-rail ollie | Direction held before release adds lateral speed, default 4.8 m/s at full charge; tap gets 80%. Later airborne direction does not steer this impulse. | Offset receivers require a planned departure. A rail crossing on a map is not automatically a transferable connection. |
| Manuals | Entry speed 3.5 m/s; 0.65-second landing link grace, 0.35-second airborne arm window and 0.45-second small off-ground tolerance. | A few metres of flat can connect actions, but a long empty stretch is still active balance work. Test the input transition, not just the existence of floor. |
| Revert | Supported after a vert-air touchdown; the player opens a 0.3-second opportunity and retains 88% of speed after the pivot. | Halfpipe-to-manual combinations are valid candidates, but repeated reversals consume momentum. Give them useful nearby exits. |
| Wallride / wallie | Supported, with 7.5 m/s minimum movement magnitude, one wallride per airtime until ground/rail re-arms it, and an explicit wall kick. | Test one local wall-to-rail or wall-to-deck link. Do not assume unlimited wall-to-wall catches. |
| Adjacent spine transfer | Requires a second release attempt in vert air, a compatible neighboring halfpipe mouth, correct axis/overlap and held direction over the lip. | Two visually neighboring custom meshes do not necessarily support this mechanic. Validate the actual registered halfpipes. |
| Generic THPS wallplant / acid-drop behavior | The inspected source does not establish a general equivalence to the 1+2 commands. Transition catches exist, but that is not proof of every reference trick. | Do not build required line continuity around those THPS commands without a separate implementation-level and input-driven check. |

Walking, the requested competition camera and the current movement tuning remain constraints. They are not variables to change merely to make a copied reference trajectory pass.

## Longer Hangar sequence: approach, connection and return

Source: [BenedictPlays, Hangar, scoring section starting 0:32](https://www.youtube.com/watch?v=G0lVkzgKEJU&t=32s). The sample ledger below records actual inspected frames and HUD state. The source map above provides spatial context. Paused snapshots cannot establish every intervening input; the exact trajectory between them is an inference.

| Timestamp | Direct observation |
| --- | --- |
| 0:35 | Halfpipe approach with the opposite wall transition visible ahead. |
| 0:37 | Flat-floor landing; HUD confirms halfpipe clearance. |
| 0:40 | Raised perimeter grind; HUD includes a manual and grind after the air. |
| 0:45 | Lower quarter-pipe coping grind; HUD confirms a rail drop. |
| 0:47 | Air above open floor beside the aircraft; HUD confirms the room-boundary gap. |
| 0:50 | Low receiver; HUD includes acid drop and revert. |
| 0:52 | Halfpipe transition; HUD includes lip, stall, another clearance, revert and manual. |
| 0:55 | Halfpipe coping/air region; accumulated list includes a wallplant. |
| 1:00 | Free floor, combo banked at 861,756. |
| 1:05 | Skater still on unobstructed floor near the halfpipe. |

The useful lesson is a repeatable relationship, rather than the score. A landing starts the next approach. A lower edge receives a higher edge. A boundary crossing returns to a familiar session. Open floor remains available to deliberately end the combo.

### Adjacency reconstruction

`→` below is supported by sampled positions plus accumulating trick text; it does not claim observation of every metre. `⇢` is an additional map-derived option.

```text
halfpipe launch → floor landing/manual → perimeter grind
                    ↑                       ↓
            return to session ← lower coping/rail drop
                    ↓                       ↓
             halfpipe lip/air ← boundary transfer + low receiver
                    ↓
             coping/air → open floor → bank or choose next approach

open floor ⇢ plane-wing line ⇢ neighboring room
open floor ⇢ entry-side quarter ⇢ another approach to halfpipe
```

This is an intersecting movement network, not a route that needs to reach the room's far end before it becomes useful again. The flat is an intersection between a rail exit, halfpipe approach and aircraft line. A rider can change the session there without a menu, checkpoint warp or long access ramp.

### Commitment and reversals

The 0:35 view exposes an opposing transition before the first clearance. At 0:40 and 0:45, the coping continues visibly ahead while the lower surface remains available alongside it. The 0:47 view shows broad floor around the aircraft receiver. These moments support early route decisions. The 0:50 and 0:52 framing is more downward and local; do not cite this recording as proof that every future destination is always visible.

The trick text verifies reverts and a wallplant in the session. Those provide local direction changes within the combo, whereas a 180-degree turn on flat requires space and steering time. For this prototype, substitute only a connector proven by its own controls: its revert exists, while generic THPS wallplant equivalence has not been established. A layout relying on wallplant reversal at the end of every rail would be an unsupported transplant.

### Missed-attempt return audit

No failed attempt was observed in this successful sequence. The following are **candidate failure outcomes inferred from geometry**, to test in our level rather than describe as witnessed THPS behavior:

- Underreach on a high rail can fall to the lower coping or transition; avoid a narrow inaccessible slit between them.
- A missed halfpipe clearance has a lower trough/transition as a possible receiver; whether it lands cleanly depends on angle, speed and trick completion.
- A lateral miss from a straight rail can land on adjacent floor; this stops being a safe alternative when a support, prop or steep slab face occupies that lane.
- An overshoot must have enough floor for the actual speed, followed by a usable turn or transition. “There is ground below” is insufficient if the rider hits the enclosing wall immediately afterward.

The revision should record these failures with real input. A successful collectible route and an overhead catch-floor diagram cannot substitute for that evidence.
