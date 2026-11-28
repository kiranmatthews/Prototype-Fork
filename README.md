# Board Platformer Prototype — Codex/sol Fork

This is the isolated level-geometry experiment fork of
[`kiranmatthews/Game-prototype`](https://github.com/kiranmatthews/Game-prototype).
It is set up to measure prompt-to-playable speed for Codex/sol level work
against the equivalent Unity greybox workflow.

- [Play the Codex/sol fork](https://kiranmatthews.github.io/Prototype-Fork/)
- [All labs, tuning panels & tools](https://kiranmatthews.github.io/Prototype-Fork/labs/)
- [Experiment protocol](docs/CODEX_LEVEL_EXPERIMENT.md)
- [Iteration log](docs/LEVEL_ITERATIONS.md)
- [Gameplay design bible](docs/GAMEPLAY_DESIGN_BIBLE.md): crates, platforms, gaps, jumps, hazards and enemies, from 36 mapped Crash 2–4 levels (maps and evidence in [`docs/crate-bible/`](docs/crate-bible/README.md))
- [Unity-backport level primitives](docs/UNITY_BACKPORT_PRIMITIVES.md)
- [Level-editor round-trip contract](docs/EDITOR_ROUNDTRIP.md)
- [Universal ground-query acceleration](docs/GROUND_QUERY_ACCELERATION.md)
- [Unity Surf Cruiser skateboard + shape lab port](docs/UNITY_SKATEBOARD_WEB_PORT.md)
- [Unity spin effects + orbital-ring lab port](docs/UNITY_SPIN_EFFECTS_WEB_PORT.md)
- [Unity combo HUD math and text parity](docs/UNITY_COMBO_HUD_PARITY.md)
- [Authorized Jungle Cliff NST layout port](docs/JUNGLE_CLIFF_PORT.md)
- [Tripo → img2threejs character pipeline](docs/TRIPO_CHARACTER_PIPELINE.md)

A greybox feel prototype for a PS1/PS2-style fake-physics board platformer —
Crash Bandicoot 2 corridor structure meets Tony Hawk's Pro Skater 2 momentum.
No physics engine: all movement is authored numbers (see `src/tuning.ts`,
live-editable in the in-game panel).

## Run

```
npm ci
npm run dev
```

Before publishing a level edit:

```
npm run check:levels
npm run build
```

Timed geometry briefs should start in `src/levels/codex-lab.ts`; it is a small
source-owned level that hot reloads through the same component pipeline as the
in-game editor.

Character asset experiments use the pinned `vendor/img2threejs` and
`vendor/img2threejs-showcase` submodules plus the isolated official Tripo CLI
under `tools/tripo-character`. Tripo credentials and generated assets remain
outside the published browser bundle.

## Labs, tuning and configuration

Bookmark **[the full tools directory](https://kiranmatthews.github.io/Prototype-Fork/labs/)**
(`labs/` on the development server). It lists every project-owned HTML review,
embedded studio, graphics/configuration panel, movement-tuning section, editor
workspace, playable lab and diagnostic launch. Search matches names, controls
and source filenames; category and availability filters are bookmarkable.
The developer MENU also links to the directory.

Published tools open immediately. The **Local dev** entries retain their authoring
fixtures and run against the development-server URL configured in the directory
(default `http://localhost:5173/`). Run `npm run dev` in this checkout first.
Historical font/art proofs can require their original generated working assets;
CLI-only generation/test scripts and the separate vendor showcase are not game UIs.

Embedded bookmarks use `?playtest&level=codex-lab&tool=tuning&section=grinds`,
with the appropriate level/tool/section substituted. Studio hash bookmarks such
as `#characterlab` and `#fieldstudio` remain supported. Opening a tool waits for
startup, exposes its controls, and ignores a remembered editor reopening without
changing the saved debug-menu preference.

`tools/tool-directory.mjs` discovers browser pages at each build;
`tools/site-entries.mjs` owns published HTML entries;
`src/toolDirectoryEntries.ts` describes embedded destinations, deriving all
movement sections from `TUNING_SECTIONS`. Add a new embedded UI there and a
handler in `src/toolRoutes.ts` / `src/main.ts`. Validate with
`node tools/test-tool-directory.mjs` after building, and use
`tools/test-tool-directory-browser.mjs` for real-browser link and panel checks.

## Controls

| Action | PS4 controller | Keyboard |
| --- | --- | --- |
| Forward / back up | Left stick or d-pad up/down | Up/Down (W/S) |
| On-foot sidestep (ground / air) | Left stick left/right | Left/Right (A/D) |
| Jump / vert transfer / board abandon | X (Cross) | Space |
| Wall plant (in the air, as you meet a wall) | X (Cross) | Space |
| Grind (hold near/over a rail) | Triangle | E |
| Spin attack / trick | Square | F |
| Air grab (speed boost on landing) | Circle | Q |
| Revert / lip exit | R2 | T |
| Restart | Share / Create | R |
| Pause | Options | P / Escape |

In a board air, Square / F selects a deck trick from the held direction:
neutral = Kickflip, left-only = Heelflip, right-only = Pop Shove-It, forward =
Impossible, and back = Varial Flip. Forward/back takes priority over sideways
input. Trick gates display both the required move and its input recipe on the
lock.

On a rail, hold a direction before releasing Jump to hop toward that side.
Release Jump from neutral to keep the rail's launch line; left/right pressed
after takeoff spins without moving you sideways. Press Grind again in the air
and hold it to catch the same rail on descent or a neighbouring rail during a
transfer. Keeping the old Grind hold does not count; landing on a rail without
the new press bails. A held transfer direction does not also spin: release it,
then press again to add a rotation.
Jump charge and stick deflection control transfer distance; R2 and grabs do
not change the flight path.

Jump into a wall and press Jump as you meet it to plant and spring back off
it. The press counts from 0.2 s before the wall to 0.2 s after first touching
it. On foot it is a Wall Kick: two facing walls up to about 6 m apart can be
climbed kick by kick, and one wall takes a single kick until you land. A wall
whose top you can still reach (the jump you are in, an unspent double jump, the
ledge grab) is climbed instead, and Jump there keeps its usual meaning. On the
board it is a Wallplant: it must be pressed just before a wall you would
otherwise wipe out on, it sends you back out with 90% of your speed, and it
scores as a trick that keeps the combo alive. `Wall Plant Lab` is the practice
course, and the WALL PLANT tuning section holds every number.

During an ordinary board ollie, press and release Jump a second time to perform
the risky emergency eject. The menu’s **STANDARD RULE** switch selects classic
lives or the optional Endless Deaths score/death-count ruleset.

During mounted vert air, the next fresh Jump press/release attempts one spine
transfer; one further fresh press/release abandons the board. Landing resets the
sequence, and X must come back up after an unfinished air press before another
ground charge can begin.

Death respawns automatically. Plug in a controller and press any button on it —
the detected name shows in the debug panel.

## The courses

`Backport Mechanics Lab` is the compact validation course for speed and
trampoline pads, trick gates/rails, return portals, and procedural wood/bamboo
paths.

`Side Pipe Lab` is a side-scrolling test course whose path runs through
halfpipes seen across their section: walking up to a coping puts you on the
board at the lip, Jump (or the stick pressed on again) drops you in, and Jump
in the hang with the stick held out over a lip pops you out across it, still
on the board. It is 830 m long, its height is
the other subject, and it has twelve pipes (a pump and a spine, an 8.5 m plunge, a 28 m
valley, a `!` headed out of a hang, a three-pipe spine cascade, a rail from
one pipe into the next and a 52 m rail down to the gate) joined by on-foot
climbs and descents with falling stairs, a trampoline, lifts, a ferry, timed
pads, crushers and six kinds of enemy. It is framed through a long lens, so
it reads flat.
Direct link: `?playtest&level=side-pipe-lab`. See
[docs/SIDE_ON_PIPES.md](docs/SIDE_ON_PIPES.md); `npm run check:side-pipe`
plays it with the real player.

`Side Pipe Lab (Forward)` is the same course, part for part, met head-on:
the camera follows from behind and forward on the stick is down the course
(the wall yard behind the start turns the view round to face its walls). It
is built from the side-scrolling lab's own component list, so the two stay
the same. Direct link: `?playtest&level=side-pipe-lab-forward`.

`Side Platform Lab` is the second side-scrolling test course: one station for
each platforming object the pipe lab does not carry. Twenty-nine of them over
1,781 m, each opening on a checkpoint (`K` and `L` warp between them): ramps,
rolling ground, a timber road, rocks, ice, a sticky floor, water to swim and water
that kills, arrow crates and steel, explosives, spin bridges, rope bridges, rope
trampolines, rope swings, a wheel of decks, a springboard, a turntable and a lift, pendulums,
rolling stones, fire heads and lava, thorns, the bull, the turret and the bird;
then a board line (ropes to grind, a speed pad, a ferrying rail, a trick gate
and a trick rail, a spine to ride, a ball in a pipe, glass and the plane that
takes the board away) and a finale of portals, a cloud with a gem, the bonus
stone, the crystal and the gate.
Direct link: `?playtest&level=side-platform-lab`. See
[docs/SIDE_PLATFORM_LAB.md](docs/SIDE_PLATFORM_LAB.md); `npm run
check:side-platform` plays every station and the whole course with the real
player.

`Jungle Cliff` is an authorized clean-room layout reconstruction from
Kraftpaper's NST Maker mod: a winding jungle climb, west-facing cliff traverse,
upper temple corridor, and condensed portal-linked death route. It ships only
procedural project primitives; no Crash render/audio assets are included.

Start pad → downhill ramp (speed boost) → jump a death pit → landing deck →
grind rail over a big pit (hold Triangle near/over the rail — landing on it
without Triangle won't grind, THPS2 rules) → spin the enemy and crates →
kicker ramp with a gap (carry speed!) → finish gate.

## Files

- `src/main.ts` — renderer, corridor camera, fixed-step loop
- `src/input.ts` — Gamepad API (DualShock 4 mapping) + keyboard
- `src/player.ts` — authored movement: heading/speed/fake gravity/spin
- `src/rails.ts` — polyline grind rails; the rail owns the player
- `src/level.ts` — every level, plus the toolkit they are built from
- `src/groundAcceleration.ts` — per-geometry BVHs for universal ground queries
- `src/tuning.ts` — every feel number in the game
- `src/ui.ts` — debug stats + live tuning sliders

## Archived pictures

Review plates, storyboards, captures and retired font atlases that nothing in
the project reads were moved out of the working tree on 17 November 2026
(commit `bc41b016`). They remain in git history. List them with
`git show --name-only --diff-filter=D bc41b016` and restore a folder with
`git checkout bc41b016^ -- docs/<folder>`. Keep new review captures outside the
repository unless a page or tool needs them.
