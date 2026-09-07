# Separate ocean tuning profiles

Press **M** if debug tools are hidden, then open **TUNER → WATER**. The existing
`#waterstudio` URL shortcut remains available.

- **Map Ocean** edits only the island-map ocean.
- **In-Level Ocean** edits oceans in playable levels.

Both tabs expose colour/depth, caustics, reflection, normals/specular,
refraction, both Gerstner wave sets and ocean intersection/shoreline parameters.
The **Map Island White Outline** section appears only in the Map Ocean tab.
It controls the separate white beach accent: enabled, opacity, width multiplier,
shore offset (metres), edge falloff, pulse speed/amount and detail frequency.
Width multiplies a common **0.8 m world-space strip** on every map island,
including offshore islets. It no longer scales down with island radius. Offset
zero preserves the authored placement; positive values move it seaward. Island land geometry and
wet-sand geometry are not retuned by this panel. In-level shoreline accents keep
their original source settings.

The selected tab says whether it is live. An inactive tab can be edited and
saved without touching the ocean on screen; visit its matching context to
preview it. Entering a different context selects the appropriate tab. Copy JSON
includes the context name, and **Reset this ocean** resets only that profile.
Map JSON also includes an `outline` object, and map reset restores both the
ocean and its outline. Resetting the in-level profile never changes the outline.

`solProtoOceanTuning.v2` stores sparse, independent parameter and debug overrides.
They apply during ordinary ocean setup/update, even with the panel closed or
after a reload. Untouched fields retain each ocean's authored values. Map
defaults come from `createMapOceanDefaults()`; opening the panel does not apply
the level preset to the map. Reset restores the current instance's authored
baseline, not whichever values happen to be visible in the other tab.
The current map baseline is the owner's complete September 7 ocean preset,
including caustic scale 0.64/strength 0.32 and reflection strength 3. Existing
personal overrides are preserved; use Map Ocean → Reset this ocean to discard
them and adopt the new baseline in full.

The current outline preset is enabled, opacity 1, width 2.9, offset -1.04 m,
edge falloff 1.97, pulse speed 0.247, pulse amount 0.665 and detail frequency 0.
Its full strip is 2.32 m wide. Previously the islets used a 0.42 m base, so
this inward offset buried their brightness peak under the sand while the main
islands retained a broad visible edge. The common base matches the mean of
the two main-island widths; with this preset its peak lies 0.28 m seaward of
the traced coastline. Island terrain and in-level shoreline geometry are unchanged.

Outline overrides share the map profile's persistence and apply with the tuner
closed. Width/offset rebuild only the existing strip's positions on edit, from
an immutable original coastline; reset does not accumulate geometry drift.
The outline draws after water (order 1), then translucent boardslide rails,
their underlays/glow and supports draw at order 2. Depth tests remain enabled,
so solid scenery still occludes them correctly.

An old Unity Ocean Studio V1 draft is read only into the in-level profile.
It never seeds map settings. A V2 reset prevents that old draft from returning.
Malformed/non-finite values are ignored, and blocked storage leaves live editing
available with a Copy JSON warning. Debug chrome stays outside CRT and follows M.

Validation: `tools/test-ocean-tuning.mjs` covers isolation, sparse inheritance,
debug flags, reload, reset, migration, storage failure, exact supplied defaults
and outline geometry/material/reset behaviour. Browser QA covers desktop,
touch and lite, CRT, inactive-tab edits, Copy JSON, M and closed-panel persistence.
Map geometry tests compare the strip width on all islands and ray-test its
bright midpoint as well as its outer edge against the actual terrain.
The rail review also checks actual render submission order from an overview.
