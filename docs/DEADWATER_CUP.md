# Deadwater Cup

The competition restores the latest non-linear Deadwater layout from commit
`871051744312ccfe8d0bcc9b2c6dda833fed1789` (before the linear conversion in
`3ed439e`). It is an additional venue, not a replacement for the downhill course.

`waterpark-cup-route.ts` preserves that source route. `waterpark-cup-base.ts`
restores its architecture, with the shared artwork factory's scenery-only slides
removed. `waterpark-cup.ts` adapts it for a free-skate competition: a courtyard
spawn, working coping and bridge rails, no course pickups/checkpoints, an optional
loop, a hidden service gate and perimeter containment. The recovered seven pools,
U-shaped ride route, circular lazy river, fountain island and bridges retain their
original placement. The original launch rollers belong only to this recovered
park; the linear course still uses gravity ramps exclusively.
Competition skating preserves each roller's authored speed for its finite launch
window; ordinary park speed, steering and braking retain their existing limits.

The venue uses the existing park controls, chase camera, three 60-second runs,
three judges, bail penalties, overtime and best-two total. Day, sunset and night
heat lighting carries across. Completing the optional loop pays a 1,000-point
ride award rather than an exit-unlocked message. Only first place wins the cup.
Deadwater and Jungle Cup trophies save independently.

The map appends `waterpark-cup` at identity index 14, connected to Deadwater Park
on the upper Island 2 branch and unlocked by clearing it. Deadwater Park remains
index 13 at `[86, 6, 4]`; the new Cup is at `[109, 12, 4]`. An untouched 14-node
saved map gains the new node. Custom map positions are preserved. Both Level
Select previews are captured from the actual current geometry.

Verification covers recovered pool dimensions, working rail scoring, supported
spawn, a complete motor-fed loop with its 1,000-point award, removed collectibles and scenery, separate trophies, three-run event
results, map graph and saved-map migration. Real Chrome checks cover the intro,
keyboard skating, actual loop inversion and ride-out, all three judging/standings screens and final trophy UI. The
browser results check seeds score and shortens the clock to inspect presentation;
actual rail scoring is tested separately using the production Player.
