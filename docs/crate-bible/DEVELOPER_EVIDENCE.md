# Developer evidence: what the makers of Crash 2, 3 and 4 said about level design

What Naughty Dog (Crash 1–3), Mark Cerny, Vicarious Visions (N. Sane Trilogy) and Toys for Bob
(Crash 4: It's About Time) have said in public about building Crash levels. The crate maps in
[`levels/`](levels/) record what the games *do*. This file records what the people who made
them said they were *trying* to do, so the bible can tell measured practice apart from stated
intent. Compiled 2026-11-09.

**Scope.** Mostly primary and near-primary text: the developers' own posts and signed articles,
interviews that quote them directly, period magazine interviews on archive.org, and official
Activision, Sony and Xbox posts. A few journalist accounts are included and labelled `PARA` or `OBS`.
No video, no YouTube, and none of the blocked wiki or forum sites.
Each claim is a short paraphrase. Quotations are a sentence or less. Translations from
Japanese, Polish and Italian are ours and are marked as such.

## How to read this file

| Label | Meaning |
|---|---|
| `DEV` | **Developer statement.** The developer's own words: their blog post or signed article, or a direct quotation in an interview. "Gavin reporting Cerny" means a developer recounting what a colleague said. |
| `PUB` | **Official publisher text.** Activision blog and support pages, Sony PlayStation Blog staff posts, Xbox Wire. It reliably describes the shipped design but rarely gives the reasoning. |
| `PARA` | **Journalist paraphrase of a developer.** The journalist attributes a view to the studio without quoting it, or reports an interview we could not read ourselves. Treat as weaker. |
| `OBS` | **Journalist observation.** A hands-on description with no developer attribution, used only to corroborate. It is not evidence of intent. |

Claim IDs (`L3`, `J1`, …) are cited by the principles at the end. Links point to the
[source register](#source-register).

**Already covered elsewhere.** [PLATFORMER_PUZZLE_RESEARCH.md](../PLATFORMER_PUZZLE_RESEARCH.md#primary-developer-evidence)
already cites Making Crash parts 4–6 for Heavy Machinery's side-view ingredients, the Donkey Kong
Country credit, the "introduce, then twist" theme rule, rollers as timing gates, provoking plants,
the crate palette, the TNT/crate/TNT puzzle, the continue economy and Dynamic Difficulty Adjustment.
It also cites Activision's Crash 4 level-type, collectible and hands-on pages. Those points are not
repeated here except as cross-references marked *(already cited)*. This file adds the rest of those
posts (controls, camera, enemy budget, testing) and everything else below.

---

## 1. Level structure and pacing

- **L1** Gavin says the team worried that a "Sonic's Ass" 3D platformer would cause camera
  trouble and dizziness and make depth hard to judge. Rubin's answer had three parts: Crash starts
  facing the player, side-view 2D levels guarantee the quality of the gameplay, and some levels run
  *into* the screen, which became the boulder levels. — Gavin and Rubin, [Making Crash part 1][mc1],
  2011-02-02 · `DEV`
- **L2** Rubin lists three options the team considered for 3D: rotate a side-scroller into 3D;
  go in and out of the camera but keep it "confined still, because it's still a platform game with
  a linear progression"; or go fully open. They ruled out fully open. — Jason Rubin, quoted in
  [IGN, Rising to Greatness][ign], 2013-10-05 · `DEV`
- **L3** "Your short term goal in Crash is always very obvious." Gavin sums it up as move forward
  and stay alive, and contrasts it with working out what Mario 64 wants from you. — Andy Gavin, [IGN][ign],
  2013-10-05 · `DEV`
- **L4** The first two levels built (Cliff/Waterfall and Cave, spring 1995) were cut because the
  designs were "too open… not channeling the player well enough for proper gameplay"; "If the space
  was so big that Crash could just walk around the enemies it wasn't very fun." — Andy Gavin,
  [Interviews "R" us][ru], 2011-08-13 · `DEV`
- **L5** After those failures the team jumped about two-thirds of the way into the game, to the factory
  levels, to find the fun. Rubin says the first jungle had been too big a leap: start simple and then add
  complexity. Two or three levels per art theme, introductory challenges first and twists later, is
  *(already cited)*. — Gavin and Rubin, [Making Crash part 4][mc4], 2011-02-05 · `DEV`
- **L6** Three level types came out of that period: side view, over the shoulder, and into the screen.
  The into-the-screen jungle corridor ("levelc", Jungle Rollers) is where that style "really came into its own".
  — Andy Gavin, [Making Crash part 4][mc4], 2011-02-05 · `DEV`
- **L7** Gavin's 1999 article says Crash 2 levels "are about twice as large, have integrated bonus levels,
  multiple branches, 'hard paths'". Warped added "a much more open look… with views up to ten times as far",
  free-roaming levels that "presented a great gameplay challenge", and nearly twice as many creatures and
  gameplay modes as Crash 2. — Andy Gavin, [1999 article reposted as Teaching an Old Dog New Bits part 3][od3],
  2011-03-28 · `DEV`
- **L8** For Warped: "This part will have many more 3D levels", because not everyone loves 2D
  platforming (our translation). Abilities learned in later levels let the player return a few levels
  and reach bonus areas. — Jason Rubin, *Neo Plus* (Poland) September 1998, reproduced on a [PPE.pl reader blog][neoplus],
  2014 · `DEV` (translated)
- **L9** The game's structure "shouldn't change much": many levels follow the existing types with new
  tricks, alongside new challenges "completely different… in terms of gameplay" (our translation). — Jason
  Rubin, Italian *PSM* August 1998, [archive.org][psmit] · `DEV` (translated)
- **L10** Naughty Dog pledged to keep the "straightforward, challenge-based" gameplay, with no
  free-roaming world. Crash 3 levels are more likely to combine forward-scrolling, side-scrolling and
  chase formats in one level, such as a prehistoric level that ends in a Triceratops chase. — *Official U.S.
  PlayStation Magazine* November 1998 cover feature, [archive.org][opm98] · `PARA`
- **L11** Crash 2 is Gavin's favourite: "the play is very balanced", it is "hard but not brutal", and
  it has a bigger, more flexible move set. Crash 3 "relies a little too much on gimmick levels". He
  prefers Crash's approach because it is "more straightforward to play with less thinking involved
  (more twitching)". — Andy Gavin, [Pixelvolt interview][pixelvolt], 2013-09-25 · `DEV`
- **L12** By Crash 2 and 3 "we had a formula": "Mark Cerny created the science behind making a good
  Crash Level", Dan Arey worked on the designs of the later games, and many levels had guest designers.
  — Jason Rubin, [Crash Mania interview][rubincm], 2008-06-16 · `DEV`
- **L13** Half of Cerny's time was "enough to do essentially all of the level design" for Crash 2
  (staff of about 15). Elsewhere he says "I essentially laid out the entire game", down to individual
  Wumpa placements. — Mark Cerny, [Game Developer][cerny11], 2011-07-11 · `DEV`, and Official PlayStation
  Magazine UK 2013 as reported by [Push Square][cernyps], 2013-09-16 · `DEV` (reported)
- **L14** Cerny's stated aim for a level is "an experience that you can settle into, a groove that you
  can get into as a player". He admires Portal because each of its challenges is "another brick or
  layer" on the ones before. — Mark Cerny, [Tom Chatfield interview][cernytc], 2013-07-26 · `DEV`
  (his general view, stated in the Knack/Crash context)
- **L15** On N. Sanity Beach the beach "feels safe", and in the jungle "things get a lot more dangerous
  and challenging". The level escalates within itself. — Dan Tanguay (Vicarious Visions), [PlayStation Blog][psbbeach],
  2017-06-27 · `DEV`
- **L16** "Looking at the levels of a Crash 2 was a really good jumping-off point for us", for "the
  layered mechanics of enemies, hazards, and challenges". Inverse describes the result as a "multiplicative" structure, with
  mechanics introduced slowly and then combined. — Lou Studdert (Toys for Bob), [Inverse][inverse], 2020-10-02 ·
  `DEV` (the "multiplicative" framing is `PARA`)
- **L17** "We introduce one mechanic in one level", then layer it into later levels once it is
  mastered. Presenting levels in a linear fashion "gives us two advantages": a more reliable story and finer difficulty tuning.
  — Paul Yan (Toys for Bob), [Crash Mania transcript of a Canadian Guy Eh interview][cge], June 2020 · `DEV`
- **L18** "We structure our levels in a linear hallway type", moving forward and back through space,
  so mechanics and enemies can be introduced and then ramped in, twisted and layered "in more convoluted
  ways in the subsequent levels". — Paul Yan, [Press Start][pressstart], 2020-06-23 · `DEV`
- **L19** A return to "a more linear format" makes difficulty, complexity and narrative more authored.
  The team is "deliberate in how it onboards and escalates new ideas and challenges". — Paul Yan,
  [Gfinity][gfinity], 2020-09-17 · `DEV`
- **L20** The Quantum Masks are spread across dozens of levels so that the challenges grow, landscapes are larger,
  other levels are visible from the path, and nooks and secret spots reward exploration. — James
  Mattone (Activision), [PlayStation Blog][psbjun20], 2020-06-22 · `PUB`
- **L21** Dan Arey (later a Crash 2/3 and Jak designer) contrasts Crash's structured, level-by-level
  design with Mario 64's open levels. — Retro Gamer 256 as reported by [GamenGuide][arey], 2024-02-19 · `PARA`

## 2. Gaps, platforms and jumps

- **J1** Controls are "the single most important thing" in a character action game. Cerny's notes on
  the prototype were that Crash "doesn't stop fast enough" and that "he needs to be able to jump for a
  frame or two AFTER he's run off a cliff or it will be frustrating". Gavin rewrote each control scheme
  "at least five or six times". — Andy Gavin reporting Mark Cerny, [Making Crash part 4][mc4], 2011-02-05 · `DEV`
- **J2** When a level felt too hard or too easy, the usual fix (Rubin's or Cerny's call) was to add or
  remove a platform or an enemy. Every such change forced the background polygon budget to be balanced again.
  — Jason Rubin, [Making Crash part 3][mc3], 2011-02-04 · `DEV`
- **J3** Crash 1's lead designer, then a "department of one", says he had no concept of raising the
  difficulty and then letting players stay at that level for a while: "In my mind, literally every
  single jump was slightly harder than the one that came before it." — Taylor Kurosaki, [IGN][ign],
  2013-10-05 · `DEV`
- **J4** Naughty Dog's original level geometry "answered a lot of questions, especially in terms of
  scale and the spacing between obstacles". The remake rebuilt every level using it as a guide. — Leo Zuniga (lead level
  designer, Vicarious Visions), [Engadget][engadget17], 2017-07-03 · `DEV`
- **J5** The remake kept the original layouts but changed the physics. It used Warped's handling as the baseline, tuned
  jump metrics per game to match the originals, made Crash fall faster after the jump button is released
  in the first game, and used a different collision system, so "certain jumps require more precision than the
  originals". — Vicarious Visions via Kevin Kelly, [Activision blog "Go Ahead and Jump!"][jump17], 2017-07-17 · `PUB`
- **J6** The PS1 games measured how long jump was held to set the height and arc. The remake made every
  jump full height, "Then realized Crash couldn't make half the jumps in the game", which leaves short,
  precise hops floaty and awkward. "The minutiae of timing and feel matter a lot more than people realize."
  — Andy Gavin, LinkedIn post quoted by [Nintendo Life][gavinli], 2025-07-18 · `DEV` (quoted in press)
- **J7** "We turned the 2D game 90 degrees into the screen." Precise 2D-style platforming in 3D was the
  core, and "We were actually most derivative of Donkey Kong Country." — Jason Rubin,
  [Gamasutra / Game Developer][rubingama], 2007-08-24 · `DEV`
- **J8** Crash 1 tied the control axis to the camera, so that "Crash moves into the screen when you push up
  on the joypad", for solid control. — Andy Gavin, [1999 article][od3] · `DEV`
- **J9** Crash 4's design pillar is "precision platformer". The new ropes are there "to test the players
  precision and timing", and the team wanted "a lot of improvements… in terms of his timing". — Paul Yan,
  [Press Start][pressstart], 2020-06-23, and [Engadget][engadget20], 2020-06-22 · `DEV`
- **J10** In Crash 4, "Crash's shadow is a clean yellow circle with a bold outline, which helps dial in precise
  jumps". — Tim Turi (Sony), [PlayStation Blog hands-on][psbaug20], 2020-08-14 · `OBS`. No Toys for
  Bob statement on the landing indicator was found.

## 3. Obstacles and hazards

- **H1** Rollers "provided timing gates" and "could be doubled or tripled up for more challenge"
  *(already cited)*. Pits, fallen logs and tikis are jumped. Side-view levels used steam vents, drop
  platforms, bounce pads, hot pipes and patrolling monsters *(already cited)*. "In the sequel to the
  jungle level we added drop platforms and moving platforms": the next level in the same theme, not a later
  game. — Andy Gavin, [Making Crash part 4][mc4], 2011-02-05 · `DEV`
- **H2** In Crash 1 some hazards fire without warning: "Spikes are just gonna come out, no matter where
  you are — and you have no idea!" When testers stalled, the remake added visual tells. Zuniga's question to the
  team was "can we add one, because the testers are not getting through all of a sudden?" — Leo Zuniga,
  [Engadget][engadget17], 2017-07-03 · `DEV`
- **H3** "When we think about the stream of hazards and platforms that come your way, it's almost
  rhythmic in nature", and once players understand that rhythm "you can get into a state of flow". Yan
  wants "precision in how things are telegraphed". — Paul Yan, [Engadget][engadget20], 2020-06-22 · `DEV`
- **H4** Hazards and enemies "stream across in almost a rhythmic way", and Crash 4 wanted to maximize that.
  — Paul Yan, [Press Start][pressstart], 2020-06-23 · `DEV`
- **H5** A founding rule was that "the difficulty had to be fair and not cheap": "there were no crazy
  things that unfairly took you by surprise and felt like the game was cheating." — Lou Studdert,
  [Nintendo World Report][nwr], 2021-03-16 · `DEV`
- **H6** Crash has no lava levels because Crash is orange: "We made one in Demo, and that ended the lava
  debate." Colours that read badly on screen were "strictly outlawed". — Jason Rubin, [Making Crash part 2][mc2],
  2011-02-03 · `DEV`
- **H7** In the cut Stormy Ascent, "The hazards and platforms steadily increase in speed as you go along!"
  Its designer says the level sat "so close to the end of the game" and ended up "insanely difficult". —
  Dan Tanguay and Taylor Kurosaki, [PlayStation Blog][psbstormy], 2017-07-20 · `DEV`
- **H8** For Future Tense, the new N. Sane level, the team "added some new behavior capabilities to the existing hazards and
  enemies" and prototyped small puzzles with the Future hazard set "outside of the level itself". — Kyle
  Martin (Vicarious Visions), [Xbox Wire][xbwft], 2018-06-29 · `DEV`
- **H9** For the jet-ski waves the remake kept the old design: new technology, used to "emulate the pacing and
  layouts of the old levels". — Leo Zuniga, [Engadget][engadget17], 2017-07-03 · `DEV`
- **H10** In the classic games, touching a Nitro crate killed Crash. Crash 4's time mask lets Crash touch one and
  escape the blast, so "The player will need to be strategic to determine when to use that power". — Paul Yan,
  [Game Informer][gi20], 2020-06-22 · `DEV`

## 4. Enemies

- **E1** "Video games need lots of minions." — Andy Gavin, [Making Crash part 2][mc2], 2011-02-03 · `DEV`
- **E2** Skunks travel "back and forth toward the player, requiring him to attack them or jump over them".
  Stationary plants must be teased into a strike before Crash jumps on their heads *(already cited)*. — Andy
  Gavin, [Making Crash part 4][mc4], 2011-02-05 · `DEV`
- **E3** Even at 50–100 polygons each, "we could show two or three at most", so "the next challenge either
  had to be part of the background, like a pit, or far away". Empty space "plagued us for a long time"
  until crates arrived. — Jason Rubin, [Making Crash part 5][mc5], 2011-02-06 · `DEV`
- **E4** The PlayStation could not handle many enemies on screen at once, which left sparse areas that
  crates later filled. — Jason Rubin, [Crash Mania interview][rubincm], 2008-06-16 · `DEV`
- **E5** Open spaces that let Crash walk around enemies were not fun (see L4). — Andy Gavin, [Interviews "R" us][ru],
  2011-08-13 · `DEV`
- **E6** "Crash 2 has about twice as many creatures as Crash 1, and their behaviors are significantly more
  sophisticated." — Andy Gavin, [1999 article][od3] · `DEV`
- **E7** GOOL, Naughty Dog's in-house scripting language, made it possible "to prototype a new creature or object in as little as 10 minutes", and a creature
  that did not work could be pulled from the game in seconds. — Andy Gavin, [Making Crash part 9 (GOOL)][gool],
  2011-03-12 · `DEV`
- **E8** Cortex's ray gun shoots hazards and turns them into solid or bouncing platforms. Yan calls those levels "a
  little bit more cerebral, a little bit more strategic", because the player decides when to convert what.
  — Paul Yan, [Press Start][pressstart], 2020-06-23 · `DEV`. Activision's hands-on post describes the same
  enemy-to-platform role *(already cited)*.
- **E9** "The bosses in the past were rather short and confined." Crash 4's bosses add layers and
  stages and cover more distance. — Paul Yan, [Game Informer][gi20], 2020-06-22 · `DEV`
- **E10** Future Tense gave existing enemies new behaviours rather than adding new ones (see H8). — Kyle Martin,
  [Xbox Wire][xbwft], 2018-06-29 · `DEV`

## 5. Camera

- **C1** "But we worried about the camera, dizziness, and the player's ability to judge depth." Rubin's
  worry was that a camera always behind Crash presents his back. — Gavin and Rubin, [Making Crash part 1][mc1],
  2011-02-02 · `DEV`
- **C2** The camera runs on a track "next to, behind, or in front of the character" (a branching rail
  camera). The team used "twists and turns in the environment to hide a lot of the landscape from view",
  which kept the visible polygon count within budget. — Andy Gavin, [Making Crash part 3][mc3], 2011-02-04 · `DEV`
- **C3** The original over-the-shoulder view "faired miserably with level1 and level2". It worked later
  in the factory levels and in the into-the-screen corridor. — Andy Gavin, [Making Crash part 4][mc4],
  2011-02-05 · `DEV`
- **C4** "So we used a camera on rails (albeit branching rails)", which served detailed visuals and
  Donkey Kong Country-style play. Mario 64's early camera was frustrating. — Andy Gavin, [Making Crash part 6][mc6],
  2011-02-07 · `DEV`
- **C5** "We had an incredibly hard time with camera control in our more constrained rails environment."
  — Dave Baggett, [Making Crash part 7][mc7], 2011-02-10 · `DEV`
- **C6** "In order to enhance the tight, high impact feel of Crash's gameplay, we were fairly conservative
  with the camera." Crash 2 "allowed the camera to look around much more" and added more branching and
  transition cameras. — Andy Gavin, [1999 article][od3] · `DEV`
- **C7** Kurosaki's Crash 2 wish list included "the camera being able to turn around" and expanded move
  sets. — Taylor Kurosaki, [IGN][ign], 2013-10-05 · `DEV`
- **C8** A rear view mostly shows Crash's back, so the team added running-into-the-screen levels and side-scrolling
  sections to show his face. — Jason Rubin, [Game Developer][rubingama], 2007-08-24 · `DEV`
- **C9** On Mario 64: "The camera was very frustrating". On Crash: it "had a button to jump and a button to spin
  and the directions", which made it easier for a mass audience. — Gavin and Rubin, [IGN][ign], 2013-10-05 · `DEV`
- **C10** Crash 4 is "changing up the camera so we can see more" of the level. — Paul Yan,
  [Press Start][pressstart], 2020-06-23 · `DEV`
- **C11** "We wanted to have huge sightlines so that you could look up and see something like a temple"
  that the player will climb later. — Lou Studdert, [Inverse][inverse], 2020-10-02 · `DEV`
- **C12** Crash 4's camera sits further out, which gives more time to see obstacles. — Tim Turi,
  [PlayStation Blog hands-on][psbaug20], 2020-08-14 · `OBS`

## 6. Difficulty, checkpoints and assistance

- **D1** Making players earn continues was "a major mistake". The fix was Dynamic Difficulty Adjustment:
  an Aku Aku mask at the start of a round, a slower boulder, and a fruit crate that becomes a continue point
  after repeated deaths. "Our mantra became help weaker players without changing the game for the better players."
  *(already cited)* — Jason Rubin, [Making Crash part 6][mc6], 2011-02-07 · `DEV`
- **D2** Sony Japan producer Shimizu "did help us smooth out some sections and make them easier (often by
  adding extra continue points". The Japanese team also proposed Aku Aku boxes that explain mechanics,
  about 200 paragraphs of in-level text. — Andy Gavin, [Crash goes to Japan part 1][jp], 2012-01-11 · `DEV`
- **D3** Europe asked Naughty Dog to "make the game harder because European gamers like a challenge", and
  the team refused to accept that "truism". The data format still let regions differ: one jungle continue point
  was flagged "hide in europe". PAL's 25 fps meant creature numbers had to be retuned. — Andy Gavin,
  [Parlez vous Crash][eu], 2012-01-06 · `DEV`
- **D4** Kurosaki calls Crash 1 "Way too hard" (see J3). The cut rainy castle-wall climb, released in 2017 as Stormy Ascent, "was
  playable, but just too damn difficult, and we ran out of time to make it easier". Kurosaki: "I didn't have a great
  understanding of a difficulty curve." Gavin: it was cut "because it was too hard and we didn't have time to
  balance it properly". — Kurosaki, [IGN][ign] 2013 and [PlayStation Blog][psbstormy] 2017-07-20; Gavin,
  [PostDesk interview][postdesk], 2012-03-16 · `DEV`
- **D5** Early teams built games without testing them on real players, and "The original Crash Bandicoot
  is legendary for that!" Elsewhere: "Crash was a brutally difficult game." — Mark Cerny, [Game Developer][cernyknack],
  2013-12-20, and [Tom Chatfield][cernytc], 2013-07-26 · `DEV`
- **D6** "I think it wasn't until Crash2 that we got the gameplay down." Crash 2 was "re-built from the
  ground up" with lessons from Crash 1 and Mario 64. — Jason Rubin, [Crash Mania][rubincm] 2008 and
  [Making Crash part 6][mc6] 2011 · `DEV`
- **D7** The remake's goal was "to reduce any points of frustration while preserving the challenge of
  the originals". Its DDA "gives Crash Aku Aku masks and checkpoints after a certain number of failures in
  a level", and the modern save and checkpoint systems make Crash 1 "a heck of a lot more forgiving". —
  Vicarious Visions via [Activision blog][jump17], 2017-07-17 · `PUB`
- **D8** Future Tense's first playtests showed "our difficulty curve was way off". When "a Crash
  amateur" could not get past the first section in 30 minutes, "you probably want to tone it down a bit!" The
  team refined "a nice difficulty curve in its critical path, with high skill ceilings in the death route and
  time trials". — Kyle Martin, [Xbox Wire][xbwft], 2018-06-29 · `DEV`
- **D9** "If you die – it's your fault, and there is a way to improve your skills to progress." The
  difficulty curve rests on teaching skills because "we want players to see the whole story". 106% is "another
  story all together", built to "put those players to the test". — Lou Studdert, [Nintendo World Report][nwr],
  2021-03-16 · `DEV`
- **D10** Players choose how much difficulty to take on. The story alone is not very hard, while the
  "3 deaths or fewer" gem is a demanding challenge. Flashback stages could be set "well above the regular stages"
  because only players who have improved will attempt them (our translation). — Paul Yan,
  [Automaton][automaton], 2021-01-05 · `DEV` (translated)
- **D11** Critics faulted the N. Sane Trilogy for sudden difficulty spikes, and Crash 4 set out to fix
  them (`PARA`). New players "won't have to do homework before diving right in" (`DEV`). — Paul Yan,
  [Gfinity][gfinity], 2020-09-17
- **D12** Modern mode exists because lives-based "friction feels a little bit foreign for some modern
  players". It is meant to work "without watering down that classic Crash precision platforming gameplay".
  — Paul Yan, [Press Start][pressstart] and [Engadget][engadget20], June 2020 · `DEV`
- **D13** In Modern mode a death restarts the player at the last checkpoint. Retro mode has limited lives, and losing the last one
  restarts the level. The "playstyle (Modern or Retro) does not affect gameplay difficulty or any reward
  progress". — Stephanie Glover (Activision), [PlayStation Blog][psboct20], 2020-10-01, and [Activision blog][actlaunch],
  2020-10-02 · `PUB`
- **D14** The team dropped the lives system mid-development after identifying pain points in the old games. The aim was
  that players "never hit a point of hard failure". — [Inverse][inverse], 2020-10-02 · `PARA` (unattributed
  to a named developer)
- **D15** In Dino Dash, Crash reaches a checkpoint after a vine grind and before a chase begins. — James
  Mattone, [Activision blog hands-on][acthandson], 2020-07-24 · `PUB`
- **D16** In Warped's time trials, checkpoint boxes disappear and Aku Aku flies away "so everyone is on an
  equal footing when you start". — Jason Rubin, [OPM US November 1998][opm98] · `DEV`

## 7. Crates and collectibles

- **K1** Crates turned "formally dull spots with nothing to do" into fun, and in the end "the challenges
  ended up filling time between Crate challenges!" Gavin tuned the smash feedback to a pinball-like ring-up with
  sound. The crate palette and the TNT puzzle are *(already cited)*. — Gavin and Rubin, [Making Crash part 5][mc5],
  2011-02-06 · `DEV`
- **K2** Crates were Rubin's idea. A late playthrough showed empty areas and players finishing levels too fast,
  and the crates went in overnight: "It felt good to break them, thus filling the boring bits of the level, and the
  puzzles slowed the player." — Jason Rubin, [Crash Mania][rubincm], 2008-06-16 · `DEV`
- **K3** Warped's time trial changes the rules. Hitting the Clock Box makes all fruit spin away, and boxes
  that gave lives instead deduct from your time. "When you're trying for a best time, it's almost as if
  you're playing a completely different game, with a different agenda and a different set of rules."
  Platinum times came from the best Sony tester, journalist and Naughty Dog player, "making sure they can
  actually do it". — Jason Rubin, [OPM US November 1998][opm98] · `DEV`
- **K4** N. Sanity Beach's white gem runs across a crate bridge over a chasm. Tanguay found a second
  strategy: three Aku Aku masks give "just enough time to cross the bridge" by smashing on contact. He presents this as
  something he discovered while playing, not as the original intent. — Dan Tanguay, [PlayStation Blog][psbbeach], 2017-06-27 · `DEV`
- **K5** As before, every crate, including TNT and Nitro, must be broken for the gem, and there are more
  gems and secrets (`PARA`). Nitro plus the time mask is a planned decision (see H10, `DEV`). — Paul Yan,
  [Game Informer][gi20], 2020-06-22
- **K6** Crates are hidden "into every corner and side path". Collecting at least 80% of the Wumpa secures three
  of a level's six gems. Flashback tapes can only be collected "if you can reach their location without
  dying" and unlock Cortex's hardest crate puzzles. — [Activision blog][actlaunch], 2020-10-02, and
  [PlayStation Blog][psboct20], 2020-10-01 · `PUB`
- **K7** The team did not want a game players "could just blast through in a single afternoon", and
  tied completion to expert players. — Lou Studdert, [Nintendo Everything][ne21], 2021-05-22 · `DEV`
- **K8** Each stage has six gems with different conditions, and players choose which to pursue. — Paul
  Yan, [Automaton][automaton], 2021-01-05 · `DEV` (translated)
- **K9** Flashback levels are "devious puzzle rooms" and are meant to be extremely hard. Their deathless
  tape requirement is a tribute to the old death routes. — Lou Studdert at gamescom 2020, as reported by
  [PlayStation LifeStyle][psls], 2020-08-28 · `DEV` (quoted phrase) / `PARA` (rest)
- **K10** Future Tense was built for replay value. "the primary path of the level is able to be completed
  regardless of whether you have any abilities unlocked", while some areas need them. It is
  "full of hidden areas", with a bonus area, a death route and a platinum relic. — Kyle Martin,
  [Xbox Wire][xbwft] and [PlayStation Blog][psbft], 2018-06-29 · `DEV`

## 8. Crash 4 specifics: masks, double jump, modes and side content

- **Q1** The masks are "a really organic way for us to extend Crash's abilities in ways that didn't
  compromise his ability to be simple to pick up and hard to master". — Paul Yan, [Press Start][pressstart],
  2020-06-23 · `DEV`
- **Q2** There are four masks. Lani-Loli phases objects in and out, Akano's dark-matter spin breaks reinforced
  crates and alters movement, Kupuna-Wa slows time, and Ika-Ika flips gravity. — [PlayStation Blog][psboct20], 2020-10-01;
  [Activision blog][actlaunch], 2020-10-02 · `PUB`
- **Q3** The time mask gets "a quick optional practice moment before the real test begins". The practice
  is a `!` box that briefly materialises four crate outlines *(already cited)*. — [Activision blog hands-on][acthandson],
  2020-07-24 · `PUB`
- **Q4** The masks cannot be equipped at will. They appear and disappear in specific guided sections, so they
  cannot be used to break the intended sequence, and tutorials are implicit, without text boxes. — Chris Carter,
  [Destructoid][dtoid], 2020-07-24 · `OBS`
- **Q5** Cortex Castle was meant to test the player's skill. It "can't be cleared unless you fully use the
  abilities of the four masks you gathered along the way" (our translation). — Paul Yan, [Automaton][automaton],
  2021-01-05 · `DEV` (translated)
- **Q6** Crash and Coco share a base move set from the start: "they can jump, double jump, spin slide,
  belly slam". Cortex has no double jump and dashes instead. — Paul Yan, [Press Start][pressstart], 2020-06-23, and
  [CGE transcript][cge] · `DEV`. Contrast Warped, where the double jump was one of six new abilities, some learned
  mid-game and usable to revisit earlier levels (L8). **No Toys for Bob reason for making the double jump
  available from the start was found.**
- **Q7** Long-time fans get "a leg-up on some advanced moves like the slide jump". — Paul Yan,
  [Gfinity][gfinity], 2020-09-17 · `DEV`
- **Q8** Modern mode logs deaths and adds a Clear Gem for finishing a level within a maximum number of deaths. —
  Paul Yan, [CGE transcript][cge], June 2020 · `DEV`
- **Q9** N.Verted mode was co-developed with Beenox, and some of its changes alter how a level plays, not only how it looks.
  Players "will have to give up the control habits they picked up in normal mode" (our translation). —
  [Activision blog][actlaunch], 2020-10-02 · `PUB`; Paul Yan, [Automaton][automaton], 2021-01-05 · `DEV`
- **Q10** "Timelines are designed for each character's unique abilities": Tawna's wall jump and hook
  shot, Dingodile's vacuum and hover, Cortex's ray gun and dash. — [PlayStation Blog][psboct20], 2020-10-01 · `PUB`
- **Q11** New traversal moves are wall running, rail grinding and rope swinging. The only stated rationale
  found is the rope timing test (J9). **No developer statement on rail design was found.** This matters for a skateboarding
  game, because reviewers singled out Crash 4's rail sections. — [Activision blog][actlaunch], [Press Start][pressstart] · `PUB` / `DEV`
- **Q12** Crash 4 is a "perspective-shifting, tense, and precise execution-based platformer". The team
  kept the "classic perspective shift in platforming that made Crash what it was" rather than going
  open-world. — Lou Studdert, [Inverse][inverse] 2020-10-02 and [Nintendo Everything][ne21] 2021-05-22 · `DEV`
- **Q13** The team began by playing all of the original games and comparing them with the remasters, worked with
  hardcore fans in the studio, and had to "dive deep into the original game and play all of it". —
  [PlayStation Blog][psbjun20] 2020-06-22 · `PUB`; Paul Yan, [CGE transcript][cge] · `DEV`

## 9. Testing and iteration

- **T1** Designers are the worst judges of their own game. Rubin tested on complete newcomers, the
  rotating secretaries at Universal: "Only when the noobs start completing challenges and smile WHILE
  PLAYING do you know you are getting somewhere." — Jason Rubin, [Making Crash part 4][mc4], 2011-02-05 · `DEV`
- **T2** "The F word is the most important concept in making games." Cerny, as producer, kept the
  team focused on fun. — Andy Gavin, [Making Crash part 4][mc4], 2011-02-05 · `DEV`
- **T3** Levels were built overnight, with results visible only after 12 hours or more, and "No level was 'done'
  till the game shipped." A changed pit cost "Six to eight hours" of rebuilding. Rubin calls that pipeline
  a nightmare but also "the secret sauce". — Jason Rubin, [Making Crash part 3][mc3], 2011-02-04, and
  [PlayStation Blog][psbbeach], 2017-06-27 · `DEV`
- **T4** "Good gameplay only comes from constant experimentation with and extensive reworking of the
  code." — Andy Gavin, [Making Crash part 9 (GOOL)][gool], 2011-03-12 · `DEV`
- **T5** "The most significant bottleneck in making Crash 1 was the overall time it took to build and
  tune a level." For Crash 2, camera and object data moved into text files. Warped "required that we
  complete a level every week", which real-time parameter tuning made possible. — Andy Gavin, [1999 article][od3] · `DEV`
- **T6** Crash 1 took "6 months of unplayable test levels" before levels were fun. The plan was about 30%
  bigger than what shipped, the overflow seeded Crash 2, and writing a level on paper is much faster than building
  one. — Andy Gavin, [Pixelvolt][pixelvolt] 2013 and [Interviews "R" us][ru] 2011 · `DEV`
- **T7** Cerny's Method means polishing one section fully before building the rest ("So that's 'Method'"),
  spending about 25–30% of the budget on it and cancelling if it does not compel. He describes usability testing simply:
  "you just watched them play". — Mark Cerny, [Tom Chatfield][cernytc], 2013-07-26 · `DEV`. "Pre-production is
  vital because you need to figure out what your design is going to be before you build it." — Mark Cerny,
  [Gamasutra / Game Developer][cernygdce], 2002-09-06 · `DEV`
- **T8** Fans of varying experience tested the remake's builds, and when testers struggled at a hazard the team added a
  tell (H2). — Engadget's account of Vicarious Visions, [Engadget][engadget17], 2017-07-03 · `PARA` / `DEV`
- **T9** Future Tense was built with small puzzles prototyped outside the level, then "studio-wide playtests
  to get a gauge on both difficulty and fun". Modular assets "allowed us extremely fast iteration times". —
  Kyle Martin, [Xbox Wire][xbwft], 2018-06-29 · `DEV`
- **T10** Crash 4's main-path designers and Flashback designers test-played each other's stages and traded
  ideas (our translation). — Paul Yan, [Automaton][automaton], 2021-01-05 · `DEV` (translated)
- **T11** "Gameplay greyboxes were provided by Toys for Bob" and served as the base on which contract level
  artists built the final levels in Unreal. — [Airborn Studios project page][airborn], undated · `DEV` (contractor)
- **T12** Platinum relic times came from top players' demonstrated runs, verified as achievable (K3). — Jason Rubin,
  [OPM US November 1998][opm98] · `DEV`

---

## What this means for the bible

These are design principles that the sources above support. Each lists the claims it rests on. Where a principle
says how to apply it to this game, that part is our inference and is checked against the engine facts in
[CRATE_DESIGN_BIBLE.md Part IX](../CRATE_DESIGN_BIBLE.md#part-ix--translating-crash-geometry-into-this-game),
not something the developers said.

1. **Channel the route, and keep the immediate goal obvious.** Naughty Dog cut its first two levels
   because open space let Crash walk around the challenge. Crash's short-term goal is always "move forward and
   stay alive", and Toys for Bob returned to "linear hallway" levels for the same reason. Lanes should be narrow
   enough that the line runs *through* the obstacle or crate. Width belongs only where a side route is deliberate
   and optional. Sources: L2, L3, L4, E5, L18, L19 ([Interviews "R" us][ru], [IGN][ign], [Press Start][pressstart]).
2. **Teach one idea at a time, then twist it, then combine.** Two or three levels per theme, "one mechanic in one level",
   Crash 2's "layered mechanics of enemies, hazards, and challenges", and Cerny's Portal-like "brick or layer" all
   describe the same order. Within one level, open safe and escalate, as the beach does before the jungle.
   Sources: L5, L14, L15, L16, L17, L18 ([Making Crash 4][mc4], [CGE][cge], [Inverse][inverse], [PlayStation Blog][psbbeach]).
3. **Ramp in steps with plateaus.** Crash 1's designer names "every single jump was slightly harder than the
   one that came before it" as his mistake. Stormy Ascent was cut, and Future Tense was toned down, for the same
   reason, and Toys for Bob set out to remove the N. Sane Trilogy's spikes. Hold a difficulty for a stretch before
   raising it again. Sources: J3, D4, D8, D11, H7 ([IGN][ign], [PlayStation Blog][psbstormy], [Xbox Wire][xbwft], [Gfinity][gfinity]).
4. **Keep the critical path fair and put the skill ceiling beside it.** Future Tense smoothed its critical path and kept
   "high skill ceilings in the death route and time trials". Crash 4 harder content sits behind deathless tapes,
   six-condition gems and 106%. All-box routes, rare gems and side rooms can be brutal. The way to the gate should
   not be. Sources: D8, D9, D10, K7, K8, K9 ([Xbox Wire][xbwft], [Nintendo World Report][nwr], [Automaton][automaton]).
5. **Telegraph every hazard, with no surprise kills.** Vicarious Visions added tells to spikes that fired
   without warning once testers stalled. Toys for Bob's rule was "fair and not cheap", with "precision in how
   things are telegraphed". Naughty Dog banned a lava level because orange Crash would not read against it. Every
   hazard needs a visible warning and contrast against the skater. Sources: H2, H3, H5, H6 ([Engadget][engadget17],
   [Engadget][engadget20], [Nintendo World Report][nwr], [Making Crash 2][mc2]).
6. **Author hazard streams as rhythm.** Rollers are "timing gates" that double or triple for difficulty, and Yan
   describes hazards and platforms as a "stream… almost rhythmic in nature" whose mastery becomes flow. Cerny's
   target is a "groove". Space repeated hazards at a learnable beat, then break the beat on purpose at a test.
   Sources: H1, H3, H4, L14 ([Making Crash 4][mc4], [Engadget][engadget20], [Press Start][pressstart], [Tom Chatfield][cernytc]).
7. **Tune gaps to the movement model actually in the game.** The N. Sane remake kept Naughty Dog's geometry ("the
   spacing between obstacles") but changed the jump and collision rules, and the same gaps became harder. Gavin says
   full-height-only jumps left Crash unable to make "half the jumps". When the board, jump or grind tuning changes, measure
   again before trusting a gap, and never copy Crash distances. Sources: J4, J5, J6, D7 ([Engadget][engadget17],
   [Activision blog][jump17], [Nintendo Life][gavinli]).
8. **Forgive the input, not the layout.** Cerny asked for "a frame or two" of jump after leaving a ledge, and a
   faster stop. Crash 4's bold landing shadow supports precise 3D landings. Keep layouts exact and make the
   controls and depth cues generous. This prototype's movement model is out of scope for level work (AGENTS.md), so
   the transferable part is the readable landing cue and honest gap sizes. Sources: J1, J8, J10 ([Making Crash 4][mc4],
   [1999 article][od3], [PlayStation Blog][psbaug20]).
9. **Help weaker players without changing the game for stronger ones.** Naughty Dog gave masks, slowed boulders and
   added continue points after repeated deaths. Sony Japan's main easing tool was extra continue points. The remake gives
   masks and checkpoints after failures, and Crash 4's modes change failure cost, not difficulty. Checkpoint density is
   the primary difficulty dial, and layout is not. Sources: D1, D2, D7, D13 ([Making Crash 6][mc6], [Crash goes to Japan][jp],
   [Activision blog][jump17], [PlayStation Blog][psboct20]).
10. **Checkpoint before commitments, and remove the safety net in mastery modes.** Crash 4 places a checkpoint
    after a grind and before a chase. Warped's time trial deletes checkpoints and Aku Aku so that "everyone is on an equal
    footing". Put checkpoints at the entry to rails, chases and irreversible crate puzzles, and strip them in timed variants.
    Sources: D15, D16, D3 ([Activision blog hands-on][acthandson], [OPM 1998][opm98]).
11. **Crates fill empty stretches and slow the player into decisions.** Crates were invented because levels were
    empty and players finished too fast: "the puzzles slowed the player". With only two or three enemies on screen,
    the next challenge had to be a pit or far away, and crates filled the gap. Crash 4 turned Nitro into a
    decision about when to spend a power. A crate cluster should create a choice or a beat, not decorate a straight.
    Sources: K1, K2, E3, E4, H10 ([Making Crash 5][mc5], [Crash Mania][rubincm], [Game Informer][gi20]).
12. **Mastery modes should change the rules, not only start a clock.** In Warped's time trial, fruit disappears,
    life boxes deduct time instead and checkpoints vanish, which is "a completely different game, with a different
    agenda". Its par times were set from demonstrated runs. N.Verted asks players to drop their habits. A timed
    skate variant should re-price the crates, for example turning them into time pickups. Sources: K3, T12, Q9 ([OPM 1998][opm98],
    [Automaton][automaton]).
13. **Scope temporary powers to the sections built for them, and combine them only at the climax.** Crash 4's masks
    "extend Crash's abilities" without compromising "simple to pick up", appear only in guided sections, and are
    practised before they are tested. Only the final castle demands all four. Treat temporary board powers or special crates the same
    way. Sources: Q1, Q3, Q4, Q5, L20 ([Press Start][pressstart], [Activision blog hands-on][acthandson], [Automaton][automaton]).
14. **Design the camera with the route.** Naughty Dog kept the camera "fairly conservative" to protect the "tight, high
    impact feel", tied controls to it, and still found rail cameras hard. Crash 4 pulled the camera back "so we can see
    more" and built in "huge sightlines" for orientation. Keep the camera stable and the landing in view wherever precision
    matters, and open the view only where it is low. Sources: C1, C2, C5, C6, C10, C11 ([Making Crash 1][mc1],
    [1999 article][od3], [Making Crash 7][mc7], [Press Start][pressstart], [Inverse][inverse]).
15. **Build a small slice, test it on novices, and keep iterating until ship.** The sources agree on the method:
    newcomers must "smile WHILE PLAYING"; "you just watched them play"; "constant experimentation"; "No level was 'done'
    till the game shipped"; studio-wide playtests of a prototyped puzzle set; designers swapping levels; greyboxed
    gameplay before art. Sources: T1, T3, T4, T7, T9, T10, T11 ([Making Crash 4][mc4], [Tom Chatfield][cernytc],
    [Making Crash 9][gool], [Xbox Wire][xbwft], [Automaton][automaton], [Airborn][airborn]).

---

## Searches that found nothing useful

| Looked for | Result |
|---|---|
| A Gavin or Rubin post specifically on Crash 2 or Crash 3 level design | None exists. Gavin's [video-games archive](https://all-things-andy-gavin.com/video-games-archive/) lists no Crash 2, 3 or CTR design posts. Crash Memories, Crash Launch Commercials, Crash Bandicoot Reunion, War Stories (only a video plus an intro), Teaching an Old Dog parts 1–2, Naughty Dog: a Pedigree Breed and Old Crash 20 Questions hold no level-design content. |
| Rolling Stone, "Crash Bandicoot at 20: An Oral History" (2016) | Paywalled (HTTP 402), not read. |
| Polygon, "Crash Bandicoot: An oral history" (2017) | Polygon could not be fetched, and the only copy found was on an unrelated mirror domain, so it was not used. |
| GamesRadar / Retro Gamer making-ofs (Crash 25th anniversary, the CTR making-of with Dan Arey, Arey in Retro Gamer 256) and the Toys for Bob "sense of adventure" interview | The pages return only their headlines. The Toys for Bob piece is labelled sponsored. Arey is used only through a secondary write-up (L21). |
| IGN 2004 Cerny interview ("Crash 2 codified what Crash 1 did by intuition") | Reachable only through Sega Retro, which bot protection blocked. Seen only in search snippets, so not used. |
| Official PlayStation Magazine UK 2013 Cerny interview | The original site is gone and the Wayback Machine could not be fetched, so it is used only through Push Square (L13). |
| Giant Bomb's claims that Crash's level formula came from the "fourth cycle" of Cerny's Method and that Cerny designed 26 of Crash 2's 28 levels | Wiki text only. No primary source found. |
| Cerny's 2002 D.I.C.E. "Method" talk | The slides on SlideShare did not load and the talk is otherwise video. Only the 2002 GDC Europe interview and the 2013 Chatfield interview were used. |
| 1997–98 magazine interviews on Crash 2 design (*Next Generation*, OPM US October 1997, OPM UK October–December 1997, PSM November–December 1997, OPM US December 1998) | Only previews and reviews, with no developer reasoning. OPM US November 1998 (L10, K3, D16) and Italian PSM August 1998 (L9) were the exceptions. |
| Evan Wells, Dan Arey, Justin Monast or Erick Pangilinan on Crash 2/3 level design | Nothing beyond the 1998 interview naming Arey and Wells as new designers (L8). |
| Bob Rafei, Charles Zembillas or Joe Pearson on readability or enemy design | Their interviews ([Zembillas, Crash Mania 2009](https://www.crashmania.net/en/backstage/interviews/charles-zembillas/), the [2017 E3 panel write-up](https://www.gamedeveloper.com/production/watch-the-original-devs-share-tales-of-i-crash-bandicoot-i-s-creation)) cover character art and polygon limits, not levels. |
| Toys for Bob GDC talks, an Unreal Engine spotlight, an Activision user-research case study on Crash 4 | None found. |
| Toys for Bob's reasons for the default double jump, the rail, wall-run and rope design, the landing indicator, and Modern mode's reported extra Aku Aku or checkpoint after repeated deaths | No developer or official text found. The death-count assistance appears only in fan guides and reviews. |
| Interviews with Dan Neil (Crash 4 director) or Jan Stec (reported lead designer) on level design | None found. |
| Game Informer's July 2020 Crash 4 cover features beyond the June 22 preview, IGN First pieces, and the IGN world-map interview with Paul Yan | Not found, or available only as secondhand summaries. |
| USgamer reveal interview, GamesBeat interview, GameSpot features, Stevivor's interview with Vicarious Visions, Checkpoint Gaming's developer write-up | HTTP 503 or 403, not read. |
| A Vicarious Visions GDC talk on rebuilding levels | Only an art-track session ("Game Art Remastered") was found. |
| Developer interviews inside the Japanese and Prima strategy guides that the crate bible uses | The archive.org items have no OCR text, so they were not searched page by page. |
| Andy Gavin answers on Quora about Crash level design | None found. |

---

## Source register

| Key | Source | Speaker / author | Date | Type |
|---|---|---|---|---|
| mc1–mc6 | [Making Crash Bandicoot parts 1–6][mc1] (all-things-andy-gavin.com) | Andy Gavin, with Jason Rubin sections | 2011-02-02 to 02-07 | `DEV` |
| mc7 | [Crash Bandicoot as a Startup (part 7)][mc7] | Dave Baggett | 2011-02-10 | `DEV` |
| gool | [Making Crash Bandicoot – GOOL – part 9][gool] | Andy Gavin | 2011-03-12 | `DEV` |
| od3 | [Teaching an Old Dog New Bits part 3][od3] (his 1999 article, reposted) | Andy Gavin | 1999 / 2011-03-28 | `DEV` |
| ru | [Crash Bandicoot – Interviews "R" us][ru] (crash-bandicoot.ru questions) | Andy Gavin | 2011-08-13 | `DEV` |
| eu | [Parlez vous Crash][eu] | Andy Gavin | 2012-01-06 | `DEV` |
| jp | [Crash goes to Japan – part 1][jp] | Andy Gavin | 2012-01-11 | `DEV` |
| postdesk | [PostDesk interview][postdesk] (Gavin's Goodreads blog repost) | Andy Gavin | 2012-03-16 | `DEV` |
| pixelvolt | [Pixelvolt interview][pixelvolt] | Andy Gavin | 2013-09-25 | `DEV` |
| gavinli | [Nintendo Life on Gavin's LinkedIn post][gavinli] | Andy Gavin, reported by Ollie Reynolds | 2025-07-18 | `DEV` (quoted) |
| ign | [IGN, Rising to Greatness: The History of Naughty Dog (archive.org copy)][ign] | Colin Moriarty, quoting Rubin, Gavin, Kurosaki | 2013-10-05 | `DEV` (quoted) |
| rubincm | [Interview with Jason Rubin][rubincm] (Crash Mania community Q&A) | Jason Rubin | 2008-06-16 | `DEV` |
| rubingama | [Naughty Dog's New Tricks: An Interview with Jason Rubin][rubingama] | Brandon Sheffield, Gamasutra | 2007-08-24 | `DEV` |
| opm98 | [Official U.S. PlayStation Magazine Vol. 2 No. 2][opm98] (Warped cover feature) | Jason Rubin, quoted | November 1998 | `DEV` / `PARA` |
| psmit | [PSM (Italian edition) no. 5][psmit] | Jason Rubin, quoted | August 1998 | `DEV` (translated) |
| neoplus | [*Neo Plus* interview reproduced on a PPE.pl blog][neoplus] | Jason Rubin | September 1998 / 2014 | `DEV` (translated) |
| cerny11 | [Mark Cerny discusses changing team sizes][cerny11] | Kyle Orland, Game Developer | 2011-07-11 | `DEV` |
| cernyps | [Push Square on Cerny's OPM UK interview][cernyps] | Mark Cerny, reported | 2013-09-16 | `DEV` (reported) |
| cernytc | [In conversation with Mark Cerny][cernytc] | Tom Chatfield | 2013-07-26 | `DEV` |
| cernyknack | [Making Knack: an interview with Mark Cerny][cernyknack] | Christian Nutt, Game Developer | 2013-12-20 | `DEV` |
| cernygdce | [Conversations from GDC Europe: Mark Cerny…][cernygdce] | John McLean-Foreman, Gamasutra | 2002-09-06 | `DEV` |
| arey | [GamenGuide on Dan Arey in Retro Gamer 256][arey] | Lyn Alkuino | 2024-02-19 | `PARA` |
| psbbeach | [Classic Levels Deconstructed: N. Sanity Beach][psbbeach] | PlayStation Blog staff, quoting Rubin and Tanguay | 2017-06-27 | `DEV` (quoted) |
| psbstormy | [Previously Unreleased Stormy Ascent Level Out Today][psbstormy] | Dan Tanguay, with Taylor Kurosaki | 2017-07-20 | `DEV` |
| engadget17 | [The (re)making of 'Crash Bandicoot'][engadget17] | Andrew Kuhar, quoting Vicarious Visions staff | 2017-07-03 | `DEV` / `PARA` |
| jump17 | [Go Ahead and Jump!][jump17] (Activision blog) | Kevin Kelly, in Vicarious Visions' voice | 2017-07-17 | `PUB` |
| psbft | [N. Sane Trilogy gets new level, HDR, faster loading][psbft] | Kyle Martin (Vicarious Visions) | 2018-06-29 | `DEV` |
| xbwft | [Crash Bandicoot and Future Tense make the leap to Xbox One][xbwft] | Kyle Martin (Vicarious Visions) | 2018-06-29 | `DEV` |
| engadget20 | [Crash Bandicoot 4 pretends the PS2-era games never happened][engadget20] | Kris Holt, quoting Paul Yan | 2020-06-22 | `DEV` |
| gi20 | [Crash Bandicoot 4 is a return to the series' glory days][gi20] | Andrew Reiner, quoting Paul Yan | 2020-06-22 | `DEV` / `PARA` |
| psbjun20 | [PlayStation Blog Crash 4 announcement][psbjun20] | James Mattone (Activision) | 2020-06-22 | `PUB` |
| pressstart | [Crash 4 interview: Retro mode, Cortex, Quantum Masks][pressstart] | Shannon Grixti, quoting Paul Yan | 2020-06-23 | `DEV` |
| cge | [Paul Yan interview transcript][cge] (Canadian Guy Eh, printed by Crash Mania) | Paul Yan | June 2020 | `DEV` |
| acthandson | [Crash Bandicoot 4 hands-on][acthandson] (Activision blog) | James Mattone | 2020-07-24 | `PUB` |
| dtoid | [We went hands-on with Crash Bandicoot 4][dtoid] | Chris Carter, Destructoid | 2020-07-24 | `OBS` / `DEV` |
| psbaug20 | [Exploring the platforming of Crash Bandicoot 4][psbaug20] | Tim Turi (Sony) | 2020-08-14 | `OBS` |
| psls | [Flashback levels revealed][psls] | Brianna Reeves, quoting Lou Studdert | 2020-08-28 | `DEV` / `PARA` |
| gfinity | [Crash Bandicoot 4 developer interview][gfinity] | Gfinity, quoting Paul Yan | 2020-09-17 | `DEV` / `PARA` |
| psboct20 | [What's new in Crash Bandicoot 4][psboct20] | Stephanie Glover (Activision) | 2020-10-01 | `PUB` |
| actlaunch | [Crash 4 available now][actlaunch] (Activision blog) | Daniel Noel | 2020-10-02 | `PUB` |
| inverse | [Why Crash Bandicoot 4 is N. Sanely faithful][inverse] | Tomas Franzese, quoting Lou Studdert | 2020-10-02 | `DEV` / `PARA` |
| automaton | [Toys for Bob mini-interview (Japanese)][automaton] | Maho Ikemi, quoting Paul Yan | 2021-01-05 | `DEV` (translated) |
| nwr | [Nintendo World Report interview][nwr] | NWR staff, quoting Lou Studdert | 2021-03-16 | `DEV` |
| ne21 | [Nintendo Everything interview][ne21] | Nintendo Everything, quoting Lou Studdert | 2021-05-22 | `DEV` |
| airborn | [Airborn Studios: Crash Bandicoot 4][airborn] | Airborn Studios (contract artists) | undated | `DEV` |

[mc1]: https://all-things-andy-gavin.com/2011/02/02/making-crash-bandicoot-part-1/
[mc2]: https://all-things-andy-gavin.com/2011/02/03/making-crash-bandicoot-part-2/
[mc3]: https://all-things-andy-gavin.com/2011/02/04/making-crash-bandicoot-part-3/
[mc4]: https://all-things-andy-gavin.com/2011/02/05/making-crash-bandicoot-part-4/
[mc5]: https://all-things-andy-gavin.com/2011/02/06/making-crash-bandicoot-part-5/
[mc6]: https://all-things-andy-gavin.com/2011/02/07/making-crash-bandicoot-part-6/
[mc7]: https://all-things-andy-gavin.com/2011/02/10/crash-bandicoot-as-a-startup/
[gool]: https://all-things-andy-gavin.com/2011/03/12/making-crash-bandicoot-gool-part-9/
[od3]: https://all-things-andy-gavin.com/2011/03/28/crash-bandicoot-teaching-an-old-dog-new-bits-part-3/
[ru]: https://all-things-andy-gavin.com/2011/08/13/crash-bandicoot-interviews-r-us/
[eu]: https://all-things-andy-gavin.com/2012/01/06/parlez-vous-crash/
[jp]: https://all-things-andy-gavin.com/2012/01/11/crash-goes-to-japan-part-1/
[postdesk]: https://www.goodreads.com/author_blog_posts/2216223-postdesk-interview
[pixelvolt]: https://all-things-andy-gavin.com/2013/09/25/pixelvolt-interview/
[gavinli]: https://www.nintendolife.com/news/2025/07/crash-bandicoot-co-creator-believes-the-remakes-botched-the-jump-mechanics
[ign]: https://archive.org/details/rising-to-greatness-the-history-of-naughty-dog-ign
[rubincm]: https://www.crashmania.net/en/backstage/interviews/jason-rubin
[rubingama]: https://www.gamedeveloper.com/business/naughty-dog-new-tricks-an-interview-with-jason-rubin
[opm98]: https://archive.org/details/official-u.-s.-play-station-magazine-volume-2-issue-2-november-1998
[psmit]: https://archive.org/details/PSM-005
[neoplus]: https://www.ppe.pl/blog/35174/275474/Z-cyklu-retro-wywiady-Czesc-2-Crash-Bandicoot-3.html
[cerny11]: https://www.gamedeveloper.com/design/interview-industry-veteran-mark-cerny-discusses-changing-team-sizes
[cernyps]: https://www.pushsquare.com/news/2013/09/mark_cerny_laid_out_most_of_the_apples_in_crash_bandicoot_2
[cernytc]: https://tomchatfield.net/portfolio/in-conversation-with-mark-cerny/
[cernyknack]: https://www.gamedeveloper.com/design/making-i-knack-i-an-interview-with-mark-cerny
[cernygdce]: https://www.gamedeveloper.com/marketing/conversations-from-gdc-europe-mark-cerny-jonty-barnes-jason-kingsley
[arey]: https://www.gamenguide.com/articles/104422/20240219/crash-bandicoot-developer-gets-candid-navigating-impact-mario-64-3d.htm
[psbbeach]: https://blog.playstation.com/archive/2017/06/27/classic-levels-deconstructed-the-hidden-complexity-behind-the-colourful-excess-of-crash-bandicoots-n-sanity-beach
[psbstormy]: https://blog.playstation.com/?p=193118
[engadget17]: https://www.engadget.com/2017/07/03/crash-bandicoot-n-sane-trilogy-remake/
[jump17]: https://blog.activision.com/crash-bandicoot/archives/go-ahead-and-jump
[psbft]: https://blog.playstation.com/2018/06/29/crash-bandicoot-n-sane-trilogy-gets-new-level-hdr-faster-loading/
[xbwft]: https://news.xbox.com/en-us/?p=96547
[engadget20]: https://www.engadget.com/crash-bandicoot-4-its-about-time-preview-release-date-150045602.html
[gi20]: https://www.gameinformer.com/2020/06/22/crash-bandicoot-4-is-a-return-to-the-series-glory-days
[psbjun20]: https://blog.playstation.com/?p=332382
[pressstart]: https://press-start.com.au/features/2020/06/23/crash-4-interview-retro-mode-doctor-neo-cortex-quantum-masks/
[cge]: https://www.crashmania.net/en/backstage/interviews/cge-interview-crash-bandicoot-4/
[acthandson]: https://blog.activision.com/crash-bandicoot/2020-07/Crash-Bandicoot-4-Hands-On
[dtoid]: https://www.destructoid.com/we-went-hands-on-with-crash-bandicoot-4-and-its-looking-good-so-far/
[psbaug20]: https://blog.playstation.com/?p=334717
[psls]: https://www.playstationlifestyle.net/2020/08/28/crash-bandicoot-4-flashback-levels-revealed/
[gfinity]: https://www.gfinityesports.com/article/crash-bandicoot-4-its-about-time-developer-interview-ps4-xbox-pc-toys-for-bob
[psboct20]: https://blog.playstation.com/?p=341723
[actlaunch]: https://blog.activision.com/crash-bandicoot/2020-10/Crash-Bandicoot-4-Its-About-Time-Available-Now-Save-the-Multiverse-in-this-New-Original-Adventure
[inverse]: https://www.inverse.com/gaming/crash-bandicoot-4-interview-toys-for-bob
[automaton]: https://automaton-media.com/articles/interviewsjp/20210105-148183/
[nwr]: https://nintendoworldreport.com/feature/56570
[ne21]: https://nintendoeverything.com/interview-crash-bandicoot-4-creative-producer-on-how-the-game-came-to-be-106-completion-switch-port-more/
[airborn]: https://airborn-studios.com/projects/crash-bandicoot-4
