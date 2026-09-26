# Blockworks · Greybox

Source: `src/levels/codex-lab.ts`; registered level ID: `codex-lab`.
The source level is available in MENU as **Blockworks · Greybox**. It replaces
the previous lab experiment without changing the shared editor pack.

The course follows a 2,530 m path through fourteen sections and eight broad
turns. Carlisle Coast's finish is about 2,300 m from its spawn, so this is the
same scale of course. All mechanics use the normal campaign controller.

## Design envelope

Measured with the production Player at its 60 Hz fixed step, using defaults:

| Move | Rise | Equal-height distance |
| --- | ---: | ---: |
| Charged foot jump | 2.854 m | 5.85 m |
| Charged board ollie at 23 m/s | 1.779 m | 13.80 m |
| Slide jump | 3.728 m | 8.10 m |
| Crouch jump | 5.256 m | 7.95 m |

The core climbing module is a 2.4 m cube, with multiple cubes forming enough
terrace space to choose the next takeoff. A full foot jump clears a 2.4 m
riser between approximately 2.4 and 4.5 m of forward travel. The board steps
rise 1.4 m. Ordinary flat skate gaps are 11–11.5 m; kicker gaps are 11.5–12 m.
Mandatory switch voids and rail crossings are substantially longer. The level
does not enable the Slipstream's perfect-grind speed reward.

Cube faces meet flush: their checker shades define the modules without
introducing false lethal seams. Landing platforms leave room for corrections,
and checkpoints bank the larger combinations. Enemies sit after landings,
where the player can see the decision before committing.

## Course progression

| Section | Length | Main decision |
| --- | ---: | --- |
| Calibration court | 170 m | Four rising board shelves, an alternate cube line, then a full-speed gap |
| Two-key foundry | 170 m | First switch builds access to the second; the second builds the crossing |
| Ice brake laboratory | 170 m | Carry inertia, use the dry island to brake/reposition, accelerate for the launch |
| Interlocking cube escarpment | 170 m | Six interlocking cube masses rise to 14.4 m; smaller outer shelves offer another line |
| Coping aqueduct | 180 m | Pump the vert walls to their coping, or enter the low rail; both curve over the void |
| Offset rail viaduct | 180 m | Rising S-bend, charged pop to an offset lower rail, descending exit |
| Sawtooth assembly | 180 m | Alternating high/low cube terraces; stomp the turtle or jump to its side shelf |
| Frozen switchyard | 180 m | Reach a dry side bay and elevated switch, then assemble the metal crossing |
| Split-level cube cathedral | 180 m | Jump between shoulders; spin through the spiker neck or grind the outside parapet |
| Bank and launch | 200 m | Descending approach, banked trough, uphill kicker and lower landing |
| Cold roof transfer | 180 m | Ice gap, cube roof, rising and falling curved grind |
| Counterweight gallery | 190 m | Repeat the two-key logic in a rotated, higher composition |
| Momentum causeway | 200 m | Downhill speed, two gaps and an elevated curving rail option |
| Blockworks crown | 180 m | Cube climb, ice braking deck, arcing finish grind and broad finish court |

Amber single bars match access switches to their ghost platforms. Violet
double bars match the second switches to their crossing platforms. These
markings are visual-only meshes; they cannot provide invisible support.
Blue ice contrasts with the dry grey catch decks. The camera follows an
ordered, rounded path; six elevated follow views expose cube/puzzle landings.

## Ice behavior

`slip: true, iceGrip: 0.08` opts these platforms into full-vector foot inertia
and 8% dry skate steering, braking and drive. Legacy Sky Bridge ice retains
its original behavior. No tuning defaults are changed. At 20 m/s, a one-second
Circle brake leaves about 17.92 m/s on the new ice versus 1.10 m/s on legacy
ice. Dry exit decks restore ordinary control immediately.

## Verification and local review

Run `npm run check:blockworks` for the focused course checks.

- `node tools/test-blockworks.mjs`: production-controller climbs, switches,
  continuous puzzle crossings, rail transfers, ramp launches, death/respawn,
  vert behavior and finish.
- `node tools/test-blockworks-structure.mjs`: full-source join support, rounded
  camera headings, genuine voids, schema validation and pickup placement.
- `node tools/test-blockworks-ice.mjs`: continuous checkpoint-to-ice-to-jump
  traversal, dry braking margins and crown rail entry.
- `node tools/test-blockworks-enemies.mjs`: encounter support and interactions.
- `node tools/test-authored-ice.mjs`: response measurements, legacy parity,
  normalization and editor capture/reload.
- `npm run check:levels` and `npm run build` remain the repository handoff checks.

For a local visual review, open
`/blockworks-review.html?lite&playtest&level=codex-lab`, then omit `lite` for
full rendering. The review page uses an ephemeral campaign and offers section
starts, checkpoint warps, pit/finish checks, and a continuous input-only run
of the first two-key puzzle. It is an authoring tool, not a production entry.
