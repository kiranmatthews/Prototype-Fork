# Generated enemy roster

All eight surfaces were generated with Meshy T2 from original built-in imagegen
design references. The final assets retain the generated texture/UV surfaces,
with model-specific fitting, cleanup, skin weights and mechanical articulation.
No API credentials or expiring provider URLs are shipped.

The four walkers use a genuine Meshy quadruped walk from an existing user-owned
export, retargeted through sampled foot paths and two-bone IK. These are custom
skins with Meshy-derived motion, not untouched provider auto-rigs. The frog,
drone, turret and spinner use custom state animation. Runtime elasticity is
applied to individual segments and preserves planted contacts.

`manifest.json` records final artifact hashes, generation task IDs and motion
provenance. Full references, prompts, authoring tools and rig specifications are
in `tools/enemies/`; raw provider and FBX source files remain local authoring
inputs. `npm run check:enemies` validates the complete published roster.
