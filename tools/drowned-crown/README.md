# Drowned Crown production assets

`sections.json` identifies the 13 player-camera sections. `storyboard-prompts.json`, `replacement-prompts.json`, `surface-prompts.json` and `imagegen-provenance.json` record the built-in imagegen direction and selected outputs. Full image sources stay in `references/` and `docs/drowned-crown/storyboards/`.

The official Meshy CLI owns authentication, submission and status requests. Set `ENEMY_NODE` and `ENEMY_MESHY_CLI` if the local installation differs. `meshy_jobs.py` reuses the repository’s audited adapter and records a named job before any billable request. `tasks.json` includes both accepted models and rejected drafts; it is an audit ledger, not an instruction to regenerate every draft.

Download existing recorded jobs, run Blender in background mode with `prepare_models.py`, then run `pack_models.py` using Python with NumPy and Pillow. `validate_assets.py` checks the shipped result. Runtime assets are in `public/drowned-crown/`; `src/drownedCrownAssets.generated.ts` records measured, uniform default proportions. Actual collision, openings and placement remain editable level data.

For browser checks, set `PLAYWRIGHT_MODULE` to an installed Playwright module and pass the local or deployed URL to the scripts. `capture.mjs --final` records six representative final views; `gallery.py` preserves the source PNGs and publishes compact JPEG proxies with exactly 13 concepts and 19 player captures.
