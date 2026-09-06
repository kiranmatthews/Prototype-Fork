# Separate ocean tuning profiles

Press **M** if debug tools are hidden, then open **TUNER → WATER**. The existing
`#waterstudio` URL shortcut remains available.

- **Map Ocean** edits only the island-map ocean.
- **In-Level Ocean** edits oceans in playable levels.

Both tabs expose colour/depth, caustics, reflection, normals/specular,
refraction, both Gerstner wave sets and ocean intersection/shoreline parameters.
These are shader controls; island geometry, separate shoreline accents and
wet-sand geometry are not retuned by the panel.

The selected tab says whether it is live. An inactive tab can be edited and
saved without touching the ocean on screen; visit its matching context to
preview it. Entering a different context selects the appropriate tab. Copy JSON
includes the context name, and **Reset this ocean** resets only that profile.

`solProtoOceanTuning.v2` stores sparse, independent parameter and debug overrides.
They apply during ordinary ocean setup/update, even with the panel closed or
after a reload. Untouched fields retain each ocean's authored values. Map
defaults come from `createMapOceanDefaults()`; opening the panel does not apply
the level preset to the map. Reset restores the current instance's authored
baseline, not whichever values happen to be visible in the other tab.

An old Unity Ocean Studio V1 draft is read only into the in-level profile.
It never seeds map settings. A V2 reset prevents that old draft from returning.
Malformed/non-finite values are ignored, and blocked storage leaves live editing
available with a Copy JSON warning. Debug chrome stays outside CRT and follows M.

Validation: `tools/test-ocean-tuning.mjs` covers isolation, sparse inheritance,
debug flags, reload, reset, migration and storage failure. Browser QA uses the
map and The Descent, including inactive-tab edits and closed-panel persistence.
