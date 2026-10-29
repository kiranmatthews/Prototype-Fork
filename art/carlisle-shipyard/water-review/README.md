# Carlisle tidal water polish

Local visual increment following `5d1eac85e7a2a90ea8f194d7011c595196e61717`.
The bounce camera exposed a dense repeating diagonal water pattern, and the
old pile foam was solid torus geometry. This pass replaces both within the
Carlisle presentation layer.

The water combines two broad swell directions with four irregular ripple
scales. Analytic noise gradients break up the earlier crosshatch. Pixel-footprint
filtering suppresses subpixel shimmer; no scenery geometry or distance-based
mesh replacement is involved. Dark navy depth colour and a procedural sky
reflection sit beneath view-dependent orange lamp highlights. The water mesh
and its authored descending profile are unchanged.

Broken, translucent wash expands and dissipates around pile feet and moored
hulls. It has no depth write or shadow, so it cannot resemble a solid ring or
cast a rectangular shadow. Main course: 1,388 static patches. Bonus: 54 static
patches and four hull patches parented to the native moving boats. Their local
waterline offset preserves normal render interpolation. The material phase is
stable as the boats move.

All gameplay source, collision, death water, spring values, camera and player
physics are preserved. Eighteen wet slippery surfaces remain wet. Dry timber,
net geometry, cones, rails and all seven airborne cargo encounters are unchanged.
No GLB assets changed and no generation credits were spent.

## Review evidence

`before/` captures the preceding compiled build with the same fixed review
cameras. `after/` contains the final compiled native 1920 × 1080 captures, normal
480p/CRT arrival and the browser report. The review covers arrival, low water,
Surf sockets from above, Storm fingers and the moving-boat bonus. Water and
wash clocks are set to 12 seconds for each comparison capture; native movers
remain live. `validation.json` records exact protected file hashes and completed
checks. This is a visual refinement, not a claim that the entire four-kilometre
course has received a continuous browser clear.

Reproduce through the shared heavy-job lease:

```sh
CARLISLE_BASE=http://127.0.0.1:5484 WATER_OUT=art/carlisle-shipyard/water-review/after node tools/carlisle-water-review.mjs
```

Use `--lite` for the fast shader/load check and `--baseline` to capture the old
build before the hull-wash assertions exist. Use `AIR_CARGO_OUT` with the existing
cargo browser tool to keep a new smoke run separate from the earlier cargo
implementation evidence.

Local publication hold remains in force.

Final checks passed: source/asset preservation, production build, five native
captures, normal 480p/CRT, bonus and main reload, and a real keyboard Storm
crosswind bounce collecting all four crates and reaching the next trampoline
with zero deaths or bails. Browser console errors: zero. The final arrival
sample was 16.7 ms median / 18.2 ms p95 over 119 frames; this short sample is not
a whole-course performance guarantee. Build stamp: `Codex/sol fork · build
10-29 22:12 UTC`; offline version `f3a257aedee344b4349f`.
