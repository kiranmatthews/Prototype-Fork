# Default bonus and return flow

Campaign bonus platforms now enter **Bonus: Easy Street**, authored in `src/levels/bonus-easy.ts`. It remains a left-to-right, one-line course with the same parallax backdrop: three broad terraces, two 2 m gaps, 18 crates, 15 loose fruit, one life crate and one mask crate. Every reward has permanent terrain below it. No rail, moving lift, enemy or explosive is mandatory. The original 34-crate Unity bonus remains available as `bonus-level`; the easier standalone editor entry is `bonus-easy`.

Parent all-box totals use the new default's 18 crates. Completing the bonus banks its broken-box count and locks that run's bonus platform. Failing returns the original parent fruit/lives purse and leaves the bonus retryable.

Masks and remaining third-mask invincibility carry into the bonus and back out at their current values, on both completion and failure. Bonus damage can therefore consume a carried mask, and bonus pickups can add protection. Loading fades do not consume invincibility time. Restarting or abandoning the entire parent run still follows the ordinary fresh-run rules.

Fruit and lives are safely merged into Player/campaign inventory before the return reveal. A display-only 2.6-second payout then counts the parent HUD from its previous totals to the banked totals, including a 100-fruit rollover. New gameplay pickups or life losses during the count are not overwritten. In Modern mode the payout briefly shows the inventory totals, then returns to the ordinary death readout without changing endless-lives rules. A reset cancels only the animation, never the already-banked rewards.

Bonus entry, bonus return and the level-complete results reveal use asset-ready black fades without a vortex or minimum loading dwell. The destination camera refreshes its floor probe under black, and a fresh bonus begins facing right. Ordinary course loading retains the two-second vortex.

HUD run/reset boundaries clear completed trick copy, preview tracking, cash-in/bail state and pending payouts. Completed cash-in copy also has a bounded expiry. L2 rewards use the actual crystal/clear-gem/green-gem factories in large transparent slots, fitted to their real radial envelope rather than hidden behind CSS symbols.

Validation: `tools/test-bonus-polish.mjs`, the loading-sequence tests and discarded-board tests; browser coverage includes successful/failed mask carry, Classic/Modern payout, desktop/portrait inventory, real spin inputs and black-only transitions.
