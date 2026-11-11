# Developer evidence: what the makers of Tony Hawk's Pro Skater said about level design

What Neversoft (THPS1–4 and the later Neversoft games), Activision, Tony Hawk, the port studios
(Treyarch, Vicarious Visions' Game Boy Advance team, Toys for Bob), Robomodo (THPS HD), Vicarious
Visions (THPS 1+2, 2020) and Iron Galaxy (THPS 3+4, 2025) have said in public about building
Tony Hawk levels. The level records in [`data/`](data/) and [STATS.md](STATS.md) describe what the
games *do*. This file records what the people who made them said they were *trying* to do, so the
bible can tell measured practice apart from stated intent. Compiled 2026-11-11.

**Scope.** Mostly primary and near-primary text: developers' own portfolio pages and signed
articles, interviews and oral histories that quote them directly, period magazine features read as
OCR text on archive.org, and official Activision and Sony posts. A few journalist accounts are
included and labelled `PARA` or `OBS`. No video, no YouTube, no audio without a transcript, and none
of the blocked wiki, guide or forum sites. Quotations from magazine scans were checked against the
OCR text; obvious OCR slips are silently corrected, and the one quotation that had to be
reassembled from jumbled columns is flagged (U1). Each claim is a short paraphrase. Quotations are a
sentence or less.

## How to read this file

| Label | Meaning |
|---|---|
| `DEV` | **Developer statement.** The developer's own words: a portfolio page, a signed article, or a direct quotation in an interview or oral history. Includes Tony Hawk speaking about his own testing. |
| `PUB` | **Official publisher text.** Activision blog, map guides and support pages, PlayStation Blog posts written by Activision staff. Reliable about the shipped design, rarely about the reasoning. |
| `PARA` | **Journalist paraphrase of a developer.** The writer attributes a view to the studio without quoting it, or relays an interview we could not read ourselves. Treat as weaker. |
| `OBS` | **Journalist observation.** A hands-on description or caption with no developer attribution, used only to corroborate. It is not evidence of intent. |

Claim IDs (`F3`, `K1`, …) are cited by the principles at the end. Links point to the
[source register](#source-register).

**Already covered elsewhere.** [research-principles.md][rp] and [research-maps.md][rm] already cite
the CoRecursive interview (the downhill prototype, the School whiteboard), the GamesRadar/OPM
making-of (open School and Downtown, Mario 64, Aaron Cammarata's points-at-risk idea, the THPS3
Los Angeles rail loop), Planet Tony Hawk's Q&A with Tony Hawk and its October 2000 interview with
Ralph D'Amato, Sound & Vision's Josh Tsui interview, the PlayStation Blog Warehouse demo post,
Press Start's Jen Oneal and Mike Rossi interviews, Andy Gentile's THPS 1+2 and Proving Ground
pages, the Official Xbox Podcast with Rossi and Kurt Tillmanns, Game Developer's 2025 Tillmanns
interview, Anthony Garcellano's School portfolio, the official Foundry page, Activision's Tours
support page and the Downhill Jam postmortem. Those points are marked *(already cited)* and are
not argued again. Three of those sources could not be re-read for this file: Planet Tony Hawk
(the live site returns 403 and the Wayback Machine is unreachable from this environment), Sound &
Vision and ArtStation (bot checks). Their points are repeated from the repository's notes and
marked *(already cited; not re-read)*. Everything else below was read for this file.

---

## 1. The format: sessions, spots and the run

- **F1** The first prototype copied Sega's downhill *Top Skater*. The downhill levels "were fun,
  but only for the minute and a half that it took to ride them", while testers had more fun doing
  tricks in the small ramp area at the bottom, so the design moved to levels you skate around
  *(already cited)*. — Mick West (Neversoft co-founder, lead programmer), [GamesRadar/OPM][gr19],
  2019-09-02, and [CoRecursive #099][cr], 2024-04-02 · `DEV` (the "20 minutes" detail is the
  CoRecursive host's narration, `PARA`)
- **F2** The half-pipe is why: "a half-pipe is going back and forth, over the same spots again and
  again", which a downhill course cannot give, and things "changed drastically" once the team
  copied the X-Games half-pipe. — Mick West, [Retro Gamer, "The Making of Tony Hawk's Pro
  Skater"][rgmo], reprinted 2017 · `DEV`
- **F3** Once the core mechanic is fun, the game is a set of challenges laid over it: "So you just
  do, here, do these five fun things", with challenges that get a bit harder each time. — Mick
  West, [CoRecursive][cr], 2024-04-02 · `DEV`
- **F4** Neversoft "designed the game around skate video culture, more than actual skateboarding
  culture": you hit a particular spot where skaters film a trick and get a replay, or you find
  videotapes. "Videoing the moves and collecting tapes" were "all taking from skate culture". —
  Mick West, [CoRecursive][cr] and [Retro Gamer making-of][rgmo] · `DEV`
- **F5** "Collecting the tapes is analogous to collecting the stars in Mario." Each level had "five
  things to do", brainstormed in front of a whiteboard where West "drew a level and said 'what can
  we do?'". — Mick West, [Retro Gamer making-of][rgmo] · `DEV`
- **F6** The structure of THPS1 "with the secret tapes and the goals, we kinda lifted a lot of that
  from Diddy Kong Racing"; the influences were Super Mario 64 and, "to a certain extent", Diddy
  Kong Racing. The Post adds that the racer's balloons unlocked more of that game (`PARA`). — Scott
  Pease (THPS producer, later Neversoft studio development director), [Washington Post, reprinted
  by Stars and Stripes][wapo], 2025-08-01; relayed by [Pocket Tactics][pocket], 2025-07-21 · `DEV`
- **F7** West drew School "just a rectangle" with stairs, rails, a pool and walls, then the room
  threw out mini-games: collect S-K-A-T-E, find the hidden tapes, a timed points run, hit set
  points, grind set rails *(School sketch already cited)*. Silvio Porretta redrew the sketches as
  the artists' blueprints, and the whole game was designed "over like three days". — Mick West,
  [CoRecursive][cr] · `DEV`. Pease remembers Porretta sketching courtyards and "big stair sets"
  live: "Then we had to go and build them." Porretta: "I redid all the levels on paper." —
  [The Ringer][ringer], 2019-08-30 · `DEV`
- **F8** "We pretty much made the design up as we went along with the first game": first a skater
  moving in an environment, then controls tuned until fun. The ideas that stuck were "pretty simple:
  doing tricks is fun, people like to compete either with themselves or against each other". —
  Joel Jewett (Neversoft president), [Game Informer 101][gi101], September 2001 · `DEV`
- **F9** Mario 64 showed open worlds; THPS1 "is not very big because of the limits of the
  PlayStation at the time", "But there was so much freedom." *(already cited)* — Mick West,
  [GamesRadar/OPM][gr19] · `DEV`. "It had to have a more open world, a trick system where you could
  score points and an open design." — Mick West, [Retro Gamer making-of][rgmo] · `DEV`
- **F10** Fun beats realism. West rejected ideas like losing a wheel because people "think realism
  is more important than fun"; "The gameplay itself isn't realistic, grinding along power lines and
  things like that", but the culture was copied from real skating. — Mick West, [Retro Gamer
  making-of][rgmo] and [The Ringer][ringer] · `DEV`. "It's all about rewarding the player, not
  making them frustrated." — Silvio Porretta (lead artist), [Jenkem][jenkem], 2017-01-13 · `DEV`

## 2. The two-minute run and the goal list

- **T1** The 1999 Pizza Hut demo disc had "like a one minute timer or maybe a 30 second timer". It
  was very limited, but "enough to have fun because you could just restart it instantly", and
  players would run out of time and try the same thing again. — Mick West, [CoRecursive][cr] ·
  `DEV`. "We knew it was going to be big because we had so much feedback from that one demo." —
  Mick West, [GamesRadar/OPM][gr19] · `DEV`
- **T2** The time limit and score attack are arcade leftovers from the *Top Skater* start;
  objectives were added on top and the design "just kind of grew organically" (West). — [Retro
  Gamer, "The History of: Tony Hawk's Pro Skater"][rghist], 2020 · `PARA` (quote `DEV`)
- **T3** THPS1's career lists goals on the loading screen, to be done in "the allotted two-minute
  period"; tapes unlock levels, equipment and competitions. — Bill Loguidice and Matt Barton,
  [Game Developer][gdhist], 2009-03-10 · `OBS`
- **T4** THPS2 swapped goal tapes for collectable cash. THPS1 "only gave you five goals per level";
  THPS2 adds many more, including S-K-A-T-E and "obstacle-specific objectives (such as ollie 10
  garbage cans, grind eight benches, etc.)". — Crispin Boyer, [EGM 130][egm130], May 2000, pp.
  132–135 · `OBS`
- **T5** On THPS3, "We'd design our levels, set the objectives, then ship it"; looking back there
  were "so many different things that we could have put in there as goals", because "at the time,
  you didn't know that specific level as well as you know it now". THPS4's focus was "goals that are
  much deeper". — Joel Jewett, [Game Informer 110][gi110], June 2002 · `DEV`
- **T6** THPS4 "feels more like real skateboarding than getting a list of goals to do"; "We had to do
  that in Tony Hawk 3 because we didn't have a lot of time." — Scott Pease, [Game Informer
  110][gi110] · `DEV`. Neversoft did not want the career to feel like "a grocery checklist"
  (`PARA`); THPS4 drops the time meter and pedestrians hand out goals (`OBS`).
- **T7** Difficulty in tiers: "Before, we would tune the game so that the weaker players could
  unlock all of the levels"; THPS4 adds "extra pro goals after that that are insanely tough", which
  "go all the way back to the first level". — Scott Pease, [Game Informer 110][gi110] · `DEV`. Even
  in THPS3, "we've never required you to get all of the Sick scores in Career mode to unlock the
  levels". — Scott Pease, [Game Informer 101][gi101] · `DEV`
- **T8** Some goals exist to teach: many players "don't necessarily know the language of the
  games", so THPS4 adds goals that call out tricks to perform. — Joel Jewett, [Game Informer
  110][gi110] · `DEV`. Three difficulty levels in THUG were "about three times the work — the
  balancing work". — Chad Findley (THUG senior designer), [Game Informer 122][gi122], June 2003 ·
  `DEV`
- **T9** Iron Galaxy iterated "a lot" on "the S-K-A-T-E line in Alcatraz": "Does it feel natural
  with the player getting to where we want to start the line". "There's no reference point for
  that." With no NPC goal-givers, "you're starting in one place and then having to navigate around
  to where the different goals are" *(where goals begin already cited)*. — Mike Rossi (design
  director, Iron Galaxy), [Press Start][psig], 2025-05-09 · `DEV`
- **T10** Internal and online feedback said players "didn't always love the two-minute timer", so
  it can be extended, which "doesn't impact progression" (Rossi). The THPS3 timer now runs in the
  THPS4 parks and can be set "up to 60 minutes" for players who want "to complete goals at your own
  pace" (Tillmanns). — Mike Rossi, [Press Start][psig]; Kurt Tillmanns (game director, Iron
  Galaxy), [Official Xbox Podcast transcript][xbp], 2025-05-14 · `DEV`
- **T11** THPS4's goals could not all fit the two-minute format, so many returned as Pro Goals that
  unlock after a level's first 10 goals (`PARA`, [VGC][vgc25], 2025-06-09). Rossi: the aim was "the
  ultimate package of 3 and 4", leaning toward the THPS3 format "for a cohesive package". — [PC
  Gamer, relaying Game Informer][pcg25], 2025-05-12 · `DEV` (quoted in press)
- **T12** In the 1+2 Single Session "You have two minutes – unless you go into Overtime by keeping
  a combo going past the time limit", and retries are unlimited. — Activision editorial (James
  Mattone), [PlayStation Blog][psbwh], 2020-08-12 · `PUB`
- **T13** 1+2's Speed Runs are "inspired by the THPS community": a park's goals reset for a fastest
  100% run. Free Skate has no goals or collectibles. — [Activision support, Tours][tours], 2020 ·
  `PUB`

## 3. Hidden collectibles: tapes, letters and cash

- **K1** "Going over to a cash-based system gives us the chance to put extra cash hidden all over
  the level and in hard-to-reach places." "It will be really hard to clean out the levels totally."
  — Scott Pease, [EGM 130][egm130], May 2000 · `DEV`
- **K2** "What we want to do this time is constantly have the player find new things they might not
  have seen before"; levels get interactive objects "as much as we can cram in", and "Our only
  limitation is memory." — Chris Rausch (designer), [EGM 130][egm130] · `DEV`. EGM's examples: a streetlight
  you knock down becomes a grind, a basketball net bursts into cash, and some objectives need these
  hidden interactions (`OBS`).
- **K3** THPS4's C.O.M.B.O. asks for every letter "in one combo line"; Game Informer calls the runs
  "extremely tough, targeting the hardcore players", eased by a "Retry Last Goal" option (`OBS`,
  [Game Informer 110][gi110]). In THPS 3+4 it is a Pro Goal: "collect all the letters in one fell
  swoop". — [Activision, Ramp Up to Launch][thramp], 2025-06-18 · `PUB`
- **K4** THPS 3+4's Solo Tours have "new S-K-A-T-E letter placements depending on your skater's
  style". — [Activision, Ramp Up to Launch][thramp] · `PUB`
- **K5** HAWK mode lets players hide letters for each other: "Drop the H along a hard-to-reach
  grind, the A at the apex of a sky-high aerial… use your park knowledge". Create-A-Park goals let
  players "look for the perfect nook to stow away the Secret Tape". — [Activision, Ramp Up to
  Launch][thramp] · `PUB`
- **K6** Waterpark's border "thin pathways can be tricky to navigate but lead to several important
  Tour pickups". In Tour mode you drain the moat round the pirate ship and board it by grinding a
  low railing into a wallride; delivering the arcade keys opens the castle slide. — Dan Noel
  (Activision), [Bird's Eye View: Waterpark][thwp], 2025-03-04 · `PUB`
- **K7** Waterpark's S-K-A-T-E line starts low, grinds the top of one of the highest slides and
  ends in the bowl of a slide for the last letter; a transfer line out of the castle also serves a
  goal (hardflip over the fountain). — Brodie Gibbons, [Press Start][pswp], 2025-05-09 · `OBS`
- **K8** Every 1+2 park hides new collectibles ("cruising through every inch of the levels to grab
  them all") and stat points; finishing a Tour unlocks secret parks *(coexistence of goal types
  already cited)*. — [Activision support, Tours][tours], 2020 · `PUB`
- **K9** Vicarious Visions' later GBA editor let staff "set up where the gaps were" and place the
  goal letters (printed as "escape letters", apparently S-K-A-T-E). Gaps and letters are authored
  placements in the tool. — Matt Conte (lead programmer, Vicarious Visions GBA ports), [Time
  Extension][te], 2025-01-10 · `DEV`

## 4. Lines and gaps

- **G1** Cammarata proposed banking points until a clean landing, the basis of combos, and West's
  favourite line is a THPS3 Los Angeles rail loop you can keep circling *(already cited)*. Pease
  says the manual was prototyped for THPS1 but cut, and "You can feel it, that there was this
  missing piece." — Mick West, [GamesRadar/OPM][gr19]; Scott Pease, [Inverse][inverse24],
  2024-09-29 · `DEV`
- **G2** Line-building had to be learned. On joining the THPS3 team, "I had no idea how to make a
  skating level"; on Suburbia "I didn't really understand how to just put lines into it." — Alan
  Flores (Neversoft level designer, later THPS lead designer), [Retro Gamer history][rghist], 2020
  · `DEV`
- **G3** Activision QA rejected Vicarious Visions' first GBA THPS2 layouts ("You guys don't
  understand how to build levels at all"). Activision staff then taught the team "the language of
  what makes a Tony Hawk's Pro Skater 2 level": "how this rail has to line up with that funbox and
  how you create these lines". — Matt Conte, [Time Extension][te] · `DEV`. Every level was then
  reworked to reward high-level play with better lines (`PARA`).
- **G4** Placing individual pipes and rails is different from arranging objects to invite a
  difficult-looking connection *(already cited; not re-read)*. — Ralph D'Amato (associate
  producer), [Planet Tony Hawk][ptdam], October 2000, as cited in [research-maps.md][rm] · `DEV`
- **G5** School II's opening is a short chain: kicker, wallride and bell, canopy grind, glass,
  rooftops *(already cited; not re-read)*. — Josh Tsui (Robomodo president), [Sound &
  Vision][snv], 2012-05-30 · `DEV`
- **G6** "We're gonna put in a lot more stair sets and kinked rails"; "Not just run-of-the-mill
  straight rails everywhere." — Chris Rausch, [EGM 130][egm130] · `DEV`
- **G7** Some original gaps were bugged and could be done in ways "the developer didn't
  necessarily intend". Because "that's not how players remember doing them", the remake kept the
  quirks: "Most of the time, we just recreate the bug." — Kurt Tillmanns, [Official Xbox Podcast
  transcript][xbp] · `DEV`
- **G8** Iron Galaxy hid community nods "with gaps that are named uniquely". Remake fixes are
  "adding a grind line here or adjusting how a gap is accomplishable there" *(second point already
  cited)*. — Mike Rossi, [Official Xbox Podcast transcript][xbp] · `DEV`
- **G9** "Most of the levels are designed to tap into" THPS4's spine transfer (`PARA`); "The gaps in
  Tony Hawk 4 are very inventive, and as always, cleverly named" (caption, `OBS`). — [Game Informer
  110][gi110]
- **G10** Spine transfers "could be key to finding extra points via Gaps" in 1+2 ([PlayStation
  Blog][psbwh], `PUB`); THPS 3+4's Expert Challenges include "gap combos" ([Activision][thramp],
  `PUB`).
- **G11** For the Downhill Jam spin-off, "tons of lines leading to shortcuts and alternate paths
  that players can reach using different skating styles" is the "bread-and-butter of a TONY HAWK
  racing game" *(route density already cited)*. Artists finished pretty geometry and then a
  designer would ask, "Didn't you realize that you can wall-ride up there to hit that secret grind
  over the ice caves?" — Toby Schadt (lead designer, Toys for Bob), [Game Developer, January
  2007][gdm07] · `DEV`

## 5. Real spots, reference trips, vert and street

- **R1** THPS1 used little reference: "You sit down and think off the tip of your head 'what
  environments does a skater skate in?'" A school and a city were obvious. Then "you'd stick a lot
  of quarter-pipes everywhere and let people grind along the tops of walls or phone lines", giving
  "this mixture of reference to real things with other elements that make it more fun". — Mick
  West, [Retro Gamer making-of][rgmo] · `DEV`
- **R2** For THPS2 the team "repeatedly watches every skate video that's ever been made" at lunch
  (Jewett), made field trips with cameras and recorded hundreds of hours of video (`PARA`); Jamie
  Thomas brought his raw footage of the spots they listed; the most-requested real spots from fans
  were built, School II merges several Southern California campuses, and New York copies the
  Brooklyn Banks (`PARA`). "To have it totally grounded in reality is a blast." — Joel Jewett, [EGM
  130][egm130] · `DEV`
- **R3** "The reason these spots made it into the game is because they're plastered all over the
  skate videos": a player can skate the school, watch the replay "and absolutely recognize what
  he's doing". — Scott Pease, [EGM 130][egm130] · `DEV`
- **R4** THPS2 left out downhill levels because they limited free skating; Skate Heaven gathers
  memorable real spots *(already cited; not re-read)*. — Tony Hawk, [Planet Tony Hawk Q&A][pth2],
  as cited in [research-principles.md][rp] · `DEV`
- **R5** From about THPS3, "We'd take a team of an artist and a level designer out on-location to
  see what the location looked like, take reference photos and then come back." — Mick West,
  [Retro Gamer history][rghist] · `DEV`. Gentile's Proving Ground trip to Washington took
  "hundreds of pictures", and the subway they rode became the tunnel between two levels. — Andy
  Gentile, [portfolio: Proving Ground][gentpg] · `DEV`
- **R6** "My approach with Tony Hawk was more street than competition." "Going up and down the ramp
  is completely boring, but on the street doing tricks on rails and steps, that's cool to me." —
  Silvio Porretta, [The Ringer][ringer] · `DEV`
- **R7** "I mostly skate bowls and vert ramps", "skating the type of terrain I would skate, but doing
  impossible combos". — Tony Hawk, [Jenkem][jenkem], 2017-01-13 · `DEV`
- **R8** THPS1's School "had huge pools and vert ramps snaking through the level", like "a skatepark
  masquerading as an educational facility", while School II "felt real"; THPS2's levels "were now
  designed with manuals in mind" and were larger. — George Collum, [Killscreen][killscreen],
  2015-10-12 · `OBS`
- **R9** Waterpark's brief was "one of these forbidden places that skaters love to go, but they're
  not usually allowed"; the team searched for abandoned waterparks skaters had sneaked into, and
  Hawk had skated one *(forbidden and fantastic places already cited)*. — Kurt Tillmanns, [Official
  Xbox Podcast transcript][xbp] · `DEV`
- **R10** The games taught people who never skated to "see landscapes as skateable places in the
  real world". — Tony Hawk, [Washington Post, via Stars and Stripes][wapo] · `DEV`

## 6. Secret areas, unlocks and changing geometry

- **U1** At a 2001 preview, grinding past a switch box in Canada raised a hydraulic ramp that opened
  a new part of the level (`OBS`). Cammarata said one of the goals in each level would "change its
  structure and to unlock secret areas" (quotation reassembled from a scan whose columns the OCR
  interleaved). — Aaron Cammarata (THPS3 level designer, Canada), [PSM2 issue 11][psm2], July 2001
  · `DEV`
- **U2** "We're going to have a given number of goals in the level that unlock additional pieces of
  geometry": finish Jamie Thomas's goal and he drags ramps in, which can be toggled, "so
  essentially, these additions will change the lines". — Scott Pease, [Game Informer 110][gi110] ·
  `DEV`
- **U3** Player-caused openings in period coverage: give Suburbia's thin man his key and he axes
  down the barriers to a hidden area ([EGM 147][egm147], October 2001, `OBS`); a THPS4 zoo elephant
  smashes open the aquarium ([Game Informer 110][gi110], `OBS`); THPS2 New York needs tokens for
  the subway and its rails ([EGM 130][egm130], `PARA`).
- **U4** Gentile "Designed and managed before-and-after states of level geo for level events and
  player progression" and managed "nodeflags for proper progression states". — Andy Gentile
  (Neversoft level designer), portfolio: [Project 8][gentp8], [Proving Ground][gentpg], [American
  Wasteland][gentaw] · `DEV`
- **U5** Secret areas are an "expectation" Iron Galaxy had to balance (Rossi, `PARA`, [GamesRadar][gr25],
  2025-05-08). Foundry ships with "a secret area" ([PlayStation Blog][psb34], 2025-05-08, `PUB`);
  Pinball's centre ramp "leads to shut bars for now", and players should "explore every ramp, rail,
  and hidden entrance to unlock the board's full capabilities" ([Bird's Eye View: Pinball][thpin],
  2025-06-11, `PUB`).
- **U6** Walking in THUG "opens it up a lot": "You could put some stuff in areas that most people
  wouldn't be able to access just with the skateboard", and it gave designers "the opportunity to
  sort of break the rules of skate lines". — Alan Flores, [Retro Gamer history][rghist] · `DEV`
- **U7** Walking was meant as convenience ("you can just stop and hang out, walk around, walk up
  stairs, or climb up to rooftops"), but "We don't want to turn it into a running game". — Scott
  Pease, [Game Informer 122][gi122] · `DEV`. Getting off the board "comes a lot from real-life
  skateboarding". — Joel Jewett, same source · `DEV`
- **U8** 1+2 includes every level "including all the secret levels". — Jen Oneal (Vicarious Visions
  studio head), [Press Start][psvv], 2020-05-13 · `DEV`

## 7. Scale and structure

- **S1** "The original Tony Hawk starts with the Warehouse which is a small level, while the second
  is the School level, which is much more open." — Mick West, [Retro Gamer making-of][rgmo] · `DEV`
- **S2** For THPS4 "what we wanted to do was make the levels much bigger and more alive than ever
  before" (Pease, `DEV`). Earlier levels "were easy to navigate and mentally map", THPS4's are
  "individual worlds", and you leave one by paying a cab driver (`OBS`). — [Game Informer
  110][gi110]
- **S3** West's favourite is THPS4: "I liked the levels, the designs are really good." — [GamesRadar/OPM][gr19]
  · `DEV`. THPS4 was "the first time that we broke the formula and tried to do something a little
  more adventurous, a little more GTA-esque". — Scott Pease, [Inverse][inverse24] · `DEV`
- **S4** THUG's stages were at first too large for the PS2; Jewett: "Basically push it till it
  doesn't work, then fix it." — [Game Informer 122][gi122] · `DEV`
- **S5** American Wasteland's streaming world used long connecting tunnels as a stopgap (Flores,
  `PARA`, [Retro Gamer history][rghist]); Proving Ground needed designers of neighbouring areas to
  coordinate "to maximize efficiency and maintain user/skater flow between levels" *(already cited)*
  (Gentile, [Proving Ground][gentpg], `DEV`).
- **S6** "The big thing with the classic parks is that they were built for the movesets that the
  skaters had at the time." The new parks were built with the full modern move set. — Kurt
  Tillmanns, [DBLTAP][dbltap], 2025-07-23 · `DEV`
- **S7** Official map guides for Iron Galaxy's new parks: Waterpark's marquee is a compact ramp
  cluster where "close-together obstacles create faster transitions and more opportunities for
  back-to-back tricks", and its lazy river is "an extensive vert ramp that touches all corners of
  the map"; Movie Studio's "horseshoe design favors smooth, connected runs"; riding into Pinball's
  zombie mouth throws you back to where you first dropped in. — [Waterpark][thwp], [Movie
  Studio][thmov] and [Pinball][thpin] guides, 2025 · `PUB`
- **S8** Later games became "bogged down by storylines and increasingly bloated levels". — Mike Rose
  and Kris Graft, [Gamasutra][gdhd], 2012-07-30 · `OBS`

## 8. Camera, sightlines and draw distance

- **C1** "Mick invented the camera movement where you jump off the vert ramp and the camera would
  swing around and look down to see where you were going to land." "Without that, there's no
  game." — Scott Pease, [Washington Post, via Stars and Stripes][wapo] · `DEV`
- **C2** Neversoft crossed the road to *Top Skater* "to study how their camera behaved when the
  player went up a ramp or vert wall". — Scott Pease, [Inverse][inverse24] · `DEV`; it "had a really
  nice camera". — Scott Pease, [Jenkem][jenkem] · `DEV`
- **C3** Longer draw distance lets players plan lines earlier, and extra pedestrians were left out
  because they could hide the next grind *(already cited; not re-read)*. — Josh Tsui, [Sound &
  Vision][snv] · `DEV`
- **C4** Treyarch's Dreamcast THPS kept identical courses but "doubled the draw distance" (`PARA`);
  "Certainly we didn't want to change the feel". — Gregory John (Treyarch producer), [EGM
  130][egm130] · `DEV`
- **C5** Period hands-ons praise THPS3's "incredible draw distances" ([Game Informer 101][gi101],
  `OBS`) and THPS4's "expansive worlds showing every detail without draw-in" ([Game Informer
  110][gi110] caption, `OBS`).
- **C6** Waterpark is so large that "you can get to the top of the slide and see across the entire
  park and plan out your combo line", which older hardware could not do. — Kurt Tillmanns,
  [DBLTAP][dbltap] · `DEV`
- **C7** New lights or detail could change "how the player reads a certain line" *(already cited)*.
  — Mike Rossi, [Press Start][psig] · `DEV`
- **C8** In Movie Studio, "Ramps line the ground floor, arrows pointing up challenging you to get
  high enough to reach the upper level"; up top the "perilous walkways require precision", with
  ramps at the rail ends to pop up and come back. — [Bird's Eye View: Movie Studio][thmov],
  2025-06-11 · `PUB`

## 9. Collision, grind input and level bounds

- **X1** "We never wanted you to accidentally do something you didn't want to do." A grind starts
  only when you press the button, so it "feels like you're doing something, versus the game kind of
  playing itself". — Scott Pease, [The Ringer][ringer] · `DEV`
- **X2** On 1+2 Gentile "Guided the level design team in how to properly lay-out and flag collision
  and markup throughout every level" *(already cited)* and "Ensured parity between THPS4 (2002) and
  THPS1+2 skater controls, physics, mechanics, and expectations". — Andy Gentile (senior designer,
  Vicarious Visions), [portfolio: THPS 1+2][gent12] · `DEV`
- **X3** Neversoft "Face flagging": non-collidable foliage, flags and small objects, "wallride flags
  for walls, vert flags for quarter pipes", and "inserting invisible collision to cater to users and
  finesse accessibility", plus grind and climb nodes and gaps *(already cited)*. On Project 8,
  Havok needed invisible collision primitives kept separate from the visible objects, and every
  surface had to be tagged for its sound and effects. — Andy Gentile, portfolio: [American
  Wasteland][gentaw], [Project 8][gentp8], [Proving Ground][gentpg] · `DEV`
- **X4** Project 8's physics changed throughout development, "so that meant rebuilding my first level
  many times to fit the new behaviors of the skater". — Andy Gentile, [portfolio: Project
  8][gentp8] · `DEV`
- **X5** Iron Galaxy treated "the marriage between both how you control the skater and the actual
  collision in the world" as untouchable *(already cited)*. — Mike Rossi, [Official Xbox Podcast
  transcript][xbp] · `DEV`
- **X6** Jango Fett's jetpack special "immediately broke every level in the game": designers "had to
  add invisible domes over all the levels so the player couldn't jump jet out of their level and get
  stuck". — Scott Pease, [Inverse][inverse24] · `DEV`
- **X7** Walking was "a much bigger deal for the level designers" than skating: they "have to really
  close them all up and make sure you can maneuver both ways". — Scott Pease, quoted from USgamer by
  [Game Developer][gdthug], 2017-09-01 · `DEV` (quoted in press)
- **X8** Early on West fixed a skater "falling through the level" while adding rail grinds and
  wallrides. — [Retro Gamer making-of][rgmo] · `PARA`
- **X9** Downhill Jam's late fixes focused on "eliminating bonks (geometry that makes players stop in
  their tracks)" *(already cited)*. — Toby Schadt, [Game Developer, January 2007][gdm07] · `DEV`

## 10. Playtesting, reviews and iteration

- **P1** Kids from a local high school tested the first game, and the team was "just watching them
  to see if they got frustrated at various points". — Mick West, [CoRecursive][cr] · `DEV`. Ralph
  D'Amato recruited them with flyers: "wave after wave of kid that didn't want to leave", which was
  "a little bit scary because we weren't getting much in the way of criticism". — [The
  Ringer][ringer] · `DEV`
- **P2** Joel Jewett wheeled a TV over to kids in skate-park car parks to watch them play. — Chris
  Rausch, [The Ringer][ringer] · `DEV`. The demo disc's feedback is T1.
- **P3** Tony Hawk "would work as a tester essentially", sending notes on builds (West,
  [GamesRadar/OPM][gr19], `DEV`); he got monthly builds on his own PS1 dev kit and had his friends
  play them (Pease, [Inverse][inverse24], `DEV`); "I'd play it incessantly and tell the Neversoft
  team what we should change or add" (Tony Hawk, [*Hawk: Occupation: Skateboarder*][hawkbook],
  2000, seen as an archive.org search snippet, `DEV`); Neversoft took his advice "from the look and
  feel of the game to whether he thinks things play well and are fun" (Jewett, [Game Informer
  101][gi101], `DEV`). Hawk: "it's just playing it and figuring out what's possible and what people
  are gonna like", including with his son ([EGM 130][egm130], `DEV`). Retro Gamer says he did not
  get involved in the design itself beyond occasional visits ([making-of][rgmo], `PARA`).
- **P4** The pros were blunt critics: Jamie Thomas told them "This is stupid, that's wrong, don't do
  that" (Pease, [Jenkem][jenkem], `DEV`). Thomas himself: "you actually let me in the door to tell
  you what's wrong with the game" ([EGM 130][egm130], pro skater consultant).
- **P5** "Previously on the TONY HAWK games, we scheduled weekly mission reviews with the project
  leads, designers, and artists to refine the levels and focus the work for the week." Dropping them
  on Gun left late fixes "that could have been easily caught earlier". — Scott Pease and Chad
  Findley, [Game Developer, March 2006 (GUN postmortem)][gdm06] · `DEV`
- **P6** Gentile "Sat in every level review to give feedback to other level designers for the
  initial blockout phase of every level" and worked with mission designers "to incorporate
  captivating objectives to work with level layouts". — Andy Gentile, portfolio: [Project
  8][gentp8], [Proving Ground][gentpg] · `DEV`
- **P7** As a Neversoft tester he "Tested and iterated while sitting side by side with Level
  Designers, Mission Designers, and Gameplay Programmers", and on THUG2 led focus tests: "Sat and
  watched new users who have never played before, took notes, and distributed notes". — Andy
  Gentile, portfolio: [THUG][gentthug], [THUG2][gentthug2] · `DEV`
- **P8** "We think about how it should be, so we put it in and just test the hell out of it - make
  sure it's cool." — Scott Pease, [Game Informer 122][gi122] · `DEV`. Neversoft would "focus test,
  and study what people were doing with the controller and adapt that". — Scott Pease,
  [Inverse][inverse24] · `DEV`
- **P9** D'Amato spent hours building a "perfect" creation in the park editor (the noun is garbled
  in the scan), "then play it for two hours and figure out how to improve it". — Ralph D'Amato, [Official U.S. PlayStation Magazine
  34][opm34], July 2000, pp. 85–88 · `DEV`
- **P10** Neversoft developers spent more than an hour failing to manual down a wavy staircase in
  THPS3's Los Angeles; community player Andy Gentile did it in two tries and was later hired as a
  tester. Flores said his levels suit "the broad spectrum of experience that players of our games
  have". — Kyle Orland, [EGM 209][egm209], November 2006, p. 46 · `PARA` (quote `DEV`)
- **P11** Vicarious Visions treated Tony as "our hardcore player" on regular builds (Jen Oneal,
  [Press Start][psvv], `DEV`). Iron Galaxy kept asking of new content "does this feel like this was
  always there and always fits within it?" (Mike Rossi, [Official Xbox Podcast transcript][xbp],
  `DEV`).
- **P12** A Downhill Jam tester who joined six weeks late saw the game with fresh eyes, and Schadt
  wanted staggered hiring next time *(already cited)*. — Toby Schadt, [Game Developer, January
  2007][gdm07] · `DEV`

## 11. Remakes and ports: what was kept

- **M1** "The one thing that we felt that was the most important thing to keep the same was the map
  layouts." — Barry Morales (senior producer, Vicarious Visions), [Retro Gamer history][rghist], 2020
  · `DEV`
- **M2** Vicarious Visions imported Neversoft's handling code and kept its timing "so you have that
  muscle memory"; making the new animations fit it was the hard part. — Jen Oneal, [ESPN][espn],
  2020-09-03 · `DEV`
- **M3** The revert was in "from day 1" because players expect endless lines *(already cited)*. —
  Leo Zuniga (lead designer, Vicarious Visions), [PlayStation Blog][psbwh] · `PUB`; Jen Oneal,
  [Press Start][psvv] · `DEV`
- **M4** Robomodo "kept the mechanics the same even though they were 13-years-old because that was
  our number one priority"; modernising them would have drawn "the same criticism from the other
  side". — Josh Tsui (Robomodo CEO), [Gamasutra][gdhd], 2012-07-30 · `DEV`. Placement and scale were
  preserved *(already cited; not re-read)*.
- **M5** A reviewer found 1+2 easier than the original: School II's wallride-the-bells goal took
  20-plus runs in 2000 and one in the remake, and "It's also noticeably easier to ollie up to higher
  areas in the remake". — [Pixel Fix][pixelfix], 2025-02-15 · `OBS`
- **M6** The GBA port chose an isometric view because "most of the level geometry and all of the
  level components are accessible in that view" (Conte, `DEV`); its Hangar no longer needs the glass
  smashed to reach the helicopter half (`OBS`). — [Time Extension][te]
- **M7** New parks had to feel as if "we found this on a hard drive for 4 and we revitalized it",
  "left on the cutting room floor". — Mike Rossi, [GamesRadar][gr25] and [Official Xbox Podcast
  transcript][xbp] · `DEV`

---

## What this means for the bible

These are design principles the sources above support. Each lists the claims it rests on. The
evidence summary is the developers'; the *Ours* line is our inference about this game, to be
checked against the engine numbers in [GAMEPLAY_DESIGN_BIBLE.md Part XV](../GAMEPLAY_DESIGN_BIBLE.md#part-xv--translating-crash-geometry-into-this-game)
and the Warehouse brief in [research-principles.md][rp] (five difficult collectibles, optional
walking, an unchanged movement model). None of it is something a THPS developer said about this game.

1. **A hidden collectible marks a spot worth filming.** The tape began as skate-video culture: find
   the spot, do the trick, get the replay. Neversoft built real spots because players would
   recognise them on replay, and treated tapes like Mario's stars. Sources: F4, F5, F6, R3.
   *Ours:* put each collectible at the end of a feat on readable architecture (a roof edge, a sign,
   a wire, a coping), never in a decorative nook, and make sure the spot is still fun to skate after
   the pickup is gone (F1, F2).
2. **Keep the list short and distinct, and write it after the level has been skated.** THPS1 had
   five things per level, brainstormed against a drawn level. By THPS3 Neversoft concluded that
   goals written before the team knew a level were shallow. Sources: F3, F5, F7, T4, T5, T6. *Ours:*
   draft the five collectibles only after the blockout has been skated, and make each one a
   different kind of feat (transfer, height, grind, gap, combo).
3. **Make "hard to reach" mean a hard line, not a hidden door.** Pease hid cash "in hard-to-reach
   places", and Rausch wanted constant discovery. The skill the series values is lining surfaces up,
   which even Neversoft's own designers had to learn. Sources: K1, K2, K8, G2, G3, G4. *Ours:* the
   difficulty of each collectible should come from speed setup, a transfer or a balance test. An
   obscure entrance or a long walk back should not be the hard part.
4. **Author the line as a chain of surfaces that line up, and prove it with real input.** "How this
   rail has to line up with that funbox" is the core skill. School II's opening is a short chain of
   actions, and stair sets and kinked rails give lines identity. Sources: G3, G4, G5, G6, G11.
   *Ours:* specify approach, launch, surface, receiver and exit for every collectible line, and
   verify each with controller input, not with route coordinates.
5. **Start each collectible line where players naturally arrive.** Iron Galaxy's hardest iteration
   was whether players naturally reached the start of a S-K-A-T-E line. In a one-spawn timed run,
   every goal is reached from the start. Sources: T9, T1, S1, S2. *Ours:* measure time from spawn
   and from the main loop to each line's first surface, and move the line, not the player, when it
   is awkward to reach.
6. **Stack the hardest pickups up the level's height, with the climb in view.** Letter lines climb
   from low ground to slide tops; thin high pathways hold Tour pickups; Activision describes hard
   hiding places as "a hard-to-reach grind" and "the apex of a sky-high aerial"; Movie Studio uses
   arrows on ramps to point at the upper level. Sources: K5, K6, K7, C8, U1. *Ours:* put one or two
   of the five on a high layer reached by a launch whose shape reads as a launch, and give that layer
   a fast way back down into play.
7. **Show the target and the landing before the commitment.** Neversoft's camera swung down to show
   where you would land; draw distance and fewer pedestrians helped players plan lines; Iron
   Galaxy's top-of-slide view exists to plan a combo line; Rossi checks that new lighting does not
   change how a line reads. Sources: C1, C2, C3, C4, C5, C6, C7. *Ours:* give every collectible a vantage
   point and a visible receiver from the approach, and keep props, trusses and reflections out of
   that view.
8. **Let the player change the level to open a secret, and make the change loud.** Cammarata wanted
   goals that change a level's structure to open secret areas; THPS4 goals bring in geometry that
   changes the lines; keys, switches and an elephant open new areas; Neversoft managed before and
   after states as authored data. Sources: U1, U2, U3, U4, K6. *Ours:* at most one of the five should
   sit behind a player-caused change, with the switch visible from the area it opens and the change
   lasting for the rest of the run.
9. **Secret areas are expected, and they should be places to skate.** Iron Galaxy calls secret
   areas an "expectation"; official parks advertise them; new content had to feel as if it had always
   been there. Sources: U5, U8, M7, R9. *Ours:* a secret area should hold a small session of its own
   and match the level's theme, not be a bare room with a pickup in it.
10. **Build for the move set the game actually has, and measure again when it changes.** Classic
    parks were built for the moves of their time; Gentile rebuilt a level whenever Project 8's
    physics changed; Vicarious Visions kept layouts and imported the original handling code;
    Robomodo froze 13-year-old mechanics; a reviewer found the remake's higher ledges easier to
    reach. Sources: S6, X4, X2, M1, M2, M4, M5. *Ours:* size every collectible gap from the measured
    reach in Part XV, never from a THPS map, and re-test all five lines after any change to the
    movement model (which level work itself must not retune).
11. **Collision flags are part of the line.** Grinds fire only on a button press; Neversoft flagged
    walls for wallrides, quarter-pipes for vert and decoration as non-collidable; invisible collision
    smoothed access; bonks were hunted out; artists' finished art could hide a designer's secret
    grind. Sources: X1, X2, X3, X5, X9, G11. *Ours:* check every surface on a collectible line for the
    right grind, wallride and ramp behaviour after the art pass as well as in blockout, and keep
    decorative geometry out of launch and landing space.
12. **Close the level against shortcuts, unless the shortcut is the design.** Walking forced
    Neversoft to "close them all up"; a jetpack escaped every level until invisible domes went in;
    walking also let designers hide things a board cannot reach and "break the rules of skate
    lines"; Pease did not want a running game. Sources: X6, X7, U6, U7. *Ours:* because walking is
    optional here, decide for each collectible whether a walker may reach it, block foot or fall
    shortcuts that skip the skate feat, and bound high layers so no one leaves the level.
13. **Price the collectibles in tiers, with one expert test.** Neversoft tuned the base game so weaker
    players could progress and added "insanely tough" pro goals; C.O.M.B.O. demands every letter in
    one combo; Iron Galaxy moved surplus goals into Pro Goals and Expert Challenges. Sources: T7, T8,
    T11, K3, G10. *Ours:* make about three of the five reachable by a competent player and one or two
    expert-only, and offer any single-combo variant as an optional extra, not as part of the base five.
14. **Keep attempts short and retries instant.** The demo worked because you could restart at once;
    combos earn overtime; Iron Galaxy let players lengthen the timer without changing progression;
    the community turned 100% runs into speedruns; Pinball even returns a player to the drop-in point
    on demand. Sources: T1, T10, T12, T13, S7. *Ours:* a missed
    attempt should leave the player near the line's approach, on skateable ground, with no remote
    checkpoint warp or long walk back.
15. **Name the connections on collectible routes.** Gaps are the series' way of confirming that a
    player found a designed connection, from named community nods to gap-combo challenges and
    spine-transfer gaps, and the tools place gaps like letters. Sources: G1, G7, G8, G9, G10, K9.
    *Ours:* if the game can name connections, name
    the key transfer on each collectible line so the HUD confirms the intended route. A gap-combo
    challenge can reuse them.
16. **Once players learn a route, keep it, quirks included.** Iron Galaxy kept bugged gaps because
    players remember doing them that way; Vicarious Visions treated layouts as sacred; Robomodo
    froze the mechanics. Sources: G7, M1, M2, M4, P11. *Ours:* after a collectible line ships, do not
    silently "fix" an unintended but reliable approach; if a route must change, record why in
    LEVEL_ITERATIONS.
17. **Start from real reference, then exaggerate for reach, for both vert and street.** THPS1 took
    real school railings and added quarter-pipes everywhere and phone-line grinds; THPS2 copied
    famous spots; later teams photographed locations; Porretta preferred street and Hawk skates vert;
    THPS 3+4 moves letters to suit each skater's style. Sources: F10, R1, R2, R3, R5, R6, R7, R8, K4.
    *Ours:*
    give the five collectibles a mix of street feats (rails, ledges, gaps) and transition feats
    (airs, transfers), each on a surface a skater would recognise.
18. **Test with newcomers and experts, and review levels weekly.** Neversoft watched novices for
    frustration and worried when kids gave no criticism; Tony Hawk and the pros were expert critics;
    weekly reviews with designers and artists refined the levels; Gentile reviewed every blockout and
    watched first-time players; an expert fan could do a line the developers could not. Sources: P1,
    P3, P4, P5, P6, P7, P8, P10, P12. *Ours:* each collectible needs one session watched with a
    newcomer (can they find it and see how to try it?) and one with a strong player (can it be done
    from a normal entry?), and decorated levels need the same review again.

---

## Searches that found nothing useful

| Looked for | Result |
|---|---|
| Archived Planet Tony Hawk interviews (D'Amato, October 2000; Tony Hawk's THPS2 Q&A; the "histories" pages that Game Developer's 2009 history quotes) | The live site returns 403 and was not worked around. The Wayback Machine is unreachable here: the proxy resets `web.archive.org` connections and WebFetch refuses the host. The repository's earlier notes (G4, R4) are repeated, marked not re-read. |
| Sound & Vision's Josh Tsui interview, Garcellano's ArtStation page | Both sit behind bot checks, so not re-read. Their points (G5, C3, M4) are repeated, marked not re-read. |
| A Pocket Tactics interview with Scott Pease | None exists. Pocket Tactics (2025) relays Pease's quote from the Washington Post (F6), which is used through its Stars and Stripes reprint. |
| Haywire | No Haywire article on Tony Hawk level design was found. |
| Killscreen | Only George Collum's 2015 essay, with no developer quotes. Used as `OBS` (R8). |
| Game Developer, "The History of Tony Hawk's Pro Skater: Ollies, Grabs, and Grinds" (2009) | Secondary history with no developer interviews. Used only for T3 (`OBS`). |
| USgamer's THUG oral history and Mick West profile | USgamer returns HTTP 503. Pease's quotes survive through Game Developer's 2017 summary (X7). |
| GameSpot (1999 THPS preview, E3 2002 THPS4 reports, the 2020 Vicarious Visions video interview), PSU (Tsui and Rausch interviews), gamedev.net ("Interview with Chris Rausch"), Gamewatcher, GamePro.de | All behind bot checks. Not used. |
| Red Bull's interview with Leo Zuniga (2020) | The CDN returns "Access Denied". Zuniga appears only through the PlayStation Blog (M3). |
| IIT oral-history archive, "Interview with Josh Tsui" transcript | The connection was reset. Listed as a lead. |
| Edge, "A Board's Tale: An Interview with Neversoft" (2007; Jewett, Pease, Ward, Bright, Findley) | Only N4G's introduction survives; next-gen.biz is gone and archive.org full-text search does not find it. |
| The original Retro Gamer issue numbers for "The Making of Tony Hawk's Pro Skater" and "The History of: Tony Hawk's Pro Skater" | Not identified. The articles were read in their reprints (*The PlayStation Book*, 2017; *Retro Gamer Annual* vol. 7, 2020). |
| Mick West's own writing on gaps, tapes or levels (cowboyprogramming.com, Metabunk, his Game Developer columns) | None found. His March 2006 Game Developer column covers THPS's game-object system, not levels. |
| Interviews with Aaron Cammarata, Johnny Ow, Jason Uyeda, Darren Thorne or Chris Rausch about specific levels | Nothing beyond EGM 2000 (Rausch), PSM2 2001 (Cammarata) and the oral histories. Credits and cheat-code lists dominate archive.org hits. |
| IGN's 2002 THPS4 interviews and 2020 Vicarious Visions features; a GDC talk on THPS 1+2 or 3+4 levels | Not found. |
| Tony Hawk's autobiography, *Hawk: Occupation: Skateboarder* (2000) | Lending-only on archive.org; only search snippets were visible (P3). |
| A Game Developer postmortem of any main THPS game | None exists in the magazine archive; the nearest are the GUN postmortem (P5) and Downhill Jam (G11, X9, P12). |
| Audio and video leads, out of scope without transcripts | THPS Podcast (thpsX) episodes 36 (Ralph D'Amato), 41 (Chris Rausch), 46 (Mick West), 51–52 (Andy Gentile, "andythps"); Game Informer's July 2020 video interviews with Zuniga, John Dobbie and Tony Hawk; GameSpot's 2020 video interview with Simon Ebejer; the documentary *Pretending I'm a Superman* (2020). The Official Xbox Podcast was used because Xbox Wire publishes a transcript. |

---

## Source register

| Key | Source | Speaker / author | Date | Type |
|---|---|---|---|---|
| cr | [CoRecursive #099, "Code, Kickflips and Crunch Time"][cr] (transcript) | Adam Gordon Bell with Mick West | 2024-04-02 | `DEV` |
| gr19 | [Tony Hawk's Pro Skater turns 20 (Official PlayStation Magazine)][gr19] | Stuart Kenny, quoting Mick West | 2019-09-02 | `DEV` |
| ringer | [Tricks, Kickflips, and Thumbsticks: an oral history][ringer] | Anthony John Agnello, quoting West, Pease, Porretta, Rausch, D'Amato, Stohl, Hawk | 2019-08-30 | `DEV` |
| jenkem | [The oral history of Tony Hawk's Pro Skater][jenkem] | Nic Dobija-Nootens, quoting Porretta, Pease, Hawk | 2017-01-13 | `DEV` |
| gdhist | [The History of Tony Hawk's Pro Skater: Ollies, Grabs, and Grinds][gdhist] | Bill Loguidice and Matt Barton | 2009-03-10 | `OBS` |
| rgmo | [Retro Gamer, "The Making of Tony Hawk's Pro Skater"][rgmo], in *The PlayStation Book* 2nd ed. (archive.org collection) | Retro Gamer, quoting Mick West | 2017 reprint | `DEV` / `PARA` |
| rghist | [Retro Gamer, "The History of: Tony Hawk's Pro Skater"][rghist], in *Retro Gamer Annual* vol. 7 (same collection) | Retro Gamer, quoting West, Alan Flores, Barry Morales | 2020 | `DEV` / `PARA` |
| egm130 | [Electronic Gaming Monthly 130, THPS2 cover feature][egm130] | Crispin Boyer, quoting Pease, Rausch, Jewett, Hawk, Thomas, Gregory John | May 2000 | `DEV` / `PARA` / `OBS` |
| opm34 | [Official U.S. PlayStation Magazine 34, "The Genius of Neversoft"][opm34] | OPM staff, quoting Jewett, D'Amato | July 2000 | `DEV` |
| psm2 | [PSM2 (UK) issue 11, THPS3 preview][psm2] | PSM2 staff, quoting Aaron Cammarata | July 2001 | `DEV` / `OBS` |
| gi101 | [Game Informer 101, THPS3 cover story][gi101] | Game Informer staff, quoting Jewett, Pease | September 2001 | `DEV` / `OBS` |
| egm147 | [Electronic Gaming Monthly 147, THPS3 preview][egm147] | Che Chou | October 2001 | `OBS` |
| gi110 | [Game Informer 110, THPS4 cover story][gi110] | Game Informer staff, quoting Jewett, Pease | June 2002 | `DEV` / `PARA` / `OBS` |
| gi122 | [Game Informer 122, THUG cover story][gi122] | Game Informer staff, quoting Jewett, Pease, Chad Findley | June 2003 | `DEV` |
| gdm06 | [Game Developer, March 2006: Postmortem, Neversoft's GUN][gdm06] | Scott Pease and Chad Findley | March 2006 | `DEV` |
| gdm07 | [Game Developer, January 2007: "Not Your Typical Grind"][gdm07] (also on the [GDC Vault](https://media.gdcvault.com/GD_Mag_Archives/GDM_January_2007.pdf)) | Toby Schadt (Toys for Bob) | January 2007 | `DEV` |
| egm209 | [Electronic Gaming Monthly 209, "Take This Job"][egm209] | Kyle Orland, quoting Andy Gentile, Alan Flores | November 2006 | `PARA` / `DEV` |
| hawkbook | [*Hawk: Occupation: Skateboarder*][hawkbook] (search snippet only) | Tony Hawk with Sean Mortimer | 2000 | `DEV` |
| wapo | [Tony Hawk is still making you see the world like a skater][wapo] (Washington Post, reprinted by Stars and Stripes) | Gene Park, quoting Pease, Hawk, Tillmanns | July 2025; reprint 2025-08-01 | `DEV` |
| pocket | [This Donkey Kong Bananza predecessor is a key influence on THPS][pocket] | Sam Comrie, relaying the Post | 2025-07-21 | `DEV` (relayed) |
| inverse24 | [Inverse interview with Scott Pease][inverse24] | Trone Dowd | 2024-09-29 | `DEV` |
| gdthug | [How Neversoft twisted Tony Hawk to let players step off the board][gdthug] | Alex Wawro, quoting USgamer's THUG oral history | 2017-09-01 | `DEV` (quoted) |
| gent12, gentpg, gentp8, gentaw, gentthug, gentthug2 | Andy Gentile portfolio: [THPS 1+2][gent12], [Proving Ground][gentpg], [Project 8][gentp8], [American Wasteland][gentaw], [THUG][gentthug], [THUG2][gentthug2] | Andy Gentile | pages dated February 2026 | `DEV` |
| ptdam | [Planet Tony Hawk interview][ptdam] *(already cited; not re-read)* | Ralph D'Amato | October 2000 | `DEV` |
| pth2 | [Planet Tony Hawk THPS2 Q&A][pth2] *(already cited; not re-read)* | Tony Hawk | undated | `DEV` |
| snv | [Sound & Vision interview][snv] *(already cited; not re-read)* | Josh Tsui (Robomodo) | 2012-05-30 | `DEV` |
| gdhd | [Did Tony Hawk's Pro Skater HD set the stage for a franchise revival?][gdhd] | Mike Rose and Kris Graft, quoting Josh Tsui | 2012-07-30 | `DEV` / `OBS` |
| psbwh | [THPS 1+2 Warehouse demo: everything you need to know][psbwh] | James Mattone (Activision editorial), quoting Leo Zuniga | 2020-08-12 | `PUB` |
| psvv | [Press Start interview with Jen Oneal][psvv] | Shannon Grixti | 2020-05-13 | `DEV` |
| espn | [How It's Made: bringing Tony Hawk's Pro Skater back to life][espn] | Jacob Wolf, quoting Jen Oneal | 2020-09-03 | `DEV` |
| tours | [The Tony Hawk's Pro Skater 1 + 2 Tours][tours] | Activision Support | 2020 (undated) | `PUB` |
| pixelfix | [Big Read: Tony Hawk vs Tony Hawk][pixelfix] | Pixel Fix | 2025-02-15 | `OBS` |
| te | [The making of THPS2's surprisingly stellar GBA port][te] | Jack Yarwood, quoting Matt Conte (Vicarious Visions) | 2025-01-10 | `DEV` / `PARA` |
| psig | [Press Start interview with Iron Galaxy][psig] | Brodie Gibbons, quoting Mike Rossi | 2025-05-09 | `DEV` |
| pswp | [Waterpark is a wonderful, original throwback][pswp] | Brodie Gibbons | 2025-05-09 | `OBS` |
| xbp | [Official Xbox Podcast: Dropping in on THPS 3+4][xbp] (transcript) | Mike Rossi, Kurt Tillmanns (Iron Galaxy) | 2025-05-14 | `DEV` |
| gd25 | [Recreating the freedom and fantasy of THPS 3+4][gd25] *(already cited)* | Alessandro Fillari, quoting Kurt Tillmanns | 2025-06-16 | `DEV` |
| gr25 | [THPS 3+4's new levels impress me as much as the rebuilt classics][gr25] | Jesse Vitelli, quoting Mike Rossi | 2025-05-08 | `DEV` / `PARA` |
| pcg25 | [Iron Galaxy has explained why THPS 3+4 won't feature the career mode][pcg25] | Kara Phillips, relaying Game Informer | 2025-05-12 | `DEV` (relayed) |
| vgc25 | [Some "missing" THPS4 content will be part of THPS 3+4's new game plus][vgc25] | Jordan Middler | 2025-06-09 | `PARA` |
| dbltap | [THPS 3+4 director interview][dbltap] | Ryan Woodrow, quoting Kurt Tillmanns | 2025-07-23 | `DEV` |
| psb34 | [THPS 3+4: a closer look at nine skate parks][psb34] | Daniel Noel (Activision) | 2025-05-08 | `PUB` |
| thwp | [Bird's Eye View: Waterpark][thwp] | Dan Noel (Activision) | 2025-03-04 | `PUB` |
| thpin | [Bird's Eye View: Pinball][thpin] | Dan Noel (Activision) | 2025-06-11 | `PUB` |
| thmov | [Bird's Eye View: Movie Studio][thmov] | Dan Noel (Activision) | 2025-06-11 | `PUB` |
| thramp | [THPS 3+4: Ramp Up to Launch][thramp] | Dan Noel (Activision) | 2025-06-18 | `PUB` |
| killscreen | [Worlds Collide: on THPS2 and style in skateboarding][killscreen] | George Collum | 2015-10-12 | `OBS` |

[cr]: https://corecursive.com/game-programming-with-mick-west/
[gr19]: https://www.gamesradar.com/tony-hawks-pro-skater-making-of-20-years-old/
[ringer]: https://www.theringer.com/2019/8/30/20838769/oral-history-tony-hawk-pro-skater-soundtrack-les-claypool-neversoft-activision
[jenkem]: https://www.jenkemmag.com/home/2017/01/13/the-oral-history-of-the-tony-hawks-pro-skater/
[gdhist]: https://www.gamedeveloper.com/design/the-history-of-i-tony-hawk-s-pro-skater-i-ollies-grabs-and-grinds
[rgmo]: https://archive.org/details/retro-gamer-ultimate-collection
[rghist]: https://archive.org/details/retro-gamer-ultimate-collection
[egm130]: https://archive.org/details/electronic-gaming-monthly-issue-130-may-2000
[opm34]: https://archive.org/details/official-u.-s.-playstation-magazine-issue-34-july-2000_202208
[psm2]: https://archive.org/details/psm-2-issue-11-july-2001
[gi101]: https://archive.org/details/game-informer-issue-101-september-2001
[egm147]: https://archive.org/details/electronic-gaming-monthly-issue-147-october-2001
[gi110]: https://archive.org/details/game-informer-issue-110-june-2002
[gi122]: https://archive.org/details/game-informer-issue-122-june-2003
[gdm06]: https://archive.org/details/GDM_March_2006
[gdm07]: https://archive.org/details/GDM_January_2007
[egm209]: https://archive.org/details/electronic-gaming-monthly-issue-209-november-2006
[hawkbook]: https://archive.org/details/hawkoccupationsk00hawk
[wapo]: https://www.stripes.com/living/entertainment/video_games/2025-08-01/tony-hawk-is-still-making-you-see-the-world-like-a-skater-18543749.html
[pocket]: https://www.pockettactics.com/tony-hawk-donkey-kong
[inverse24]: https://www.inverse.com/gaming/tony-hawk-pro-skater-anniversary
[gdthug]: https://www.gamedeveloper.com/design/how-neversoft-twisted-i-tony-hawk-i-to-let-players-step-off-the-board
[gent12]: https://andygentile.com/tony-hawks-pro-skater-1-2-2019-2020/
[gentpg]: https://andygentile.com/tony-hawks-proving-ground-2007/
[gentp8]: https://andygentile.com/tony-hawks-project-8-2006/
[gentaw]: https://andygentile.com/tony-hawks-american-wasteland-2005/
[gentthug]: https://andygentile.com/tony-hawks-underground-2003/
[gentthug2]: https://andygentile.com/tony-hawks-underground-2-2004/
[ptdam]: https://planettonyhawk.gamespy.com/Viewf473.html?id=38&view=Articles.Detail
[pth2]: https://planettonyhawk.gamespy.com/Viewa087.html?id=21&view=histories.Detail
[snv]: https://www.soundandvision.com/content/sv-interview-robomodo-president-josh-tsui-talks-tony-hawk-pro-skater-hd
[gdhd]: https://www.gamedeveloper.com/business/did-i-tony-hawk-s-pro-skater-hd-i-set-the-stage-for-a-franchise-revival-
[psbwh]: https://blog.playstation.com/2020/08/12/tony-hawks-pro-skater-1-2-warehouse-demo-everything-you-need-to-know/
[psvv]: https://press-start.com.au/features/2020/05/13/we-chatted-to-the-vicarious-visions-studio-head-about-the-return-of-tony-hawks-pro-skater-1-2/
[espn]: https://www.espn.com/esports/story/_/id/29802496/how-made-bringing-tony-hawk-pro-skater-back-life
[tours]: https://support.activision.com/tony-hawks-pro-skater-1-2/articles/the-tony-hawks-pro-skater-1-2-tours
[pixelfix]: https://pixelfix.substack.com/p/big-read-tony-hawk-vs-tony-hawk
[te]: https://www.timeextension.com/features/the-making-of-tony-hawks-pro-skater-2s-surprisingly-stellar-gba-port
[psig]: https://press-start.com.au/features/2025/05/09/we-got-to-chat-with-iron-galaxy-about-bringing-tony-hawks-pro-skater-34-to-life/
[pswp]: https://press-start.com.au/features/2025/05/09/waterpark-is-a-wonderful-original-throwback-from-the-thps-34-developer/
[xbp]: https://news.xbox.com/en-us/podcast/dropping-in-on-tony-hawks-pro-skater-34-official-xbox-podcast/
[gd25]: https://www.gamedeveloper.com/design/recreating-the-freedom-and-fantasy-of-tony-hawk-s-pro-skater-3-4
[gr25]: https://www.gamesradar.com/games/sports/tony-hawks-pro-skater-3-4s-new-levels-impress-me-as-much-the-rebuilt-classics-this-needs-to-feel-like-we-found-this-on-a-hard-drive-for-thps4-and-we-revitalized-it
[pcg25]: https://www.pcgamer.com/games/sports/iron-galaxy-has-explained-why-tony-hawks-pro-skater-3-4-wont-feature-the-career-mode-our-goal-here-is-to-make-the-ultimate-package
[vgc25]: https://www.videogameschronicle.com/news/some-missing-tony-hawks-pro-skater-4-content-will-be-part-of-thps-34s-new-game-plus
[dbltap]: https://www.dbltap.com/features/thps-3-4-director-interview
[psb34]: https://blog.playstation.com/?p=404598
[thwp]: https://www.tonyhawkthegame.com/blog/2025/03/tony-hawk-pro-skater-three-plus-four-launch-map-guide-waterpark
[thpin]: https://www.tonyhawkthegame.com/blog/2025/06/tony-hawk-pro-skater-three-four-park-map-guide-pinball
[thmov]: https://www.tonyhawkthegame.com/blog/2025/06/tony-hawk-pro-skater-three-four-park-map-guide-movie-studio
[thramp]: https://www.tonyhawkthegame.com/blog/2025/06/tony-hawk-pro-skater-three-four-launch-ramp-up
[killscreen]: https://www.killscreen.com/worlds-collide-tony-hawks-pro-skater-2-and-style-skateboarding/
[rp]: ../warehouse-flow/research-principles.md
[rm]: ../warehouse-flow/research-maps.md
