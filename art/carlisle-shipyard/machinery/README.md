# Carlisle moving-deck machinery

Local visual increment from `a5db0acbf6fedff3a2eb0e9a41a4e28b6f3251f9`.
Ten moving decks now have fitted drive mechanisms instead of isolated machinery
props travelling beneath unsupported slabs:

- Four tide steps sit on sixteen hydraulic rams. Constant-diameter piston rods
  slide into fixed barrels; orange collars, deck plates and bolted footings
  explain the change in height.
- Four counterweight platforms have paired outboard lattice towers, grooved
  sheaves, suspension cables and stacked ballast. The ballast travels opposite
  the deck and the two straight cable runs retain a constant total length.
- Both winch decks ride on flanged bogie wheels and fixed tracks aligned to the
  native world-X travel, including where the coastline turns. Two tow drums per
  deck pull closed cable loops through carriage clamps and return pulleys.

The native deck transform remains the sole motion owner. Fixed members live in
the existing scenery chunks; riding parts are children of the native mesh.
Pulley, wheel, ballast and cable presentation reads that interpolated transform
at render/shadow time. There is no second simulation clock and no new contacts,
rideable rails, platforms, input, camera changes or collision geometry.
The counterweight towers are outboard of the floor edges; everything within
the deck footprint and a one-metre border stays below its original underside.

The new assemblies contain 82,512 triangles in 212 merged geometries. They use
the four existing steel-deck materials and their existing navy paint texture.
The ten former decorative riding hoist/winch placements and their generic
cross braces are deliberately replaced; the original generated GLBs remain
byte-identical and continue serving the other placements. All visible geometry
is retained at every distance and in reflections. No paid generation, new
textures, mesh reduction or distance substitutes were used.

## Evidence

`geometry.json` records 209 native-motion samples per deck over 26 seconds,
including both reversals. The check covers finite geometry, every vertex near
each native contact box, counter-travelling ballast, constant hoist-cable
length and complete geometry/callback/group cleanup. Numerical contact error
is below 0.000001 metres. It is a fitting audit, not a whole-course traversal.

`protected-source.json` proves 23 source files remain byte-identical to the
preceding commit, including level data, crates/nitro, slippery surfaces, nets,
boardwalks, boat bonus, player physics and all eight recently merged trampoline
animation/camera files. The existing shipyard source/asset test also passed:
the main/bonus course fingerprints and twelve complete original models agree.

`compiled/browser.json` and its screenshots record the production full-render
review: nine staged views at native 1920×1080, both ends of travel, three native
rider-carry cases, normal 480p/CRT, main→bonus→main reload and console output.
The isolated test browser uses ephemeral progress. The bonus keeps four boats
and installs no drive assemblies. The final production build log is adjacent.

Visual review caught the first winch cables ending in open air. Those were
replaced with complete closed loops and return sheaves before handoff. The
initial lite capture also exposed a review-harness resolution assertion; lite
correctly renders at 960×540. A TypeScript-only curve-construction issue was
fixed by using the supported Curve subclass. Early captures remain in
`/tmp/carlisle-machinery-first-review-20261030/`, outside the deliverable.

No sustained performance or fresh four-kilometre-clear claim. Local testing and
publication hold remain active; this is one increment toward the broader polish
goal, not proof that the full objective is complete.

[Local playtest](http://127.0.0.1:5483/?playtest&level=carlisle-coast&art=harbour)
