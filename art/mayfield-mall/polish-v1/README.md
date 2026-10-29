# Mayfield Mall — polish concept atlas

Forty screenshot-based ImageGen paintovers for the next environment polish
pass. Open [the comparison gallery](index.html) to browse the whole route,
filter by area, and switch between the captured level and its concept. Click
an image for the full-size viewer; arrow keys change views and Space compares
source/concept. The gallery also works directly from disk without a server.

The brief combines the sunny Southern California teenage hangout atmosphere
of Disney’s *The Weekenders* with the sculpted forms, material detail and
expressive environment art of *Crash Bandicoot 4: It’s About Time*. These are
art direction references for the existing playable level. Game geometry,
collision, controls and materials have not been changed in this iteration.

## Coverage

| Views | Area | Geometry and landmarks to preserve |
| --- | --- | --- |
| 01–08 | Upper Mall | Monumental galleria, diagonal supports, fountain, folded sculpture, mezzanines, escalator descent and car display |
| 09–14 | School wing | Food court threshold, gym, basketball floor, banks, courtyard and blue canopy descent |
| 15–17 | Crossrail arcade | Angled crossrails, broad promenade, Side Quest portal and bonus entrance |
| 18 | After Hours bonus | Full bonus room, prize platforms, switch bridge and retained Mall backdrop |
| 19–25 | Warehouse wing | Loading portal, roll-in, halfpipe, rail/kicker island, suspended room, taxi and crates |
| 26–34 | Kona recreation courts | Spinal grooves, timber vert, snake-head kiosk, winding banked snake run and atrium connection |
| 35–39 | Grand atrium | Large angled planes, descending lanes, crossing, changing levels and lower promenade |
| 40 | Exit court | Final mall approach, crystal and finish court |

## Art direction for implementation

- Keep the real source assemblies as the architectural foundation. Preserve
  the Mall’s unusually large spaces, steep changes in elevation, diagonal
  supports, overhangs and long sightlines. Do not flatten the route into a
  generic shopping corridor.
- Use cream terrazzo and warm tile, coral and mauve wall panels, teal accents,
  brass/chrome rails and chunky retro lettering. Retain blue canopy and water
  accents, dark retail grilles, the car display and the industrial loading wing.
- Add shaped bevels, purposeful material transitions, substantial shopfronts,
  readable trim, planted courts and sculpted foliage. Use detail to frame the
  playable lane and landmarks; keep jumps, rails and platform edges legible.
- Carry the same materials through all four source families while preserving
  each area’s construction: Mall concrete and tile, School timber and canopy,
  Warehouse steel and loading props, Kona timber vert and concrete banks.

Generated background buildings, balconies, planting, lights and rail caps are
proposals. Check headroom, sightlines, landing space and collision when modeling
them. Paintovers are not replacement collision specifications: the captured
level remains the authority for route topology, dimensions and movement.
In particular, view 39 suggests steps at the distant approach; preserve the
current traversable slope there. Redraw text consistently during implementation.
Incidental people in the bonus paintover are background illustration, not a
requirement for characters or crowds.

## Source and provenance

- Captured source: `8aae8ceabc5708476e226f6b7b878a75d619cf94`.
- Build: `Codex/sol fork`, 29 October 2026, 05:00 UTC.
- Forty clean 1920 × 1080 captures from the actual full-render game at MAX/native
  resolution, with CRT/HUD/player hidden for architectural review.
- The captured main level was checked against the source-owned level data;
  capture runs recorded no browser errors. View 18 loads `bonus-mayfield-mall`.
- Every concept used the corresponding screenshot as its first reference.
  After view 01, its finished concept was also supplied as the shared style
  reference. Generation used the built-in ImageGen tool, without an external
  API key, command-line image generator or raster compositing.
- [manifest.json](manifest.json) preserves each final camera, target, field of
  view and source/concept path. [prompts.json](prompts.json) preserves all forty
  exact prompts, inputs and tool output paths.
- Original captures are in `screenshots/`; selected generated images are in
  `concepts/`. Full-resolution PNGs are retained. These authoring files live
  outside `public/` and do not increase the playable Pages download.

## Reproduction and review

The capture script is `tools/capture-mayfield-polish.mjs`. It expects a built
preview at `http://127.0.0.1:5278/`; override with `MAYFIELD_POLISH_URL`.
`PLAYWRIGHT_MODULE` can point to a local Playwright `index.mjs`. Use `--only=18`
or a comma-separated view list for a selected recapture. Capture into a new
revision when the level changes, to preserve these source/concept pairs.

Run `node tools/mayfield-polish-gallery.mjs` to rebuild the standalone gallery
from the manifest and generation records. This does not regenerate images.
The final [validation record](validation.json) records file hashes, decoded
image sizes and browser checks for the complete gallery.

To repeat the gallery checks, serve this directory with a local HTTP server
and run `node tools/check-mayfield-polish.mjs`. Its default gallery URL is
`http://127.0.0.1:5279/`; override with `MAYFIELD_GALLERY_URL`. The check decodes
all eighty PNGs and exercises the gallery in Chrome, including offline loading.
