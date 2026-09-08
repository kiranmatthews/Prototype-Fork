# Jungle Cup

Island 1's first competition boss follows Nightworks. Nightworks remains a normal playable course. The cup occupies the old island-end hub; Nightworks moves a little west to make room without enlarging the island's coastline. New-game progression is Jungle Ruins → Test Course → Sky Bridge → Nightworks → Jungle Cup → Island 2. Existing editable maps retain their original hub identities; unchanged layouts adopt the new placement and custom eleven-hub maps append a separated cup hub.

## Playing the event

Three runs, 60 seconds each. All three judges contribute to the run average. After the third run, everyone drops their lowest mark and adds the other two. Bone Man must finish **1st overall**, directly ahead of the rival. A tie with the rival is not a win.

The timer advances with active gameplay, including ragdolls and respawns; Pause freezes it. Competition falls do not consume reserve lives or erase banked trick points. A knockdown followed by a death is one bail, not two. Normal combo losses still apply. A supported, landed combo receives its ordinary cash-in at the buzzer; an unlanded combo does not. Restart/Retry begins a new three-run event.

The arena is a continuous six-metre-radius vert bowl with four straight walls, rounded corners and a five-metre coping deck. Its 120 × 172 m foundation is 2.29 times the former footprint. A four-way temple funbox, a low manual island, a north transfer island and five street grind lines occupy the open interior. The islands use continuous bank meshes, including their corners, rather than overlapping wedges with exposed ends. Spectator temples, trees and braziers remain outside the primary ride lines. There are no crates, checkpoints, ceremony dais, finish gate, in-level trophy, bonus entrances or run-mode collectibles.

## Skating and camera

Jungle Cup starts mounted on the board. Left/right steer relative to the rider, up pushes toward cruise, and down or the grab button brakes to a mounted stop. Releasing the brake restores control immediately. Hold Jump (Space / the controller's south face button) to accelerate and pump; release to ollie. Grind remains E / the north face button. The event introduction displays the connected controller's actual button glyphs.

The source-owned `skatepark: true` profile owns these controls, symmetric board-air gravity and the chase camera. Camera lag, right-stick peeking, stored chase toggles and course lanes cannot rotate park steering. Copies retain the profile, and import/restore migration does not manufacture a finish gate, trial clock or combo orb. Ordinary course profiles retain their movement defaults.

The skate camera follows the rider's height through jumps, holds the approach through the climb and opens the return line near the apex. A bounded angular spring handles 180-degree changes without a zero-vector collapse or a sudden orbit. Terrain clearance and an obstruction feeler keep the eye out of transitions and decks. The body levels for the apex and prepares its wheels for re-entry; trick rotation remains independent of the camera.

Explicit vert meshes now attach along the ridden face normal. Swept air contacts catch the actual transition triangles before a downward ground query can select the foundation below. Coping launches happen while still on the face. There is no automatic inward drift, position offset or restoring force: head-on airs return to their launch point, and angled airs retain their earned velocity along the coping. Ordinary banked roads keep their established contact path.

## Judging and tuning

`src/competition/event.ts` owns the small event model and exported tuning:

| Setting | Initial value |
| --- | ---: |
| Run duration | 60 seconds |
| PerfectRunTarget | 12,000 gameplay points |
| Score exponent | 0.55 |
| Linear bail penalty | 3.0 |
| Quadratic bail penalty | 0.75 |
| Judges 1/2 randomness | −1.2 to +1.2 |
| Hostile judge randomness | −1.2 to +0.5 |
| Hostile judge bias | −3.0 |
| Reveal interval | 0.65 seconds |
| Rival skill / variance | 96.1 / ±0.65 |
| Rival player tracking | 0.2 around a 95.0 reference |
| Rival allowed run range | 94.1–98.5 |

The gameplay-score normalization and bail formula follow the supplied brief. Official judge and run marks use one decimal place, so the displayed best-two total adds up exactly from the scorecard. The total is bounded by 199.8. With the initial bias, a perfect run still gives the hostile judge a grudging high-90s mark.

`COMPETITORS` exposes each normal skater's ID, name, portrait, skill and variance. These skaters receive only a bounded random run mark, capped at 94.0; no trick or bail simulation runs for them.

The rival's target responds to Bone Man's latest judged run, then varies within its elite band. Clamping the target before adding variation avoids identical floor marks after weak player runs. Keeping the rival above the ordinary competitors guarantees 1st or 2nd overall without rewriting any previously revealed run or inventing a final total. A strong player can beat the rival directly.

Developer inspection is available through `window.__game.getCompetition()`, `competitionTuning`, `competitionRoster` and `competitionJudges`. These are source-owned event settings, not a generic tournament framework.

## Presentation and story hooks

`src/competition/presentation.ts` renders the event introduction, run HUD, sequential judge reveal, interim standings and final podium. Normal trick/combo presentation remains active during runs. Each leaderboard has three run slots, a total, portraits and a highlighted player row; the discarded run is struck through after Run 3.

Moss, Sol, Voss and the competitor portraits are placeholders for the later story pass. Voss is the recognizable hostile head judge. The rival uses the stable `rival` ID and placeholder name **Rival**.

The presentation exposes `portraitUrl`, `dialogue` and `onReveal` hooks. `onReveal` runs after the scorecard DOM is updated, allowing sound or animation cues. Judge cards expose stable `data-judge` IDs and `data-reaction` states (`waiting`, `critical`, `impressed`). No cutscene or character-generation service is required by the event.

## Trophy and saves

An overall win commits `levels['jungle-cup'].cup = true` and `cleared = true`. This operation is idempotent: repeated wins never mint another collectible. The cup appears in Progress and on the map's level card, and the first win opens the route to Island 2. The event has two completion milestones (clear and cup), rather than unreachable crystal/gem/time-medal milestones. Losing or leaving an unfinished event grants neither.

The trophy is a competition/progress award, with no decorative trophy in the skate park. The entire park is source-owned level data in `src/levels/jungle-cup.ts`; ordinary editor copies remain practice geometry, while the canonical `jungle-cup` identity runs the handcrafted competition.

## Verification

`npm run check:competition` covers the event model and the real Level/Player runtime. Park coverage includes all eight sides/corners at three speeds (24 returns to the launch plane), 24 terminal-speed landing contacts, 19,200 mixed-input frames and all 3,117 frames of the supplied September 8 replay. It also checks camera-independent controls, mounted braking/restart, apex posture, rider framing, 30/60/120 Hz camera turns, foundation coverage, containment below/on/above the deck, a real grind/cash-in, competition death accounting and gate-free editor round trips.

For browser review, run Vite and open `/jungle-cup-review.html?lite&playtest&level=jungle-cup`. The local-only review controls run the real game loop through each wall, corners, a carve sequence and the attached replay, with an optional pause at the apex. Remove `lite` for the full renderer. This QA entry and its scripted controls are not part of the published build.

The earlier THPS/THUG design work was reviewed through the upstream history, especially `d6cdb53`, `1deba7f`, `a11cb71`, and `0665d60`. The current implementation is based on this game's own movement and geometry; no external game source was copied.
