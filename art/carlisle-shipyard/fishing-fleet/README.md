# Carlisle fishing fleet

Local visual increment following `71942e2d03f6dc32936ba67816680f8df8027213`.
The six scenic main-course boats and two scenic bonus boats previously combined
an open skiff with an untextured box cabin, flat orange roof and pole mast.
They now use one complete fishing-vessel model: curved planked hull, framed
wheelhouse, fishing booms, modeled winch/net drum, fenders, ropes and deck cargo.

The replacement retains the existing headings and six of the eight moorings.
The lift and crane yards' extra side sheds overlapped two old boat berths;
those two boats now sit 34m farther outboard, with the crane boat another 28m
west to clear its long quay without leaving level water. A uniform scale
sets the vessel's length to 36m, with a 3.6m draft. All 51,177 source triangles,
70,464 vertices and the original 8192×8192 texture remain intact. There is no
axis stretching, retopology, decimation or distance-dependent mesh replacement,
including in reflections. Main placements contain 307,062 source triangles;
the bonus placements contain 102,354.

Small, unequal heave and rotation phases make the fleet move without following
the player or camera. Heave is bounded to 0.205m, and horizontal mooring positions
stay fixed. Wash stays on the water plane while its heading follows the hull.
The painted amber window shapes emit warm light only within the wheelhouse's
height, and the existing lighting/reflection pool follows the cabin position.
The boats add no collisions. The four native rideable bonus boats, all spring
and moving-platform physics, camera, eighteen wet slopes, reactive nets and
airborne cargo are unchanged.

## Asset and credit record

The built-in Imagegen workflow produced the reference, with a second framing
edit to expose the complete mast. The selected project-bound image and exact
prompts are in `references/shrimp-boat.png` and `references/prompts.json`.
Tripo Studio Smart Mesh P2.0 used a 50,000-triangle target; the returned complete
mesh has 51,177 triangles. The downloaded GLB is installed byte-for-byte at
`public/props/carlisle-fleet/shrimp-boat.glb`. The adjacent `provenance.json`
records its exact hash, bounds, dimensions and original export filename.

Studio asset ID: `5570a940-f388-4ff9-b0cf-2f8a322a3dee`.

| Step | Existing plan credits deducted |
| --- | ---: |
| Image-to-model, Smart Mesh P2.0 | 100 |
| Texture, 8K | 30 |
| Total | 130 |

Observed Studio balance: 24,225 → 24,095. Known cumulative spend: 1,495.
No API purchase or top-up. These are observed Studio prices and deductions,
not API billing records; a separate internal texture task ID is not exposed
by Studio. Both steps and the export completed. The export wait expired in the
browser tool, but the finished local GLB was verified before any repeat action;
no duplicate export or generation was submitted. `credits.json` and
`studio-textured.png` retain the billing and completed-asset evidence.

## Review

`before/` records the preceding compiled build. The first-vessel and bonus
comparisons use matching cameras; later-act views move outboard to avoid the
foreground quay supports, following the repaired crane berth where needed.
`review/` contains the final compiled native views, both sides of the first
boat, later-act moorings, the bonus, normal 480p/CRT, motion samples and browser
report. `validation.json` records completed checks and protected source hashes.

Reproduce through the shared heavy-job lease:

```sh
CARLISLE_BASE=http://127.0.0.1:5484 node tools/carlisle-fleet-review.mjs
```

Use `--lite` for fast loading/shader/motion checks, `--baseline` for the preceding
build, and `FLEET_OUT` for a separate evidence directory. This is a presentation
change; the course fingerprint check protects original gameplay data. No new
full-course traversal or repeated level audit is claimed. Publication remains
held for local testing rounds.
