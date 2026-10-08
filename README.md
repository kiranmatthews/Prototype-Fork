# Board Platformer Prototype — Codex/sol Fork

This is the isolated level-geometry experiment fork of
[`kiranmatthews/Game-prototype`](https://github.com/kiranmatthews/Game-prototype).
It is set up to measure prompt-to-playable speed for Codex/sol level work
against the equivalent Unity greybox workflow.

- [Play the Codex/sol fork](https://kiranmatthews.github.io/Prototype-Fork/)
- [All labs, tuning panels & tools](https://kiranmatthews.github.io/Prototype-Fork/labs/)
- [Experiment protocol](docs/CODEX_LEVEL_EXPERIMENT.md)
- [Iteration log](docs/LEVEL_ITERATIONS.md)
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

## Offline desktop app

See [the offline desktop publishing workflow](docs/OFFLINE_DESKTOP.md) for self-contained macOS, Windows and Linux builds, native packaging, offline verification and release performance gates.
