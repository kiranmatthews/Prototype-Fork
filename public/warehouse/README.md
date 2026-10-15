# Warehouse asset attribution

Original warehouse models were generated for this project using
[Meshy](https://www.meshy.ai/). Their task IDs, source/output hashes, measured
bounds, triangle counts and texture encoding are recorded in the adjacent
`.provenance.json` files. The ImageGen references and final prompts are retained
under `tools/warehouse-assets/` in the source repository. No API credentials or
temporary signed provider URLs are included in the game.

The generated kit follows the existing project's conservative Meshy attribution
practice under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
Original graffiti artwork was generated with the built-in ImageGen tool.

Large surface maps are [Poly Haven CC0](https://polyhaven.com/license) materials:
Concrete Floor Worn 001, Red Brick 03, Rusty Metal 04, Blue Metal Plate, Plywood,
and Concrete Floor 02. Exact source links and processing hashes are listed in
`materials/provenance.json`. Processing is limited to resizing, encoding and
GPU mip generation; no new large-surface texture tiles were painted.

Existing Meshy assets are referenced in place from `ghost-train/`,
`props/wood-crate/`, and `blockworks-art/`; their original attribution and
provenance remain with those asset families.
