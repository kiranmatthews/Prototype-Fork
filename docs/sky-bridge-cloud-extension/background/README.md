# Restore Sky Bridge's original background

29 October 2026. The cloud-platform addition accidentally activated Skystream's
blue lower-sky tint and sun/flare in Sky Bridge. `applyTheme` enabled that
treatment whenever it found a cloud-road collider, although cloud platforms
can belong to other levels. The tinted background made the original pale
distance fog and scenery silhouettes stand out much more strongly.

`src/main.ts` now enables that treatment only for `skystream`, its active
`bonus:skystream` round and the standalone `bonus-skystream` preview. Sky Bridge
and Cloudtop Lockers retain their original `sky-bridge/cloud-sea.webp` image,
sky projection and atmosphere. Level geometry, collision, cloud density and
the 360p cloud compositor remain unchanged; hashes are in
[preserved-source.json](preserved-source.json).

`tools/cloud-sky-theme-browser.mjs` checks the actual GPU tint uniform and
flare visibility, main/bonus entry and return, standalone bonus preview, and
switching back from Skystream. It also verifies that cloud rendering remains
active at 360p, with native and 720p/CRT visual review. The original sky is
retained while Skystream keeps its requested treatment.

The first corrected full-render preview and transition checks passed around
03:34 UTC, approximately nine minutes after the 03:25 UTC report.

Packaged lite and full-render checks pass with no console errors; all main,
bonus and return transitions retain the expected sky treatment. Production
build/type checking and release-size validation pass (997,244,080 bytes).
No level data changed, so the previous traversal evidence remains applicable.

![Restored cloud-sea sky behind the cloud bridge](sky-high-span-native.png)
