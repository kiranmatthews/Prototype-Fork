# Crash 4 pirate reference pass

The user identifies lighting, prop arrangement and layout as the weakest aspects, and rejects the repeating cave-wall texture. This supersedes the previous release candidate; nothing from the continuation has been published.

Primary reference: [Airborn Studios — Booty Calls](https://airbornstudios.artstation.com/projects/3dgevg). The studio credits its own environment concept and 3D work. The reference is for visual analysis; its textures and models are not copied into this repository.

Observed design principles:

- Warm, readable walking surfaces against cooler water and shaded rock.
- Broad quiet colour areas; texture detail is subordinate to shape and lighting.
- Heavy nearby arches, rigging and cloth frame the next landing and landmark.
- Supplies, lamps and cannons form purposeful groups with clear walking space.
- Cave openings, pools and turns create depth; the path alternates enclosed and open scenes.

Implementation order:

1. Replace tiled mine/cavern skins with fitted sculpted rock retaining original Meshy UVs. Reuse the paid rock atlas across derived geometry.
2. Establish a smooth warm-harbour to cool-cave light transition, with bounded local warm/cool light pools.
3. Group props around working landings and frame the route with substantial timber, rope and cloth.
4. Recompose the dock jumps and cave/ship approaches, keeping ordinary movement tuning.
5. Check player views and traverse the revised routes before publishing.

Meshy budget remains 105 / 400 spent. The first work in this pass uses existing paid assets; no new provider job has been submitted.
