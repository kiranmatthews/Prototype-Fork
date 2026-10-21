# Campaign map scenery

Local art revision, 21 October 2026. All 25 built campaign courses have map scenery using existing Meshy assets; 13 planned destinations remain placeholders. All proper courses are assigned. Sky Bridge, Temple of Embers and The Ancient Gates occupy the first three secret slots.

## Reference and composition

The supplied [Crash 1 N. Sane Trilogy map video](https://www.youtube.com/watch?v=nPPj4RW4zDo) was examined at the opening island view and several early camera positions. Its compact landmass, foreground character scale, coastal route and dominant central silhouette guide this revision. No reference game assets are copied.

The generated [composition studies](../art/island-worlds/README.md) were rejected. They remain archived and are not art targets. The current correction was reviewed against the actual video and native-resolution game views.

Each island now has a shared landform behind its course scenery: Motu's ochre ridge, Uga's twin sandstone peaks, Spooky's cave escarpment, Maynard's low headland, Quagmire's basalt volcano and the elevated secret mesa. Existing rocks, foliage and buildings join the landform to the individual hubs. Plants on mountain ledges are rooted against the actual Meshy surface. Sky Bridge, Temple of Embers and The Ancient Gates have separate entrance arrangements.

The offshore camera faces island centre, with the selected hub and enlarged skater in the foreground. Same-island movement orbits the landform. Island changes use a 2.6-second camera pan; the rider is hidden during the sea crossing and revealed on the destination hub. Navigation links remain in the graph but have no visible ocean line, rail, dots or pylons. The secret island's hub foundations are relative to its elevation.

Keep the skating route clear. Course props were repositioned using actual mesh intersections along every route. Coastlines are tighter and smoother; planting fills the spaces between scenes while retaining the route. Distance fog covers scenery and the sea, with a matching sky haze. These ocean and fog adjustments are map-specific. Foam now fades into the same distance fog as its island. Each island has a restrained lighting palette that blends during transfers; explicit atmosphere edits retain priority, and course lighting is unchanged.

The correction tightens the coast around the hubs, reduces the camera distance and height, and uses existing cliff-bay, eroded-cliff, planted-cliff and hanging-foliage assets to join the central forms to their surroundings. The original tropical palm replaces the older map palm. Sand follows the walking route through the ground cover. Existing sandstone and moss textures add metre-scaled surface detail without replacing the source atlases. Terrain now casts and receives shadows; shadow coverage follows the island centre.

## Fidelity and provenance

`tools/map-landmarks/assets.json` identifies each source GLB. The runtime manifest records source/output SHA-256 hashes, triangle counts and bounds. `pack.py` bakes source transforms without decimation, retaining every highest-detail authored triangle, original UVs and full-resolution colour, normal and material atlases. Redundant LOD1 geometry and unused rigs/animations are omitted from static copies. No distance-based mesh swaps occur in the map scenery loader. Source files remain untouched.

The earlier seven Meshy landmarks used **105 / 500 credits**. The new six landforms used **90 / 100 credits**, recorded in `tools/map-landforms/tasks.json`: six previews and six texture jobs, all successful. Ten credits of the current allowance remain unused. This correction used only existing assets and spent **zero additional credits**.

The production export retains byte-identical mesh and image payloads for all **86 map models and 179 images**. Its texture-sharing step only moves identical image bytes into shared files.

`cloud-bank.png` is an ImageGen photorealistic cumulus bank on transparency, used on 24 moving sprites. Original generation: `exec-965329b6-3069-48f2-a51f-945cad7179c6.png`. Brief: broad daylight cumulus cloud bank, fine photographic edge detail and volume, transparent background, no terrain or objects.

## Verification

`tools/test-map-worlds-browser.mjs` captures all 38 hubs at 1920×1080 CSS pixels and DPR 2. It disables fixed rendering and asserts the actual **3840×2160** drawing buffer. Every hub stays on screen and the camera faces island centre.

The real-browser route audit checks 1,632 positions across 32 same-island edges, reciprocal travel, terrain support and five vertical mesh probes across the skater envelope. No sampled scenery intersections remain. All five island changes pass in both directions with a hidden rider, endpoint-only relocation and continuous camera movement. The rebuilt production preview passes six arrival views, all ten transfers and portrait capture with no console errors.

Required `check:levels`, focused campaign/map/ocean checks, and the TypeScript/Vite production build pass. The movement regression also covers entering/leaving the map and disposing pending scenery loads. No full suite or publication was run under the temporary slow-network workflow.

Evidence: [map-worlds-review.json](performance/map-worlds-review.json). Full-resolution local captures are in `/private/tmp/island-reference-final/` and `/private/tmp/island-reference-production/`. Combined offline preview: `http://127.0.0.1:6265/?playtest&level=warproom`.
