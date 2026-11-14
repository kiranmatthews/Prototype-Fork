# Tribal Run and The Resonance Vault

Eighth campaign course, reviewed against the crate bible on 14 November 2026. Layout authoring took about six minutes; complete validation and packaging took 22.1 minutes, exceeding the requested 15-minute main plus five-minute bonus budget.

| Measure | Before | After |
|---|---:|---:|
| Main counted cargo | 45 | 100 |
| Main collectible clusters | 44 | 30 |
| Main mean cluster size | 1.02 | 3.33 |
| Main single crates | 43 | 0 |
| Main enemy kinds / placements | 1 / 35 | 1 / 21 |
| Bonus counted crates | 20 | 52 |
| Bonus mean cluster size | 1.18 | 3.06 |

Each of the ten checkpoint sections now carries a 3 + 3 + 4 harvest on fixed ground. Columns preserve small footholds on the rolling route. Eight masks face the eight fire-head encounters; dry banks, crossing pauses and restart approaches give the remaining groups distinct jobs. Cargo leaves the mover decks, wet slides and crossing landings clear. Twenty-one retained guardians keep their positions, kind, patrol range and speed; fourteen redundant patrols are removed. There are no new explosives or enemy types.

The Resonance Vault retains its listening steps, drum launch, elevated gallery, switch, three stepping stones and lower return. Small stacks and walls expand its offerings to 52, including nine outlined crates and a jump-reachable life above the final short gap. Three authored outlined platforms previously stayed solid because the platform primitive ignores `outline`. They now use the supported mesh primitive with identical box dimensions, positions and materials, so the gray switch genuinely reveals the route. Skipping it leads to a dead state; retry restores the switch, all outlines and all 53 physical crates. The life is an ordinary jump reward, not a claimed tool gate. The parent total is 161: 100 cargo + nine checkpoints + 52 bonus.

## Verification

[Validation](validation.json), [before audit](audit-before.json), [after audit](audit-after.json), [full main route](native-route.json), [cargo and patrols](native-cargo.json), [bonus positive/negative/reset cases](native-bonus.json), [browser](browser.json), and [geometry comparison](geometry-preservation.json).

The complete native main route finishes with nine checkpoints and the crystal, all 29 mover rides and seven rail catches, 604 slippery frames and zero deaths. Separately, 30 staged input-only harvests collect all 100 cargo boxes without death; 630 enemy patrol samples remain supported. All main crates have ground or stack support. Twelve footprint-corner flags remain on rolling terrain, down from 23 before this edit.

Both continuous native and normal-loop lite-browser bonus previews collect all 52, earn their preview gem and finish without death. Actual bonus play banks its count toward the parent. Main lite-browser checks cover a continuous three-box opening harvest, natural checkpoint activation, one kill-plane fall and recovery, and a separately staged finish. All six full-render 1280×720 views and both lite finish images were inspected, with clean consoles. No continuous main all-box run is claimed.

Geometry comparison proves 2,218 main non-crate/enemy components and 249 bonus components unchanged; the only support change is activating the three already-authored outline boxes. Movement, animation, native art, source terrain, hazards and the published editor pack are preserved. Required level checks, production build, release-size check (952,662,913 / 1,000,000,000 bytes), and diff checks pass. Publishing is authorized and awaits GitHub authentication.
