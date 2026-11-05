# Illustrated live 3D fruit HUD

The HUD fruit now uses the complete existing Classic fruit geometry with a
private illustration material inspired by the Bone Head life portrait. Its
original idle rotation is retained: **0.6 radians/second**, approximately
**10.47 seconds per turn**. World pickups retain their existing rendering.

The selected finish keeps the skin smooth. Polish adds a soft elongated
shoulder highlight, warm red-brown shadows, reflected light at the green tip,
a defined stem socket, clearer leaf folds and filtered vein/bark detail.
A warm-brown silhouette has a heavier stroke on the body and finer strokes
on the crown. The surface writes depth before the outline, keeping the
outline's interior from showing through during HUD fades.

`src/illustratedFruitHud.ts` creates the surface and outline. `src/ui.ts`
uses them in the existing fruit slot, shared by gameplay, Bonus counters and
reward flights. The shader follows the active cloned material's opacity.
There is no frame atlas, texture download, additional renderer or geometry
replacement. Every source triangle remains in the surface; the outline is
an expanded duplicate used only for its exposed edge.

## Review — 6 November 2026, Pacific/Auckland

- TypeScript and production build pass; final release-size result is recorded
  in `validation.json`. No level data or movement settings changed.
- Existing HUD visibility, modern life portrait and Bonus transfer checks pass.
  The Bonus test covers 90 receipt cases, count conservation, rollover,
  portrait changes and shared fruit/crate slots. Its Vite test server logs a
  sandbox WebSocket permission warning; the assertions finish successfully.
- Browser comparison inspected at 30, 150 and 285 degrees, large and 88 px
  presentation, against dark and light backgrounds. Original 3D, the previous
  PNG sequence and Bone Head remain available for comparison.
- Real `?lite` game at 1280 × 720: inventory reveal and ordinary-input pickup
  verified (fruit counter 0 → 1 in Haunted Hassle), with no console warnings
  or errors.
- Full renderer at 1920 × 1080, MAX/native resolution and CRT enabled:
  Treehouse Trail HUD, inventory hide/reveal and portrait reviewed; no console
  warnings or errors. See `full-native-crt.jpg` and `comparison.jpg`.
- Final production preview at 1280 × 720 also passes with a clean console;
  build stamp is `Codex/sol fork · build 11-05 11:30 UTC`. See `production-720.jpg`.

The 24 individually authored PNG frames and the initial material draft remain
in the local authoring archive, `art/fruit-hud-painted/`. They are not used by
the game or included in this release. Its `compare.html` uses the same slow
turn rate as the live HUD and includes an initial-draft toggle. The standalone
PNG preview retains the old 20 fps timing for reference.
