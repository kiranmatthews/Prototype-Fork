# Platform-edge default audit · 2026-10-11

The audit starts from `b61d228`. It restores **1,177 solid component defaults
across 45 source entries**, including themed bonus stages. The comparison of
old and new data verifies identical coordinates, dimensions, materials,
movement settings and triangle faces. Custard's triangle ordering changes to
identify the cap; its geometry and normals remain identical.

Scope is the live course registry, shared builders and published playable pack.
Historical fixtures and frozen provenance/atlas exports retain their captured
data; they are not silently rewritten as new live defaults.

## Corrected authoring families

| Family | Restored behavior |
| --- | --- |
| Coastal Street, Jungle Gate, jungle sequels, Sky Bridge, Slipstream 2, Deadwater courses, Jungle Cup, Bone Yard, Crab Chief | Ordinary platforms, roads, ramps, courtyards, terraces and approaches inherit grindable edges. |
| Bonus courses and puzzle courses | Permanent courts and shelves grind; switch-built surfaces offer their edges only while solid. |
| Treehouse Trail and the room | Visible deck supports, balcony/landing supports, bridge abutments, exact rock supports and solid room surfaces retain edges. |
| Ghost Train | Paving, serving-table runways, measured banquet tables and raised dais supports retain their edges. |
| Carlisle and Custard | The actual sculpted cap defines the grind rim. Lower decorative strata cannot create hundreds of unrelated crease rails. |
| Nightworks | The baked flat rock cap supplies its measured rim, for stationary, moving and phase platforms. |
| Beachside, Island Hopper and the chief's pier | Timber deck boundaries grind independently of their separate handrails. |
| Native Descent | Road chunks, shoulders and the car-park platform no longer suppress default edges. |
| Shared mechanic platforms | Movers, fallaway pads, phase pads, spin bridges and switch-created decks track their actual transforms and availability. Boost/bounce decks retain ordinary edges too. |

## Remaining exceptions

The audit inventories every remaining disabled component. It does not treat a
repeated `false` in a general floor helper as evidence of an intentional choice.

| Exception | Concrete reason |
| --- | --- |
| `solid:false` artwork, lettering, water and surface decorations | They are not gameplay support. |
| Invisible wall/containment proxies and enclosing doorway/roof/colonnade walls | They describe architectural boundaries rather than ordinary roads or platform decks. |
| Natural beach/seabed shelves, forest-earth skirts, shallow riverbeds and scenic boulders | Their modeled borders are ground/scenery construction boundaries, not hard riding ledges. |
| Treehouse safety foundation, cabin interior floor and smooth stair-ramp proxies | Buried/interior support, or a smoothed contact proxy beneath separately drawn stepped timber and handrails. Exact exposed landing and balcony supports are enabled. |
| Descent oil patches | Traction/paint overlays on the existing road, with no independent physical lip. |
| Blockworks ground stratum | It lies beneath the authored ground-floor reset volume. |
| Flats' two legacy practice slabs | Two individually authored historical opt-outs, preserved by the existing exact migration. |
| Slipstream finish apron | Its low rim lies under the overlapping landing ribbon. |
| True vert transitions and vertical loops | Their existing explicit coping/track policy defines the riding boundaries. |
| Portal/finish/start pads and visual collision proxies | Their existing interaction or support owner remains authoritative; they are not generic deck helpers. |

## Runtime and saved-data guarantees

- `edgeGrinding:false` remains an explicit per-component choice. Ice and the
  fallaway helper cannot overwrite it or silently impose it.
- A mover's rim follows its mesh, including a rim initially coincident with a
  dock. Disappearing floors retire their rails; a rider drops when support is
  gone. Return/reset restores the rim with the floor. Ghost switch decks and
  undeployed spin bridges cannot become invisible shortcuts.
- Cap metadata is bounded and validated. Top-face vertex IDs survive BVH index
  reordering, and geometry capture reconstructs the cap prefix correctly.
  Sub-weld cap seams are closed at the existing 0.1 mm topology scale while
  keeping authored height samples. Ground and collision triangles are untouched.
- Deduplication checks the intervening portion of a curved authored rail,
  preventing matching endpoints from erasing an uncovered middle segment.
- Exact pre-fix source and published identities upgrade pristine cached copies.
  Coordinates, colors, names or other edits prevent that upgrade. The older
  published pirate scenery is preserved; only its reviewed flags change.
- An explicit editor save that exactly reproduces a legacy default receives
  `edgeGrindingRevision:1`, so a deliberate opt-out cannot be migrated away
  on the next load. Export/import preserves that choice.

## Verification

- All **54 playable built-in entries**, including bonus stages: **53,600**
  boundary checks and **1,390** production-player catches. Existing intentional
  exceptions are inventoried by the test; new unexplained disabled floors fail.
- Chrome: native keyboard grinding in all 54 entries in lite mode and full
  rendering in eight representative course families, with clean consoles.
  Full passes also wait for models and surface images; all 66 Nightworks model
  placements report ready with no asset errors. Two isolated browser-storage
  cases confirm pristine upgrades and deliberately authored opt-outs.
- An additional lite/full flow check verifies supported spawn, checkpoint
  warp, pit death/respawn and the finish gate on the integrated main build.
- Independent dynamic lifecycle, cap topology, capture, mirrored geometry,
  explicit opt-out and saved-data tests pass. The full captured baseline checks
  54 pristine cases, including registry title normalization.
- Required level-pack checks, production build, 186 parser/security cases and
  27 editor transaction cases pass. Existing traction, fallaway timing, spin
  bridge, Carlisle geometry/support and Deadwater coping-approach checks pass.
- Custard's two old pilots pressed Grind while still steering inward from an
  edge and consequently chose the newly restored bank rim. Their updated
  input waits until aligned with the authored bar. The intended mill and final
  rail routes complete; no runtime input rule or movement tuning changes.
- The broader Unity-port check passes its updated grind-policy assertions,
  then fails a pre-existing literal-comment assertion requiring
  `meshycourtyard ... visual only`. The same required comment is absent from
  unchanged `b61d228`; that unrelated assertion is not weakened here.
- No `check:all` run. Focused grinding regressions are included in the existing
  Pages release workflow.

Reproduce with `tools/test-course-edge-policy.mjs`,
`tools/test-dynamic-platform-edges.mjs`, `tools/test-edge-cap-topology.mjs`,
`tools/test-edge-grinding-migration.mjs` and
`tools/test-course-edges-browser.mjs <game URL>`. Supply `PLAYWRIGHT_MODULE`
when Playwright comes from the bundled runtime. `EDGE_BROWSER_LEVELS` selects
individual courses; `EDGE_BROWSER_MODE=full` runs only full-render checks.
