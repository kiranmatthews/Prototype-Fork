# Coastal modular seaside kit

Sixteen separate textured models were generated with the official Meshy CLI
from original built-in Imagegen component references. No complete shop,
café, villa or town was submitted to Meshy. The stores are assembled from
editable level components; there are no store signs, plaques or logos.

The Meshy pieces are the tiled roof, shuttered window, arched door, striped
awning, balcony, corner quoins, display window, palm trunk, palm crown,
flower pot, window box, climbing flowers, lantern post, railing post,
lighthouse lantern room and sandstone formation. The 16 completed jobs
consumed **240 existing credits**; no credit purchase was made.

`stucco-body.glb` and `stucco-trim.glb` are simple code-authored structural
primitives with Imagegen plaster. They share the same instancing and editor
path as the generated pieces. Plain surfboards, festival pennants and the
public clock use ordinary authored meshes. These are not Meshy outputs.

Each GLB has one atlas material and near/far geometry. The Meshy meshes and
UVs are retained; a reduced far mesh, 512/1024 px web atlas, full UASTC mip
chain and portable JPEG fallback keep the kit suitable for the browser.
Architectural instances can fit their authored bay dimensions. Individual
manifests record actual dimensions, triangle counts, final hashes and bytes.

The generated sky, two transparent scenery mattes and three surface albedos
are shared by Coastal and Rooftop Deliveries. Exact prompts, original
component PNGs, task IDs and the reproducible preparation scripts live in
`tools/coastal-town-assets/`. The 17-section comparison gallery is in
`docs/coastal-storyboard/index.html`.

## Attribution

Model created with [Meshy](https://www.meshy.ai/) —
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
This follows the repository's conservative asset publication convention;
the task ledger does not record the account tier. See the
[Meshy ownership terms](https://help.meshy.ai/en/articles/10137554-what-is-the-ownership-of-the-generated-models).
The two structural primitive meshes and their source code use the
repository's Apache-2.0 licence. Raster art was produced with built-in
Imagegen from the project's own views and the recorded style briefs.
