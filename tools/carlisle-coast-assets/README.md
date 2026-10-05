# Carlisle Coast original temple-ravine kit

Six original built-in imagegen references and Meshy T2 smart-topology models
provide a cohesive warm sandstone, deep seam, emerald moss and coral foliage
kit for Carlisle Coast. The supplied Tiki Pits video guides the broad forms;
no video geometry or textures are copied. All references remain in `references`.
Role/prompt summaries and target dimensions are in `prompts.json` and
`specs.json`; task payloads and provider handles are in `tasks.json`.

The six billable tasks use exactly 90 existing credits (486 to 396); no credits
were purchased. Each reservation and stable operation ID preceded submission.
Official Meshy CLI commands use existing local OAuth. Network access may need
the approved execution context; a sandbox-only refresh failure does not imply
that reauthentication is necessary. Never pass keys in shell arguments or
publish credentials, signed provider URLs or raw responses.

Each GLB contains one merged LOD0, one independently decimated LOD1, and one
shared atlas material. 1024px albedo and 512px normals retain source UVs and
large painted regions. UASTC quality2 with complete mips and lossless Zstd18
retains JPEG fallbacks for ordinary GLTFLoader. `_JUNGLE_AO` is five-ray measured
indirect-only occlusion (0.8–1.0); `_WIND_FLEX` masks rooted green/red foliage.

Packed geometry is physically normalized to X/Z [-0.5,+0.5], Y [0,1], bottom
anchored and front-facing +Z. `size` records intended authoring dimensions;
`uniformScaleSizeAtDefaultWidth` records the source proportions. The moss shelf
is intended for side skirts below collision tops, not a new walking collider.
All six models are scenery only. The temple arch requires route clearance;
verify the actual opening in the composed browser level.

## Rebuild

1. `python3 tools/carlisle-coast-assets/meshy_jobs.py download NAME` retrieves an
   already-recorded task. Do not resubmit a task with an unknown outcome.
2. `/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python tools/carlisle-coast-assets/prepare.py -- NAME`
   retains actual source forms/normals, measures AO, creates far geometry,
   normalizes the exported models and renders two review angles.
3. Run `pack.py NAME` with Pillow available, then `compress_gpu.py` with
   `CARLISLE_TOKTX` set to Khronos toktx 4.4.2.
4. Refresh `meshy_jobs.py balance`, then `provenance.py` and `validate.py`.

Source GLBs, raw responses, provider billing evidence and two-angle reviews
remain in ignored `.img2threejs/carlisle-coast/`. Committed provenance contains
only stable task handles, hashes and budgets. `public/carlisle-coast/LICENSE.txt`
retains conservative Meshy CC BY4 attribution while the account plan tier is
not captured by task outputs.
