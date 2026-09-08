# Jungle Cup

Island 1's first competition boss follows Nightworks. Nightworks remains a normal playable course. The cup occupies the old island-end hub; Nightworks moves a little west to make room without enlarging the island's coastline. New-game progression is Jungle Ruins → Test Course → Sky Bridge → Nightworks → Jungle Cup → Island 2. Existing editable maps retain their original hub identities; unchanged layouts adopt the new placement and custom eleven-hub maps append a separated cup hub.

## Playing the event

Three runs, 60 seconds each. All three judges contribute to the run average. After the third run, everyone drops their lowest mark and adds the other two. Bone Man must finish **1st overall**, directly ahead of the rival. A tie with the rival is not a win.

The timer advances with active gameplay, including ragdolls and respawns; Pause freezes it. Competition falls do not consume reserve lives or erase banked trick points. A knockdown followed by a death is one bail, not two. Normal combo losses still apply. A supported, landed combo receives its ordinary cash-in at the buzzer; an unlanded combo does not. Restart/Retry begins a new three-run event.

The course offers a wide terrace drop-in, a central funbox and crown rail, a long western halfpipe, a northern vert wall, a southern return quarter, a two-sided eastern spine, manual pads and several connecting grind lines. Masonry bounds keep the player in the park. Existing Jungle Ruins assets dress the arena, and the original procedural cup sits on the ceremony dais. No movement defaults changed. There are no bonus entrances, crystals, trial clocks or combo orbs in this event.

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

The decorative trophy uses the editor's `junglecup` prop with bounded geometry, dimensions and yaw. The entire park is source-owned level data in `src/levels/jungle-cup.ts`; ordinary editor copies remain practice geometry, while the canonical `jungle-cup` identity runs the handcrafted competition.

## Verification

`npm run check:competition` covers exact run duration, all three judges, nonlinear bails, reveal gates, best-two scoring, rival placement and immutable prior marks, opponent caps, unique trophy saving, unlock rules and legacy map migration. The runtime check builds the actual Level and Player to verify supported ramps/vert/spine, containment, a real rail catch and cash-in, death accounting, buzzer settlement, finish-gate protection and cup round-trip capture. The normal build also gates campaign, editor, movement and rendering regressions.

The browser scenario checks use controlled scores to exercise both losing and winning result paths. A separate unmodified live-input run reached judging after 60.10 seconds of wall time, with normal scoring and bail handling and no console errors.
