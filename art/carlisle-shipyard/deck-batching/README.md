# Carlisle full-geometry deck batching

Local-only increment based on `af10916be66dfa27674b85d25b830513ccddd519`.
The broader polish goal remains active; this is not a whole-course frame-rate
or final-quality certification.

## Runtime change

Intact solid timber modules are grouped into 48m cells in their existing
parent's local coordinates. The former batch key grouped every module of the
same kind under one parent, allowing a single visible corner to submit many
off-screen quay modules to camera and shadow passes.

The main course retains 131 decks, 966 sections, 567 intact modules and
27,724,901 placed/fitted triangles. Its intact modules retain 21,843,906
triangles; only their partition changes, from 34 to 177 instance batches.
Shared source geometry, materials, exact matrices, fitted edge pieces,
visibility distance, all cameras and gameplay are unchanged. No LOD or
decimation, and no additional per-frame update logic.

## Evidence

- `experiment/report.json`: initial 0/32/48/64/96m partition comparison against
  the prior compiled build. 48m balanced fewer submitted triangles and a modest
  increase in draw calls.
- `final/report.json`: current compiled build, native 1920x1080. Exact sorted
  geometry/material/matrix fingerprints agree across coarse control, reconstructed
  48m cells and runtime batches. The repeated coarse control is pixel-identical.
- The runtime batches are also pixel-identical to the same batches with frustum
  culling disabled in all seven views, including shadows. No visible pixels are
  lost to the narrower bounds.
- Paired native PNGs and `final/pixel-review.png` show the largest changed areas.
  Regrouping changes a small number of plank-edge pixels compared with the coarse
  control (maximum 782 of 2,073,600 pixels, 0.0378%; largest channel delta 39).
  These images are not claimed pixel-identical to the old grouping. The exact
  uncull comparison excludes missing frustum-visible geometry as their cause.
- The mirrored view hides the reflecting water surface to inspect deck
  undersides. It tests a reflected camera/frustum; it is not a claim that the
  Carlisle water shader renders planar scene reflections.
- Native bonus, main-to-bonus-to-main disposal/reload, normal 480p/CRT and
  keyboard walking passed, with zero console errors/deaths. All four playable
  bonus boats and eighteen wet slippery slopes remain.
- `protected-source.json`: nineteen protected sources and the complete deck
  fitting function match the base commit. Both source GLBs are unchanged. The
  build externalizes their images using its existing deduplication; all vertex,
  index, material and image bytes match exactly after resolving those references.

| View | Coarse submitted triangles | Runtime submitted triangles | Reduction | Calls, coarse to runtime |
| --- | ---: | ---: | ---: | ---: |
| Arrival | 22,214,055 | 18,474,190 | 16.8% | 614 → 676 |
| First big bounce | 22,839,295 | 13,312,481 | 41.7% | 425 → 462 |
| Near-vertical bounce | 17,647,236 | 11,348,516 | 35.7% | 370 → 407 |
| Lift yard | 29,878,191 | 20,941,882 | 29.9% | 701 → 763 |
| Crane yard | 10,595,138 | 10,595,138 | 0% | 597 → 625 |
| Homecoming | 4,133,231 | 4,133,231 | 0% | 376 → 388 |
| Mirrored arrival | 22,260,666 | 18,599,535 | 16.4% | 613 → 676 |

Measurements use one frozen scene per camera, all full source geometry and
the same lights and shadow passes. Shader/VAO setup is outside timed draws;
`gl.finish()` bounds them. These short samples establish submitted-work savings,
not sustained FPS. Some views pay additional draw calls with no triangle saving.

## Reproduction

Run the compiled preview on port 5484. Use the shared heavy-job lease for browser
checks. `node tools/carlisle-deck-batches.mjs` writes the final report and paired
native images. `--experiment` compares all five cell sizes; `BATCH_OUT` and
`CARLISLE_BASE` override output and server.

The cargo keyboard tool accepts `--no-flight-capture` so screenshot encoding
does not stall its external feedback loop across the apex. The initial capture
run and subsequent input-only run are kept separately in `air-cargo/` and
`air-cargo-final/`. A failed reward collection during the first run is retained
as evidence, not hidden; it cleared the nitro and landed safely.

No generated assets, paid services, Tripo credits, API purchases or publication.
Local test: <http://127.0.0.1:5483/?playtest&level=carlisle-coast&art=harbour>.
