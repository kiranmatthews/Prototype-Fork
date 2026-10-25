# Rooftop Relay coastal art kit

Original scenery and enemies for the affluent Outer Banks rooftop brief. Built-in ImageGen supplied six original scenery references, two surface textures, three expansion references, a registered metal height map and two screenshot studies. Exact prompts are retained in prompts.json, expansion-prompts.json, metal-height-prompt.json and docs/rooftop-kook/studies/prompts.json.

The official Meshy CLI 0.3.1 owns provider calls, authentication, submission journaling and waits. [tasks.json](tasks.json) records IDs, source hashes and actual credit consumption. Credentials and signed download URLs are never shipped.

| Generation | Credits |
| --- | ---: |
| Six original scenery models, meshy-t2 | 90 |
| Karen, Kook and clubhouse, meshy-7.1 / 4K PBR | 105 |
| Two character rigs | 10 |
| Six imported gesture/idle/weapon clips | 18 |
| Total | 223 |

The verified balance after these jobs is 388 credits, from an initial 611. All nine model jobs succeeded. Imported animation candidates remain available for later refinement; the current gunner uses native idle motion with fitted two-handed aiming and recoil.

## Native geometry

| Module | Triangles at every visible distance |
| --- | ---: |
| Cedar estate | 14,762 |
| Turret manor | 14,003 |
| Yacht-club cupola | 8,114 |
| Parasol terrace | 10,243 |
| Hydrangea planter | 7,262 |
| Cedar dormer | 6,861 |
| Columned clubhouse | 77,950 |
| Karen lookout | 41,066 |
| Kook gunner | 41,225 |

prepare.py preserves geometry and UVs, measures scenery and renders multiple review angles. It creates no reduced mesh. pack.py retains the original six meshes with 2K atlases. pack_expansion.py preserves PBR, skinning and UVs with 4K base colour and 2K normal/roughness maps.

compress_native.mjs uses lossless Meshopt geometry compression and high-quality WebP colour/roughness packing. It verifies every vertex and skin value plus every oriented triangle after decoding; no simplification or quantization is applied. Normal maps are retained. Public manifests record hashes, sizes and verification. extract_clips.py publishes animation tracks without six duplicate character meshes.

For the optional packing step, install @gltf-transform/core, @gltf-transform/extensions and @gltf-transform/functions 4.2.1 with sharp and meshoptimizer in a tooling directory. Set ROOFTOP_GLTF_PACKAGE to that directory's absolute package.json path, or install the tooling packages beside the script. This runtime does not ship those authoring dependencies.

Roof grain is source-aligned, and metal-height.png supplies simulated seam depth through bump mapping. The skyline uses full Meshy buildings and existing coastal-town/country-club windows, balconies and trees. Added scenery is visual-only; native components own traversal and collision.

Original downloads and Blender renders remain in ignored .img2threejs/rooftop-kook/. Runtime assets live in public/rooftop-kook/; placements are in src/levels/rooftop-kook-art.ts. The ledger refuses duplicate submission of an existing job name.
