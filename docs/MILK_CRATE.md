# Five-bounce milk crate

The existing `multihit` crate now uses the supplied blue storage crate and red-capped milk bottle models. Its full assembly and collider are both 0.96 × 0.96 × 0.96 metres. The blue rack is 82% of that height; upright bottles fill the remaining height in a 3×3 grid. Bottles occupy 27% of the cube width on 28.2% centres, leaving small gaps. Bottle width and height are fitted independently so nine bottles fit without growing the gameplay cube.

The visible sequence is **9 → 7 → 5 → 3 → 1 → smashed**. Each surviving stomp/head-bump removes an opposite pair; the centre bottle remains until the final hit. The existing squash, bounce, final crate pop/dust, audio, two-milk-per-hit reward and one-crate tally remain authoritative. Spin/slam/skate/blast force-smashes retain their existing behaviour.

Checkpoint death restores the saved hit/bottle count; a restart restores all nine. Outline crates hide the imported model until materialized. Time-trial and combo modes hide it while the original cube presents that mode's number/boost printing. Saved level data still uses `kind: "multihit"`; no migration is needed.

The runtime uses two draws per full crate: one 2,238-triangle rack and one instanced draw containing nine 326-triangle bottles (5,172 triangles total). Geometry, PBR textures and materials are shared across crates and levels. Disposal retires instance buffers and prevents late loads attaching to old levels, while shared assets survive level changes. The existing loading barrier waits for these props before revealing a destination. A small procedural rack/bottle fallback preserves readable, playable crates if asset loading fails.

Source assets supplied by the project owner:

- `Meshy_AI_Blue_Storage_Crate_0910095024_texture.glb`
- `Meshy_AI_Red_Capped_Milk_Bottl_0910105954_texture.glb`

`tools/milk-crate/prepare_assets.py` preserves the supplied mesh/UV data, reduces embedded JPEG textures, and sets dielectric materials. Outputs in `public/props/milk-crate` total 435,892 bytes, down from 8,277,232. Original filenames and SHA-256 hashes are embedded in each output's asset metadata. Run the script with a Pillow-enabled Python and the two original file paths to reproduce them.

`milk-crate-review.html?playtest&level=jungle` is a local-only review page with one temporary crate, contact/bounce controls, geometry measurements, run-mode controls and normal gameplay rendering. It does not save a level or campaign slot. The focused `tools/test-life-multihit-crates.mjs` checks the real five-hit player collision sequence, awards, collider stability, checkpoint/reset and run-mode visibility. Full-suite execution remains opt-in.
