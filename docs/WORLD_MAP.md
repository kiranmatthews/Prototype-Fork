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

Keyboard and physical D-pad/stick directions become one discrete map step.
Quick keyboard down/up pairs are latched even between render frames. Cross/Enter
enters a hub; the map exposes Progress, Options, Save/Load, and Quit directly.

Touch uses the map itself, not an emulated controller. Gameplay D-pad, face
buttons, look surface and pause button are hidden on the map and restored in
levels. Their held/pending input is cleared at the boundary. Tap an unlocked
green hub to follow the shortest connected unlocked route to it, or tap in a
neighbour's projected screen direction to travel toward an off-screen hub or
island. Camera projection, not keyboard direction slots, owns touch direction.
Locked hubs consume the tap without redirecting it. Drags, long holds and
multi-touch gestures do not navigate. Travel keeps the existing walking and
boardslide presentation; new navigation waits until it finishes.

Touch utility actions are directly tappable text without controller-symbol or
keyboard hints when no hardware controller is active. A Play button on the selected-level card enters the level only when
settled and unlocked. Menu sections remain accessible during travel and pause
it normally. Tapping a hub never auto-enters its level.

The desktop map shows the selected-level card and utility menu. The separate
region card, direction hints, arrow buttons and Enter Level panel are omitted;
keyboard/gamepad input continues to drive navigation and entry unchanged.
The launch screen presents “Boolie Roo” directly on its vortex, without a
timber container, tagline or input hint. Map overlays remain hidden throughout
the loading vortex and reappear only beneath the destination reveal.

### Skateboard level card and trial records

The selected level is printed on a real 3D skateboard at the upper left.
`MapLevelPresentation` reuses the game's procedural deck, plywood, grip,
underside artwork, trucks and wheels with a menu-only wider deck profile.
Changing hubs performs a 0.64-second kickflip; name/reward data swaps halfway
through while the grip is facing away. Repeated progress refreshes do not
restart the animation, and later selections queue without exposing wrong text.

Four screen-printed sockets show crystal, box gem, combo gem and time relic.
Uncollected slots use dark flat silhouettes. Collected slots use
`Level.crystalMesh`, `Level.gemMesh` (including the green combo tint), and
`Level.timeRelicMesh`, with world halo sprites removed and continuous idle
rotation. No reward models have been restored to the level hubs themselves.

Only cleared levels show the right-side race card: three personal bests and
the level's authored relic target, labelled Time to Beat. Empty records are
dashes, never invented zero times. Optional `CampaignLevelProgress.trialTimes`
stores the fastest three completed trial times; old saves seed one record from
`bestTime`. Save/load, autosave and discard preserve independent array snapshots.
The card is informational; normal level entry and the in-level trial-start
mechanism are unchanged.

Both pieces render through the existing WebGL renderer before CRT, alongside
the existing Canvas/DOM interface seam; lite/direct rendering uses the same
3D objects. There is no second renderer or animation loop. Canvas printing is
uploaded only on data/font changes. Semantic DOM retains level/reward/record
descriptions, responsive safe-area anchors and the 48px-high touch Play button.
Modal and loading screens suppress the presentation; map return snaps to the
correct hub before the reveal. Portrait places the trial card below the deck,
on the right, without changing map navigation or utility controls.

All four map utilities (Progress, Options, Save/Load and Quit) have a fixed,
safe-area 48px close X. It uses the existing Back/cancel route: closing Quit
never quits the game, and closing a save/load confirmation does not perform
the operation. Touch map panels are native vertical scroll surfaces, including
their blank gutters, with no vertically centred overflowing content. Opening
another panel resets scroll to the top. Scroll events invalidate the cached
pre-CRT menu, and the X has its own matching Canvas rendering so it stays
visible and usable while the filtered content scrolls underneath it. Desktop
menu layout and gameplay touch controls are unchanged.

Map utilities keep the ocean, plants, shoreline wetness, waterfalls and hub
effects animating behind the panel. This advances only the map's scenic runtime
and water presentation; map navigation, travel progress, player simulation and
gameplay clocks remain blocked. The menu still reuses its cached pre-CRT ink.
Ordinary in-level pause screens retain their frozen-world behavior.

The map renders the player at three times their ordinary scale. Both animation
overlay snapshots and render interpolation are cleared before entering or
leaving this presentation so the scale cannot carry into gameplay. Hub discs
are 70% of their previous diameter, with route endpoints trimmed to the same
radius. At rest the character turns toward the map camera; the camera orbits
the rear hubs to keep the mountains from obscuring the player. Portrait touch
actions occupy two rows at the bottom, with no virtual-controller clearance gap.

Hubs have no miniature collectible models or 3D padlocks. Locked hubs keep
their muted colour and navigation guard; collectibles remain in the selected
level's UI card. The map omits both the colourful shallow-water reef props and
the orange/blue bird-of-paradise blooms that resembled fish, while keeping the
foliage and reusable level assets.

Open **TUNER → WATER → Map Ocean** for map-only shader sliders; **In-Level Ocean**
has an independent profile. See [OCEAN_TUNING.md](OCEAN_TUNING.md).

Quit Level, Game Over No, and Results Continue pass the originating progress
key back through the shared return helper. The controller seats the character
on that exact hub and persists it as map focus. A first clear animates newly
opened routes without a text popup. Gameplay checkpoint, collectible, run-mode
and trick-gate events have no stock announcement banners; specific messaging
is left to authored presentation. Normal HUD and results displays remain.

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
blur. Portrait touch uses two readable rows at the bottom. The font is
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

Text Tuning is developer chrome: it is map-only and follows **M**, including
when its summary/button has focus. Editing an input retains the shared M-key
typing guard. It is excluded from CRT composition, like the other debug tools.
The map's actual level card, labels, utilities and enter arrow
are composited before CRT; their semantic DOM remains in place for hit testing.

Map action symbols are resolved by the [shared input-prompt system](INPUT_PROMPTS.md),
not separate controller/keyboard labels. Connecting a controller switches the
entire row to its family; disconnecting restores keyboard-only prompts (or the
touch map's direct text buttons). Options → Prompt Style handles generic device
IDs without changing any action binding.
