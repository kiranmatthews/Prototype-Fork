# Themed bonus stages and return flow

Bonus stages use a 13.4 m side view with a 46° lens and a look target 2.7 m above the last supported feet. The character reads at roughly a quarter of the landscape frame height. A damped look-ahead leaves room for the next landing and eases reversals; ordinary jumps retain their floor anchor, while tall bounces and lower receivers keep the head and feet inside the gameplay area. The two legacy rooms use a render-only view so their travel zones and movement axes remain unchanged.

Bonus entrances use an ImageGen-to-Meshy circular masonry platform, 3.2 m across and 1.05 m high. Its large chunky question mark is built from golden sandstone blocks against dark blue-grey stones. The mark faces the normal approach; the platform has no floating BONUS label. Steep circular sides block running approaches; the flat top supports a deliberate jump. Entry requires an actual rising jump command followed by a grounded landing inside the top area. Walking, standing, falling without a jump command, and landing elsewhere cannot enter. A jump arms only one landing; deaths, resets, trial mode and locks clear it. Board riders charge and release an ollie to clear the raised deck. Default placements stay off the route centre and check room around walls, crates, checkpoints, enemies and individual rail segments. Narrow bridges can use a farther side pad. If a forward return point is over a gap, the supported approach point is retained for return.

The generated model is in `public/props/bonus-platform/question-masonry.glb`, with Meshy task/source hashes in `question-provenance.json`. The reference and exact imagegen prompt are in `art/bonus-platform/question-masonry.png` and `question-masonry-prompt.txt`. One Meshy T2 Smart Topology generation used 15 credits (366 → 351). The web model retains 3,695 triangles and original UVs, with one 1024px base-colour texture in a 500,144-byte GLB. Runtime bounds and shared resource ownership match the previous platform; only artwork and the floating label change. Trial mode hides both art and all platform collision; locked completed platforms remain physical but do not accept entry. Suspended parent levels retain the shared artwork correctly.

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

A completed bonus also acts as a checkpoint crate: the supported return point becomes the respawn point, and the parent crate, outline, switch, partial multi-hit and deployed-bridge states are banked together with its box count, masks and score. Banking adds no extra physical crate or box to the level's total. Later deaths restore this snapshot and retain the completed bonus tally and locked entrance. A failed bonus preserves the previous checkpoint; a fresh run clears the bonus checkpoint and reopens the entrance. Reward inventory continues through the existing campaign autosave preference.

Discarded boards survive a successful bonus detour, but a bonus death clears the suspended parent's pile on return, matching normal death/respawn cleanup.

Masks and remaining third-mask invincibility carry into the bonus and back out at their current values, on both completion and failure. Bonus damage can therefore consume a carried mask, and bonus pickups can add protection. Loading fades do not consume invincibility time. Restarting or abandoning the entire parent run still follows the ordinary fresh-run rules.

A successful exit keeps the bonus room in view. BONUS clears, the character settles into the exit light and rises, then a display-only 2.8-second receipt transfers fruit, boxes and lives from the bottom counters into the parent totals above. Real spinning crate/fruit HUD models and the existing portrait travel between the rows; depleted bottom counters fade. The immutable receipt includes fruit rollover and Modern death reduction, with no gameplay-inventory writes during animation. The existing return action banks the final inventory and checkpoint exactly once under black, before the parent reveal. Failed exits skip the receipt and preserve the original purse.

Bonus entry, bonus return and the level-complete results reveal use asset-ready black fades without a vortex or minimum loading dwell. The destination camera refreshes its floor probe under black, and a fresh bonus begins facing right. Ordinary course loading retains the two-second vortex.

HUD run/reset boundaries clear completed trick copy, preview tracking, cash-in/bail state and pending payouts. Completed cash-in copy also has a bounded expiry. L2 rewards use the actual crystal/clear-gem/green-gem factories in large transparent slots, fitted to their real radial envelope rather than hidden behind CSS symbols.

Validation: all 20 authored source-spawn bonus pilots collect every authored box, collect the standalone gem and reach the actual gate with no deaths. Six shared-module positive runs and six wrong-order trials exercise the real dependencies. `test-themed-bonus-flow.mjs` executes production entry/return/reset functions for all parents and the fallback, including cup event preservation and failed/successful inventory rules. Real-player alcove checks cover all three puzzle courses. Full-render browser reviews cover every theme, with no retired backdrop nodes or texture requests; live cup/temple sessions check entry, completion, failure, return and compact scorecard controls. Existing bonus-polish and lifecycle regressions remain in place.

## Production presentation — 8 October 2026

Reference: [Coco gameplay, 1:47–2:16](https://www.youtube.com/watch?v=kMNgcuR1gzw&t=107). The frame study identified sequential BONUS letter arrivals and the bonus-room receipt before return, rather than a generic word wobble or payout over resumed gameplay.

A valid landing holds for 0.65 seconds before a 0.5-second rise. Cyan light, upward sparks and a short whoosh communicate activation. A distant parent shot eases closer to make the landing readable. The exit uses warm light, clears the title and holds the empty pad behind the receipt. Arrival reveals include a short supported descent and a fading light. All root offsets are restored after drawing; physics, run time, invincibility, the saved return point and movement tuning remain unchanged. Reduced motion keeps the readable beat with static light and no translated character or flying reward icons.

BONUS uses the existing green/blue PNG art at about 8.8% of screen height. Its six-second loop introduces the letters one by one, lets the complete word rest, and turns the letters away before repeating. SVG and native pre-CRT Canvas share the same poses. The smaller counter rows share a baseline on desktop. On touch screens fruit and lives clear the trigger buttons; the crate counter sits down in the middle gap between the lower controls. Its bounded cap/icon sizes also fit `18/18` at 320px and 390px widths. The pickup pulse stays within that gap. Saved open developer panels only block touch while they are actually visible; hiding chrome with M restores the pad, action buttons, look surface and Pause.

The dev-only `bonus-presentation-review.html?playtest&level=crate-primer` page provides actual jump staging, a complete input-only bonus pilot, slow/held travel, step-by-step exit review, and a full-render frame export. Append `lite` or `touch` for those presentation paths. The fixture is excluded from the production HTML entry list.

Validation includes 20 complete production-Player journeys and **165,357** projected actor poses across 16:9, 4:3 and portrait, 90 reward receipts including fruit rollover/Modern rules, actual entry/exit transition and frozen-simulation tests, 30 warp resource lifetimes, SVG/native title parity, supported legacy jumps, all 23 parent/fallback lifecycle cases, checkpoint restoration, touch ownership and HUD composition. Real Chrome verifies complete six- and nine-box journeys, actual gate return, the before-fade receipt, responsive rendering and clean consoles. The required level checks and build run on the isolated release. No full suite.
