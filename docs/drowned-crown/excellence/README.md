# Drowned Crown visual rebuild

The current iteration replaces the repeating cave-wall skin with existing original-UV sculpted cave assets, adds a warm-harbour/cool-cave/warm-cabin lighting profile, groups harbour cargo beneath red sailcloth, and reshapes the dock landings, mine fork and moonpool pier. The vault has a rounded terrace with physical support taken from its visible surface.

The native 4K review exposed fragmented model reduction, an obstructed grotto camera and hull flanges across the afterdeck. The source meshes are now welded before reduction while retaining per-corner UVs; the upper decks have real clearances, and the grotto entrance and bridge landing are clear. No new provider jobs were used for these repairs.

The latest staging pass extends the inner hull below the hold floor, replaces its broad open port strip with a measured powder doorway, and groups supplies beneath suspended red sailcloth. A bounded warm hold profile separates that interior from the cool cave. Broad original-proportion rock shelves replace the stretched cavern/vault walls. The grotto has its own supported rock shelf and lit cache, and a timber landing joins the escape bridge to the vault. Bridge cables now follow the actual deck normal and have supported anchor posts.

The storyboard set was redrawn with built-in Imagegen in the pirate-environment style of **Crash Bandicoot 4**. All thirteen scenes use player cameras as composition references, with shared style anchors for the harbour and galleon. The user replaced the ocean exit with an enclosed treasury: the level now has a sculpted back wall, grouped hoards and original-UV coin spills; the bridge and vault storyboards reflect that decision. The final thirteen native outputs are 1672 × 941, inspected at their original resolution without upscaling. Exact prompts, reference roles, input/output hashes and the two superseded ending drafts are recorded in [crash4-storyboard-prompts.json](../../../tools/drowned-crown/crash4-storyboard-prompts.json).

## Review

[The gallery](https://kiranmatthews.github.io/Prototype-Fork/drowned-crown/storyboard/index.html) contains 13 current player views beside 13 storyboards and six original comparisons. Current views render at **3840 × 2160 with the game’s Max setting**. Both the world input and output buffers are verified; these are not enlarged 720p renders. Click a gallery image for its full-size image. Lossless originals and per-view buffer evidence are in [final](../final).

The artwork is labelled separately from gameplay. All current captures use the actual follow camera with a supported player. The retained unique player-view total remains twenty, including one earlier repair capture outside the gallery.

## Validation and cost

[release-validation.json](release-validation.json) records the checks. The enclosed-treasury full-render Chrome run at native 4K reached the finish in 8,687 simulation steps with six checkpoints, zero deaths, unchanged movement tuning and no console errors. The optional grotto, captain’s stash and powder-room crystal also pass actual browser input checks. Focused level checks, atmosphere isolation, plank geometry, asset topology and the production build pass. The full suite was not run.

The visual-excellence goal remains active: selected roof openings, light-shaft placement and upper-deck/quay dressing still need refinement. Passing traversal is not a claim of storyboard parity.

**165 of the approved 400 additional Meshy credits have been used; 235 remain unused.** No jobs are in flight. The [production record](../../../tools/drowned-crown/excellence/README.md) retains task IDs, exact prompts, sources and budgets.

The next cavern pass uses a new sculpted rock kit matched to the Crash 4 storyboard, a higher continuous ceiling, real round skylights and brighter cool ambient light with warm reflected fill. The same original-UV rock appears in the grotto, bridge and treasury. The harbour and the authored movement model retain their earlier behavior. The ship's older materials and the remaining close mine surfaces still need work toward the new visual target.
