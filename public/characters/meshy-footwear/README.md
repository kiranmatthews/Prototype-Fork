# Meshy shoe and sock footwear

The production rider footwear uses the owner-supplied Meshy shoe-and-sock
surface. It replaces the former procedural sock cylinders, stripe, shoe
sphere, box straps, and capsule sole while retaining the conventional knee,
ankle, toe, and foot-contact controls.

**Model created with [Meshy](https://www.meshy.ai/) —
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).**

`tools/import-meshy-footwear.mjs` validates the exact FBX and four PBR texture
sources, bakes the source axes into ankle-local rider space, and records all
seven connected surface islands. Runtime code keeps the shoe and five lace
islands rigid on the ankle, while the separate sock island smoothly blends
from the ankle into the lower-leg/knee bone. The opposite foot is a corrected
geometric mirror with reversed winding and mirrored normals.

The authored fit preserves the existing sole plane plus heel, foot-center, and
toe socket positions. `Foot size` continues to scale the complete semantic foot
chain. `Leg thickness` widens only the exposed sock through a tapered morph
that remains fixed inside the shoe. The original FBX and archive are not
redistributed.

See `provenance.json` for exact source/derived hashes, upload ID, topology,
rest fit, skinning rules, and contact mapping.
