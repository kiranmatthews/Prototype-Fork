# Cone silhouette and marine-net repair

Local only. The original literal-cone P1 mesh replaces the humanoid cone-headed
character. All 78 actors still dress the same 26 authored lethal rows. A tailored
13-joint rig preserves the complete 4,986-triangle mesh and its original maps,
with idle, walk and finite tantrum motions. The rig uses shared elasticity
amplitudes, independent segment transforms and planted boot targets. No new
Tripo generation or paid operation was needed.

All 56 main-course and five bonus nets now use the same detailed runtime and
workshop implementation: cylindrical braided ropes, alternating weave, knot
collars, a thick perimeter and lashings through the eight measured housing
eyelets. The housing remains the complete original P1 mesh. Its asymmetric
eyelet locations are recorded in `src/carlisleMarineNet.ts`. Original collision
meshes remain authoritative; only visible rope vertices deform.

The successful native trampoline launch writes a small visual impact stamp in
deck-local coordinates. The rope shader compresses around that contact, rebounds
and sends a damped ripple through the bed; it settles completely after two
seconds. Eyelet sections are pinned while the perimeter and hanging laces flex.
Moving/spinning platforms carry the same local deformation. The under-net
machinery and bracing are lowered to leave clearance for maximum compression.
Matching shadow shaders use the same deformation. Geometry/maps are shared by
net dimensions, with three geometry sets serving the 56 main nets; no LOD or
geometry substitution is used.

Checks: `validation.json` covers all eight anchored eyelets, normalized skin
weights, 162 planted sole vertices over 49 idle poses, actual off-centre fixed
and moving impacts, complete settling, resource sharing and main/bonus disposal.
The maximum measured idle sole drift is below 0.000001 metres. `cone/` records
complete idle/walk/tantrum cycles at front, 40° and side views, plus finite-pose,
native, smaller-view and mobile checks. `native-physics.json` retains all 55
transfers, held/unheld launch speeds and zero neutral drift.

The first combined local gameplay pass completed around 19:03 UTC on 29 October
2026, approximately 14 minutes after this correction began. Build and final
compiled-browser results are recorded alongside these images. No course,
trampoline force, input, abandon jump or camera tuning was changed.

The workshop's live deformation also exports as a portable compression morph
with full geometry, normals and braided maps. Both standalone and assembled GLBs
load back successfully (`exports.json`). Temporary bitmap conversion keeps
procedural roughness/normal data compatible with the standard exporter.

`production.json` records the compiled browser pass, including 4.17 metres of
lateral control over 0.3 game seconds and a working Emergency Eject during a
mounted trampoline bounce. `cone/game-validation.json` verifies hazard death,
all 78 actors, zero actors in the bonus and clean return to the main level.
