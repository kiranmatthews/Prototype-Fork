# Platformer crate, enemy and side-view puzzle research

Research date: 2 October 2026. This document is being assembled from sources actually read and, where stated, video frames actually inspected. It is a design research dossier for three original playable levels, not a claim to have replayed every commercial game or a tile-perfect reproduction of their maps.

## Evidence and diagram conventions

- **Developer evidence** means a creator's own account or publisher/manual documentation.
- **Guide evidence** means a named walkthrough author's description of a real level. Such evidence can contain mistakes and can describe a different release.
- **Observed frame** means a screenshot of a specific video timestamp actually inspected. A video description or search snippet alone does not count as watching its action.
- **Design inference** means our deduction or an original adaptation, separated from claims about the source game.

The diagrams below are relationship maps: vertical alignment denotes a supported or overhead relationship only where the source says so. Horizontal arrows denote an action sequence. They are **not measured tile maps**. Unknown widths, positions and intermediate crates remain unknown. `S` = a support which must survive until its job is finished, `W` = ordinary breakable crate, `M` = metal, `B` = multi-hit/striped bounce crate, `T` = TNT, `!` = switch, `o` = outline, `?` = mystery crate. A bridge drawn as `...` does not claim a crate count.

## Concrete Crash bonus and crate-room case studies

### 1. Cold Hard Crash: preserve two striped crates to reach an overhead box

**Game/release:** Crash Bandicoot 2, original PlayStation guide; N. Sane guide corroborates the upper-first principle. **Read evidence:** toby_lover's bonus paragraph reports 31 crates, two striped crates, and a hidden box above the top striped crate. Its required sequence is: use the upper striped crate while holding Jump to reach the hidden box, then finish breaking the striped supports. The Gamepressure guide also advises clearing a high crate before the ones beneath it. [toby_lover, 2009 guide](https://gamefaqs.gamespot.com/ps/196987-crash-bandicoot-2-cortex-strikes-back/faqs/54250), [Gamepressure, Cold Hard Crash](https://www.gamepressure.com/crash-bandicoot-n-sane-trilogy/cold-hard-crash/z19f1a)

```text
        [hidden W]        1. Bounce high and destroy this
            ↑
           [B/S]         2. Clear upper support afterwards
           [B/S]         3. Clear lower support last
```

**Design inference:** the support is simultaneously a collectible and the only currently documented tool for another collectible. A player can reach the exit yet fail the all-box objective by consuming that tool too early. This is a dependency puzzle: `overhead reward → upper support → lower support`, not simply a stack to smash. Our adaptation should make the overhead target visible; preserve the ordering demand without copying an off-camera surprise. A comfortable floor bypass can make a clear possible after an all-box failure, while a checkpoint before the room permits a deliberate reset.

### 2. Road to Ruin: switch traversal, an air-spin, retreat, then floor recovery

**Game/release:** Crash Bandicoot 2. **Read evidence:** Gamepressure describes a 13-crate bonus with four grouped metal switches and 12 later crates on two stable ledges. The original toby_lover guide says to travel back and forth activating switches; air-spin the first wooden life crate, immediately jump back to iron crates, and wait for the platform to reappear before crossing. [Gamepressure, Road to Ruin](https://www.gamepressure.com/crash-bandicoot-n-sane-trilogy/road-to-ruin/z39f13), [toby_lover](https://gamefaqs.gamespot.com/ps/196987-crash-bandicoot-2-cortex-strikes-back/faqs/54250)

```text
switch section:  !1 ↔ !2 ↔ !3 ↔ !4
safe iron perch → [life W over gap] → later stable ledges
                 air-spin
safe iron perch ← retreat
                 wait for route to reappear → cross
```

**Design inference:** the first wood crate is a tempting goal positioned inside a route that changes over time. Collecting it is only half the solution; the safe recovery position matters. The important interaction is not four switches as decoration but the consequence of activation, approach, attack and retreat. The prototype's permanent outline activation cannot reproduce the reappearing floor verbatim. Use a grouped outline route plus a separate existing `phasepad` if that cyclic recovery behavior is desired, and label that an adaptation.

### 3. Ruination: create a route, harvest the cap, then collapse the tower

**Game/release:** Crash Bandicoot 2 / N. Sane. **Read evidence:** Gamepressure reports a 49-crate bonus, two TNT-to-tower sequences, and a final normal/striped crate crossing over a chasm. For each tower the player springs from TNT onto its top, waits for the explosion, then body-slams remaining reinforced crates. Ludo's detailed opening separately describes: break the lone ordinary crate in a reinforced wall; climb three reinforced crates and slam them; hit `!`; use activated metal crates to break the overhead box; reach another metal set and air-spin the cap above three reinforced crates before slamming those supports. [Gamepressure, Ruination](https://www.gamepressure.com/crash-bandicoot-n-sane-trilogy/ruination/z29f1b), [Ludo, bonus steps 1–6](https://www.ludo.guide/guide/crash-bandicoot-n-sane-trilogy/level-19-ruination)

```text
opening wall → break ordinary member → climb / slam reinforced members
           ! → o-metal route becomes M → harvest overhead cap

                  [cap W]       harvest cap before supports
               [reinforced]
               [reinforced]
               [reinforced]

T → bounce to tower top → explosion removes affected crates
                        → slam surviving reinforced crates
                        → repeat at second tower
                        → clear normal / multi-hit crossing over abyss
```

**Design inference:** the explosion is a scheduled geometry transformation, and the player must already occupy the appropriate refuge before it occurs. An original level should show the pre-blast support, post-blast landing and next objective together. The two repetitions should alter one constraint, such as cap height or a patrol's timing, instead of copying the same tower. Reinforced slam-only crates and striped multi-hit crates are distinct in the source games; the current prototype has `multihit` but no armored slam-only crate kind, so this distinction cannot be copied literally.

### 4. Hangin' Out: TNT as a temporary bridge, upper row before lower row

**Game/release:** Crash Bandicoot 2 / N. Sane. **Read evidence:** Gamepressure gives a 34-crate bonus: an initial tower, springboard over a single Nitro, a larger Nitro area leading to two springboards, a TNT section that should initially be entered without lighting it, two wooden crates to break quickly once landing starts the fuse, then two rows of multi-hit fruit crates. The original guide recommends using a lower crate with nothing overhead to reach the upper striped row, clearing that upper row first and the bottom row afterwards. Its bonus total differs from Gamepressure's; this dossier does not treat that conflicting total as settled. [Gamepressure, Hangin' Out](https://www.gamepressure.com/crash-bandicoot-n-sane-trilogy/hangin-out/z89f18), [toby_lover](https://gamefaqs.gamespot.com/ps/196987-crash-bandicoot-2-cortex-strikes-back/faqs/54250)

```text
springboards → enter TNT bridge without starting fuse → reach wood targets
           → land / light fuse → break 2 W quickly → escape

upper:    [B][B]...     clear this row first
lower: [B][B][B]...     use exposed lower crate to gain upper-row height
```

**Design inference:** the player must spend a limited support lifetime *after* planning their route. The final rows introduce a second budget: every bounce brings a lower multi-hit crate closer to disappearing. These are resource-order puzzles, even without an inventory. Our levels should expose the remaining-hit feedback and leave enough safety for the player to recognize the budget before requiring mastery.

### 5. Air Crash: activate the missing floor, then consume the crossing

**Game/release:** Crash Bandicoot 2. **Read evidence:** toby_lover specifies three appearing wood footholds, two mystery targets, then a metal spring. Gamepressure corroborates eight counted crates, switches and suspended singles. [toby_lover](https://gamefaqs.gamespot.com/ps/196987-crash-bandicoot-2-cortex-strikes-back/faqs/54250), [Gamepressure, Air Crash](https://www.gamepressure.com/crash-bandicoot-n-sane-trilogy/air-crash/z99efe)

```text
! → missing iron floor becomes solid
  → [W][W][W] crossing → [?] → [?] → [metal arrow] → exit
```

The three-wood/two-mystery account comes from the original guide, not from independently counted video. Other counted crates are deliberately omitted from the schematic.

**Design inference:** this is a clear beginner model for a switch changing traversability. It progresses from reusable iron footing to consumable wooden footing and finally a reliable launch point. Do not place a deep catch floor beneath every consumable crate: that would make the geometry disappear without changing the decision. A beginner version can instead place one recoverable catch platform at the demonstration, then use a true gap in the test.

### 6. Future Frenzy: selective air attack while retaining a landing

**Game/release:** Crash Bandicoot 3 / N. Sane. **Read evidence:** Gamepressure identifies a 19-crate bonus with a final mural-directed sequence: jump from the ledge, use the tornado spin, descend toward the right while breaking airborne crates, and reach the right landing. The guide also explicitly distinguishes a normal first visit from the all-crates route entered through the secret portal, including backtracking left after returning to the main level. [Gamepressure, Future Frenzy](https://www.gamepressure.com/crash-bandicoot-n-sane-trilogy/future-frenzy/z69faf), [Warp Speed Studios' bonus-only video](https://www.youtube.com/watch?v=7NGU1AhVYoc)

```text
left ledge → jump / tornado through airborne targets → right ledge
                         break while descending
```

**Observed frames:** Warp Speed Studios' bonus-only video was subsequently sampled at 0:12, 0:15, 0:16, 0:17, 0:20 and 0:24. The middle structure visible at 0:16 is two columns by four rows: plain wood caps, two mystery-crate rows, plain wood bases. The run shows `7/19` before this structure, `8/19` during an air-spin at 0:17, `14/19` while attacking a remaining mystery crate at 0:20, and `19/19` at the exit at 0:24. The left metal structure and lower platforms offer intermediate footing. These are sampled states; no unseen frame-perfect input sequence is claimed.

```text
observed middle structure:
   [W][W]
   [?][?]
   [?][?]
   [W][W]    lower platforms and right landing visible nearby
```

**Design inference:** an airborne attack has two responsibilities: harvest targets and preserve a trajectory that still reaches supported ground. This is different from stomping a horizontal crate bridge. The prototype should use its existing jump/spin behavior, measured locally, instead of assuming Crash 3's extended tornado glide exists.

### 7. Countdown Crate Intro: defer a switch, preserve a return tool

**Game/release:** Crash Bandicoot 4. **Observed frames:** PowerPyx video at 0:15 displays `5/301`, a high reward row and lower separated wooden footholds; at 0:48 it displays `44/301`, a Nitro ceiling, a horizontal outline floor and a diagonal outline route at the right. These two screenshots were actually inspected in Chrome. They show states, not the complete actions between them. [PowerPyx complete walkthrough](https://www.youtube.com/watch?v=-OBoH0uX1hY)

**Read evidence:** TrueAchievements describes time-sensitive outlined structures, numbered timed switches, an armored-crate slam triggering another switch, then dropping after timed floor disappears and **skipping the next timed switch initially**. GarlandTheGreat's video description specifically says to return to the activation crate after the first boxes, while leaving one box available for the return jump before the checkpoint. [TrueAchievements, Countdown section](https://www.trueachievements.com/game/Crash-Bandicoot-4-Its-About-Time/walkthrough/48), [GarlandTheGreat](https://www.youtube.com/watch?v=flVO2Ay-7Ro)

```text
activation → temporary footholds → harvest first targets
                                  retain one return support
activation ← return using retained support
reactivate → remaining targets → checkpoint
```

**Design inference:** the obvious forward action is intentionally incomplete. The solution uses the same room twice in different states. A level built from permanent one-shot switches can express the dependency/return concept, but cannot claim to implement a repeatable timed switch. Reuse existing cyclic platforms for time pressure or choose a different source mechanic.

### 8. Nitro Bounce Crate Test: change the upper pair's material before blasting

**Game/release:** Crash Bandicoot 4. **Read and observed evidence:** SweetJohnnyCage's auto-generated transcript at 2:11–3:20 explains the final puzzle; browser screenshots at 2:37, 2:49 and 2:53 corroborate its state change. At `66/164`, three vertically stacked TNT sit beside four Nitro-bounce crates above two wood crates. Convert the upper pair to Nitro, activate TNT, and retreat onto the metal pair at left. At 2:49 the upper pair is Nitro and the fuse reads three. At 2:53 the counter is `73/164`: three TNT, two converted Nitro and two wood crates disappeared; the lower bounce pair survives and is exposed. Convert that pair before continuing. Unconverted bounce crates resist the final green Nitro switch. [SweetJohnnyCage, narrated solution](https://www.youtube.com/watch?v=ONuiA5lUK34&t=131s)

```text
BEFORE                 CONVERT UPPER PAIR       AFTER BLAST
[T] [NBC][NBC]         [T] [N][N]
[T] [NBC][NBC]         [T] [NBC][NBC]            [NBC][NBC]
[T] [ W ][ W ]         [T] [ W ][ W ]
                         ↑ light fuse, retreat
```

**Design inference:** here action order determines which objects the same explosion can remove. The available lower pair cannot be reached as intended until the upper pair changes material and is cleared. The prototype has no NBC-to-Nitro transformation; transfer the two-stage access dependency to its supported crate types instead of quietly treating ordinary arrow crates as equivalent.

### 9. Sunset Vista: two bonus types give TNT different jobs

**Game/release:** Crash Bandicoot / N. Sane. **Read evidence:** Gamepressure describes the Cortex bonus as 23 crates, mostly explosive, demanding sustained movement while the floor is lost. The Tawna bonus has 16 crates; in its difficult section the guide specifically advises bouncing across the crates *on top of* TNT rather than landing on the TNT itself, since that starts a fuse which cannot be safely escaped in that setup. These are different rooms and should not be merged into one invented map. [Gamepressure, Sunset Vista bonus paragraphs](https://www.gamepressure.com/crash-bandicoot-n-sane-trilogy/sunset-vista/z49edb)

```text
Cortex:  light explosive footing → move right before footing disappears

Tawna fragment:   [W] ... [W]    bounce across upper crates
                  [T] ... [T]    avoid starting this support clock
```

**Design inference:** even one crate type can have opposite tactical meanings. TNT may be the useful launch to commit to, or the support which must remain unlit while harvesting an upper route. Advanced difficulty should exploit those distinctions after demonstrating each one. Making every TNT encounter a identical jump-and-run test discards most of the puzzle vocabulary.

### 10. Stowing Away: finish switch, conserve a launch, sweep back to the entrance

**Game/release:** Crash Bandicoot 4. **Team-observed evidence:** paused samples of AbyxGaming's 34-box bonus run show a four-metal bridge above `TNT–wood–wood–TNT` at 0:20, then TNT above `!`. At 0:30 an arrow sits under Nitro, beside a vertical `switch / reinforced / wood-arrow` lock. The end green switch precedes a cleared world and `24/34` at 0:45. At 0:50, a three-box return stack has golden Wumpa at bottom, mystery in the middle and multi-hit on top, next to a higher permanent metal box. At 1:00 a metal arrow supports the upper return sweep. At 1:15 the count reaches `34/34` near the entrance; the player then returns to the exit. Samples establish relationships and a state loop, not measured coordinates. [AbyxGaming walkthrough](https://www.youtube.com/watch?v=8rj9bzw1TKQ)

**Read corroboration:** TrueAchievements' indexed bonus instructions explicitly preserve the multi-hit box through four bounces and use its fifth high bounce to reach high metal. Neoseeker independently gives 34 bonus crates. [TrueAchievements, Stowing Away](https://www.trueachievements.com/game/Crash-Bandicoot-4-Its-About-Time/walkthrough/36), [Neoseeker](https://www.neoseeker.com/crash-bandicoot-4-its-about-time/walkthrough/Stowing_Away)

```text
OUTWARD: entrance → metal bridge / TNT supports → local lock → green !
                                                              ↓ Nitro clears
RETURN:  entrance targets ← upper sweep ← metal arrow ← retained multi-hit
         34/34                                                 ↑ fifth high bounce
FINAL:   entrance → cleared route → exit
```

**Design inference:** reaching the apparent end is the midpoint of the harvesting puzzle. The end action changes the meaning of every earlier hazard; an exhaustible crate budget permits access to a second route. The correct order therefore spans several screens. This is a particularly strong model for the richest original level: an outward route establishes resources, a far switch changes state, a conserved tool opens the return route, and the return sweeps earlier targets before the actual finish.

### 11. Subject #218: staggered relay separates bounce targets from upper targets

**Game/release:** Crash Bandicoot 4. **Team-observed evidence:** the root researcher inspected PowerPyx frames at 0:10, 0:15 and 0:25. At 0:10 the counter is `7/118` with a near-edge crate retained. At 0:15 it is `10/118` and the view shows staggered low singles and higher paired rows; by 0:25 it is `21/118` on the next permanent platform. These samples verify a two-height relay and its progress, but alone do not establish every input or crate's original type. [PowerPyx, Subject #218](https://www.youtube.com/watch?v=94j-SFf7hBU)

**Design inference:** a relay can demand that a low foothold remain available while the player air-spins a higher row. Judge the authored version by whether the upper targets and the next low contact can both be reached in the same supported action chain. A scattering of low and high crates is only a puzzle if breaking the wrong low one actually changes the chain.

## What these rooms demand beyond obstacle placement

The source cases establish five materially different responsibilities: keep a destructible support alive until an upper target is collected; occupy a refuge before TNT changes the structure; create a route before crossing it; attack a target in the air and retreat to safety; and return through a room whose state has changed. A course with a bounce crate, a TNT crate and an enemy spaced along a floor need not express any of these responsibilities.

For each original room, record **a correct solution** and **a tempting incorrect solution** before authoring it. If both solutions still collect every crate and exit equally easily, the supposed puzzle has not been realized. Mechanical uncertainty, however, is not an authored puzzle: test blast radius, enemy flings and jump reach before relying on them.

## Prototype contract and adaptation limits

These facts come from local `src/level.ts`, `src/player.ts` and `src/enemies/types.ts`, inspected on the research date.

| Affordance | Actual behavior and consequence for authoring |
| --- | --- |
| `wood`, `mystery`, `mask`, `life` | Breakable rewards. Use deterministic kinds where a required protective reward matters; a mystery crate is not a guaranteed resource. |
| `multihit` | Five-hit crate. Can be used as a finite support budget. It is not the same as a slam-only armored Crash crate. |
| `bouncy` | Held Jump at contact gives a higher launch; spin/slam can destroy it. Preserve it until all dependent targets are collected. |
| `metalbounce`, `metal` | Reusable arrow / solid metal. Uncounted. Plain metal is lethal if it falls onto the player. |
| `tnt` | Stomp or head-bonk starts the fuse; spin/slam/slide detonates. The current player callsites make TNT blasts unsafe, despite an older helper comment claiming otherwise. |
| `bang` + `outline` + groups | One-shot, permanent materialization of its connected outlines, including outlined surfaces. This is not Crash 4's repeatable timed `!`. |
| `nitrobang` | Detonates every live Nitro in the level, not merely a local group. A local lock cannot assume isolated clearance. |
| Crate stacking | Removing support makes affected crates settle. Landing on arrow crates can cause repeated crate hopping. Nitro is excluded from this ordinary settling path. |
| Blast | Can chain explosives, break ordinary crates, kill enemies and trigger switches. Arrow crates are skipped by the blast loop. Verify the reachable refuge against the authored blast radius. |
| Enemy fling | A spun foe follows a short ballistic path and can smash nearby ordinary/explosive crates. Its loop skips arrow crates, switches and pending outlines. Do not require a foe to directly activate a switch by fling. |
| Checkpoint | Captures alive/pending/switch state; respawn clears fuse and restores authored crate homes. Checkpoint placement can preserve a bad all-box state if the last remaining access tool was already destroyed. |
| `zone`, `camnode` | E/W side-view travel and authored camera framing. Movement remains three-dimensional; check whether depth movement bypasses the intended crate order. |
| Existing hazards | `crumble`, `phasepad`, `mover`, `crusher` can supply time pressure without new runtime systems. They do not automatically enforce all-crate completion. |

An exit is normally a clear objective independent of crate completion. If an original study level needs an all-crate gate, use only existing supported finish behavior or add the smallest explicitly reviewed runtime support; do not imply that `gate` alone checks a puzzle's intended action order.

## Primary developer evidence

The historical claims in this section are compact paraphrases. The later taxonomy is our own design synthesis, not a claim that any studio published that taxonomy.

| Source actually read | What it establishes |
| --- | --- |
| [Andy Gavin / Jason Rubin, Making Crash part 4, 2011](https://all-things-andy-gavin.com/2011/02/05/making-crash-bandicoot-part-4/) | Heavy Machinery was the first successful essentially side-view prototype. Its ingredients included vents, drop platforms, bounce pads, hot pipes and patterned patrols. Gavin explicitly credits techniques used in Donkey Kong Country and describes introducing a theme across two or three levels, then adding twists and harder combinations. Jungle Rollers' rollers serve as timing gates; stationary plants require provoking an attack before jumping onto them. |
| [Gavin / Rubin, Making Crash part 5, 2011](https://all-things-andy-gavin.com/2011/02/06/making-crash-bandicoot-part-5/) | Crates were designed as a cheap palette with stacking, dropping, bouncing, explosives and switches that could combine. Rubin specifically describes repeatedly tuning a TNT / ordinary crate / TNT puzzle so spinning the middle reward was difficult but worthwhile. This is direct developer evidence for selective destruction, not just decorative crate density. |
| [Gavin / Rubin, Making Crash part 6, 2011](https://all-things-andy-gavin.com/2011/02/07/making-crash-bandicoot-part-6/) | Rubin calls the original continue economy a balance mistake and describes assistance after repeated failure, including masks, slower boulders and additional checkpoints. This is a reason to keep retries generous while retaining a difficult local puzzle. |
| [Activision, Crash 4 level types](https://support.activision.com/crash-bandicoot-4/articles/dimensions-and-level-types-in-crash-bandicoot-4) | Flashbacks are separately unlocked side-view levels; main paths, bosses and alternate-character timelines are separate level types. Do not call any ordinary side-view segment a literal Flashback mechanic. |
| [Activision, Crash 4 collectibles](https://support.activision.com/crash-bandicoot-4/articles/crash-bandicoot-4-its-about-time-collectibles) | All-crates, Wumpa percentage, death allowance and hidden gems are different objectives. Flashback tapes require reaching them before dying. This documents that survival and complete harvesting impose different challenges. |
| [Activision, Crash 4 hands-on](https://blog.activision.com/crash-bandicoot/2020-07/Crash-Bandicoot-4-Hands-On) | Snow Way Out offers a practice example with a switch and four briefly materialized crates before the harder time-mask test. Cortex's different ability turns enemies into platforms or bouncy forms. Those mechanics are ability-specific and cannot simply be transplanted into Crash's route. |
| [Nintendo, New Super Mario Bros. developers, volume 2 page 6](https://iwataasks.nintendo.com/interviews/wii/nsmb/1/5/) | The first Goomba was deliberately a one-step squashable enemy, because opening with the two-step Koopa was too difficult for testers. Enemy complexity is a teaching choice, not merely increasing enemy count. |
| [Nintendo, New Super Mario Bros. developers, volume 1 page 4](https://iwataasks.nintendo.com/interviews/wii/nsmb/0/3/) | The first Goomba and mushroom sequence uses geometry and object motion to teach differences between danger and reward. Miyamoto describes repeated trial and error, rather than a complete design predetermined on paper. |
| [Nintendo, Super Mario 3D World page 3](https://iwataasks.nintendo.com/interviews/wiiu/super-mario-3d-world/0/2/) | The team separates getting to the goal from harder Green Star objectives and discusses camera constraints as a limit on possible game ideas. Completion route and mastery route need not demand identical skill. |
| [Nintendo / Retro, Donkey Kong Country Returns page 3](https://iwataasks.nintendo.com/interviews/wii/donkey-kong-country-returns/0/2/) | An enemy attack was revised to lean back slowly before attacking quickly. This is direct evidence for a visible warning leading into a timing challenge. The indexed interview text was read; the direct page repeatedly failed to load during this session. |
| [Nintendo / Retro, Donkey Kong Country Returns page 6](https://iwataasks.nintendo.com/interviews/wii/donkey-kong-country-returns/0/5/) | The designers discuss bouncing flowers, progressing by stepping on creatures, and Muncher Marathon's calculated combination of pursuit, movement and crumbling scenery. Enemies can be footing as well as threats. |
| [Nintendo, Donkey Kong Country Returns 3D manual](https://csassets.nintendo.com/noaext/image/private/t_KA_PDF/manual-3DS-donkey-kong-country-returns-3D-en?_a=DATAg1AAZAA0) | Regular barrels can hit enemies and break certain obstacles; barrel cannons distinguish manual launch, automatic launch and disposable variants. Player control over commitment is itself a level-design variable. |
| [Yacht Club, Specter level design 1/5](https://www.yachtclubgames.com/blog/specter-of-torment-level-design-deep-dive-1-5/) | Ingredients should interact in several contexts; mechanics are introduced and developed; level shape supports theme. A changed moveset required major layout revisions, including more walls and maneuvering space. |
| [Yacht Club, Specter level design 2/5](https://www.yachtclubgames.com/blog/specter-of-torment-level-design-deep-dive-2-5/) | Their described progression introduces, complicates, layers, tests and cools down ideas. Screen space and readability can force an interesting setup to be changed or removed. Their comparison with Mario and DKC is Yacht Club's interpretation, not a statement from those studios. |
| [Yacht Club, Specter level design 3/5](https://www.yachtclubgames.com/blog/specter-of-torment-level-design-deep-dive-3-5/) | Health/rewards alter tension; exploration can purchase safety for combat. Density and breathing room require separate scrutiny. Small geometry edits can make additional player tools viable. |
| [Yacht Club, Specter level design 4/5](https://www.yachtclubgames.com/blog/specter-of-torment-level-design-deep-dive-4-5/) | Separate passes examine resources, bounds and art. Background shapes can frame targets, indicate height differences and distinguish dangerous descents from safe recovery. |
| [Yacht Club, Specter level design 5/5](https://www.yachtclubgames.com/blog/specter-of-torment-level-design-deep-dive-5-of-5/) | They favor comfortable jumps below maximum reach, obvious attainable versus impossible gaps, consistent spacing, clear secret-route language and visible exits. The challenge comes from interacting hazards around achievable movement rather than routine maximum-range jumps. |
| [Maddy Thorson, Celeste & Forgiveness](https://www.maddymakesgames.com/articles/celeste_and_forgiveness/index.html) | Coyote time, jump buffering, apex gravity, correction and other assists widen timing/position windows. Difficult play can be supported by consistent generosity. This research does not authorize retuning the prototype's physics. |
| [GDC, Designing Celeste, 2017 session description](https://gdcvault.com/play/1024307/Level-Design-Workshop-Designing-Celeste) | The speaker's stated scope covers designing hundreds of small stages, area maps and story. Only the session description was read here; no claim about unviewed talk content is used as evidence. |
| [Ubisoft, Rayman Legends official page](https://www.ubisoft.com/fr-fr/games/rayman-legends) | Its musical levels coordinate jumps with drum beats, attacks with bass and traversal with musical rhythm. That is authored synchronization, not simply placing repeat hazards at equal distances. |
| [Ubisoft, Rayman Origins official page](https://www.ubisoft.com/en-us/games/rayman-origins) | Progressive abilities, return visits, hidden paths and treasure-chest pursuit are explicit parts of the design. This prototype can borrow pursuit/commitment grammar without adding Rayman's entire moveset. |
| [Derek Yu, Spelunky 2 interview, 2018](https://blog.playstation.com/2018/08/29/first-look-spelunky-2-gameplay-mossmouth-interview/) | Interacting elements produce cascades of consequences; procedural room templates establish a route to the exit. Additional layers create opportunities for shortcuts and exploration. |
| [Derek Yu, Spelunky 2 launch essay, 2020](https://blog.playstation.com/2020/09/15/spelunky-2-is-out-today-on-ps4/) | Yu wants multiple viable strategies to remain interesting, instead of one dominant equipment/behavior choice. Difficulty supplies a context for player decisions. |
| [Frozenbyte, Trine](https://www.frozenbyte.com/games/trine/) and [Trine Enchanted Edition press kit](https://press.frozenbyte.com/sheet.php?p=trine_enchanted_edition) | Physical objects and different character abilities support alternative ways through puzzles and enemies. The prototype lacks free crate manipulation and character switching; its supported equivalent is alternative authored routes, not a new construction sandbox. |
| [Sluggerfly, Super Meat Boy 3D camera/development essay, 2026](https://blog.playstation.com/2026/03/26/how-super-meat-boy-3d-captures-the-series-identity-out-may-31/) | Levels were built around controlled camera angles; movement, depth readability and geometry evolved together. This is contemporary developer evidence for designing the camera with the route rather than adding a camera after geometry is finished. |

## Comparative transfer: what each family contributes

### Specific resource-order cases outside Crash

**Super Mario World, Donut Secret 1 — move the trigger before starting its clock.** Nintendo's manual documents switch blocks exchanging certain objects and coins, and grab blocks which can be held/thrown. Thonky's route calls for hitting the P-Switch, swimming right through temporarily converted brown blocks, obtaining the key and bringing it to the keyhole before the route returns. StrategyWiki gives the useful alternative: carry the P-Switch to the keyhole area before pressing it. [Nintendo manual](https://www.nintendo.co.jp/clvs/manuals/common/pdf/CLV-P-SAAAE.pdf), [Thonky route](https://www.thonky.com/super-mario-world/donut-secret-1), [StrategyWiki route](https://strategywiki.org/wiki/Super_Mario_World/Beating_the_game_in_12_levels)

```text
carry unpressed P toward lock → activate near target → coins replace barrier
                            → key → keyhole before state expires
```

**Inference:** a collectible-looking object is a portable activation position. The route tests choosing *where and when* to spend the trigger. Our fixed switch can express the same plan through a side route to a nearer switch, but cannot claim to be a carried P-Switch.

**Super Mario World, Donut Plains 2 — preserve an enemy's shell as an access tool.** Thonky describes breaking rotating blocks to reach a blue shell, feeding it to Yoshi, then flying to the high key/keyhole. Cape flight and a beanstalk are alternate solutions. This makes the enemy-derived object useful after combat, and killing/destroying it carelessly can lose that particular access method. [Thonky](https://www.thonky.com/super-mario-world/donut-plains-2), [Mario Wiki](https://www.mariowiki.com/Donut_Plains_2)

**Inference:** separate the entity's threat role from its later traversal role. In this prototype, a stompable enemy can be a retained height tool, but a turtle does not become a carryable shell. An alternate route is meaningful when it purchases access using a different resource, not when it lets the player ignore every puzzle without a cost.

**Donkey Kong Country, Oil Drum Alley — choose a small reward because it is a tool.** Specialist guides agree that matching three single bananas in the second bonus awards a barrel which opens another bonus. The Kongs must take that barrel to the right wall with a jump rather than merely throw it and trigger the ordinary completion exit. A later bonus entrance requires preserving another barrel through intervening enemies and using it on a wall near a floating oil drum; Rambi supplies an alternate destruction method. [Donkey Kong Wiki](https://donkeykong.fandom.com/wiki/Oil_Drum_Alley), [Brother_Reed's guide](https://gamefaqs.gamespot.com/snes/588282-donkey-kong-country/faqs/8224), [T_Hayes's guide](https://gamefaqs.gamespot.com/snes/588282-donkey-kong-country/faqs/16178)

```text
small banana match → receive barrel → retain it → carry/jump into wall
                                                    → second bonus
```

**Evidence caution:** guides disagree about one-time missability; the linked Arqade discussion questions an original player's-guide claim. This research does not reproduce that disputed failure rule. [Arqade discussion](https://gaming.stackexchange.com/questions/332488/is-the-bonus-room-in-oil-drum-alley-missable)

**Inference:** high nominal value need not mean high functional value. A modest reward can be the missing key to a richer route. The transferable authored interaction is “do not spend the tool on the next enemy,” not a need to add arbitrary mystery-prize logic.

**Donkey Kong Country 3, Koin — route a projectile behind the defender.** The manual identifies Koin as the holder of the DK Coin. DWA's GBA walkthrough instructs the player at one Koin setup to throw a steel barrel over Koin so it hits the left wall and rebounds into his rear. The defender's orientation makes a direct throw ineffective; the wall is part of the solution. The indexed excerpt establishes the action but not a measured room map. [Original manual scan](https://www.retrogames.cz/manualy/SNES/Donkey_Kong_Country_3_-_SNES_-_Manual.pdf), [DWA guide](https://gamefaqs.gamespot.com/gba/928294-donkey-kong-country-3/faqs/73588)

**Inference:** aim around the obstacle by understanding shared object rules. The prototype's enemy fling can supply a projectile role, but no inspected code establishes wall-bouncing enemy projectiles or directional shields; borrow the aiming problem only within actual fling behavior.

**Rayman Origins, It's a Jungle Out There — the guardian also drives your platform.** RayWiki's final-area description identifies two sleeping Psychlops, a lower Lividstone, another Psychlops near a geyser and a Hunter above. The Hunter's missiles repeatedly strike a green bulb, releasing/retracting a water-lily platform. The cage's shield disappears only after the area's enemies are defeated. Ludo's route uses the missile-driven platform to reach the vine, then reaches and defeats the Hunter before breaking the cage. [RayWiki](https://raymanpc.com/wiki/en/It%27s_a_Jungle_Out_There...), [Ludo route](https://origin.ludo.guide/guide/rayman-origins/jibberish-jungle-0301)

```text
Hunter alive → missiles → bulb toggles → platform access → reach Hunter
                                                   → defeat all guardians
                                                   → cage shield removed
```

The official Feral manual separately documents guarded cages, temporarily doubled Lums after collecting a Lum King, and floating Bubble Lums that must be popped/collected before escaping. A good collection route therefore has an ordering and a lifetime. No exact “stacked cage” layout was verified, and none is invented here. [Feral / Ubisoft manual](https://www.feralinteractive.com/en/manuals/raymanorigins/latest/steam/)

**Inference:** a dangerous actor can power the player's access before becoming the final target. Distinguish that from a guard simply standing beside a switch. The prototype's sentry projectiles are not confirmed as switch activators, so the supported adaptation needs an independently authored cycle rather than an invented projectile interaction.

**Celeste, Mirror Temple rescue — the carried object changes which moves are available.** Neoseeker's chapter guide documents that holding Theo's crystal prevents dashing/climbing while still permitting jumps and wall kicks. Theo can be thrown through thorns and into switches; dropping him into a fatal pit or crushing him resets the attempt. The same guide describes seekers breaking blocks and activating switches that Madeline cannot safely access. Dash-activated platforms can transport the crystal across gaps. [Neoseeker, Mirror Temple tools and rescue](https://www.neoseeker.com/celeste/walkthrough/Chapter_5_-_Mirror_Temple)

```text
carry Theo → throw to safe receiver / switch → regain dash and climb
           → traverse separately → retrieve Theo → continue together
```

**Inference:** the cargo is a route obligation and a movement constraint, not just a key at the end. Our crate puzzle can express “leave a needed object in the right state/position before advancing,” but the prototype does not support literal Theo carrying.

**Celeste, Farewell — send the tool through a route you cannot take.** The specialist Farewell guide describes a wind section where a thrown jellyfish reaches a key inside electricity, Madeline falls when she loses the jellyfish's lift, and the key unlocks a platform. She then traverses back through moon blocks and retrieves the previously thrown jellyfish for the next passage. Other described sections throw the jellyfish into a spring and re-catch it after a separate movement chain. These are guide-supported sequences, not video-observed maps. [Celeste Wiki, Farewell strategies](https://celestegame.fandom.com/wiki/Farewell)

**Inference:** the player's path and the tool's path separate, then rejoin. A crate/state equivalent can have an outward action expose a later return launch. The prototype lacks jellyfish and wind, so the goal is the dependency structure rather than new flying cargo physics.

These are **design inferences** grounded in the preceding evidence and source cases, not descriptions of a universal formula used by every game in each series.

| Family | Productive idea for these three levels | What should not be assumed transferable |
| --- | --- | --- |
| Crash | Destroyable footing, action order, selective attacks, TNT as geometry editing, switches and all-box accountability. | Exact jump values, bonus scoring rules across releases, timed switches, armored crates and Nitro-bounce conversion. |
| Mario | A readable beginner encounter before a multi-step enemy, geometry that teaches, a manageable goal path with demanding collectible objectives. | Carryable Koopa shells, item transformations or switches absent from the runtime. |
| Donkey Kong Country | Enemy bounce relays, patterned commitment, recoverable observation perches before a sustained sequence. | Roll-jumps, barrel-cannon aiming or forced minecart behavior. |
| Rayman | A legible sequence of actions with rhythm, then a distinct action interrupting the rhythm. | Music synchronization without a rhythm system; chase mechanics without actual pursuit. |
| Celeste | Compact room-scale retry, clear movement destination, kindness around precision. | Dash recharge, wall climbing, stamina or a blanket need to tighten this prototype's movement. |
| Shovel Knight | Consistent readable spaces, rewards placed around tools, a theme developed through related room setups. | Pogo behavior, ammunition economy and screen reset rules absent from the prototype. |
| Spelunky | Judge a system before acting; let explosions and enemies have consequential interactions; maintain more than one viable approach where possible. | Large chaotic random cascades as a substitute for a readable authored puzzle. |
| Trine | Tool choice and an alternate solution should materially change the route or exposure. | Player-generated boxes, weighted seesaws, water/fire simulations or mandatory cooperative roles. |
| Meat Boy | Clear fast movement, concise local retry, camera-aware geometry. | Routine maximum-reach jumps or turning every all-crate room into a speedrun. |

## Puzzle pattern taxonomy

Everything below is **our original authoring framework**. The real-game cases supply evidence that these interactions are worth exploring; the proposed variants are not claims about an unseen canonical room.

### Destruction and support

1. **Harvest before dismantling.** An upper target depends on a breakable lower support. Correct play uses the support, collects the high target, then destroys the tool. Test the wrong order: breaking the support must actually remove access in the current state, not merely change a visual. Give a visible explanation for any missed target.
2. **Spend bounces deliberately.** A multi-hit box is a finite-height/retry resource. The player must avoid wasting the final hit before accessing a cap or crossing. Begin with one box and a safe recovery, then add two different height targets. A counter adds information; it does not itself make the route a puzzle.
3. **Selective air-spin.** The attack must intersect an upper or middle target while a needed lower support or nearby explosive survives. Validate the actual attack volume. A plausible-looking thin gap can be mechanically impossible, especially with a three-dimensional attack box.
4. **Attack and recover.** The target hangs beyond safe footing. The player commits into the air, breaks it, then returns to a previously visible refuge. The recovery decision is essential. A full catch floor converts this into ordinary collection.
5. **Destroy behind you.** Traversal consumes the stepping stones already used. Each bounce is both progress and deletion. Use a predictable direction and give the next foothold room for error. Distinguish this from an upper-first room, where destruction should be deferred.
6. **Temporary foothold, permanent reward.** A TNT crate or crumble pad serves as an access tool with a deadline. The deadline begins at a deliberate contact. Make the activation rule clear before layering nearby enemies.
7. **Falling cap.** Break a lower member to lower a previously unreachable cap or metal stepping stone. The reward is a changed elevation rather than just a cleared stack. A metal falling onto the player is a real extra hazard; give space to observe the transformation.
8. **Repeat hopping crate.** Remove an intervening support so a plain metal crate lands on an arrow pad and begins hopping. That creates a timed window under or above it. Do not place it as a decorative stack if the player can walk around it without a decision.

### Switches, state and return routes

9. **Bridge materialization.** A visible outline route links switch to destination. The first version is immediate; later, the switch is reached through a height tool and the newly available return path matters. Distinct group membership prevents an unrelated earlier switch from solving every later puzzle.
10. **Advance to change the past.** The switch appears beyond an earlier unharvested outline target. The player must recognize it, advance, activate, backtrack, harvest, then resume. Keep the earlier room in sight or use a strong repeated landmark so backtracking is readable.
11. **Different outward and return routes.** An outward lower route reaches the switch; its newly materialized upper route provides return access or the next exit. This can express a multi-stage dependency without a timed-switch engine.
12. **Do not press yet.** Activation removes a currently useful resource, exposes hazards or starts a deadline. The solution delays an otherwise attractive action. It needs a safe preview and should come after a room that teaches the switch's actual effect.
13. **State-dependent clearance.** TNT removes part of a structure, revealing a previously blocked lower route. The player's refuge and return access must be supported in both states. The Nitro-bounce case is a strong commercial example of this grammar, but its material-conversion action is unavailable here.
14. **Local explosion, remote activation.** Put a normal switch inside a TNT blast's reachable area and outlines outside that area. A blast can activate a switch in this prototype. Show the causal link; test that the blast cannot prematurely remove the new reward targets or kill the player on the refuge.
15. **Global cleanup after use.** A green switch clears Nitro only after the player has finished any traversal near that hazard arrangement. Because the prototype switch is global, all earlier and later Nitro dependencies must be audited together.

### Enemy and geometry composition

16. **Action choice.** A turtle resists spin and favors a stomp; a spiker resists stomps and favors a grounded/air spin. Put each on stable space before combining their rules with crate access. Two different enemy types are meaningful only if choosing the wrong action changes the result.
17. **Enemy as height tool.** The player must retain a stompable foe long enough to bounce to a high reward, then clear it. A required fling is a different action and removes the height tool. Confirm enemy bounce height and motion empirically rather than assuming Crash's values.
18. **Enemy as projectile.** A spin flings an enemy toward crates. Arrange targets within the actual ballistic interval; provide direct access for important counted crates if the fling is variable. In this prototype a fling cannot directly hit a `!`, so do not write that as the required solution.
19. **Bait, evade, punish.** A charger has a warning, unsafe dash and recovery. Use a visible upper/side refuge, then a reason to approach during recovery. A narrow unavoidable corridor can make the same enemy unfair rather than difficult.
20. **Wait for vulnerability.** A spinner is dangerous while extended and safe while retracted. The observation perch and next movement must fit its cycle. Add a crate target only after proving both a slow waiting strategy and the intended aggressive strategy.
21. **Sentry as a sightline puzzle.** Cover changes whether a projectile can be fired. The player leaves cover to reach a crate or switch, then returns. Keep the muzzle, target and cover silhouette visible; a projectile appearing from an offscreen foe tests memory rather than the presented room.
22. **Jump-path interference.** A harmless-looking high reward places the player's trajectory near a floater or spiker. The reward's approach and the enemy's danger zone create the decision together. Spamming unrelated enemies at floor level does not express this pattern.

### Layout, pace and mastery

23. **One room, two objectives.** The exit is obtainable through a moderate path; collecting all crates requires a different order or upper return. Clearly show what remains after an ordinary clear. Keep this distinction explicit in the level's description and finish behavior.
24. **Preview, commit, recover.** A room exposes three supported positions: observation, a meaningful action, and recovery. Advanced versions remove an intermediate rest, but not the ability to read the start. “Hard” should not mean the camera hides the next landing.
25. **Rule change after repetition.** Teach two safe ordinary bounces, then make the third crate one that must survive. Provide a visible cue so the change can be read before the irreversible action. The goal is to test understanding, not to punish successful use of an established rule without warning.
26. **Compact synthesis.** A climax combines already taught rules: preserve a bounce support, bait an enemy, activate a switch, return to harvest, then dismantle. Limit simultaneous uncertainty. A new enemy, new crate rule and new camera direction introduced together make failure hard to diagnose.

## Designing a genuine three-level progression

The following is a proposed progression for the authored prototype, **not a claim about the final implementation**. Each room needs an intended input/action sequence and a recorded failure sequence before it can count as expressing the research.

| Design axis | Level 1: learn the dependencies | Level 2: choose and transform | Level 3: retain a plan through several states |
| --- | --- | --- | --- |
| Crate role | One support also holds reward value. | One structure contains reusable, consumable and explosive members. | Supports serve outward and return routes at different times. |
| Action order | Reach high target before breaking support. | Reach refuge before fuse; create route before returning. | Preserve two tools until separate later objectives are complete. |
| Enemy role | One obvious action choice on stable ground. | An enemy changes a jump window or can clear crates. | A previously taught enemy cycle intersects the planned return. |
| Timer | Deliberate single fuse after preview. | Two sequential commitment windows separated by a refuge. | One pressure segment spanning two known actions, with clear recovery. |
| Camera | One side-view frame shows cap and support. | A composed view shows pre/post-blast states and return route. | Related rooms retain clear landmarks through height/heading changes. |
| Mastery | All crates adds one visible upper action. | All crates requires a small detour and return. | All crates requires retaining the correct state across a multi-room loop. |
| Retry | Before every first irreversible lesson. | Before each transformation room. | Before each compound puzzle; avoid saving after destroying its last tool. |

Richness means more relationships, not merely more meters, enemies or spikes. A three-step dependency with generous jumps is richer than ten maximum-distance gaps. A challenging all-box route can remain fair if the geometry reveals the target, the remaining resource and the consequence of the next action.

## Room validation and playtest evidence

For every room, fill out this matrix against the real browser runtime:

| Question | Evidence needed |
| --- | --- |
| What is the player trying to change? | Name the target, state change and next supported position. |
| Which crate is currently a tool? | Record its type, remaining hit budget and all dependent targets. |
| What is the tempting wrong order? | Perform it and record exactly which target or route is lost. |
| Is the required order actually required? | Try direct jumps, double jumps, wall/rail interactions, alternate attacks and depth movement. |
| Can an ordinary clear differ from an all-box clear? | Verify both deliberately and show the difference in the outcome. |
| Does TNT transform the intended members? | Compare live crate state before and after the blast; test chain radius and switch activation. |
| Is a timer meant to be started intentionally? | Confirm contact rules and a clear refuge outside the blast. |
| Can the player read the transformation? | Screenshot before activation, during commitment and after settling. |
| Does death reset the puzzle to a solvable state? | Test pit/death respawn before and after switching and destruction. |
| Can the checkpoint preserve a failed state? | Attempt the bad order, activate the checkpoint if reachable, die and inspect restoration. |
| Do optional routes accidentally mask the problem? | Remove the shortcut from consideration, then test whether the intended puzzle itself works. |
| Is the failure mechanical or conceptual? | Separate missing reach, attack-volume collision and unreadable camera from a understood wrong choice. |

For mandatory movement, begin comfortably within locally measured jump reach. Tighten the interactions first: less convenient refuge, one extra dependent target, a vulnerability cycle, then reduced footing. Preserve authored tuning. Check full-render visibility after `?lite`; source-owned geometry checks and build validation do not substitute for playing the room.

## Research limits and source integrity

- Original Crash 1, original Crash 2/3, N. Sane and Crash 4 differ. Crate totals and bonus retry/count rules are not silently merged. The Hangin' Out conflicting total is flagged above; all exact claims name their source/release.
- GameFAQs direct fetching was denied by robots restrictions. Its indexed guide passages were read through search results; direct source access was not retried. The Neoseeker and Crash Mania mirrors were located as additional routes to original guides, but an unread PDF is not used to establish an exact crate map.
- No walkthrough video is described as completely watched merely because its title, description or auto-captions were available. Timestamp samples and transcript ranges are identified explicitly.
- The downloaded Gamepressure Ruination and Hangin' Out images inspected during research show bonus entrances, not the internal bonus arrangements. They do **not** establish tower counts or bonus-room coordinates and are not used for those claims.
- The schematics encode sourced relationships and observed counts. They do not invent metric distances, tile positions or missing crates. Original levels must be dimensioned around this prototype's measured movement.
- Primary developer accounts substantiate intention and process. Specialist guides substantiate particular puzzle sequences. Our taxonomy, progression and proposed adaptations are explicitly design inference.
- The research covers nine platformer families and several different crate-puzzle mechanisms. It is broad and detailed within the supplied sources; a claim to have exhaustively catalogued every puzzle in every release would exceed the evidence.

## Great Gate interaction added in the follow-up

The Great Gate combines a directly struck upright wooden plank with a horizontal landing and an iron-arrow ascent. [Prima](https://primagames.com/eguides/crash-bandicoot-n-sane-trilogy-eguide/n-sanity-island/the-great-gate) and [Gamepressure](https://www.gamepressure.com/crash-bandicoot-n-sane-trilogy/the-great-gate/z49eb4) describe a short horizontal window in N. Sane. Our follow-up intentionally latches the timber open, as requested: direct spin contact visibly changes the level into stable footing, with checkpoint restoration of the changed state. This is an adaptation, not a claim that the commercial plank has the same permanence.
