# Mall · New York

The playable Mall now uses measured PS1-derived architecture instead of the earlier image-based reconstruction. Select **Mall · New York** in MENU, or open `/?playtest&level=mall`. Add `&lite` for the fast renderer. All files, previews and commits remain local under the slow-network workflow.

WASD/arrow keys steer; hold Space to build speed and release to ollie; E grinds. K/L move between the five checkpoints. M shows developer controls if MENU is hidden.

## Source and provenance

The supplied VGCartography cutaway and [original PS1 footage](https://www.youtube.com/watch?v=n0kosmzFb0A) establish the intended version. The geometry and static art come from [letmynutzgo’s public THPS Mall conversion](https://thpsx.com/creation-details/?obj=958), released 18 July 2018. Its readme credits the original PS1 level to Neversoft, extraction and nodes to letmynutzgo, and conversion scripting to TylerLasagna.

Static art and collision came from a converted PS1 source, not a byte-for-byte verification of the 1999 disc. Its authored conversion rails have now been replaced by measured original-format rail chains retained in THPS2 retail. The altered cereal boxes, multiplayer nodes and gameplay helper objects are excluded. Third-party asset provenance is recorded in [the art README](../public/mall-reference/README.md); these game assets are not relicensed as Apache source code.

`tools/mall-reference-survey.py` reads bounded collision and literal node records without executing game scripts. `tools/mall-reference-art.py` independently reads SCN/TEX data and decodes the original DXT textures to PNG. The [THPS Blender importer](https://github.com/denetii/io_thps_scene) documents those formats. Archive, member and image hashes are retained in the source data. No executable game code or audio is included.

A bounded read of the retail data pack recovered `SKMALL.PSX` (418,280 bytes) and `SKMALL_T.TRG` (28,532 bytes), with sizes matching the published PS1 THPS2 inventory. A uniform transform registers 8,232 conversion vertex records (97.49% of distinct floating-point positions) to the retail geometry, with at most 0.00751 conversion units of error. This confirms the coordinate relationship independently of the earlier quantization inference; it does not prove a byte-identical THPS1 revision. See [retail-reference.json](mall/retail-reference.json) for hashes, measured registration and provenance. The bounded measurement tool shares the School decoder; raw retail binaries stay outside the repository.

Rail activation matters. The normal `Re_Start_Mall` restart pulses command points 0 and 441. Their rail chains produce 73 native paths, 214 segments including four authored overlaps, and 210 unique edges. Command point 759 adds alternate-restart rails and is excluded from the normal course. The runtime preserves each activated source chain and its endpoints; it no longer generates paths from the conversion's duplicated return edges. Terrain-specific original grind audio remains unimplemented.

## Geometry and scale

[src/levels/mall-measured.ts](../src/levels/mall-measured.ts) retains all **8,650 referenced static collision control vertices**. The 9,826 original static triangles comprise 8,678 solid triangles and 1,148 pass-through/detail triangles. A single axis rotation, translation and uniform scale transforms the source coordinates into the fork’s Y-up world. Static vertices already contain world positions; their separate conversion node offsets must not be applied again.

The current provisional scale is **0.045 world metres per source unit**. It is calibrated to the existing visible rider, whose measured standing bounds are about 3.02 m tall. The earlier 0.025 trial passed collision tests but visibly cut through the arcade beams; the collision capsule alone was an inadequate scale reference. The full-render route now measures at least **0.36 m of head clearance** beneath the crossing beam. This establishes clearance for this rider and route, not the original game’s metric unit convention.

The source’s folded entrance, concourses, gallery, angled atrium, escalator, crossed arcade arches, courtyard quarters, canopies, pool, exit passage and parking retain their relative positions and elevations. The recovered normal-start rail graph preserves **210 unique edges in 73 native paths**, including its authored overlapping segments. Every native rail control point matches its transformed source position within numerical precision.

The source marks only the upper parts of some quarters as VERT. Classification follows smooth connected faces down to their toes and across storage-sector seams, covering 379 source triangles. Three subdivision passes add tangent midpoints without moving the source control vertices. Shared vertical tangents keep straight wall extensions straight. Native contact follows its current mesh, so continuous quarters use overlapping spatial chunks with a 1.2 m halo. Chunk dimensions follow source scale; this keeps the source connections stable and the full level within existing editor limits. The final data has 2,305 components, 60,615 mesh vertices and 68,091 mesh triangles, occupying about 6.9 MB as JSON.

Original static scenery supplies 25 sectors, 208 meshes, 9,750 render triangles, 126 single-pass materials and 125 decoded textures. Native measured surfaces own collision; the original render meshes own appearance. Shared runtime support registers those textures and their unlit materials, and lets level data opt out of automatic huge-drop damage. Mall uses that option for its original gallery drop. Speeds, gravity, ollies, steering, camera implementation and rail physics are unchanged by this task. Course direction, a lower arcade camera view, five supported checkpoints and a finish gate are level data.

The native wall proxies omit buried spans at continuous floor joins. The first up-escalator previously tripped the board against the deck’s front face just before reaching the landing. The correction splits that proxy at measured floor edges and checks strict support on both sides; exposed deck sides and actual guardrails remain collidable. Source render and collision control vertices stay unchanged.

Connected wall frames also retain their openings. The fountain previously looked open but had a solid bounding rectangle across its passage. Nineteen wall envelopes are now clipped to their measured coplanar triangles. The shared School toolkit's `wallHeights` field gives the resulting 69 profiles their measured lower and upper edges; 1,035 interior samples remain inside source polygons. Both old fountain exits bailed. Both corrected exits pass with ordinary input and clean landings, natively and in the full renderer. Sills and lintels remain solid. See [wall-openings.json](mall/wall-openings.json).

The separate [scale and physics research](mall/scale-physics-research.json) records the importer's coordinate conversion, the earlier inferred quantization, the newly measured retail registration, and original PS1 charge/gravity/kick calculations. These do not establish the final actor-relative scale. Experimental flight settings are not enabled in the validated build. In particular, the source's `mMaxSpeed` selects stronger drag rather than imposing a universal hard cap.

## Authored gaps and landing policy

The [original PS1 guide](https://gamefaqs.gamespot.com/ps/199060-tony-hawks-pro-skater/faqs/5073) distinguishes the Flying Leap from the secret-tape transfer: the former drops from the high gallery, while the latter uses the right-hand rail beside the descending route to reach the suspended beams. The failed earlier probe mixed those approaches.

The gallery jump exposed a runtime mismatch. A correctly aligned landing from this approximately 48 m apex-to-floor drop triggered the fork’s automatic 24 m huge-drop bail. The published [PS1 physics decompilation](https://github.com/LANCommander/TonyWasAProSkater/blob/main/game/src/physics.cpp) checks landing alignment, leaning and trick completion; its inspected ground-contact path does not impose that height rule. Mall now sets `hugeDropBail:false`. This level option preserves existing defaults and all other landing judgement; it does not change the flight trajectory or global tuning. It survives editor capture/import. Both airborne and wall-ride ground contacts respect it.

Two normal-input Flying Leap releases now clear the front guard and roll away without a bail. The separate tape-route test catches original chain 282→281, transfers to suspended beam 134→135, grinds **135.00 m over 381 frames**, runs off the far end and rolls away. Native and full-production browser fixtures agree. The beam transfer requires a late charged ollie with lateral input; its timing tolerance still needs broader comparison with the original game before the scale is considered final.

## Original glass and directories

The two intact glass barriers and all five directory signs now break on body contact. Render sectors are linked to their collision objects by checksum: collision directories 33–37 are render sectors 27–31. Collision helper 38 has no intact render counterpart and does not create an extra door. The entrance glass has two visual meshes that break together.

Contact sweeps the existing body bounds across each fixed step, including thin panes at speed. It changes no movement, score, tuning or collision surfaces. Native tests compare identical controller inputs with breaking enabled and disabled; every recorded position, state and speed agrees. Broken objects stay absent after a fall and return on a new run. Fragments retain the source textures, shrink promptly to keep the rider visible, expire after 0.9 seconds, and use one draw per source mesh with bounded work. The breakup motion is procedural and the sound reuses an existing local effect; those are not recovered PS1 effects.

All seven objects pass full-production browser approaches, including the transverse atrium sign. Tests also check grouped visibility, diagonal near misses, reset behavior, resource disposal, editor round-trip and invalid imports. The count is retained for later directory-goal integration; no goal completion reward is implemented yet.

## Validation

Current evidence is saved in [validation.json](mall/validation.json), including hashes of the frozen runtime used while other chats edited the shared checkout.

The complete full-render route uses normal controller input from the source restart to the parking finish: **83.57 simulation seconds, no bail or death, at least 16.20 m/s after the entrance**. Pass 20 repeats the complete native and full-render browser route after restoring the retail rail chains, and repeats the Flying Leap and suspended-beam transfer in both runtimes. The seven breakable browser fixtures retain their pass-18 evidence; fountain-opening browser evidence remains identified with its pass-19 build, and the native fountain checks pass again in pass 20. Source equality, unchanged tuning and zero console errors are checked. The main route uses the courtyard’s sloped takeoff before clearing its raised lip.

Focused native checks cover source control-point retention, 58 measured surface probes, supported spawn and five checkpoints, editor save/load, curved garden-skirt collision, both courtyard wall airs, and the atrium wall return. A separate data test checks three scales: transition and rail connectivity remain identical, and each version stays below the existing mesh and file-size caps. Rail section tests require the intended source path, a sustained grind and a clean exit, using ordinary controller samples after an initial supported placement.

Both escalators are checked uphill and downhill with ordinary input, no ollie and no in-run placement or speed edits. All four routes retain support across their landings; minimum seam speeds range from 9.45 to 21.00 m/s. The actual inner handrail on the first escalator is separately verified: original chain starting at node 5, 24 grind frames, 4.43 m travelled and a clean landing back on the ramp. This is distinct from the adjacent display ledge checked in the previous pass.

The production build and required level checks are run locally. MENU selection, K/L warps and reserve-life pit recovery use the real browser. The full suite is not run. The related endpoint-height wall support and shared check are included in the local Mall commit. Other concurrent runtime changes are excluded from that commit and identified in the frozen preview's manifest.

![Measured arcade at normal gameplay camera](mall/measured-arcade.png)

## Reproduction

- `node tools/test-mall-measured-topology.mjs`
- `node tools/test-mall-measured-surfaces.mjs`
- `node tools/test-mall-measured-verts.mjs`
- `node tools/test-mall-measured-rails.mjs`
- `node tools/test-mall-measured-upper.mjs`
- `node tools/test-mall-measured-gaps.mjs`
- `node tools/test-mall-wall-proxies.mjs`
- `node tools/test-mall-wall-openings.mjs`
- `node tools/test-school-wall-profile.mjs`
- `node tools/mall-wall-openings-browser.mjs <local-url>`
- `node tools/test-mall-landing-policy.mjs`
- `node tools/test-breakable-scenery.mjs`
- `node tools/test-mall-breakables.mjs`
- `node tools/mall-breakables-browser.mjs <local-url>`
- `node tools/test-mall-measured.mjs`
- `node tools/mall-measured-browser.mjs <local-url> --full`
- `node tools/mall-measured-upper-browser.mjs <local-url>`
- `node tools/mall-measured-gaps-browser.mjs <local-url>`
- `node tools/mall-smoke.mjs <local-url>`

The retail-reference audit can be reproduced with `python3 tools/test-mall-retail-reference.py /private/tmp/mall-recreation/research/retail`. The decoder dependency is the School tool from local commit `b69bb15`; concurrent geometry-export additions are not required.

Set `PLAYWRIGHT_MODULE` when Playwright is installed outside this repository. Use `npm run check:levels` and `npm run build` for the repository’s required checks. The old `mall-pilot.mjs`, `test-mall.mjs`, and their related route tools describe the superseded image-based level at commit `2508077121b87c2b606c515ac025556bd05f44af`; they are historical evidence, not tests of the measured replacement.

## Remaining fidelity work

The goal remains active. The Flying Leap and complete suspended-beam route now pass input-only checks, alongside both escalators and the actual first-escalator handrail. The fountain passage is physically open, but its complete upper-display/car-ramp entry and grounded rollout still need source-scale and movement comparison. Remaining alternate upper routes and the tape transfer’s input tolerance also need comparison with original gameplay. Head clearance and one successful transfer do not settle the final scale. The retained retail rail graph is now measured and applied, but a byte-identical 1999 THPS1 revision and original grind audio are not verified. The source directories and glass now break, but the directory-goal reward, original box stacks, collectibles, sky and animated water remain incomplete. Breakup motion and sound are local approximations. These limitations prevent calling the recreation a completed literal 1:1 match.
