# Character elasticity

Stretch, compression and rebound are a baseline animation principle across the
player, including new work. They are action-specific rather than one perpetual
whole-character wobble.

## Shared, editable layers

`src/animation/elasticity.ts` supplies profiles for all 30 current player clips.
Looping clips get named **Elasticity** procedural drivers, with exact loop seams.
One-shots get scalar keyframes for load, rebound and settle, ending neutral.
Existing authored length keys/drivers keep ownership of their channels, including
the strong Jump/Fall/Land, double-jump, charge and forward-roll deformation.
No existing joint key, speed or user-authored length track is replaced.

| Family | Treatment |
| --- | --- |
| Idle / crouch | Restrained breathing and weight transfer |
| Walk / run / crawl | Step-synchronized compression and extension; no replacement gait rotations |
| Swim | Stroke-sized torso/limb length changes |
| Jump / fall / land | Existing long-rise, apex-catch and cushion/rebound curves |
| Skate / ollie | Contact-owned stance plus the recovered large elastic arc |
| Grind / grab / rope / ledge | Modest elastic load; grip-sensitive arm channels protected |
| Slide / slam / bail / spin | Action-sized compression and release |
| Death / transitions | Finite load and settle, not a continuing bounce after the action ends |

Catalogue 31 adds these layers to saved player clips without overwriting existing
channels. The upgrade is idempotent; later edits or disabled drivers remain saved.
New Animation, initial empty documents and missing-active-clip recovery in the
Studio all use the same factory. Unsupported rigs without the independent length
controls are left alone rather than receiving invalid driver targets.

## Recovered ollie

`src/skateOllieMotion.ts` adapts the independent scalar curves present at repository
snapshot `91cf126` (11 September 2026, before the skating-contact rewrite).
It does not restore that version's on-foot hip/knee keys or overhead arm poses.
The reference includes 1.42× torso and 1.65× shin stretch, followed by apex
compression and a landing rebound. Eased real-control playback reaches roughly
0.73–1.58× shin length. A small delayed spine/arm/wrist follow-through restores
the loose motion, without a body rotation or a change to the physical jump.

Normal skate idle/charge/ollie foot spacing is reduced 25% (1.00 m to 0.75 m in
the default deck). Grinds, grabs, manuals and flips retain their contact-specific
widths. The narrower pose blends into those wider contacts rather than switching
foot targets instantaneously.

The previous shallow charge and proportion-aware knee spring remain. True length
deformation now sits alongside that knee motion; foot IK runs after both. The
bridge composes the elastic multiplier with any authored scalar pose, restores
it before the next frame and does not accumulate transformations.

## Garment and contact ownership

Shorts now have two garment-only length bones underneath the real upper-leg
joints. These extend the existing three-bone skin with each elongated thigh, so
the lower legs remain inserted. During compression knees nest inside the original
hem, avoiding a pinched crotch from shrinking only the leg-weighted vertices.
The waist follows the pelvis. Actual leg joints remain unscaled, source geometry,
UVs and weights are unchanged, and Shorts Width/Height/Depth remain independent
Character Lab settings. Bone knobs, gloves, shoes and the head do not inherit
whole-rig scale.

Order: legacy pose → authored keys/procedural drivers → independent elasticity →
character proportions/garment response → final foot/palm contacts → render
interpolation. Gameplay movement and normalized collision stature are unchanged.

## Focused verification

- `npm run check:animation`: core suite/migrations, IK, runtime routing, fixed-length
  leg solve, arm clearance, charged ollies and all-clip elasticity coverage.
- `tools/test-skate-contacts.mjs`: 10,014 contact/trick frames; roughly 1.15 mm maximum
  sole and 0.94 mm palm error in the fixture.
- `tools/test-skate-charge-ollie.mjs`: 1,344 campaign/park tap/full ollie frames in
  both stances; exact controller position/speed/state parity, roughly 1.48 mm
  maximum sole error, no deep two-legged squat.
- Shorts geometry/rig, on-foot idle/charge recovery and recorded world-map
  locomotion checks pass. The map remains free of gameplay skid poses.
- Local review entries: `skate-charge-review.html` (including phase pauses and
  slow motion) and `idle-review.html` (real idle/walk/run/crouch/crawl inputs).
  Keep `nocrt` during review. These do not save settings or animation drafts.

Numerical checks cover the fixture, not arbitrary extreme character proportions.
Future clips still need motion review for their actual poses and contact needs.
