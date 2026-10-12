# Blockworks · haunted island art job

The user requested a complete player-view storyboard followed by a Meshy and
ImageGen rebuild. The art direction is a haunted Crash 2-inspired castle in an
abandoned theme park on a tropical island. The eight connected districts retain
their current gameplay geometry and camera path.

## Execution and evidence

The resumable state is `tools/blockworks-art/job.json`. A chat heartbeat resumes
work every 30 minutes. The isolated checkout is `/Users/kiki/Documents/ChatGPT/Prototype Fork/.img2threejs/blockworks-haunted-park`
on `codex/blockworks-haunted-park`; the original working folder has unrelated
uncommitted work. No publication is complete until the actual deployment is checked.

1. Capture overlapping views along the route, plus roof tiers, rails, foundry
   branches, aerial targets, movers and the finish. Use the production player
   camera. Save world coordinates, camera matrices and source hashes beside the
   images. Inspection placements are not gameplay traversal evidence.
2. Redraw **every** view with the built-in imagegen tool. Reference its exact
   screenshot for composition and the first accepted storyboard for style.
   Keep a one-to-one capture-to-storyboard manifest, inspect all outputs and
   resolve missing coverage before the Meshy phase.
3. Derive a small reusable asset kit from the completed storyboard. Use the
   established official Meshy CLI adapter with named, journaled operations.
   Preserve supplied topology, textures and UVs. No credit purchases.
4. Generate the sky, distant scenery mattes and supporting textures with imagegen.
   Integrate them with restrained lighting and fog matched to the storyboard.
5. Compare actual gameplay and storyboards from identical saved camera views.
   Check loading, draw calls, clear landing silhouettes, camera clearance,
   supported spawn, pits, checkpoints and the finish. Run focused tests,
   `check:levels` and a build; do not run `check:all`.
6. Log elapsed prompt-to-playable time, commit only this job's files, deploy via
   `origin/main`, verify the public `Codex/sol fork` stamp and disable the heartbeat.

## Style continuity

User clarification: ImageGen is expected to vary distant scenery between views.
Prioritize the playable foreground, nearby castle pieces, local plants and props.
One coherent level-wide skybox and a shared set of world-placed scenery mattes
own the horizon and distant islands, castles and rides. Do not regenerate a
storyboard or rebuild an area merely to reconcile its far-background objects.
Use distant storyboard content as atmosphere and palette guidance only.

The greybox and saved camera matrices remain authoritative for geometry. Small
concept simplifications are implementation notes, not a reason to iterate images
indefinitely. Fix material cues that misrepresent gameplay (especially ice under
the player) and major foreground omissions; never follow a generated image into
changing collision or the route. Read `storyboard-ledger.json` review notes.

Chunky, deliberately crooked castle masonry and exaggerated rounded bevels;
weathered plaster, purple slate roofs, faded carnival paint and oxidized brass;
lush palms and jungle reclaiming deserted rides; distant tropical sea and island
silhouettes; violet blue dusk, pale turquoise moonlight and small warm amber lamps.
Use readable medium-value playable surfaces and darker scenery silhouettes.
The mood is spooky, playful and abandoned, with painted texture detail rather
than photographic noise. Reuse the same masonry scale, roof color, plant shapes,
light direction and weathering language in all districts.

The ice sections remain visually identifiable as cold, glossy enchanted water
or frost. The foundry switches and conditional steel routes remain legible.
Decorative towers, foliage and ride silhouettes stay outside playable and camera
clearance. Do not add obstacles, fill gaps or change jump lengths to match art.

## Baseline limitation

Before any art edits, the existing whole-journey pilot failed at frame 203,
station 47.18, against the newly added opening moa. That historical pilot must
be adapted to the current encounter for final traversal validation. Its failure
must not be described as an art regression or concealed by removing enemies.
