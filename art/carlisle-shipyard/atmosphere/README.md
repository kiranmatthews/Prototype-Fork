# Carlisle visible blue-hour sky

Local visual increment following `4a55ba93818ec4d99f81e1e1108ead2d60aa899a`.
The earlier Carlisle-specific sky was a 4.5km-radius sphere. The main play lens
has an authored 850m far plane, and the bonus uses 450m, so the sphere was clipped
and players saw the flat fog clear colour. An isolated magenta-clear probe
confirmed 100% missing sky at 300m and 850m; it only became visible at 6km.

The backdrop now reconstructs angular rays from the active rendering camera on
a full-screen background. It uses that pass's rotation and projection terms,
including off-centre and reflected cameras. Camera position and far distance
cannot move or clip it. The real gameplay lens remains unchanged. This replaces
the background's rendering method, not any authored prop geometry or LOD.

Two unequal cloud layers drift slowly over dark navy, with a restrained copper
afterglow, a cool small moon and sparse filtered stars. The horizon blends into
the existing scenery fog colour after colour conversion. The water evaluates
the same clouds, afterglow and moon direction; its rough surface averages tiny
stars. Existing orange lantern paths remain in place. No yellow daylight wash,
new lights, generated assets, generation-credit spend or movement changes.

The first lite render exposed a thin broken line at the horizon: pixel
derivatives for filtered stars crossed an early-return branch. Derivatives now
use a finite coordinate field on both sides of the horizon. The review checks
every pixel for a black seam, as well as uncovered clear colour.

## Evidence

`before/` contains the prior compiled build, including the clipping probes and
actual 850m harbour cameras. Its initial diagnostic statistics sampled at
320×180; the final review measures every native output pixel.
`after/` contains the final compiled native views, camera probes, boat bonus,
normal 480p/CRT, and a browser report. `validation.json` records exact protected
source hashes and completed checks.

The review proves identical sky pixels at 300m, 850m and 6km view distances and
after a large camera translation. Rotation and off-centre projection change the
view as expected. Each pass receives its own camera matrix. The same fixed
42-second cloud/water phase is used for gameplay comparison captures; a second
162-second sky capture verifies cloud drift. Native movers remain live.

Reproduce through the shared heavy-job lease:

```sh
CARLISLE_BASE=http://127.0.0.1:5484 node tools/carlisle-atmosphere-review.mjs
```

Use `--lite` for the fast shader check, `--baseline` for the previous build,
and `ATMOS_OUT` to keep exploratory results separate. Required production build
and original course/asset fingerprint checks accompany the browser review.
No source level data changed; no repeated level audit or full suite is needed.
Publication remains held for local playtest rounds.
