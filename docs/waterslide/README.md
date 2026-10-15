# The Slipstream waterslide race

The 4.09 km course uses weathered turquoise fiberglass, fitted panel joints and rolled edge bands, an old ticket forecourt, pump equipment, lifeguard towers, discarded flumes and floats, worn pool fencing and overgrown maintenance aprons. The kit has eight original Meshy assets, fitted in metres without replacing their UVs. Actual cost is **120 / 200 Meshy credits**; no jobs remain in flight and no credits were purchased.

The original riding surfaces and restored gaps are retained. Six main catch pools and two longer basins under the loose/moving platforms let a missed jump continue as an ordinary swim and downhill exit. Solid props stand on real surfaces; 82 placements pass 328 foot probes and central racing-corridor clearance. A further 80 ray probes verify trestle-foot contact with the rendered columns or the valley floor. Treated scenery does not alter global movement tuning. Non-playable hillsides use the existing out-of-bounds policy, while ordinary road edges remain grindable. The eight buried pool foundations have a narrowly named edge-policy exception; 3,459 exposed boundaries and 74 real catches pass.

Twelve original transparent item pictures share the existing competition image painter. Water bombs and returning boomerangs join the common item pool; the star and course-following tidal wave are ultra rare. Item warnings and counterplay use the established race effects and normal movement. Leaders have seven common rewards, and the previous two draws cannot repeat. Each race starts from fresh crypto entropy; recordings retain its seed for repeatable playback. Ultra rewards are limited to one per rider per race, and heavy attacks share a cooldown.

All eight riders start on their boards. The existing countdown type is shown over the live skating view, and the held-item picture has the only control hint. The deck aligns with the actual steep road normal while walking, jumping, ledge grabs and swimming remain available.

## Sources and reproduction

- Level dressing: `src/levels/slipstream-waterslide.ts`; original race route and catch pools: `src/levels/slipstream-race.ts`.
- `tools/bake-waterslide-trim.mjs` fits source-owned trim directly to the native floor triangles, omitting every authored gap. Regenerate after changing road geometry, then run `tools/sync-slipstream.mjs` to update the single published entry and legacy-stock signatures.
- Generated artwork prompts and hashes: `tools/waterslide-assets/image-prompts.json`. References: `tools/waterslide-assets/references/`; runtime pictures: `public/race-items/`.
- Meshy requests and actual charges: `tools/waterslide-assets/tasks.json`. Measured bounds and UV-preserving packing: `asset-manifest.json`, `pack_assets.py`, and `register_assets.py` in the same directory. Downloaded full-resolution provider sources remain in the ignored `.img2threejs/waterslide-art/` archive. The CLI wrapper reserves the budget before submission and does not resubmit recorded task names.
- The source fiberglass PNG lives with the references; only its 1024² WebP ships. The eight packed models total 5.84 MiB; 12 inventory pictures total 599 KiB.
- Focused mechanics: `npm run check:race:rules`; placement: `node tools/test-waterslide-placement.mjs`; all six finale entry lines: `node tools/test-skate-race-quality.mjs`.
- Browser: `tools/waterslide-review-browser.mjs <url>` (use `WATERSLIDE_LITE=1` for lite), `tools/skate-race-full-browser.mjs <url>`, `tools/skate-race-pools-browser.mjs <url>`, and `tools/skate-race-ui-browser.mjs <url>`. An external Playwright install is supported by `PLAYWRIGHT_MODULE`.

## Acceptance

`validation.json` and `views/` retain the measured placement, actual gameplay views and full-race results. All eight riders finish the full-render race; the human takes 155.13 seconds without falling. Rivals recover normally from combat falls, all retain four lives, and the console remains clear. All six forward-control entry lines finish the steep finale without a fall. Separate tests cover normal movement, the recorded edge-fall recovery, eight swimming routes, random restarts/replay seeds, the four new items and desktop/touch inventory/warning layouts. The exact level-check script and production build pass; the full suite was not run.

First complete full-render playable was verified 129.65 minutes after the original brief (10:26:35–12:36:14 UTC on 15 October). Subsequent placement polish resumed after direct user confirmation, followed by local integration and publication verification.
