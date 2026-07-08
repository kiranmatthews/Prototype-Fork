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
| Steer / accelerate / brake | Left stick or d-pad | Arrow keys / WASD |
| Jump | X (Cross) | Space |
| Grind (near a rail) | Triangle | E |
| Spin attack / trick | Square | F |
| Restart | Options | R |

Death respawns automatically. Plug in a controller and press any button on it —
the detected name shows in the debug panel.

## The course

Start pad → downhill ramp (speed boost) → jump a death pit → landing deck →
grind rail over a big pit (Triangle near the rail, or land close and it snaps) →
spin the enemy and crates → kicker ramp with a gap (carry speed!) → finish gate.

## Files

- `src/main.ts` — renderer, corridor camera, fixed-step loop
- `src/input.ts` — Gamepad API (DualShock 4 mapping) + keyboard
- `src/player.ts` — authored movement: heading/speed/fake gravity/spin
- `src/rails.ts` — polyline grind rails; the rail owns the player
- `src/level.ts` — the greybox test course
- `src/tuning.ts` — every feel number in the game
- `src/ui.ts` — debug stats + live tuning sliders
