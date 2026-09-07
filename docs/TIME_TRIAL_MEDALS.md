# Time-trial medals

Time-trial rewards are bronze, silver and gold medals. One shared evaluator
awards the highest tier whose target the completed time meets, inclusively.
Invalid/non-positive times award nothing; times slower than bronze award none.

The old relic benchmark is the **gold** target. Silver defaults to **115%** and
bronze to **130%**, rounded to hundredths of a second. Thus the default 60-second
course uses gold 60, silver 69 and bronze 78. Existing authored `relicTime`
values remain valid and seed the same ratios; no level pack rewrite is needed.

## Authoring

Editor **PROJECT → LEVEL** exposes three medal-time fields in seconds. First
opening the editor does not materialize defaults. Editing stores an independent
triple, with the invariant `0.01 <= gold <= silver <= bronze <= 86400`.
Neighbouring targets move only if necessary to preserve that order. Undo, redo,
reset, JSON import/export, level copies and reload preserve the values.

```json
"medalTimes": { "gold": 50, "silver": 65, "bronze": 80 }
```

An authored triple takes precedence over legacy `relicTime`. “Use default medal
times” removes both overrides and restores the campaign/default benchmark and
ratios. The runtime `relicTime` name remains a gold-target compatibility alias.

## Awards and saved progress

`CampaignLevelProgress.timeMedal` stores the highest earned tier. A slower
attempt never downgrades it, even if it does not place in the three best times.
Each level still has one time-trial collectible milestone: tier upgrades do not
inflate completion percentages or count as three separate collectibles.

Existing V1 saves with `timeRelic: true` migrate to gold. The old boolean remains
as a compatibility “has a medal” flag, but a saved bronze/silver `timeMedal`
takes precedence over it on reload. Saved awards are not recalculated or removed
when an editor target changes. Old best times alone do not invent an award.

The map's fourth socket shows the best earned medal as a rotating embossed round coin
without a ribbon or loop; missing awards use a dark filled circle. A tier change
recolours the existing model without rebuilding it or restarting the deck flip.
The race card has just three gold/silver/bronze rows, replacing personal-best rankings
and the duplicate target list. Earned tiers show EARNED instead of their target time.
Progress shows all three benchmarks. Results show the medal
earned by that attempt (not necessarily the player's saved best), with the same
3D model and all targets. No additional popup or full-screen sequence is added.

The models use one owned mesh/material each and no new texture assets. They
follow existing shared-renderer/pre-CRT routing and disposal. The time-trial
results grid is compacted so the new target rows fit short landscape screens.
Gameplay touch controls are hidden during results, including their CRT mirror,
and return when gameplay resumes so they cannot cover targets or menu buttons.
Bonus restrictions, crystal/gem inventory, trial clocks and input bindings are
unchanged.

Validation covers inclusive tier boundaries, upgrades/no downgrade, all-tier
save/reload, legacy gold migration, invalid targets, normalization/copy isolation,
editor undo/reset/reload, model colours/disposal, results/map/progress consistency,
touch/CRT layouts and the full production build.
