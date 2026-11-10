# Worktree integration — 11 November 2026

The user designated Claude's latest character movement/animation work as
authoritative. At audit time `origin/main` was `91fe4413`, already containing
Claude's newer idle, charge, skid, slide, low-pose, slam and ledge work. This
integration starts there. It does not replay the older jump/skate/slam edits
over that baseline.

## Completed work

| Active branch at audit | Tip | Mainline status |
| --- | --- | --- |
| `codex/jump-reference-motion` | `91fe4413` | Current main; earlier jump/skate/ledge/eco work already integrated |
| `codex/dusty-road-collision` | `db001d61` | Ancestor of main |
| `codex/dusty-road-heat-coverage` | `fa688e9d` | Ancestor of main |
| `codex/flame-heat-distortion` | `afb40ace` | Ancestor of main; integrated heat distortion, but did not replace torch flame artwork |
| `codex/jak-rope-bridge` | `84fdb6b7` | Ancestor of main |
| `codex/jump-skate-release-20261108` | `39788711` | Ancestor of main |
| `codex/opengoal-enemy-audit` | `06efc419` | Ancestor of main |
| `codex/skate-boneman-motion-lab` | `c00bc86e` | `b967f838`/`c00bc86e` adopted by the playable study (`9357fd78`), then refined on main; documented in `SKATE_PLAYTEST.md` |
| `codex/jak-whole-game-lab` | `8de60c29` | Completed effect catalogue/eco/sage cage/first-person work integrated; only unfinished progress-HUD checkpoint remains |

The three missing files from the old Skate branch are its obsolete private-only
Vite configuration, private-only instructions, and original retarget test.
Main contains the published source viewer, the 218-clip dataset, the evolved
retargeter, and playable-motion checks. Restoring that old packaging would undo
the subsequently authorized publication and motion corrections.

The Jak lab's last commit explicitly says **not READY for release** in
`docs/JAK_ASSET_LAB.md`: progress-HUD sampling/placement validation, remaining
extractor thresholds, candidate refresh and browser review are unfinished.
Its seven progress-HUD-only source/test files stay on that checkpoint branch.
They are not silently promoted by this audit.

The shared Documents checkout is dirty and still based on `4e1a78b0`. Its edits
are preserved; it must not be staged or reset wholesale. Publish from the
validated task branch against current `origin/main`. Clean completed worktrees
can fast-forward; divergent reference/checkpoint branches remain recoverable
when their worktrees switch to new branches based on current main.

## Missing torch integration

Every call to the shared `Level.torch` factory now uses Jak's original
`group-part-maincave-torch` launcher graph (group 318, particles 706–713), drawn
with the existing texture-free Gouraud bigpuffs. The generated source is checked
against the published catalogue. Warm flames retain the source colour/timing;
phase-pad blue flames retain their gameplay cue. Static torches, ferry braziers
and tiki crown torches share this path. Pooled lights, heat distortion,
phase-pad warning/extinction and moving mounts retain their existing ownership.
The green-eco vents remain their distinct green-eco effect.

Each torch has a fixed 256-particle pool and two instanced draws for the original
normal cooling/additive flame layers. The deterministic 12-second sweep peaks
at 111 visible particles, with no drops, identical at 30/60/120 Hz. Rendering
uses actual-camera billboards, depth testing, fog retirement and bounded culling.

## Main-game animation setup fixes

Browser review found two integration errors which headless comparison tests
had not covered:

- Main's editable rig wraps the body in `skateBody`. D's new idle expects the
  actual skeletal `root`. `gameplayAnimationDocument` now supplies the body rig
  to the existing D generator while retaining the full editable rig in the
  document. The regression compares all resulting clips against the comparison
  lab: exact equality. No authored animation or controller file is changed.
- Vite serves `.gz` motion assets with HTTP gzip encoding, which fetch already
  decodes. The loader now inspects the payload before decompressing, accepting
  both raw gzip and decoded JSON/GLB. It retains explicit HTTP error reporting.

Focused checks: `check:torch-fire`, `test-green-eco-fire`, `check:motion-assets`,
production build and release-size check. The shared-factory fixture exercises
all 92 Nightworks torches, blue/orange phase cycles, ferry transforms, pooled
lights and teardown. The lifecycle check also covers both local players and
29 native animation owners. Full-suite work is outside this integration.

Local browser review: `/tools/flame-heat/review.html?playtest&level=dark&launchReview&nocrt&lite`;
the same entry without `lite`/`nocrt` exercises the full renderer, with Normal
720 and MAX/native controls. `/labs/` now links this review with its required
fixture parameters. The local server is restored at port 5189.
