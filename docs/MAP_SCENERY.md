# Campaign map scenery

Local art revision, 20 October 2026. All 22 built campaign courses use Meshy props from their levels; all 16 planned courses remain unavailable placeholders. The original handmade beacon miniatures are superseded.

## Fidelity and provenance

`tools/map-landmarks/assets.json` identifies each source GLB. The runtime manifest records source/output SHA-256 hashes, triangle counts and bounds. `pack.py` bakes source transforms without decimation, retaining every highest-detail authored triangle, original UVs and full-resolution colour, normal and material atlases. Redundant LOD1 geometry and unused rigs/animations are omitted from static copies. No distance-based mesh swaps occur in the map scenery loader. Source files remain untouched.

The seven new Meshy landmarks are two competition bowls, the Deadwater slide tower, harbour rooftops, golf cart, sky temple and spirit totem. `tasks.json` records 14 successful preview/texture tasks, totalling **105 / 500 credits**. No jobs are pending.

`cloud-bank.png` is an ImageGen photorealistic cumulus bank on transparency, generated for this map and used on 24 moving sprites. Original generation: `exec-965329b6-3069-48f2-a51f-945cad7179c6.png`. Brief: broad daylight cumulus cloud bank, fine photographic edge detail and volume, transparent background, no terrain or objects.

## Composition

Each built course has an authored footprint with the hub within foreground and side planting, buildings or rock forms. The terrain supports the hubs, route samples and scenery. The offshore camera faces island centre and follows a continuous orbit during travel. Secret Island is elevated at Y=125 with a temple, spirit totems, palms and drifting clouds.

The [Crash N. Sane Trilogy map reference](https://www.alza.cz/crash-bandicoot-sane-trilogy-recenze) was examined for continuous scenery, marker placement and camera direction; no reference assets were copied.

## Verification

`tools/test-map-scenery-browser.mjs` uses full rendering at 1920×1080 CSS pixels and DPR 2. It disables Fixed pre-CRT resolution and verifies an actual 3840×2160 drawing buffer. Individual full-resolution captures, camera framing, cloud motion, every edge in both directions, terrain support and reciprocity are checked. Evidence stays local under `/private/tmp/meshy-map-final/`.

Required local checks: `check:levels`, focused campaign/map/Level Select tests, and the TypeScript/Vite build. No full suite or publication under the temporary slow-network workflow.
