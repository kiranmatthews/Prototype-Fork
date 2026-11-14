# Sunset Safari and Willowmill Cache

Seventh campaign course, reviewed against the crate bible on 14 November 2026. Layout authoring finished in about nine minutes; complete validation and packaging took 33.8 minutes, exceeding the requested 15-minute main plus five-minute bonus budget.

| Measure | Before | After |
|---|---:|---:|
| Main counted cargo | 152 | 170 |
| Main collectible clusters | 150 | 53 |
| Main mean cluster size | 1.01 | 3.21 |
| Main single crates | 148 | 1 |
| Main enemy kinds / placements | 7 / 11 | 2 / 11 |
| Bonus counted crates | 18 | 27 |
| Bonus mean cluster size | 1.06 | 3.38 |

Every checkpoint section now has ten cargo crates, except the split millrace, which has ten on each branch. The clear route chooses a bank; the all-box route visits both. Small harvests occupy existing protected shoulders, jump courts, receivers and rest terraces. The downhill spillway keeps ten crates on its carve/smash line. No crates occupy the waterfall springs or their landing nets: ten sit on each of the three fixed checkpoint terraces. The native full descent still clears all twenty springs without death.

Masks remain before the stamping locks and quarry. The only main life sits on the optional mill roof, reached by the existing elevator. The arrow retains its visible upper reward; neither is claimed as a required height gate. Two Nitro boxes form a shoulder frame beneath a mystery crate. The green switch now stands on the final finish shelf and remotely credits all three. Checkpoint retry restores the frame and switch. Eleven existing patrol positions now use crabs and turtles, introduced on roomy ground before their later repetitions.

Willowmill Cache has seven terrace groups and one high life over its second 2 m water gap. The two forgiving jumps and single-plane controls remain intact. Its safe-line life and unnecessary final mask are removed. The gap reward is reachable with the ordinary jump and current full character collision silhouette; it is not an arrow or double-jump gate. A continuous native bonus-mode run and a continuous normal-loop browser preview both collect all 27 and finish without deaths. Actual bonus play banks toward the parent's 212-box gem (170 cargo + 15 checkpoints + 27 bonus); standalone preview awards its own gem.

## Verification

[Validation record](validation.json), [before audit](audit-before.json), [after audit](audit-after.json), [cargo and patrol checks](native-cargo.json), [traversal results](native-traversal.json), [bonus/water recovery](native-bonus-water.json), and [waterfall descent](native-waterfalls.json).

All 167 ordinary main crates were harvested in 52 separate supported scenarios, and the final switch cleared the three framed boxes without death. All 171 physical crates have ground/stack support; 330 enemy patrol probes stayed supported. Ten native route scenarios cover the lockyard, both millrace branches, spillway, sluices, ferry, quarry, continuous mill/spillway chapter, mill roof lift and final crown rail. The opening skating pilot was updated to follow the regrouped visible cargo instead of its old empty center line.

Main browser checks cover the opening harvest, genuine checkpoint activation and water death/recovery, and a separately staged finish. Full-render 1280×720 views and lite checks have clean consoles. No continuous main all-box run is claimed. Both split branches are individually crossed; all-box backtracking is not presented as a continuous tested run.

[Geometry comparison](geometry-preservation.json) proves all 4,400 non-crate/enemy main components and all 296 bonus components are identical to the preceding commit. Enemy positions, patrol ranges and speeds also match. Movement, animation, native art, terrain, hazards and the shared editor pack are preserved. The two main corner-overhang audit flags match the previous count; every crate center and stack is supported.

`npm run check:levels`, production build, release-size check (952,660,312 / 1,000,000,000 bytes), and diff checks pass. Native headless checks use the existing procedural asset fallback; the browser checks load the real assets. Publishing is authorized and awaits GitHub authentication.
