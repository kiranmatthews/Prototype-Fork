# Treehouse Trials dense bush enclosure kit

This pass fills the previously exposed distance between the nine scene beats.
The two Meshy jobs use 30 existing credits (351 → 321); no credits were bought.
`tasks.json` holds stable task/operation IDs. Raw service responses and source
GLBs stay in the ignored `.img2threejs/treehouse-trials-v3/` authoring directory.
Runtime source hashes, topology, texture budgets and billing are in
`public/treehouse-trials-v3/provenance.json`.

The thicket and bough references, plus the dense transparent understory matte,
were generated with built-in ImageGen from the supplied jungle references.
Original reference PNGs and exact prompts are retained in `references/` and
`prompts.json`. The matte preserves the generated alpha and 2172×724 pixels;
KTX2 includes full mipmaps and an original-alpha WebP fallback.

## Production

Reuse the V2 pipeline with `TREEHOUSE_ASSET_KIT=treehouse-trials-v3`. The default
remains V2. Use `meshy_jobs.py` for submission/status/download, then Blender
`prepare.py` for measured bounds, two LODs and indirect AO, and `pack.py` for
one shared atlas with rooted wind. For the bough run `connect_bough_vines.py`
after packing, then run `compress_gpu.py` with `TREEHOUSE_TOKTX` set.

The bough's Meshy leaves were disconnected along four thin tendrils. Measured
native-space stems now connect those leaves to the bough, adding 384 near / 192
far triangles without another material or draw call. The stem and tendril
weights ramp from the attachment to the tip; the attachment stub stays fixed and
the crown uses restrained wind. The thicket remains rooted at its base.

Level placements, continuously rising forest floors, porch openings, shoreline
exclusions and camera clearance live in `src/levels/treehouse-enclosure.ts`.
World-metre sampling keeps vegetation equally dense inside stretched joins.
Additional background thickets/trees receive shadows but do not add redundant
shadow passes; the nearer canopy and existing foreground continue casting.
