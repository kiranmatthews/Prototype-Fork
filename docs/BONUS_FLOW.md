# Themed bonus stages and return flow

Bonus entrances use a Meshy-generated circular stone pedestal, 3.2 m across and 1.05 m high. Steep circular sides block running approaches; the flat top supports a deliberate jump. Entry requires an actual rising jump command followed by a grounded landing inside the top area. Walking, standing, falling without a jump command, and landing elsewhere cannot enter. A jump arms only one landing; deaths, resets, trial mode and locks clear it. Board riders charge and release an ollie to clear the raised deck. Default placements stay off the route centre and check room around walls, crates, checkpoints, enemies and individual rail segments. Narrow bridges can use a farther side pad. If a forward return point is over a gap, the supported approach point is retained for return.

The generated model is in `public/props/bonus-platform/stone-circle.glb`, with Meshy task/source hashes in `provenance.json`. Trial mode hides both art and all platform collision; locked completed platforms remain physical but do not accept entry. Suspended parent levels retain the shared artwork correctly.

Every non-boss campaign course has a distinct bonus room selected by `resolveBonusLevel(parentId)` in `src/levels/themed-bonuses.ts`. The 20 active authored rooms combine six measured crate relationships from [the platformer research](PLATFORMER_PUZZLE_RESEARCH.md): preserve an arrow for a high reward, spend finite striped supports in the correct order, materialize a visible bridge, activate and return to an earlier gallery, claim a high cap before a TNT fuse consumes its support, and harvest caps while retaining permanent gap anchors. Each parent has its own sequence and physical scenery. None uses the retired painted house/mountain parallax; normal authored fog, lighting and world geometry own the background. [Original art survey](art-reviews/themed-bonuses.jpg) includes four retired boss-room concepts.

| Parent | Bonus | Boxes | Main decisions |
| --- | --- | ---: | --- |
| Treehouse Trail | Canopy Cache | 7 | arrow before reward → retain gap anchors |
| Jungle Ruins | Fern Reliquary | 5 | arrow before reward → visible switch bridge |
| Carlisle Coast | Quayside Cargo | 6 | cap before fuse → visible switch bridge |
| Sky Bridge | Cloudtop Lockers | 7 | retain gap anchors → finite supports |
| Slipstream | Slipstream Airlocks | 9 | arrow before reward → retain gap anchors → visible switch bridge |
| Nightworks | Nightworks Fuse Store | 7 | cap before fuse → reveal and return |
| Beachside Run | Lifeguard Lockup | 5 | visible switch bridge → arrow before reward |
| Coastal | Rooftop Deliveries | 7 | finite supports → cap before fuse |
| Island Hopper | Lagoon Relay | 10 | retain gap anchors → arrow before reward → reveal and return |
| Blockworks | Blockworks Reassembly | 8 | reveal and return → visible switch bridge → finite supports |
| Chimeworks | Belfry Counterweights | 6 | finite supports → reveal and return |
| Deadwater Park | Deadwater Valve House | 9 | cap before fuse → visible switch bridge → reveal and return |
| Nightworks: After Hours | After Hours Dispatch | 11 | retain gap anchors → cap before fuse → reveal and return |
| Crate Primer | Apprentice Storehouse | 6 | arrow before reward → finite supports |
| Switchyard | Signal Cabin | 9 | visible switch bridge → reveal and return → retain gap anchors |
| Clockwork Gauntlet | Furnace Reserve | 10 | finite supports → reveal and return → cap before fuse |
| Temple Terraces | Jade Reservoir | 9 | finite supports → visible switch bridge → cap before fuse |
| Temple Skyline | Sun-Crown Treasury | 10 | reveal and return → retain gap anchors → arrow before reward |
| The Drowned Crown | The Captain’s Last Ledger | 9 | reveal and return → cap before fuse → visible switch bridge |
| The Bone Yard | Ivory Salvage | 10 | retain gap anchors → finite supports → reveal and return |

Ordinary courses use their raised bonus platforms. Temple Terraces and Temple Skyline have explicit pads beside their skating line. Crate Primer, Switchyard and Clockwork Gauntlet have bounded final-court alcoves with real openings in the depth boundary; the pad cannot provide a new height tool for their earlier puzzles. Their published editor snapshots contain the same entrances.

Boss and competition levels have no bonus pad, scorecard action, detour or bonus-box tally. Runtime construction ignores authored bonus components in older boss editor exports. Ordinary courses and unknown editor courses retain their bonus behavior.

Parent all-box totals use the selected room's actual breakable crates, excluding metal, metal arrows and switches. Completing a detour banks its broken-box count and locks that visit's entrance. Failing restores the original parent fruit/lives purse and leaves the bonus retryable. An ordinary exit with boxes left behind remains valid. A bonus detour contributes to the **parent's** gem objective; the direct standalone editor versions award their own gem before their gate. Main-only puzzle-course regression runs now correctly finish without a gem until the linked bonus boxes are also earned.

Unknown editor courses retain Easy Street as a safe fallback. The original Unity bonus and Easy Street remain available as editor entries with normal world backgrounds. `bonus-<progressKey>` entries expose every new room for direct playtesting, while actual detours retain the established `bonus:<parentId>` session identity.

Discarded boards survive a successful bonus detour, but a bonus death clears the suspended parent's pile on return, matching normal death/respawn cleanup.

Masks and remaining third-mask invincibility carry into the bonus and back out at their current values, on both completion and failure. Bonus damage can therefore consume a carried mask, and bonus pickups can add protection. Loading fades do not consume invincibility time. Restarting or abandoning the entire parent run still follows the ordinary fresh-run rules.

Fruit and lives are safely merged into Player/campaign inventory before the return reveal. A display-only 2.6-second payout then counts the parent HUD from its previous totals to the banked totals, including a 100-fruit rollover. New gameplay pickups or life losses during the count are not overwritten. In Modern mode the payout briefly shows the inventory totals, then returns to the ordinary death readout without changing endless-lives rules. A reset cancels only the animation, never the already-banked rewards.

Bonus entry, bonus return and the level-complete results reveal use asset-ready black fades without a vortex or minimum loading dwell. The destination camera refreshes its floor probe under black, and a fresh bonus begins facing right. Ordinary course loading retains the two-second vortex.

HUD run/reset boundaries clear completed trick copy, preview tracking, cash-in/bail state and pending payouts. Completed cash-in copy also has a bounded expiry. L2 rewards use the actual crystal/clear-gem/green-gem factories in large transparent slots, fitted to their real radial envelope rather than hidden behind CSS symbols.

Validation: all 24 source-spawn bonus pilots collect every authored box, collect the standalone gem and reach the actual gate with no deaths. Six shared-module positive runs and six wrong-order trials exercise the real dependencies. `test-themed-bonus-flow.mjs` executes production entry/return/reset functions for all parents and the fallback, including cup event preservation and failed/successful inventory rules. Real-player alcove checks cover all three puzzle courses. Full-render browser reviews cover every theme, with no retired backdrop nodes or texture requests; live cup/temple sessions check entry, completion, failure, return and compact scorecard controls. Existing bonus-polish and lifecycle regressions remain in place.
