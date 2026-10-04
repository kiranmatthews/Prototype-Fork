# Splat Valley · Image Blaster scenery demo

Image Blaster's static `.spz` environments work as browser-game scenery with
real camera parallax. The Gaussian scene supplies the appearance; ordinary
authored platforms, ramps, rails and pits supply all gameplay collision.
The splat is never registered as ground, a wall, an enemy or a hazard.
Its lighting is baked into its colors, so ordinary game lights do not relight it.

Splat Valley is immediately available in **Island 1 → Level Select**, and via
`/?playtest&level=splat-valley`. It has a 142 m bridge course, two 3 m river
gaps, two climbs, an optional 18 m grind, two checkpoint crates and a finish
gate. The new map branch sits below Treehouse Trail. Existing campaign indices
are retained. Movement tuning is unchanged.

## Source and import

The demo uses **World Labs' public Spark valley sample**, obtained using Image
Blaster's actual local-asset importer. This is an existing demonstration world,
not a newly generated image-to-world result. No generation request was made.
Image Blaster's repository contains its authoring workflow and viewer, but no
bundled sample worlds. New environments require a World Labs account/API key;
neither the game nor its published assets contain provider credentials.

Sources:

- [Image Blaster](https://github.com/neilsonnn/image-blaster), inspected at
  `4acb43ba126a12358f71838d1b1a05e856b10eaf`.
- [Official World Labs sample listing](https://github.com/sparkjsdev/spark/blob/main/examples/assets.json)
  and [valley SPZ](https://sparkjs.dev/assets/splats/valley.spz).
- [GaussianSplats3D](https://github.com/mkkellogg/GaussianSplats3D), pinned at
  `0.4.7`, MIT. Its peer range supports the game's existing Three.js `0.166.1`.

The upstream importer invocation was:

```sh
node .claude/scripts/project/ensure-local-assets.mjs \
  --from worlds/splat-valley/output/world/0-world.json
```

The input metadata used the official sample URL in
`assets.splats.spz_urls["500k"]`. The original file contains 500,000 splats.
Source hashes, downloaded-file provenance and variant hashes are recorded in
`public/splat-scenery/provenance.json`; renderer/Image Blaster notices are
stored alongside it. The existing sample retains its World Labs attribution.

To replace the scenery with a generated Image Blaster world, use its downloaded
SPZ v2/v3 export and recreate the two local budgeted files:

```sh
python3 tools/import-splat-scenery.py /path/to/world.spz \
  public/splat-scenery/valley-250k.spz --budget 250000
python3 tools/import-splat-scenery.py /path/to/world.spz \
  public/splat-scenery/valley-150k.spz --budget 150000
```

Then update provenance and fit the `splatScenery` position, uniform scale and
yaw in `src/levels/splat-valley.ts`. The renderer flips World Labs' Y-down frame
about X before applying the authored Y-up yaw. Recheck the course from several
camera positions: generated worlds have a useful viewing region, and scenery
can visually overlap gameplay even when it has no collision.

## Runtime

The splat library is loaded only for levels declaring `splatScenery`.
Desktop uses the 250k asset (3.37 MiB); touch/coarse-pointer and `?lite` use
150k (2.06 MiB). Alpha filtering leaves 241,304/144,816 rendered splats.
The asset reducer retains all Gaussian attributes and slightly enlarges
retained splats to preserve coverage.

The scene respects ordinary mesh depth, renders inside the game's full
postprocessing/CRT pipeline, and uses the active render-target viewport for
projection. Native painted sky mist is hidden for splat levels because it
otherwise overlays the depthless splat background. Full float covariances
avoid overflow on distant, scaled scenery. CPU sorting uses an ordinary
worker, so GitHub Pages does not need SharedArrayBuffer isolation headers.
Assets and workers are released when the level is disposed, including pending
loads. Missing scenery falls back to the supported authored course/backdrop.

Only the allowlisted local `valley` preset and bounded finite transforms pass
the editor/parser boundary. Capture/export retains the scenery metadata.
The offline manifest includes `.spz` assets. API/provider URLs are provenance
only; the running game loads local assets from its own origin.

## Verification

- `npm run check:levels`, `npm run build`, renderer regressions, existing
  campaign/Level Select checks and offline cache checks.
- `node tools/test-splat-valley.mjs`: parser bounds, local/offline SPZ headers,
  real-controller source-to-finish route, both climbs/jumps/checkpoints.
- `node tools/splat-valley-browser.mjs <base-url>` and `--full`: same route in
  Chrome with the actual rendered character and both scenery variants.
- `node tools/splat-valley-extra-browser.mjs <base-url>`: wall contact, actual
  pit death and checkpoint respawn, optional rail, collision exclusion,
  scenery disposal and a full-render 390×844 DPR3 touch profile.

The complete browser route takes 2,075 fixed steps / 34.58 s, finishes with no
deaths and no console errors. The optional rail run has 120 grinding frames
and returns to supported ground. The Level Select preview is captured from
the actual game/scenery scene. The full suite remains opt-in.
