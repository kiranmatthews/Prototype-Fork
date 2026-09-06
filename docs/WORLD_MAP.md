# Island world map

The campaign hub keeps the historical level id `warproom` only for save,
replay, and tooling compatibility. Its runtime is the fixed-rail island map in
`src/worldMap.ts`; it is not a free-movement level.

## Data contract

- `CAMPAIGN_LEVELS` owns stable progress keys, generic island ids, hub poses,
  prerequisites, join rules, finale markers, and time targets.
- `CAMPAIGN_MAP_EDGES` owns graph connectivity, a unique directional input at
  each endpoint, map-only curve guides, and the `trail` or `boardslide` travel
  presentation. Every edge is regression-tested in both directions.
- Each `CAMPAIGN_ISLANDS` entry generates one cohesive, compact landmass. Its
  organic beach outline expands from the island centre to contain every linked
  `CAMPAIGN_LEVELS.mapPosition`; decorative islets and mountain ranges remain
  scenery-authored.
- Normal clears unlock time trial and any newly satisfied outgoing hubs. The
  first island fork is a true join: both branches are required for its finale.
- `CampaignSaveV1.mapFocus` is optional for backward compatibility. New and
  migrated saves remember the last settled hub.
- Finale markers currently reserve and dress the end-of-island hubs. They do
  not claim that their backing courses contain implemented boss combat yet.

## Input and flow

Keyboard, D-pad/stick, and touch direction changes all become one discrete map
step. Quick keyboard and touch down/up pairs are latched even when both events
occur between render frames. Movement is ignored until the current canned
travel finishes. Cross/Enter enters a hub; the map exposes Progress, Options,
Save/Load, and Quit directly.

The desktop map shows the selected-level card and utility menu. The separate
region card, direction hints, arrow buttons and Enter Level panel are omitted;
keyboard/gamepad input and the touch controls still drive navigation and entry.
The launch screen presents “Boolie Roo” directly on its vortex, without a
timber container, tagline or input hint. Map overlays remain hidden throughout
the loading vortex and reappear only beneath the destination reveal.

The map renders the player at three times their ordinary scale. Both animation
overlay snapshots and render interpolation are cleared before entering or
leaving this presentation so the scale cannot carry into gameplay. Hub discs
are 70% of their previous diameter, with route endpoints trimmed to the same
radius. At rest the character turns toward the map camera; the camera orbits
the rear hubs to keep the mountains from obscuring the player. Portrait actions
sit above the touch controls to leave the larger character unobstructed.

Quit Level, Game Over No, and Results Continue pass the originating progress
key back through the shared return helper. The controller seats the character
on that exact hub and persists it as map focus. A first clear announces and
animates newly opened routes; replaying the level does not repeat the
time-trial unlock banner.

## MatrixRex ocean contract

The map uses the same full `CoastWater`/`UnityOcean` owner as the ocean levels:
planar reflection, opaque color/depth prepass, refraction, projected caustics,
intersection foam, two-way normals, Gerstner displacement, specular, shadows,
and horizon fill.

Important map-specific requirements:

- The straight shore is authored from positive X to negative X with seaward
  `-Z`. Reversing that order back-face culls the detailed `FrontSide` ribbon
  and leaves only the flat, double-sided horizon visible.
- Caustics require real opaque scene depth. Every campaign island and offshore
  islet therefore has an outward submerged sand/reef shelf. The broad bright
  plateau is roughly 0.1–0.7 m below sea level, with a deeper outer falloff.
  A densely sampled, gradual seabed slope spreads the turquoise-to-blue
  transition from the broad lagoon across several dozen metres, ending at
  four times the nominal island radius. Caustic scale remains 1.05.
  `terrainHeight` is sampler compatibility only; it does not create a seabed.
- The elevated map camera needs a longer caustic distance range and a lower
  reflection Fresnel exponent than the close gameplay coast. These are
  presentation-scale adjustments on the same shader, not a replacement water
  material.
- `?lite` intentionally disables reflection, prepass, refraction, caustics,
  and intersection. Judge ocean fidelity only in a full-render pass.

## Visual QA

At 16:9, water should occupy roughly a third or more of the frame. Both deep
normal/specular motion and bright moving caustics over the shallow shelves must
be obvious without opening debug tools. The selected character should remain
readable and every hub must clear mountain footprints and have visible terrain
support.

The temporary art direction intentionally separates two reference jobs: the
Crash 1-style read comes from a single broad beach-ringed island mass with an
imposing clustered central peak, while the Crash 4-style navigation read comes
from large luminous green discs and chunky, evenly spaced white route dashes.
Floating number labels and ornamental boss crowns are deliberately omitted so
the marker language stays clean.

The island surface follows the trail elevations with gentle hills and broad
sand gradients. Palms have curved trunks and folded, shaded fronds; tropical
plants, ground leaves and rounded boulders are instanced and placed against the
actual land surface. Rounded bush clusters have been removed. Map lighting
uses a warm front key, cool fill and reduced shadow contrast, and the shared
ocean retains its full passes with quieter surface normals and reflections.

The beach layers the existing MatrixRex sand/pebble color, normal and mask
textures at a 2.7 m repeat, using a vertex mask to exclude the grass. White
shore foam follows the actual sea-level crossing of the island mesh; all six
shorelines share the existing Island Hopper foam renderer in one draw. Raised
path support fades out before the submerged perimeter, and the foam sits just
seaward of that contour so terrain cannot hide sections of the white edge.
The same contour supplies metric beach coordinates to a lapping wetness layer:
the incoming wash darkens the sand and lowers its roughness, then retreats to
a softer residual damp band. Its clock advances only with the map update.
The reusable tropical
plant kit adds five species and Gouraud vertex shading with gentle leaf wind;
see [TROPICAL_PLANTS.md](TROPICAL_PLANTS.md) for the editor and code contracts.

For a diagnostic pass, add `?renderdiag`, enter the map, and inspect the hidden
`#render-diagnostics` payload. Ocean quality must be `full`; reflection and
prepass dimensions and render counts must be non-zero. Also check 844×390 and
390×844 with `?touch`, then finish at 1920×1080 with a clean console.

The bottom menu hints use the user-supplied CCGeekSpeakTweak Bold placeholder
through `--font-secondary`. Their SVG silver gradient face sits over a black
stroke and a solid black extrusion swept in overlapping half-pixel steps back
to the face, without a shared panel or backdrop
blur. Portrait touch uses two readable rows above the controls. The font is
restricted to the current non-commercial, low-traffic staging use; see
[the font notice](../public/fonts/SECONDARY-FONT-NOTICE.md) before release.

Open **TEXT TUNING** at the map's top-left for live size, face weight, outline,
block-shadow X/Y, gradient angle/band position and six color controls. The
fixed Bold font's weight is adjusted geometrically, not via a nonexistent
variable-font axis. Size is a responsive 1080p reference. Settings persist at
`solProtoSecondaryText.v1`; Reset restores source defaults, and Copy settings
exports JSON (with a selectable fallback if clipboard access is unavailable).
The panel stops control keystrokes from navigating the map and remains local
to this browser; it does not silently change shipped defaults.
