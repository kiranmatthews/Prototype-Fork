# Active Roo reference-fidelity work

The user rejected the published v1 mesh/PNG treatment as **not nearly good enough**. The active goal is **1:1 fidelity to the supplied HUD reference**, using Roo. Live output must be actual 3D meshes; baked output must run each letter through an image model. Do not mark this goal complete from the current samples or from technical tests alone.

This goal turn is **progress**, not blocked: it creates image-model glyph passes, a reference-preserving color/detail bake, measured per-glyph title layout, and a direct authoring comparison. None of these candidates is visually approved or published as a replacement yet.

## Current route and evidence

- Work uses the built-in `image_gen` tool, as required by the imagegen skill. Prompts are individual `.txt` files here. Every raw output is copied unchanged into `candidates/`. `review.json` records the candidates and reference crops; `worklist.json` records all 51 nonempty glyphs in the existing font. Space is an advance only.
- The first image-model B and 0 were overinflated/too glossy. Requests for RGBA produced opaque RGB checkerboards. Later calls deliberately request flat magenta RGB color layers. Original Roo glyph meshes supply the actual alpha in a subsequent font bake. This is explicitly documented; do not call the model outputs transparent.
- Strict reference-background edits retain the material more faithfully than asking the model to create a new bevel from a blank silhouette. The model still changes subtle lighting and can retain an unwanted black surround. Registration should use the **colored core**, not that black surround.
- `tools/roo-type/color-projection.ts` is an authoring renderer. It maps a model RGB layer onto the original Roo mesh, pads invalid color at the texture edge, and renders with supersampled alpha. Optional reference input preserves the screenshot's light/color while adding only the model's detail above the source pixel scale. It also derives a connected reference foreground mask to exclude scenery while retaining real white glints. This is a **baked** route, not a claim of completed live relighting.
- `tools/roo-type/reference-review.html` / `.ts` compare original, rejected v1, model-only, and reference-lighting/model-detail rows. Dev URL: `http://127.0.0.1:5178/tools/roo-type/reference-review.html`. The Vite server on 5178 was confirmed live (PID 90080 at the earlier check). Recheck before assuming it still runs.
- Browser review script: `/private/tmp/roo-type-review/reference.mjs`. It uses bundled Playwright, captures `/private/tmp/roo-type-review/reference-native.png` and `reference-large.png`, and exports glyph projections to `projections/`. It waits for `window.rooReferenceReview`. The latest completed browser run, including the connected reference mask, was error-free. Screenshots/projections are current for the BONUS word and B/0 individual comparisons. A/C/D/E/F/G/H/I still need to be added to the rendered comparison.
- Native interior color comparison in `analysis/native-color-review.json`: model-only RGB RMSE roughly 9–15; reference-preserving RMSE roughly 2.3–3.6; median absolute channel error 0–1. **This excludes a 3-pixel edge band. It proves neither bevel/edge fidelity nor full-font completion.**

## Size/layout findings

The original screenshot is 1672×941. BONUS's colored word is about 626×162 px. Measured individual colored boxes are in `review.json.measuredTitleGlyphs`:

| Letter | x | y | Width | Height |
|---|---:|---:|---:|---:|
| B | 546 | 60 | 128 | 161 |
| O | 688 | 66 | 119 | 151 |
| N | 817 | 71 | 119 | 149 |
| U | 952 | 71 | 117 | 147 |
| S | 1077 | 75 | 95 | 147 |

Matching total width alone hid incorrect glyph widths/gaps, particularly U. The current word comparison uses these individual boxes. The original Roo font-wide cap band is -76..806 = 882 font units, em 1000. Its raw silhouette remains the source; optical scaling is explicit. Alphabet reference crops/colored boxes for all A–Z are in `analysis/alphabet-references.json`.

The actual game typography still needs a final reference-size audit. V1's CSS cap sizing at 720p made some digits visibly smaller than the reference-scaled target, and crate total is a smaller suffix. Do not blindly reuse those sizes/tracking and claim fidelity. Reconcile numeric cap height, `/total` sizing, and spacing against the latest user reference while preserving unrelated HUD/game behavior.

## Model output state

Currently registered unique glyphs: A, B, C, D, E, F, G, H, I, N, O, U, S, and digit 0 (14 of 51). The preferred title candidates are B-bonus-04, O/N/U/S-bonus-02 (strict background edits). Warm 0-counter-03 is the strict background edit. A/C/D/E-bonus-01 are generated but retained black surrounds; they still need projection and visual QA.

The F/G/H/I batch in exec cell **102** completed. All four outputs were copied unchanged and registered with `tools/roo-type/register-model-output.py` as F/G/H/I-bonus-01. All image-generation cells (63, 65, 68, 72, 77, 82, 88, 92, 99, 102) completed; no image generation is currently pending. The newest candidates still need projection and visual QA.

The remaining 37 unique glyph model passes are J/K/L/M/P/Q/R/T/V/W/X/Y/Z, digits 1–9, and the remaining supported punctuation. `worklist.json` is authoritative for the complete list. Existing two palettes (bonus/counter) and every consumer need coverage before final integration. Preserve reference colors where available; for variants/unseen glyphs, validate consistent material behavior, not just file presence.

## Required work before completion

1. Complete every required per-glyph model pass and register provenance/prompt paths. Do not substitute the rejected procedural art for ungenerated glyphs.
2. Validate smaller alphabet glyphs and numeric/punctuation glyphs, including foreground registration, bevel profile, edge highlights, gradients, and clean alpha on dark and light backgrounds. The optional reference-preserving shader is still a candidate pipeline.
3. Finish both required color treatments, atlas packing and metrics. The v1 runtime already has atlas/DOM integration, but **no v2 atlas has been integrated**.
4. Verify real HUD text sizes, spacing and dynamic counts in lite/full rendering, with CRT constraints; check actual reference-size appearance. Preserve unrelated work.
5. Run relevant focused checks and `npm run build` (not `check:all`), append the completed iteration, stage only task-owned changes, publish through origin/main, and verify the deployed result. Do not ship an unapproved fidelity compromise merely because tests pass.

## Environment and tools

- Root: `/Users/kiki/Documents/ChatGPT/Prototype Fork`.
- Original reference: `/Users/kiki/.codex/attachments/3db808d9-57b3-4173-b9be-75f584f03af9/image-1.png`.
- Python: `/Users/kiki/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3`.
- Node: `/Users/kiki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`.
- Playwright: `/Users/kiki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs`.
- Npm CLI available at `/private/tmp/jungle-cup-npm/package/bin/npm-cli.js`; put bundled Node in PATH.
- Default branch main; origin is `kiranmatthews/Prototype-Fork`. Always pass `--repo kiranmatthews/Prototype-Fork` to gh; its inferred default can be the upstream repo.
- Other tasks have uncommitted changes in `.gitignore`, `vite.config.ts`, and character-study/blink files, and have been committing performance work while this goal runs. Recheck git status and stage only Roo task files. No new changes from this goal have been committed/published yet.

## Latest checkpoint

No v2 production files were changed, no unapproved font was published, and the goal remains active. The next concrete step is to extend the comparison/bake to the 14 generated glyphs and continue individual image-model passes for the remaining worklist. The reference-color/detail blend is promising, but a full visual acceptance audit, both final color treatments, complete atlas coverage, actual HUD size/spacing checks and deployment are still outstanding. Do not mark complete or blocked at this checkpoint.

## V2 release checkpoint — supersedes earlier progress counts

All 51 nonempty glyphs now have recorded built-in image_gen passes. Both v2 RGBA atlases, metrics and the ZIP are installed locally. `public/fonts/roo-font-v2-provenance.json` verifies every selected model file against its generator-output hash and includes the exact prompts. `tools/roo-type/install-bake.py` is the reproducible installation step. No image-generation jobs remain pending.

The final bake removes black-matte contamination at the reference edge, pads genuine foreground colors, and restricts model fine detail to the raised face so it cannot introduce stripes across the reference bevel. Final enlarged and dark/light visual checks completed. Browser tests pass for all glyph masks (worst native-raster overlap 97.29%, slash), matching alpha across both palettes, 67,031 partial-alpha pixels per palette, no magenta contamination, PNG/ZIP exports, changing number counts, common numerator/denominator size, exact 107/165 px bands at the 1672×941 reference viewport, and bounded portrait bonus rows. Lite/full browser runs had no errors. Focused HUD/visibility/combo checks and production build pass; no full suite was run.

The runtime uses v2 through the existing pre-CRT surface and the matching DOM/lite path. The public lab now demonstrates the baked font rather than the rejected live material. Remaining release work at this checkpoint: commit only task-owned files, clean-checkout build, origin/main push and public deployment verification.

## V3 follow-up release checkpoint

Reviewed all 51 nonempty glyphs in both palettes at native and enlarged sizes. Added 21 individual built-in image-model cleanup passes for the small-reference alphabet, repaired the numeric/punctuation gradient normalization, rejected model matte colors, corrected P crop registration, and separated final analytic Roo curve alpha from mesh coverage. Three aligned bevel-light frames now crossfade in HUD and menus. Default tracking is −0.065 cap units, with saved cross-tab controls in Font Studio. The built-in tool did not expose or report a selected model/quality tier; no GPT Image 2.5/max claim is made. Final mask overlap is at least 98.8%, all frame/palette alpha matches exactly, no pink/gray/neutral matte remains, and Canvas/browser crossfades vary alpha by at most one 8-bit step. Menu layouts, spacing persistence, reduced motion, PNG/ZIP exports, lite/full HUD, world-map and Jungle Cup screens were checked. Focused checks and build pass; the full suite was not run. See REVIEW_V3.md for the review record.
