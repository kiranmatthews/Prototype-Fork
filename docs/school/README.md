# School source measurements

`source-geometry.json` is decoded geometry and rail data for the local measured School preview. It is derived from the School files retained in the retail THPS2 PC pack, not newly authored replacement geometry. Original game material remains attributable to its owners. This task keeps delivery local.

The source file names, byte sizes and SHA-256 hashes are embedded in the JSON. Archive provenance and pack offsets are recorded in `../performance/school-miami-retail-reference.json`. The files have not been independently hash-matched to a THPS1 disc. No executable, texture, sprite image, game archive or third-party decoder implementation is included.

Regenerate from local reference files:

```sh
python3 tools/school-source-survey.py --psx /path/to/SKSCHL.PSX \
  --trg /path/to/SKSCHL_T.TRG --out /tmp/school-summary.json \
  --geometry-out docs/school/source-geometry.json
```

Coordinates are `[X, -Y, Z]` in original whole engine units, before the preview's scale and X reflection. Each mesh stores flat vertex coordinates and faces shaped as `[originalFaceIndex, renderFlags, collisionFlags, R, G, B, ...vertexIndices]`. Original polygon boundary order is retained. The export omits 98 sprite faces; collision-only polygons remain. The level factory rejects seven degenerate polygons and builds the remaining 7,593 faces. Rail records preserve original TRG IDs and directed links. `railActivation.paths` supplies the original normal-start chain boundaries, including overlaps.

The format reader is source-owned Python informed by the pinned format reference listed in its header. Re-exporting the same input files produces a byte-identical JSON file. The preview deliberately uses existing procedural materials; exact original art and complete traversal validation remain future work.

The bounded `Re_Start_School` audit (node 393) resolves the original pulse semantics: command points 3, 506, 608 and 879 activate 128 chains, 331 segments and 270 unique edges. Their 61 overlapping segments are intentional source chain overlap. Alternate-mode command point 961 and its edge 189→190 are excluded. The decoder requires the exact unconditional activator layout and restart-only parentage; unknown instructions, indirect activation and cyclic chains fail closed. It does not execute scripts. See `../performance/school-miami-source-activation.json` for decoded commands, source references and provenance. Validate with `python3 tools/test-school-activation.py /path/to/SKSCHL_T.TRG`.
