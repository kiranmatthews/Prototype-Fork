# Carlisle rotating beacons

Four complete existing lighthouse models now have independently rotating
lantern glow and soft copper haze over their seaward sectors. The lens glow
uses the painted window glass and its measured height band. The volume
integrates through a tapered beam; it does not use a camera-facing triangle.
The landward sector fades out smoothly. No new collision, movement, camera,
level data, point lights, shadow maps, asset downloads or paid generation.

The original 5,180-triangle GLB and all four fitting transforms are unchanged.
The four light volumes add 512 triangles in total, with no distance mesh swap.
Cached asset materials are not modified by a level-specific clock; scoped
material clones share the original textures and are disposed on exit.

`compiled/browser.json` records all four beacons, several rotation phases,
1,056 cycle samples per beacon, native views, normal presentation and
main/bonus/main reload. No active sample faces the landward sector. The bonus
keeps all four boats and adds no beacons. Console errors zero. These are
bounded visual checks, not a sustained performance or full-course claim.

The original native close/overview views are in `before/`; the final compiled
views are in `compiled/`. The first haze opacity was too faint; diagnostics
confirmed the volume was rendering before opacity was adjusted. Intermediate
process captures are retained outside the repository in
`/tmp/carlisle-beacon-lighting-process-20261030/`.

The final build also includes the user-requested animation/camera merge.
Its focused checks and source-preservation proof are recorded separately in
`docs/carlisle-relay/launch-integration/`. Publication remains held.
