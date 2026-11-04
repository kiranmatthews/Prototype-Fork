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

Browser review and production-build evidence will be added after the reserved
validation capacity becomes available. This is an authoring checkpoint, not a
completed visual review or publication claim.
