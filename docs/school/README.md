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

The restart export also retains its raw angles. School's normal restart has yaw 1023. In the pinned original code, `FudgeAngles` adds 2048 and rotates -Z to make `mFront`, but `HandleKick` accelerates along **negative** `mFront`. After the preview's X reflection, actual starting travel is approximately +X, with a 0.084-degree negative-Z offset. The native cardinal zone remains east; the existing canopy heading was correct. Reading only the rotation function would reverse it.

The animated scale audit is in `../performance/school-miami-source-scale-audit.json`. The shared `tools/psx-skater-survey.py` independently checks all 78 HAWK animation byte budgets, stitches and the 4,096-entry rotation table. Relaxed clip 0 measures a median 208.1875 original units from board bottom to head. Visible vertices of the current rider measure 2.90384 m during coasting; lite and full measurements differ by less than 1e-10 m. Hidden helpers are excluded. The pose measurement button is available in the local preview.

Matching that neutral pose at 2.90 m gives 0.0139297508 m per original unit, 2.993% above the provisional preview scale. It also raises the original gym toe to 1.978 m: neither side clears with the current flat ollie, including nine tested release distances spanning the apex. The other fifteen source cases pass at the candidate scale, including the continuous campus route. The validated preview therefore retains 3 / 221.8125 for now, and the user-facing map reconstruction remains 2×. The original coasting pose would measure 2.816 m at the retained preview scale. No character or movement tuning is changed. Differing crouch proportions prevent a single uniform scale from matching every pose; the candidate is evidence for the remaining movement comparison, not a completed 1:1 calibration.

Regenerate the actor evidence from a locally supplied file:

```sh
python3 tools/psx-skater-survey.py /path/to/HAWK.PSX \
  --trig-source /path/to/psyq-data.cpp --out /tmp/school-actor-poses.json
python3 tools/test-psx-skater-survey.py /path/to/HAWK.PSX /path/to/psyq-data.cpp
```

Heading semantics use [the pinned original trigger implementation](https://github.com/LANCommander/TonyWasAProSkater/blob/d9319c8d5b42c431de02bec0f02f0cf955f2fbae/game/src/trig.cpp), [rotation utility](https://github.com/LANCommander/TonyWasAProSkater/blob/d9319c8d5b42c431de02bec0f02f0cf955f2fbae/game/src/utils.cpp), and [kick implementation](https://github.com/LANCommander/TonyWasAProSkater/blob/d9319c8d5b42c431de02bec0f02f0cf955f2fbae/game/src/physics.cpp). The actor file hash and bounded decoder results are recorded with the measurement report; no actor binary is included.

The continuous source route follows 35 waypoints for 950.52 m, starting on the original canopy, rolling down to the upper courtyard, descending the east lane, circling both pools, crossing the lower pipe/ditch area and reaching the Hall Pass approach. It takes 6,094 fixed steps with native steering and braking only. There are no intermediate resets, position writes or velocity changes. It ends below the Hall Pass stairs; it does not claim an uphill stair climb or a closed loop. Isolated bank, pool and grind cases remain separate coverage.
