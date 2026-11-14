# Ripcord River and Sluicekeeper’s Cache · 14 November 2026

Ripcord River now separates the boulder chase from harvesting. The protected checkpoint shelters and sanctuary hold the cargo; the two fork branches, jump approaches, bowls and escape rail stay clear. This follows the bible’s chase grammar: the pursuer supplies the pressure, and its stopped entrance marks the collecting respite.

| Measure | Before | After |
|---|---:|---:|
| Main counted crates | 21 | 50 |
| Main mean cluster size | 1.00 | 3.33 |
| Main singles | 21 | 0 |
| Main crates per checkpoint section | 5, 5, 4, 5, 2 | 10, 10, 10, 10, 10 |
| Chasing boulders | 5 | 5 |
| Bonus counted crates | 21 | 33 |
| Bonus mean cluster size | 1.50 | 2.54 |
| Bonus singles / counted crates | 11 / 21 | 4 / 33 |

The first shelter introduces a three-box harvest, a four-box wall and a checkpoint-side count trap. Later shelters repeat the two arrival groups, followed by a three-box departure harvest. The first room holds 13 boxes, each later room ten, and the sanctuary seven; splitting those groups at the checkpoint produces ten boxes in every section. The central walking line, mandatory trip, checkpoint, bonus pad and release threshold remain clear. Sanctuary rewards begin beyond the rail landing and sit beside the crystal and exit attractors.

Removed the isolated running-line crates, two branch/shoulder lives, twelve scattered steel boxes and the green switch with no Nitro to clear. Boulder impacts and river falls bypass masks, so the safe groups give ordinary rewards without implying shield protection from the chase. The risky life belongs to the bonus high cache. No extra patrol enemy competes with the boulders or interrupts the shelters. The five existing boulders, their speeds and paths, all four refuges, fork geometry, timing and mandatory chasm rail are unchanged.

Both fork choices now have the same all-box opportunity. Neither branch requires reversing into a live boulder to recover the other branch’s box. The all-box goal is independent of a no-death run: checkpoint recovery restores unbanked cargo, and the optional bonus can be retried. The parent total is 87: 50 cargo, four checkpoints and 33 bonus crates. Long crate-free runs are active chase/traversal passages with fruit and their existing gaps, banks and rails, not empty collecting rooms.

Sluicekeeper’s Cache retains its stepped aqueduct, arrow, three river islands, storehouse and falling timbers. The arrival group gains a rewarded lid and foot; the first stair remains a landing marker. Island rewards become two-high stacks on their unchanged stone footprints. A three-box ground row marks the safe storehouse pause before the timbers. Two four-box walls reward the final crossing, with the landing bank kept clear. The safe final life becomes ordinary cargo.

Native wrong-order play found that the old bell cache could be reached from the ordinary departure box after destroying the arrow. Raised the life from y=9.6 to y=12, added vertical fruit clues, and kept the nearer stair stack two high. The extra stair crate moved to the distant arrival group. The intended route preserves the arrow for its boosted rebound, then collects the arrow last; the pilot can add a double jump if the upper reward remains. See [validation](validation.json) for the successful route and measured alternate-support probes, including their fixture setup. The one floating crate is this deliberate high target.

The switch reveals six reward crates on three permanent islands. The existing platform primitive ignored its old outline flag, so removing that flag and correcting the description preserves actual footing. The islands still have water between them. Retry verification checks that the reward crates become outlines again while all three stone receivers remain supported.

Main layout review and authoring took approximately three to four minutes after starting at 04:49 UTC. Bonus authoring and native dependency corrections continued until approximately 05:02, roughly ten minutes including the failed bypass probe; this exceeded the requested five-minute bonus budget. Retry verification found the ignored platform-outline metadata, corrected around 05:19. Final browser review completed around 05:30, about 41 minutes after the pair began, with evidence packaging afterwards. This total exceeds the requested 15-minute main plus five-minute bonus budget; the overrun includes browser harness corrections and slow parallel software rendering.

Main verification includes both complete native branch routes, all checkpoints and the final rail, plus ordinary-input harvesting of all 50 cargo boxes from staged shelter/sanctuary starts. That is not a continuous all-box main run. The main browser check uses staged starts for harvesting, checkpoint/fall recovery and the finish gate. The bonus has a continuous native and browser all-box journey. Full-render views cover all four shelters, sanctuary, high-cache approach, islands, storehouse and return court. Initial main browser route attempts were interrupted by source reload or stopped because parallel software rendering was too slow; no continuous main browser finish is claimed. The final bonus browser harness matches normal controller rounding and passes the unchanged landing assertions. Required level checks, final production build and release-size results are in [validation](validation.json).

Only source-owned crate data and its focused test pilots change. Terrain, architecture, gap geometry, boulder behavior, movement, animation, complete native art and the published editor pack are preserved. The original Rumblewater course used by Rolling Bones is untouched.

Evidence: [audit](audit.md), [machine-readable audit](audit.json), [validation](validation.json), [first shelter](main-full-shelter-1.jpg), [bonus entrance shelter](main-full-shelter-2.jpg), [sanctuary](main-full-sanctuary.jpg), [high-cache approach](bonus-full-bell.jpg), [outlined island rewards](bonus-full-islands.jpg), [storehouse](bonus-full-storehouse.jpg), [return court](bonus-full-return-court.jpg), [bonus finish](bonus-lite-finish.jpg).
