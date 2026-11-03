# Tribal Run guardian — generation pending

The imagegen reference in `references/guardian.png` is the prepared production
input for the requested Meshy character. Its prompt is saved alongside it.
It uses the current Bone Man's proportions and an explicit Crash 4 aesthetic
pass: an adult Pacific island guardian with woven clothing, large readable
hands and feet, an unobstructed face and separated limbs for rigging.

No Meshy task has been submitted. On 4 November 2026 the authenticated API
profile had one credit; generation needs fifteen and humanoid rigging five.
The web workspace was signed out. The user has been asked to sign in so web
plan credits can be used. Do not silently replace this request with Tripo,
pretend the current decorated crab is the new character, or submit duplicates.

Use Smart Topology at 15,000 triangles, textured GLB and humanoid rigging with
the included walk. Inspect the budget before submission and count the actual
exported triangles before integration. The absolute model limit is 30,000.
Keep the complete final mesh at every viewing distance. No high-poly source,
decimation stand-in or distance LOD is required.

`meshy_assets.py` reuses the project's official CLI submission journal. Set
`ENEMY_MESHY_CLI` to the installed official CLI entry point, then run:

```sh
python3 tools/tribal-guardian/meshy_assets.py create guardian --image tools/tribal-guardian/references/guardian.png --triangles 15000 --dry-run
```

After account access is available, use either that CLI workflow or the signed-in
web UI. Download and preserve the source mesh, humanoid skeleton and walk
provenance. Inspect the new skeleton's actual names before mapping semantic
joints; the existing Meshy goblin mapping is a reference, not proof of a match.

Integration must select the new GLB for `appearance: 'tribal'`, fit the measured
body and collision box, and remove crab costume/carcass behavior for this
appearance only. Preserve other grunt enemies. Reuse shared per-segment
elasticity and foot-contact correction; never animate whole-skeleton scale.
Review complete walk/turn/defeat cycles at front, 40° and 90°, and test both
spin and stomp interactions in Tribal Run before publication.
