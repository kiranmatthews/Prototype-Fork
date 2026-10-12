# Carlisle bonus environment assets

Six player-camera storyboards and four environment assets were generated with the built-in ImageGen tool. The exact prompts are retained here and in `docs/carlisle-bonus/prompts.json`. `references/` contains every original environment PNG; `pack.mjs` only encodes WebP and retains alpha. No image content is painted or replaced during packing.

Runtime assets live in `public/carlisle-bonus/`. The generated sky is a 2:1 panorama, with separate transparent distant canyon and ruined quay layers and a hanging moss cutout. Original Carlisle rock and ruin GLBs supply the real foreground geometry and texture atlases; their existing provenance and license notices remain authoritative. The follow-up switch bridge uses one explicitly authorized Meshy job (15 credits); no credits were purchased.

`node tools/bake-carlisle-contacts.mjs` derives the ten normalized LOD0 collision templates from those accepted GLBs. It keeps their real topology, including arch openings. The contact manifest records source hashes. Runtime contacts share immutable geometry/BVHs; they do not depend on visible LODs or cutaway state.

`gallery.mjs` builds the six-section public comparison from the source, storyboard and final production gameplay captures. It creates reduced WebP previews; full-resolution PNGs remain in `docs/carlisle-bonus/`.

The switch bridge keeps its ImageGen reference and prompt in `references/revealed-bridge.png` and `bridge-reference-prompt.txt`. `meshy-tasks.json` records the completed task and exact generation parameters. Never resubmit that task. `meshy_jobs.py` uses the official Meshy CLI; set `MESHY_NODE` and `MESHY_CLI` for another machine. `prepare-bridge.py` repairs and normalizes the actual source mesh, retains its UVs, creates the distant LOD and measures the top. `pack-bridge.py` packages 2K albedo / 1K normals. The accepted GLB has 7,417 / 1,508 triangles and transfers 2.26 MiB. Runtime reveal/reset owns its resource lifetime; collision and puzzle timing remain source-owned.
