# Jungle Cup

Island 1's first competition boss follows Nightworks. Nightworks remains a normal playable course. The cup occupies the old island-end hub; Nightworks moves a little west to make room without enlarging the island's coastline. New-game progression is Jungle Ruins → Test Course → Sky Bridge → Nightworks → Jungle Cup → Island 2. Existing editable maps retain their original hub identities; unchanged layouts adopt the new placement and custom eleven-hub maps append a separated cup hub.

## Playing the event

Three runs, 60 seconds each. All three judges contribute to the run average. After the third run, everyone drops their lowest mark and adds the other two. Bone Man must finish **1st overall**, directly ahead of the rival. A tie with the rival is not a win.

The timer advances with active gameplay, including ragdolls and respawns; Pause freezes it. Competition falls do not consume reserve lives or erase banked trick points. A knockdown followed by a death is one bail, not two. Normal combo losses still apply. At zero, an active combo keeps the run playable at **0:00** with a **FINAL COMBO** label. There is no overtime limit. Normal manual/grind links and landing grace remain active; judging begins when that combo banks or breaks. Its final banked score and any final bail are included exactly once. A new combo cannot reopen the extension after the previous one resolves, even in the same simulation tick. An empty air does not extend the clock. Restart/Retry begins a new three-run event.

The arena is a continuous vert bowl with a 3.6 m transition radius, a 0.8 m vertical top, four straight walls, rounded corners and a 7.4 m coping deck. Its 120 × 172 m foundation is 2.29 times the former footprint. A four-way temple funbox, a low manual island, a north transfer island and five street grind lines occupy the open interior. The islands use continuous bank meshes, including their corners, rather than overlapping wedges with exposed ends. Spectator temples, trees and braziers remain outside the primary ride lines. There are no crates, checkpoints, ceremony dais, finish gate, in-level trophy, bonus entrances or run-mode collectibles.

## Skating and camera

Jungle Cup is always skate. The board returns automatically as soon as control resumes after a wipeout, on the ground or in the air, preserving the recovery momentum. Extra jump releases cannot abandon the board, and down + Grab remains a board grab rather than an on-foot slam. Left/right steer relative to the rider. Neutral input keeps skating; down or the grab button brakes to a mounted stop. Up during a rising vert air deliberately transfers over the coping. Releasing the brake restores control immediately. Hold Jump (Space / the controller's south face button) to crouch and accelerate; release to ollie. Grind remains E / the north face button. The event introduction displays the connected controller's actual button glyphs.

The source-owned `skatepark: true` profile owns these controls, symmetric board-air gravity and the chase camera. Camera lag, right-stick peeking, stored chase toggles and course lanes cannot rotate park steering. Copies retain the profile, and import/restore migration does not manufacture a finish gate, trial clock or combo orb. Ordinary course profiles retain their movement defaults.

The skate camera follows a full surface frame, keeping the rider framed as the transition steepens. Vert uses a downward view with the wall normal as screen-up; touchdown restores the ground-following view. The rider keeps the wall frame through apex. Tricks rotate the board independently of the camera.

The follow camera reads the live rail tangent during grinds, including reverse travel and curved coping. A rail catch ends the vert camera state immediately, and an angled vert catch preserves its incoming coping speed and direction. Bails on the flat upper deck use the physical surface slope rather than the shared vert feature tag. A supported recovery can finish its roll-up even after its own run-out exceeds the initial settling speed.

Explicit vert meshes attach along the ridden face normal. Swept air contacts catch actual transition triangles before a downward query can select the foundation. Automatic vert begins at the actual lip and preserves the full launch velocity without an extra pop. Charged releases add a separate impulse. Constant gravity controls the arc; source-sized coping feelers follow curved walls with 7.62 cm clearance, without a continuous inward shove. The calibration, actual upstream changes reviewed, reference links and known adaptations are recorded in [THUG_SKATING_REFERENCE.md](THUG_SKATING_REFERENCE.md).

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

`npm run check:competition` covers the event model and the real Level/Player runtime. Skating checks include all sides/corners at three speeds, measured gravity/impulses, true lip launches, curved tracking, landing contact, 19,200 mixed-input frames and all 3,117 frames of the supplied replay. Camera checks include complete rider framing, visibility through coping, wall-oriented apex and 30/60/120 Hz equivalence. Event coverage includes 100 simulated minutes of overtime, final bank/bail/same-tick closure, reset/pause, real manual linking, pending flips, and automatic ground/air remounting. Follow-up regressions cover 16 actual rail catches, 553 grind frames and 14 exits, plus 49 deck/corner/lip/air/standable-bank bail cases without input; all recover within 1.73 seconds. Geometry checks cover the actual vertical top, continuous banks, foundation, containment at three heights, rail scoring and editor round trips.

For browser review, run Vite and open `/jungle-cup-review.html?lite&playtest&level=jungle-cup`. The local-only review controls run the real game loop through each wall, corners, a carve sequence and the attached replay, with an optional pause at the apex. Remove `lite` for the full renderer. This QA entry and its scripted controls are not part of the published build.
