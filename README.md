# Board Platformer Prototype — Codex/sol Fork

This is the isolated level-geometry experiment fork of
[`kiranmatthews/Game-prototype`](https://github.com/kiranmatthews/Game-prototype).
It is set up to measure prompt-to-playable speed for Codex/sol level work
against the equivalent Unity greybox workflow.

- [Play the Codex/sol fork](https://kiranmatthews.github.io/Prototype-Fork/)
- [Experiment protocol](docs/CODEX_LEVEL_EXPERIMENT.md)
- [Iteration log](docs/LEVEL_ITERATIONS.md)
- [Unity-backport level primitives](docs/UNITY_BACKPORT_PRIMITIVES.md)
- [Level-editor round-trip contract](docs/EDITOR_ROUNDTRIP.md)
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

## Controls

| Action | PS4 controller | Keyboard |
| --- | --- | --- |
| Forward / back up | Left stick or d-pad up/down | Up/Down (W/S) |
| Sidestep (axis-locked, works in air) | Left stick left/right | Left/Right (A/D) |
| Jump | X (Cross) | Space |
| Grind (hold near/over a rail) | Triangle | E |
| Spin attack / trick | Square | F |
| Air grab (speed boost on landing) | Circle | Q |
| Spine transfer / revert | R2 | T |
| Restart | Share / Create | R |
| Pause | Options | P / Escape |

In a board air, Square / F selects a deck trick from the held direction:
neutral = Kickflip, left-only = Heelflip, right-only = Pop Shove-It, forward =
Impossible, and back = Varial Flip. Forward/back takes priority over sideways
input. Trick gates display both the required move and its input recipe on the
lock.

During an ordinary board ollie, press and release Jump a second time to perform
the risky emergency eject. The menu’s **STANDARD RULE** switch selects classic
lives or the optional Endless Deaths score/death-count ruleset.

Death respawns automatically. Plug in a controller and press any button on it —
the detected name shows in the debug panel.

## The courses

`Backport Mechanics Lab` is the compact validation course for speed and
trampoline pads, trick gates/rails, return portals, and procedural wood/bamboo
paths.

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
- `src/tuning.ts` — every feel number in the game
- `src/ui.ts` — debug stats + live tuning sliders
