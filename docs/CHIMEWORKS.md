# The Chimeworks — Astra benchmark

[Play the published course](https://kiranmatthews.github.io/Prototype-Fork/?playtest&level=astra-chimeworks).
It is also a separate entry in the M-key debug level menu. Existing courses,
number-key shortcuts, campaign gates and movement tuning are unchanged.

A floating brass-and-teal instrument factory, with approximately 707 metres
from spawn to the finish. Intended difficulty: intermediate, with broad skating
channels and four checkpoints; the narrow grind shortcuts are optional.

## Route

1. **Overture:** a downhill channel with broad bends, breakable crate lines and
   a six-metre leap. The first checkpoint sits after the charged-jump landing.
2. **Xylophone:** seven rising keys separated by three-metre gaps. Two keys
   crumble after a warning. The long strings on either side bypass the hops
   if you can hold a grind, but skip the key crates.
3. **Harp and hammers:** collect the crystal on the reunion stage. To the right,
   hold Jump on the trampoline and steer onto the high life-crate shelf; drop
   back to the stage. Alternate hammer lanes lead into three sliding keys.
4. **Crescendo:** a second downhill channel, a boost and final kicker. The long
   landing balcony has the Nitro-clear switch before the exit, not under the
   jump arc.

There are 36 counted boxes (including four checkpoints), two Nitro hazards,
101 loose fruit and one crystal. The level pipeline supplies the final metal
Nitro-clear switch. Standard, time-trial and combo activators use the existing
mechanics. This is a standalone benchmark level, not a tenth canonical progress
slot; its results do not create crystal/gem ownership in a campaign save.

## Implementation and verification

The source is `src/levels/astra-chimeworks.ts`: 520 editor components using the
existing platform, curved transition, rail, crumble, mover, crusher, trampoline,
boost and collectible primitives. The instrument skyline is batched box scenery;
there are no new downloaded assets, render loops or movement parameters.

`npm run check:chimeworks` builds the actual Level and Player, checking 875
surface samples, support and true gaps, every mandatory platform transition,
both skate jumps, both full grind shortcuts, the trampoline detour/return and
ordinary held-forward skating through both downhill sections. Moving keys are
checked across their full cycle. Lite and full-render browser checks cover the
opening, all checkpoints, route visibility and console errors.

The opt-in `?playtest&level=<stable-id>` link and generic run-results support
are independently covered by `tools/test-playtest-level-flow.mjs`. Normal
production startup still opens the campaign shell; unrecognized playtest IDs
retain the previous safe fallback.
