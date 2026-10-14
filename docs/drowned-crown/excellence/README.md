# Drowned Crown visual rebuild

The current iteration replaces the repeating cave-wall skin with existing original-UV sculpted cave assets, adds a warm-harbour/cool-cave/warm-cabin lighting profile, groups harbour cargo beneath red sailcloth, and reshapes the dock landings, mine fork and moonpool pier. The vault has a rounded terrace with physical support taken from its visible surface.

The native 4K review exposed fragmented model reduction, an obstructed grotto camera and hull flanges across the afterdeck. The source meshes are now welded before reduction while retaining per-corner UVs; the upper decks have real clearances, and the grotto entrance and bridge landing are clear. No new provider jobs were used for these repairs.

## Review

[The gallery](https://kiranmatthews.github.io/Prototype-Fork/drowned-crown/storyboard/index.html) contains 13 current player views beside 13 storyboards and six original comparisons. Current views render at **3840 × 2160 with the game’s Max setting**. Both the world input and output buffers are verified; these are not enlarged 720p renders. Click a gallery image for its full-size image. Lossless originals and per-view buffer evidence are in [final](../final).

The artwork is labelled separately from gameplay. All current captures use the actual follow camera with a supported player. The retained unique player-view total remains twenty, including one earlier repair capture outside the gallery.

## Validation and cost

[release-validation.json](release-validation.json) records the checks. A continuous full-render Chrome run at native 4K reached the finish in 8,690 simulation steps with six checkpoints, zero deaths, unchanged movement tuning and no console errors. The optional grotto, captain’s stash and powder-room crystal also pass actual browser input checks. Focused level checks, atmosphere isolation, plank geometry, asset topology and the production build pass. The full suite was not run.

The visual-excellence goal remains active: cavern staging, lower hold lining and interior lighting still need refinement. Passing traversal is not a claim of storyboard parity.

**105 of the approved 400 additional Meshy credits have been used; 295 remain unused.** No jobs are in flight. The [production record](../../../tools/drowned-crown/excellence/README.md) retains task IDs, exact prompts, sources and budgets.
