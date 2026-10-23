# Mall reference art

Static Mall geometry and texture images originate from the 1999 PlayStation game by Neversoft. They were recovered from [letmynutzgo's public THPS Mall conversion](https://thpsx.com/creation-details/?obj=958), released 18 July 2018. Its readme credits PS1 extraction and nodes to letmynutzgo and conversion scripting to TylerLasagna.

These third-party game assets retain their original rights and are not covered by this repository's Apache source-code license. They are kept here for the user's local level-recreation experiment.

Archive: `THPS1Mallv2.0.zip` (6,390,584 bytes). SHA-256: `ecee7495cfa3978b939d713d676c2312ae6e220d852380c8a630c1ee74e69153`.

`tools/mall-reference-art.py` independently reads the bounded SCN/TEX records and decodes the original DXT textures to PNG. It executes no game scripts. The [THPS Blender importer](https://github.com/denetii/io_thps_scene) documents the formats. Per-image and source-member hashes are recorded in `src/levels/mall-art.json`.

The converted static scenery is included. The conversion's altered cereal boxes and gameplay helper sectors are excluded. This converted source has not been compared byte-for-byte with a retail PS1 disc. No audio or executable game code is included.

The playable rails now use the original-format Mall records retained in a THPS2 retail data pack, registered against this scenery. `docs/mall/retail-rails.json` contains measured nodes and normal-start activation chains; `docs/mall/retail-reference.json` records the file hashes, bounded archive ranges and provenance. The retail binaries remain outside the repository. Their sizes match the published THPS2 PS1 inventory; that is not a byte-for-byte verification of the 1999 THPS1 disc. These reference measurements retain the same third-party asset status described above.

The two `box-*.png` textures and model data in `src/levels/mall-source-props.json` are decoded directly from the retained retail `SKMALL_O.PSX` object bank, with twelve literal placements from `SKMALL_T.TRG`. `tools/mall-source-props.py` reads bounded records and interprets only the supported wooden-box creation layout. It executes no game scripts. The record and texture hashes, variant caveat, source-code references and gameplay validation are recorded in `docs/mall/source-boxes.json`. These assets retain the original game's rights under the same local-experiment scope above.
