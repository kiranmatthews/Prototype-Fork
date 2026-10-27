# Motu Beach — lighting and closed skate structures

Validated third increment above published source commit
`58ec2000f65376eb371031841b24c8de39e8c7d1`. The release coordinator owns
integration and publication.

The park now has 85 complete palms and 1,351 spectators in eight stands facing
all four sides. Five additional native rails create west/east promenade lines,
a southern flatbar, a palm crescent and a kinked surf-side line. The southern
flatbar was moved clear of the central perimeter run-up after a native check.

Daylight, sunset and moonlight have coordinated sky, fog, real key lighting,
visible sun/moon and ocean colour. Two cached 1774 × 519 variants retain the
complete existing coastal cloud painting and its projection; the visible sky
and ocean horizon use the same texture. Moonlight adds stars and a cratered
moon. Four fixed warm floodlights reuse their light objects and add no shadow
maps. Level-authored bloom retains the existing allocation cap and restores the
latest user preferences when leaving Motu; it never writes to saved settings.

The latest request closes exposed ramp construction. Eight fitted panels close
the ends of the halfpipe, wave wall and two banked channels. The street ramps
are closed wedges with unchanged top planes. The elevated roll-in and return
route use the original indexed riding ribbons with their bodies extended down
to the apron. An outer skin closes the loop's thickness, preserving the open
centre and its native inside riding surface. The four obstacle-name billboards
and their support posts are removed. Venue, kiosk and sponsor art remain.

All changes are source-owned by `jungle-cup`; `public/levels.json` and movement
tuning are unchanged. Complete Meshy assets and crowd geometry remain at every
viewing distance. No new external assets were downloaded.

## Validation and reproduction

Native checks pass 21,412 nondegenerate authored mesh triangles, watertight
raised ribbon topology, 952 fitted end-panel points and 424 swept side contacts
across all eight ends, including the low channels. The loop still completes
from rest in 295 frames, reaches 8.399 metres and exits safely; the curved return
climbs all four waypoints in 227 frames. The wave wall returns an air to ground.

All 3,060 floor probes, 1,351 spectator supports, original skating routes,
competition recovery and editor round trips pass. Layout checks include four
pocket airs and 38 rail catches. The skating regression passes 24 vert returns,
24 terminal contacts, 3,117 replay frames, 19,200 stress frames and camera
framing at 30/60/120 Hz. Lighting checks cycle all heats 36 times without new
scene objects, restore ocean editor colours, reuse and dispose sky variants,
restore current bloom preferences and catch all five new rails.

All twenty required level checks, TypeScript/build and hosting-size checks
pass. The package contains 1,838 files and 999,497,633 bytes, with offline version
`df99459ba0c2e8f07ffc`. The coordinator rechecks the combined release budget.
No `check:all` run was requested or performed.

Eight real Player rides pass in both full and lightweight browser rendering.
Final views cover closed ramp/pipe construction and all three heats. Native/MAX
review used 1920 × 1080 scene input and 3840 × 2160 output; normal presentation
used 1280 × 720. The full-resolution sky and ocean horizon share the same
texture UUID in every heat. Bloom remains capped at 11,046,720 bytes at MAX and
4,910,080 bytes at normal resolution. The packaged game starts Run 1, accepts
keyboard skating, advances its timer and retains supported movement. All
captured warning/error logs are empty.

- [Closed halfpipe ends, with individual feature labels removed](closed-halfpipe-native.png)
- [Closed loop shell](closed-loop-native.png)
- [Closed channel ends](closed-channel-native.png)
- [Daylight and filled timber ramp bodies](daylight-native.png)
- [Sunset](sunset-native.png)
- [Moonlight with warm floodlights](moonlight-normal.png)
- [Native structure and routes](structure-and-routes.json)
- [Original routes, support, recovery and reconstruction](native-validation.json)
- [Lighting, sky/ocean and bloom lifecycle](lighting-lifecycle.json)
- [Full browser rides](full-rides.json) and [lightweight browser rides](lite-rides.json)
- [Packaged-game keyboard skating](production-play.png)
- [Final verification and source fingerprints](verification.json)

Reproduce the focused checks through the shared heavy-job guard:

```sh
node tools/test-motu-festival.mjs
node tools/test-motu-beach.mjs
node tools/test-motu-lighting.mjs
node tools/test-jungle-cup-layout.mjs
node tools/test-jungle-cup-skating.mjs
node --run check:levels
node --run build
node --run check:release
```

The local-only review page is
`/tools/motu-beach-review.html?playtest&level=jungle-cup`; add `&lite` for the fast
pass. It provides actual competition heat controls, native/MAX and normal
resolution, eight automated rides through the real Player, close construction
views and a report of lighting, sky/ocean texture identity, full asset counts
and post-processing allocation. Production play starts at
`/?playtest&level=jungle-cup`.

Shared hooks are limited to `src/main.ts`, `src/level.ts`, `src/coastpost.ts`,
`src/unityBloom.ts` and the optional ocean light-direction setter in
`src/unityOcean.ts`. `src/skyProjection.ts` is unchanged. The release coordinator
owns integration and publication; this ongoing polish goal remains active.

The lighting goal began at 08:13:44 UTC; its first native playable check was
approximately fourteen minutes later. The enclosure follow-up was authored in
approximately twelve minutes and reached final native playable validation at
09:30:56 UTC, about 46 minutes after the request. That elapsed interval includes
an explicitly recorded idle capacity wait from 09:14:58 to 09:30:45 UTC; it is
not all authoring time. The consolidated final validation lease ran from
09:30:45 to 09:43:07 UTC. The task-owned renderer and both preview servers are
closed and the lease is released.
