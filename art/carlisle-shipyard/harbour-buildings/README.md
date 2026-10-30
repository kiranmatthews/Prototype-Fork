# Carlisle harbour frontages

Local presentation increment based on `ee1eaf331607f1297beef01ad26d0cb16683d1fa`.
The wider polish goal remains active. Publication stays held for local testing.

The previous receiving wharves repeated one closed blue boathouse. The new
frontages mix a low asymmetric fish market, an open barrel-roof repair shed,
the existing boathouse and uncovered repair yards. Markets mark the arrival
and homecoming. Open repair bays recur around the lift and industrial yards;
the last act retains its sparse scenery around the airborne grind route.
The bonus frontage also gains one market and one repair shed. The main course
contains five markets, sixteen repair sheds and eight uncovered yards.

Both new buildings retain every source vertex, triangle and 8K texture. They
are uniformly scaled inside the former building envelopes, with their feet
on the existing quay height. Quarter-turn headings face the course; the fitting
envelopes turn with them, preserving the former world-space footprints.
No LOD, decimation, mesh replacement by distance or new collision is used.
Existing source buildings and machinery retain their original transforms.

Uncovered yards use the existing complete winch, spool and skiff models with
thick wooden boat cradles. The old box-only fishing-trap placeholders become
small grouped cable spools. All scenery quays retain their positions, dimensions,
deck modules and pier structures. This increment does not edit the course,
bonus, wet slopes, cargo/nitro encounters, input, movement, bounce, cameras,
reactive nets or four rideable bonus boats.

## Imagegen and Tripo assets

Built-in Imagegen produced both isolated architectural references. Saved files:

- `references/fish-market.png`
- `references/repair-shed.png`
- `references/prompts.json`: exact prompts and original generated-image paths.

Each reference was uploaded to Tripo Studio Smart Mesh P2.0, Triangle topology,
one model, with a 50,000-triangle target. The complete mesh was reviewed before
its 8K texture step. Original GLB exports are installed byte-for-byte under
`public/props/carlisle-buildings/`; adjacent `provenance.json` records IDs,
hashes, source counts, bounds, texture dimensions and export filenames.

| Asset | Studio asset ID | Triangles | Textured vertices | Mesh credits | Texture credits |
| --- | --- | ---: | ---: | ---: | ---: |
| Fish market | ff4dd1af-f1b1-47b0-89b6-3c30905d4644 | 42,816 | 65,292 | 100 | 30 |
| Repair shed | a03d32eb-6bac-4a49-9bce-5cfc5767e0e3 | 47,523 | 69,827 | 100 | 30 |

Total: **260 existing plan credits**, balance **24,095 → 23,835**.
Known cumulative spend is 1,755. API balance was zero; no API top-up or purchase.
`credits.json` retains per-asset/per-step deductions. These are observed Studio
prices and balances, not API billing records. Studio exposes asset IDs but no
separate internal texture task IDs. Both generations, textures and exports
completed; there were no retries or duplicate generations. The fish-market
export observer timed out, but the actual completed download was verified
before any repeat action. Both exports retain original complete geometry.

`fish-market-studio.png` and `repair-shed-studio.png` show the completed assets
and observed balances. `before/` retains the preceding compiled presentation.
`protected-source.json` records nineteen byte-identical protected source files
and seven unchanged surface, net, moving-decoration, quay, fleet/update methods.

## Local review

`tools/carlisle-buildings-review.mjs` checks loading, grounded building feet,
uniform scales, envelope containment, all eighteen wet slopes, native main
and bonus counts, native views, normal 480p/CRT, level reload and keyboard
walking. Run through the shared heavy-job lease. `--lite` is the fast shader
and fitting pass; the default uses the compiled preview on port 5484.
`--workyard` rechecks only the corrected boat cradles at native resolution.
`CARLISLE_BASE` and `BUILDINGS_OUT` can select another server/output directory.
The `--baseline` option records the preceding build without new-asset assertions.

Original main/bonus fingerprints, all twelve original models, typecheck/build,
lite loading/fitting, ten native 1920×1080 views, normal 480p/CRT, main-to-bonus-
to-main reload and keyboard walking pass, with zero console errors or walking
deaths. All 131 decks, 966 sections, 567 intact timber modules, 27,724,901 deck
triangles and complete pier diagnostics match the preceding build exactly.
All 21 new main buildings fit their envelopes with uniform axes and grounded
feet. Both source GLBs remain byte-identical in the compiled release.

Close review found the skiffs sitting above their first timber cradles. Hull
measurement at the support stations put the underside 1.84–2.02m above the quay;
the crossbeams now reach 2.1m. A new production build and two focused native
views verify that correction. The first-pass images are retained in `review/`;
`workyard-final/` is authoritative for the corrected cradles.

Final build: `Codex/sol fork · build 10-30 03:07 UTC`, 1,782 files / 1,109.2MiB,
offline version `244bcb4585f8b994ec99`. `validation.json` records completed
results. No full suite, new full-course traversal or sustained performance
measurement is claimed.

Local testing: <http://127.0.0.1:5483/?playtest&level=carlisle-coast&art=harbour>.
