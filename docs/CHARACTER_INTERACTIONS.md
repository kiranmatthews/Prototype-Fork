# Character pickup and smash bounds

Fruit contact and destructible crate attacks use a world-space bounding box fitted to the current posed rider. This is sampled every simulation pose, including height, head proportions, active head, morph weights and skin deformation. Invisible alternate parts and sibling boards, shadows and effects do not enlarge it. Temporary hiding of the whole rider for a presentation effect does not remove its interaction bounds.

The box is the union of transformed bounds for visible mesh parts. It is an enclosing box, not per-triangle contact. Character Lab displays its live dimensions. Swept sole/lid landings still recognize a stomp when an airborne pose tucks its visible feet. Ground, wall and solid-crate support keep the authored movement collider, so changing head size does not displace the feet or break metal-lid traversal. Destructible crate contact, spin attacks and upward head hits use the fitted silhouette without the old short attack-height cap.

Nearby fruit starts homing within 1.75 metres of the body box. It accelerates toward the moving character in world space; physical contact starts the existing screen-space HUD flight. The counter, score and sound still tick at HUD arrival. Spinning attracts fruit rather than batting it away.

A homing native pickup remains alive but reserved until contact. Death releases it; unearned crate fruit remains in the world. Reset, bonus snapshots, run modes and P2 removal release or transfer pending fruit. Two players cannot reserve the same fruit or receive its reward twice.

Validation uses `tools/test-character-interactions.mjs` (part of `check:character-lab`) for posed/morphed/skinned bounds, enlarged crown contact, an out-of-bounds crate, moving-target attraction, HUD accounting, death, snapshots, run modes and multiplayer ownership. `interaction-review.html?playtest&level=jungle-cup` provides a local-only review with visible bounds, resize controls and pause-at-magnet/HUD controls. Finish review restores the starting character preferences and returns to normal play.

The archived input-only vert, ledge and locomotion recordings pin their historical crate envelope in their test harnesses: changing early crate contact otherwise shifts the route thousands of frames before their fixed-time traversal assertions. Current interaction behavior is tested separately, while solid-crate support and current Jungle Cup skating/recovery tests run without that compatibility override.
