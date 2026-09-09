# Milk bottle HUD

The user-supplied `BONEMAN_milk_complete/frames_256` set is copied unchanged into `public/hud/milk-bottle/`: 101 transparent 256×256 PNGs, named `milk_000.png` through `milk_100.png`. The fixed bottle replaces the rotating fruit in the existing icon slot. Its supplied angle and colours are retained; the icon uses the same fades, layout, droplet target and pre-CRT render pass as before.

`src/milkBottleHud.ts` shares decoded frames across HUD instances, limits loading to eight requests, and participates in the presentation readiness gate. Each HUD owns one reusable GPU texture. Changing fill updates that texture; reveal-material clones and another player's bottle remain independent.

Ordinary counts select their matching frame. At a 100-milk rollover, the bottle holds full for 0.12 seconds, drains through the provided frames for 0.72 seconds, and briefly reaches empty. Milk earned during the drink is then shown with a short refill. Only the image animates downward: the numeric counter continues to report the actual count. Inventory, life awards and scoring remain gameplay-owned. Bonus payout uses its already-existing display progression, and reset clears any pending drink animation.

Focused validation: `npm run check:milk-bottle` and `node tools/test-game-hud-pipeline.mjs`. The local `milk-bottle-review.html?playtest&level=jungle-cup` fixture provides count selection and rollover controls without saving an event.
