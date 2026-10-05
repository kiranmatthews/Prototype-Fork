# Carlisle Coast higher-fidelity sculpture kit

Two original isolated concepts provide coherent massive sandstone geometry,
informed by the broad form and palette of the supplied Tiki Pits reference.
No video model geometry or texture was extracted. Built-in imagegen generated
the original references in `references/`; exact prompts remain in `prompts.json`.

`ledge-root` has a broad irregular olive-grass landing, exposed tan cap rim,
three thick rock courses and a deep tapered root. `canyon-buttress` has three
huge rounded courses, fractured corners and dark recessed intersections. Sparse
muted olive moss occupies sheltered crevices; the painted stone stays quiet.

These are geometry replacements for the first iteration's thin shelves and
many-tiered repeating cliff bays. The ledge model supplies a genuinely deep
tapered rock finger with rounded fractured corners; the buttress supplies three
large connected masses with a recessed waist. They are not new surface maps
applied to the previous shapes. Level authoring uses them with separate actual
sculpted collision terrain; this asset pipeline owns the generated references,
source preparation, atlas packing, contact measurements and provider evidence.

| Alias | Published model | Measured natural dimensions (m) | Near / far triangles |
| --- | --- | --- | --- |
| `coastv2ledge` | `public/carlisle-coast-fidelity/ledge-root.glb` | 10 × 10.115 × 8.597 | 8,717 / 1,800 |
| `coastv2buttress` | `public/carlisle-coast-fidelity/canyon-buttress.glb` | 14 × 12.975 × 14 | 10,720 / 2,200 |

Each source was reviewed from three angles at the measured natural proportions,
not stretched to the initial requested dimensions. The ledge's broad central
cap has normalized median Y 0.98905, minimum 0.98769 and maximum 0.99698; the
41 × 41 contact grid records the actual irregular surface.

Official task evidence and the final balance audit prove **30 credits consumed,
396 → 366 remaining**. Each model retains one matte atlas material, a finite
unit-length `NORMAL` attribute, original UVs, `_JUNGLE_AO` indirect-only scalar
and `_WIND_FLEX` zero scalar. Both 2K/1K atlases use full mip chains and retain
JPEG fallbacks. Final transfer is 8.15 / 8.05 MiB and combined estimated ASTC
texture memory is 13.33 MiB. The two reused model families share templates and
textures across their placements; no textures are generated per streaming cell.

The public directory also contains independently code-authored `grass-tuft-a/b`
models. `make-grass.mjs` owns their editable blade geometry and their manifests
record **Apache-2.0**, zero provider credits and zero texture bytes. The Meshy
attribution notice and 30-credit provider provenance apply to the two sandstone
models only.

The terrain's two quiet 1024 px surface albedos come from built-in ImageGen.
Their retained prompts and processing are in `surface-prompts.json`. These
are complementary material detail on real solid geometry. The late timber
crossings reuse the existing rustic boardwalk atlas and authored mesh kit;
they consume no additional provider credits.

The official Meshy CLI uses the existing local account. `tasks.json` records
each reservation and stable operation ID before the billable submission; raw
responses and signed URLs remain ignored. Never resubmit an unknown outcome.
Use only existing authorized credits; never purchase credits or publish keys.

## Rebuild

1. `python3 tools/carlisle-coast-fidelity-assets/meshy_jobs.py download NAME`
   retrieves the existing recorded task; it does not submit another job.
2. `/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python tools/carlisle-coast-fidelity-assets/prepare.py -- NAME`
   retains generated geometry and UVs, measures natural proportions and contact
   surfaces, samples indirect AO, creates a far mesh and renders front/rear/side.
   Review renders use the measured source aspect ratio at the authored width.
3. Run `pack.py NAME` with Python/Pillow. Both models retain 2048px albedo and
   1024px normals, one matte atlas material and the original source UV mapping.
4. Set `CARLISLE_TOKTX` to Khronos toktx 4.4.2 and run `compress_gpu.py` to add
   UASTC quality2 textures with complete mip chains and JPEG fallbacks.
5. Refresh `meshy_jobs.py balance`, run `provenance.py`, then `validate.py`.

Models are physically normalized to X/Z [-0.5,+0.5] and Y [0,1], bottom anchored,
front +Z at LOD0. The collapse far meshes retain the same anchor and may deviate
at their outermost vertices by at most 2% of the source span. Registry authoring
dimensions should use the measured
`uniformScaleSizeAtDefaultWidth` in each manifest to preserve source proportions.
Measured top contact grids are evidence for gameplay authoring, not a claim that
the entire irregular cap is a flat collision plane. Runtime placement and
collision remain level-owned.
