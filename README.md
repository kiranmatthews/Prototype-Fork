# Board Platformer Prototype

A greybox feel prototype for a PS1/PS2-style fake-physics board platformer —
Crash Bandicoot 2 corridor structure meets Tony Hawk's Pro Skater 2 momentum.
No physics engine: all movement is authored numbers (see `src/tuning.ts`,
live-editable in the in-game panel).

## Run

```
npm install
npm run dev
```

## Controls

| Action | PS4 controller | Keyboard |
| --- | --- | --- |
| Forward / back up | Left stick or d-pad up/down | Up/Down (W/S) |
| Sidestep (axis-locked, works in air) | Left stick left/right | Left/Right (A/D) |
| Jump | X (Cross) | Space |
| Grind (hold near/over a rail) | Triangle | E |
| Spin attack / trick | Square | F |
| Air grab (speed boost on landing) | Circle | Q |
| Restart | Options | R |

Death respawns automatically. Plug in a controller and press any button on it —
the detected name shows in the debug panel.

## The course

Start pad → downhill ramp (speed boost) → jump a death pit → landing deck →
grind rail over a big pit (hold Triangle near/over the rail — landing on it
without Triangle won't grind, THPS2 rules) → spin the enemy and crates →
kicker ramp with a gap (carry speed!) → finish gate.

## Files

- `src/main.ts` — renderer, corridor camera, fixed-step loop
- `src/input.ts` — Gamepad API (DualShock 4 mapping) + keyboard
- `src/player.ts` — authored movement: heading/speed/fake gravity/spin
- `src/rails.ts` — polyline grind rails; the rail owns the player
- `src/level.ts` — the greybox test course
- `src/tuning.ts` — every feel number in the game
- `src/ui.ts` — debug stats + live tuning sliders
