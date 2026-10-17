# THPS design research: implications for Warehouse / Five Lines

Research date: 17 October 2026 (Pacific/Auckland). This is a design investigation for a substantial course rebuild, not evidence that a rebuild has passed. The competition camera, optional walking, five difficult collectibles, authored movement model and existing purchased artwork are constraints. No new large-surface texture tiles are proposed.

## Evidence and interpretation

The source notes below distinguish **developer testimony**, **direct visual observation**, and **our design inference**. Interviews describe intent and experience; they do not independently establish that every released map succeeded. Promotional screenshots establish visible arrangement, not traversal times, exact dimensions or collision quality. Numeric targets later in this document are proposed criteria for this prototype, not discovered Neversoft standards.

### 1. The foundational experiment favored repeatable spots over a journey

**Developer testimony.** Mick West describes an early downhill prototype whose testers stayed in the small ramp area at its bottom for roughly twenty minutes instead of restarting. The team changed direction toward levels players could circulate within. He also recalls designing School on a whiteboard around a schoolhouse, stairs/rails, a pool and walls, then adding challenges. [CoRecursive, interview with Neversoft cofounder/lead programmer Mick West, sections 37:31–44:24](https://corecursive.com/game-programming-with-mick-west/).

**Implication.** Build several spots that remain fun after their collectible is taken. An enjoyable traversal to a destination is insufficient if arriving finishes the interesting part. Test the park with collectibles ignored as well as with them pursued.

### 2. Recirculation and risk are part of the original design

**Developer testimony.** West describes open traversal in School and Downtown, identifies Mario 64 as an influence, and discusses the adoption of points held at risk until a successful landing. His favorite example of a sustained line is a repeatable rail loop in THPS3 Los Angeles. [Official PlayStation Magazine interview republished by GamesRadar, 2019](https://www.gamesradar.com/tony-hawks-pro-skater-making-of-20-years-old/).

**Implication.** A useful loop offers decisions about continuing, changing direction and cashing out. It is not just a ring-shaped rail that mechanically repeats one action. Provide smooth exits and cross-links so the player chooses the duration and shape of a run.

### 3. Free skating and linking changed the map requirements

**Developer testimony.** Tony Hawk says THPS2 omitted downhill levels because they restricted free skating in a game without racing. He identifies manuals as the missing connection between tricks, and describes Skate Heaven as a collection of memorable real skate spots. [Planet Tony Hawk, retrospective THPS2 Q&A with Tony Hawk](https://planettonyhawk.gamespy.com/Viewa087.html?id=21&view=histories.Detail).

**Implication.** Transport that only leads forward suits a race better than this warehouse. Meaningful destinations should also be reusable connections. Named spots should be recognizable pieces of architecture with a distinct trick opportunity, rather than identical remote shelves differentiated only by numbers.

### 4. School II is an example of a sequence, not an object collection

**Developer testimony.** Josh Tsui describes revisiting a School II opening line involving a kicker, wallride/bell, canopy grind, glass and rooftops. He also says longer draw distance lets players plan lines earlier, and that Robomodo excluded extra pedestrians because even noncolliding characters could hide the next grind. Geometry placement and scale were deliberately preserved during that remake. [Sound & Vision, Josh Tsui interview, 30 May 2012](https://www.soundandvision.com/content/sv-interview-robomodo-president-josh-tsui-talks-tony-hawk-pro-skater-hd).

**Implication.** Place elements as a short sentence of actions: approach, commitment, landing, continuation. Show the next usable surface before the player commits. Decoration belongs outside that visual sentence. This does not mean copying School II's exact route or assuming this prototype has identical wallride physics.

### 5. Vert and street should belong to one combo system

**Developer testimony.** Activision's official Warehouse demo explanation identifies the revert into a manual as a means of continuing a vert landing into another trick; lead designer Leo Zuniga says reverts were intended from the beginning of the remake. [PlayStation Blog, Activision editorial, 12 August 2020](https://blog.playstation.com/2020/08/12/tony-hawks-pro-skater-1-2-warehouse-demo-everything-you-need-to-know/).

**Developer testimony.** Jen Oneal explains that Vicarious Visions expanded the first two games' trick library to support the long lines players expected, while keeping an exaggerated but plausible skating world. [Press Start, Vicarious Visions studio-head interview, 13 May 2020](https://press-start.com.au/features/2020/05/13/we-chatted-to-the-vicarious-visions-studio-head-about-the-return-of-tony-hawks-pro-skater-1-2/).

**Implication.** The halfpipe must have deliberate entries and departures into street play. Landing from a good air should reveal another action, not a long featureless cruise. Use the prototype's existing combo rules; do not retune movement to rescue poorly spaced geometry.

### 6. Collision semantics are authored level design

**Developer testimony.** Andy Gentile's own THPS1+2 portfolio describes guiding collision layout/flagging and maintaining skater behavior expectations across the remake. His Proving Ground account includes transition design, collaboration across connected zones, wallride/vert flags, grind nodes and accessibility-oriented collision work. [Gentile: THPS1+2](https://andygentile.com/tony-hawks-pro-skater-1-2-2019-2020/), [Gentile: Proving Ground](https://andygentile.com/tony-hawks-proving-ground-2007/).

**Implication.** A surface that looks like a launch, ledge or grind must behave consistently. Decorative steel cannot randomly snag a line. Ordinary native skate edges retain their grind policy. Collision should be inspected during blockout and after dressing, not treated as a final cleanup pass.

### 7. Modern detail can damage a good line

**Developer testimony.** Mike Rossi describes skater handling and level collision as an inseparable foundation, with targeted additions such as grind lines and gap adjustments built on that foundation. [Official Xbox Podcast interview with Rossi and Kurt Tillmanns](https://news.xbox.com/en-us/podcast/dropping-in-on-tony-hawks-pro-skater-34-official-xbox-podcast/).

**Developer testimony.** In a separate interview he specifically asks whether new lights or environmental detail change how players read a line or navigate. Adapting THPS4's larger spaces required iterative work on where goals begin and how players naturally reach them. [Press Start, Iron Galaxy interview, 9 May 2025](https://press-start.com.au/features/2025/05/09/we-got-to-chat-with-iron-galaxy-about-bringing-tony-hawks-pro-skater-34-to-life/).

**Implication.** Readability is a layout, lighting and collision responsibility. Keeping camera code unchanged is necessary here, but insufficient: geometry has to work within the view that camera actually provides. Check normal moving views, not just editor cutaways or hand-picked cinematic angles.

### 8. Objectives are invitations to reinterpret the same space

**Developer testimony.** Tillmanns describes the series as a sandbox with varied player expression and goals completed in different orders. He also discusses the fantasy of skating normally forbidden real spaces alongside deliberately impossible locations. [Game Developer interview, 2025](https://www.gamedeveloper.com/design/recreating-the-freedom-and-fantasy-of-tony-hawk-s-pro-skater-3-4).

**Implication.** Five collectibles should suggest five distinct feats and reveal five useful pieces of the park. Avoid making three of them merely consecutive stops on one long ascent. Preserve player choice of order, approach and return wherever the challenge allows.

### 9. School's environmental identity is also its route vocabulary

**Developer testimony.** Environment artist Anthony Garcellano describes working from an updated School blockout. His listed features include awnings, a skybridge, rooftop ramp and rails, rooftop-to-awning pipes, and basketball-court surroundings. [Garcellano's School 1 production portfolio](https://garcellano.artstation.com/projects/68wkD5).

**Implication.** The warehouse should be describable through places: loading dock, central press/hoist, bowl, workshop mezzanine, roof bay. Each should have a different silhouette and action vocabulary. This gives players a mental map without flooding the screen with labels or colored arrows.

### 10. Foundry demonstrates layered density in a readable industrial room

**Direct visual observation.** Three official Foundry screenshots were opened and inspected. They show low banks/hips around a bright furnace/press area, perimeter decks with direct slopes, open sightlines across much of the floor, and slender catwalks above. The high routes are overlays rather than a single opaque upper floor. Strong warm machinery and cooler shell light distinguish depth and destinations. The publisher also describes ramps integrated into industrial forms and a helix room. [Official Foundry page](https://www.tonyhawkthegame.com/blog/2025/06/tony-hawk-pro-skater-three-four-foundry-demo), [overview image](https://www.tonyhawkthegame.com/content/dam/atvi/tony-hawk/blog/chicago/foundry-demo/THPS-DEMO-003.webp), [floor image](https://www.tonyhawkthegame.com/content/dam/atvi/tony-hawk/blog/chicago/foundry-demo/THPS-DEMO-004.webp), [vertical image](https://www.tonyhawkthegame.com/content/dam/atvi/tony-hawk/blog/chicago/foundry-demo/THPS-DEMO-005.webp).

**Inference.** Borrow the relationship between visible floor, local level changes and compact upper overlays. Do not infer measured jump distances from these promotional views, or imitate molten hazards simply because they appear in the reference.

### 11. A relevant counterexample: Downhill Jam's different priorities

**Developer postmortem.** Toby Schadt's *Not Your Typical Grind* describes dense alternate trick routes, an art workload amplified by long fast levels, fresh playtesters revealing habits that experienced testers had missed, and late work eliminating geometry that stopped the player. He explicitly distinguishes racing priorities, including faster recovery and the conflict between speed loss in manuals and racing. [Game Developer, January 2007, printed pages 30–37, official GDC archive](https://media.gdcvault.com/GD_Mag_Archives/GDM_January_2007.pdf). Relevant article pages were downloaded and read, including the continuation on printed page 37.

**Implication.** Useful lessons are density budgeting, unobstructed travel and fresh-eye tests. Its racing speed/recovery rules are not a reason to impose constant skating or remove deliberate pauses from this exploration park.

## What these sources do not justify

- They do not establish one ideal map size, universal rail spacing, jump ratio or minimum frame rate. Those depend on this controller, camera and runtime.
- They do not prove that every THPS remake's choices were successful. Preservation, new mechanics, added art and restructured goals create distinct tradeoffs.
- A familiar industrial palette does not make an arrangement THPS-like. The useful reference is what one obstacle lets the player do next.
- Reachability, a five-token completion run, and a clean console are necessary evidence. None independently proves good flow or readable choices.
- A novice cannot be simulated by giving a bot the authored route coordinates. First-time visual comprehension requires separate review.

## Current-source diagnosis

This diagnosis concerns the pre-rebuild `WAREHOUSE_PARK_LEVEL` inspected on 17 October. It should not be mistaken for a report on whatever the rebuild later contains.

- The floor is 176 by 252 metres: **44,352 square metres**. Three principal central low islands are distributed near Z = -28, -91 and -143. That is a great deal of floor for very few central choices.
- Three rewards occupy serial 18, 28 and 32 metre routes reached primarily through one long east-side service ascent. Their apparent variety comes heavily from height and distance.
- Much of the upper circulation consists of long ribbons or rails. A successful route test can follow these exactly while never asking whether the player saw the next decision or enjoyed the intervening travel.
- Native route names already claim several returns and transfers. Those claims require moving-camera and momentum evidence; naming a return does not prove it hands control back gracefully.

These observations support rebuilding the spatial organization, not adding more clutter to the same empty footprint. The tall warehouse shell can remain atmospheric while the actual skating arrangement becomes much more concentrated.

## Proposed architecture for the rebuild

The following are our design deductions, to be validated in play.

1. **An immediate, understandable session.** Spawn offers an overview of a major landmark and two visibly different routes. The first slope leads into a usable obstacle, an easy continuation and room to turn back. First input should not commit the player to a long one-way introduction.
2. **A compact main circulation loop.** A clear connected route should link the principal districts. Let quarter-pipes and banked turns return momentum into that loop. Keep an open path for walking and casual skating without making it the only route.
3. **Several local loops.** Make the bowl, dock and central street area worthwhile on their own. Each should support at least two types of action and an obvious cash-out. A player should be able to stay at one spot for practice and then leave without resetting.
4. **Cross-links across the loop.** Put a central hip, rail crossing or low deck where it can shorten a route, reverse direction or enter another spot. Routes that only run around the outside create a racetrack; cross-links create a skatepark.
5. **Vertical layering near the action.** Put low and medium decks within actual trick range of the floor and each other. Reserve an exceptional height for one memorable advanced route. A high destination should be visible, have a legible setup, and return toward playable ground.
6. **Five distinct challenge branches.** Suggested families are precision gap, pumped air, grind transfer, bank-to-roof transfer, and a short linked advanced sequence. Final choices must fit the existing movement verbs. Each branch needs a readable approach, recovery, reward and continuation.
7. **Independent access choices.** All five goals should be discoverable from the main circulation network. A combination route can link several for experts, but completing one should not require collecting another first.
8. **Landmarks that do work.** Reuse the hoist, loading doors, broken windows and selected machinery as identifiers. Align these with local decisions, rather than distributing equally prominent props everywhere.
9. **One consistent surface language.** Riding faces, landing decks and grind edges should have coherent contrast. Unique graffiti or lighting can identify a district without concealing its contours. Keep the user-approved Meshy wall sections and their materials.
10. **Decorative restraint in the moving view.** Avoid pillars, rail posts, foliage and hanging fixtures in launch/landing envelopes or camera corridors. Dense decay can live in recesses and non-riding edges; the active route should remain clear.

## Geometry should be specified as transitions

For every important connection, record the following rather than just the endpoints:

| Stage | Design question | Evidence needed |
|---|---|---|
| Approach | Can the player recognize the launch and obtain the required speed? | Moving competition-camera view and measured approach speed |
| Commitment | Is the intended action evident before the last opportunity to steer? | Launch silhouette, destination visibility and input window |
| Flight/grind | Is the desired direction compatible with native control? | Real input run, including slightly imperfect entry angles |
| Landing | Is there clearance for the player and camera, with a useful heading? | Contact, velocity and camera trace |
| Continuation | Is another action offered without an involuntary stop or sharp reversal? | Combo trace and video through the next obstacle |
| Failure | Does a short/long/off-angle attempt return to usable skating? | Deliberate miss cases, not just successful attempts |
| Retry | Can the player reattempt locally without a remote checkpoint or teleport? | Continuous recovery-to-retry run |

Make a distinction between the **navigation graph** (can reach B from A), **combo graph** (can preserve a useful sequence from A to B), and **visible-choice graph** (can understand that B is an option from the current camera). All three must work. A connected navigation graph alone was already achievable in the old arrangement.

## Measurement and review plan

The values below are initial test targets for this prototype. Adjust them from actual movement measurements and visual review; do not silently replace a failing target with an easier one.

### Baseline before editing

Record an ordinary start, an unassisted-looking circulation run, one route to every token and at least one floor/upper combo. Measure time coasting between meaningful actions, involuntary stops, camera-hidden landings, failed transfers and retry time. Save normal gameplay screenshots from the same views used after the rebuild. Record speed and turning behavior; keep movement tuning constant.

### Playability and flow

- Demonstrate at least three distinct closed sessions and at least two cross-links between them. Count meaningful actions, not arbitrary waypoint arrivals.
- Target a meaningful action or deliberate route choice every 2–4 seconds on the principal line at ordinary cruise speed. Longer stretches require an intentional setup or reveal. This is a proposed pacing criterion, not a THPS fact.
- Demonstrate at least three continuous multi-action combos that cross spot boundaries, including a vert-to-street connection and a ground-to-raised-route connection when the current rules support them.
- Test both normal entry speed and a fast entry. Evaluate turn radius from measured speed and steering response; decorative roundness does not guarantee the player can make the turn.
- Test every major receiver with short, long, left and right errors. Failure should usually become a lower route or an easy retry rather than a trap.
- A missed optional challenge must not block general circulation. No collectible requires a checkpoint warp, debug jump, teleporter or compulsory walking.

### Readability

- Use the shared competition camera for spawn, every branching point, all five commitments, all five rewards and the returns. Include walking views and mount/dismount transitions.
- Before each committed jump, verify the receiver is visible or unmistakably indicated by continuous geometry. A tiny floating collectible cannot carry the whole explanation.
- Give each district a recognizable silhouette and landmark. Check whether a screenshot can be placed on the mental map without reading a waypoint name.
- Assess overlapping edges in the actual frame: a launch lip should not disappear into a wall seam, truss, reflection, rail bundle or high-contrast graffiti.
- Review a clean gameplay recording without the route-author's waypoint overlay. Scripted route knowledge must not stand in for visual communication.
- Keep the exit legible after collecting five goals. An exit hidden on the original spawn balcony should not demand an unexplained full-map return.

### Meaningful objective difficulty

- Verify each collectible through real controls from a normal entry, with the intended input challenge visible in evidence.
- Difficulty should come from timing, balance, speed setup or a short sequence. Reduce difficulty caused only by finding an obscure entrance or repeating long traversal after a miss.
- Offer a low-risk observation position near each advanced attempt so a walking player can inspect the route, then remount naturally.
- After collection, demonstrate a satisfying continuation. The goal's perch should not become a dead end that wastes the momentum just earned.

### Robustness without mistaking it for fun

Run level validation, a production build and focused collision, grind, camera and five-goal checks. Smoke-test lite and full rendering, walking/mounting, respawn, checkpoints and finish. Compare performance under the same renderer and camera conditions. Then conduct a separate qualitative pass: is the next useful action clear, is the player choosing lines, and is repeating them enjoyable? A pass on the first group cannot substitute for the last questions.

## Design decision record to keep during implementation

For each major change, record: old problem; source principle; new arrangement; expected player behavior; actual test evidence; and remaining uncertainty. Capture rejected routes too when they explain a final tradeoff. Completion requires the rebuilt course to demonstrate the intended behavior, not just for these recommendations to exist in documentation.
