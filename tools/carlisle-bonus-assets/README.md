# Carlisle bonus environment assets

Six player-camera storyboards and four environment assets were generated with the built-in ImageGen tool. The exact prompts are retained here and in `docs/carlisle-bonus/prompts.json`. `references/` contains every original environment PNG; `pack.mjs` only encodes WebP and retains alpha. No image content is painted or replaced during packing.

Runtime assets live in `public/carlisle-bonus/`. The generated sky is a 2:1 panorama, with separate transparent distant canyon and ruined quay layers and a hanging moss cutout. Original Carlisle rock and ruin GLBs supply the real foreground geometry and texture atlases; their existing provenance and license notices remain authoritative. No new 3D provider job or credit purchase was required.

`node tools/bake-carlisle-contacts.mjs` derives the ten normalized LOD0 collision templates from those accepted GLBs. It keeps their real topology, including arch openings. The contact manifest records source hashes. Runtime contacts share immutable geometry/BVHs; they do not depend on visible LODs or cutaway state.

`gallery.mjs` builds the six-section public comparison from the source, storyboard and final production gameplay captures. It creates reduced WebP previews; full-resolution PNGs remain in `docs/carlisle-bonus/`.
