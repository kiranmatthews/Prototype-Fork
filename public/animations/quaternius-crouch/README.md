# Quaternius crouch and crawl

Four animations from the user's Universal Animation Library [Source] pack:

| Runtime clip | Source take | Playback |
| --- | --- | --- |
| player.crouch-enter | Crouch_Enter | Once |
| player.crouch | Crouch_Idle_Loop | Loop |
| player.crouch-exit | Crouch_Exit | Once |
| player.crawl | Crawl_Fwd_Loop | Loop |

Source: `Unreal-Godot/UAL1.glb`, the pack's in-place variant. Native durations
and 30 FPS samples are retained. `tools/import-quaternius-humanoid-animation.mjs`
retargets 22 semantic body joints using the same bind-world conversion as the
existing Quaternius walk/run. Use `--edition Source`, and `--loop false` for
the two one-shots. All resulting tracks remain editable in Animation Studio.

This import contains the real enter/exit takes, not generated pose blends.
The source library GLB and Blender file are not loaded by the live game.
Only sampled animation keys are included in the application bundle.

Catalog revision 23 upgrades the two existing low-pose routes while saving
their previous clips under `player.crouch.pre-quaternius` and
`player.crawl.pre-quaternius`. Saved playback speeds survive. Existing deleted
routes stay deleted. Later edits to the new clips remain owned by the user.

Movement interrupts enter/exit immediately, allowing crawling or running to
continue; jumps and other gameplay actions also interrupt the one-shots.
The new source pose owns its torso/root shape and does not use the Unity-specific
hand IK, 180-degree wrist correction, or arm-stretch tracks.
