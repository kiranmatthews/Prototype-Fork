# Drowned Crown visual rebuild

The current candidate includes a new textured limestone headland, sculpted cavern walls and a fitted royal galleon hull. The curved Port Royal boardwalk joins the mine, wreck and vault through the original playable route. Fort placements are measured across their footprints; the mine, grotto and ship hatches have real openings. Rock and timber foundations extend beneath the tide, the cargo deck fits inside the hull, and the shared soft light-shaft material replaces the hard translucent strips.

## Review

[The gallery](https://kiranmatthews.github.io/Prototype-Fork/drowned-crown/storyboard/index.html) presents **13 current player views** beside all **13 storyboards**, with six original comparisons. It opens on actual gameplay images. The PNGs are in [final](../final); the earlier repair view brings the retained unique player-view total to twenty. Seven superseded originals remain recoverable from Git commit `f7b5c099`.

The artwork is labelled separately from the game captures. Every current view uses the actual follow camera with a supported player; no free camera or image repaint is presented as gameplay.

## Validation and cost

[release-validation.json](release-validation.json) records the current checks. The complete full-render Chrome run reached the gate in 8,668 simulation steps with six checkpoints, zero deaths, unchanged movement tuning and no console errors. Lite-mode spawn, pit/checkpoint respawns and solid-mast collision passed. Real browser runs also entered and returned from the crystal grotto, collected the powder-room crystal, and reached the captain’s stash. The focused level checks and production build passed; the full test suite was not run.

**105 of the approved 400 additional Meshy credits were used.** One 15-credit draft failed the art check; three 30-credit Meshy 7 models were accepted after local reduction and fitting. No more jobs are running. The [production record](../../../tools/drowned-crown/excellence/README.md) links the saved models, reference images, exact built-in imagegen prompts and credit ledger.

Deployment verification will be added to the release report after integration with current main.
