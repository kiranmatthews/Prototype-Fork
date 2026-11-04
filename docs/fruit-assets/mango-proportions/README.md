# Long mango proportion correction — 5 November 2026

The user found Long mango stretched. Variant 5 now has wider, fuller shoulders,
a shorter body, less lean and a more compact crown with broader leaves. The
measured body height/width ratio changes from 1.352 to 1.084: approximately 16.3%
wider and 6.7% shorter. This changes its sculpt directly, without scaling the
assembled pickup or changing motion settings.

`geometry.json` compares the previous `61b05207` geometry with the correction.
All vertex attributes and indices for the other five variants are byte-identical.
The complete mango remains 4,904 triangles at every distance. The wider body initially intersected two folded leaves; their folds were lifted and fitted to the new shoulders. `crown-clearance.json` records the final vertex-clearance diagnostic, with no sampled leaf penetration outside the roots.

The existing `node tools/test-milk.mjs` check passes: complete closed geometry,
attached crown flex, morph normals, pooling, variant switching, flight handoff
and finite settling. No new test duplicates the sculpt parameters. Shared
material, interaction logic, cluster data and movement settings are unchanged.

The gallery review covers front, three-quarter, back and crown views at native
resolution, plus crate rebound and collection flight at normal resolution.
`front-native.jpg`, `quarter-native.jpg`, `back-native.jpg`, `flight-720p.jpg`
and `collection-720p.jpg` show the corrected source geometry. The gallery
warning/error log is empty.

The gameplay harness must use `level=jungle`, not `level=jungle-cup`. The latter
is a separate skate competition and produced an initial setup diagnostic that
its expected six-fruit cluster was absent. The diagnostic is preserved in
`jungle-lite-console.json`; it predates the corrected Jungle walk. That walk
collected all six variants for six credits and zero deaths. Subsequent full
game review uses a fresh tab, so its console log is independently scoped.

The corrected Jungle lite and full 720p walks each collect six fruits for six
credits, with zero deaths and no stranded flights. Full rendering was also
reviewed at native 2560 × 1440 after the loading transition finished. Canvas
dimensions, collection results, the native scene capture and independent full
game console logs are saved alongside this note. Both full-game warning/error
logs are empty. The dev terminal still reports the existing Carlisle manifest
import warning, unrelated to this sculpt.

Final runtime source is `8124fbc5977f25bb1ae67fad526fcb8680d992ab`, following
`4ad77b7d14bc6b8f3477413b629fffb4d5afc4fd`. The focused test and build record in
`checks.json` uses the exact `src/fruitAssets.ts` blob, so the completed geometry
check is reused for the unchanged source during the build.

Both checks pass. The complete production build/typecheck/release preparation
finished successfully in 125.53 seconds, around 10:40 Auckland. The final local
validation was complete approximately 36 minutes after the request, including
the capacity queue. The task-owned browser/server are closed and the build guard
released its lease. No GitHub polling or duplicate release check was performed.

The first source correction was saved within approximately six minutes of the
request. The first revised shaded preview was available approximately 30 minutes
after the request, including roughly 27 minutes queued for the shared validation
slot; that waiting time is not active authoring. The preview used its own port
5207 because another process occupied 5199. Only this task's review tab and server
were closed. Release publication remains owned by the active coordinator.
