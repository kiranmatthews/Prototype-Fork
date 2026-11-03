# Sunset Safari — expanded trampoline run

The waterfall extension now has twenty trampolines over a 784 m gorge, up from
twelve over 614 m. Landing footprints range from 10 × 15 m to 22 × 28 m, with
twelve distinct sizes. The route traverses 35 m of the river width and has
four uphill transfers above flat water, alternating with seven major falls.
Five pools provide at least 100 m of flat river. Three checkpoint shelves
divide the run into four groups of five springs; the only finish follows the
last group.

Frames, piles and brackets fit the individual nets. Piles reach below each
local river bed, including the taller nets above flat pools. The existing
5,082-triangle Smart Mesh rope joint is reused at full geometry, scaled to fit
the smaller frames. No new generated asset or movement tuning was needed.
Carlisle's rope deformation, bounce controls and launch camera remain shared.
The camera's forward axis stays aligned with the river during lateral jumps.
Scoped haze now starts at 170 m and ends at 300 m around the springs, keeping
the smaller receivers readable during the highest arcs. The original valley
atmosphere resumes outside that section.

The production Player completes all twenty transfers in 149.33 seconds,
then walks onto the finish, with no deaths or rim bails. Deliberately missing the final
net triggers its local water reset at -278.12 m. The global kill plane is
below the new scenery, and medal times allow for the longer traversal.

Source: `src/levels/sunset-waterfalls.ts`. The published pack is updated only
for `custard-creek`; every other level remains unchanged. Local review:
`/sunset-waterfall-review.html?playtest&level=custard-creek`.

Both lite and full-render native-resolution browser runs reach all twenty
nets in order, activate the three new terrace checkpoints and finish with
zero deaths, unexpected bails, asset errors or console errors. The measured
browser trampoline sequence is 149.35 seconds. The native Player regression,
tribal net deformation/visibility/disposal test, level checks, production
build and hosting-size check pass. No full suite was run.

Evidence: `browser-lite.json`, `browser-full.json`, `native-runtime.json`,
`upper-native.png`, `small-net-native.png`, and `lower-normal.png`.
