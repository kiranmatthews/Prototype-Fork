# Carlisle cliff replay repair

The submitted 6,618-frame recording explores the sandstone around the first checkpoint. At the final standing position (15.17459, −35.22637, −192.58476), the character is on an outer ledge but the follow camera lies inside neighbouring deep bedrock. Earlier in the take, the old double-sided support rays also accept downward-facing rock surfaces as floors.

The camera now sweeps a small sphere from the player body toward the authored eye, retracting before stone and easing out again. Its original transform is restored before each rig update, so correction cannot affect input direction or replay physics. Both player cameras use this, existing side-view cutaways remain respected, and the bonus retains its storyboard composition.

Scenery support rays use front faces. Walls and ceilings use the existing continuous `WorldSolids` capsule solver instead of discrete horizontal-only pushes. The normal floor solver, authored geometry, open arches, contact templates and movement tuning remain.

`before-camera.png` and `after-camera.png` compare the exact recorded final position with camera clearance disabled/enabled on the same build. The character does not move between them. `replay-end.png` is the corrected final approach, replayed from the last recorded checkpoint respawn (frame 5,807) through frame 6,618, captured before the application’s automatic replay-end reset.

Validation: all 6,618 inputs run with no downward-face support contacts; the final 811-frame approach remains above the buried foundation layers; continuous underside impact and authored-camera restoration checks pass. Existing tests pass 41 top probes, 15 side contacts, real-player rebound at 23 m/s, open-arch clearance, 4,819 native support probes, 1,944 footholds, 1,191 joins and 1,499 gaps. The bonus retains all six boxes, gem and finish with zero deaths. Chrome lite/full checks verify the exact camera fault, corrected replay tail, and clean consoles; normal-course smoke covers spawn, traversal, checkpoint, pit respawn and finish. Production build passes.

Reproduce with `node tools/test-carlisle-cliff-clearance.mjs` (add `--full` for the complete recording) and `node tools/carlisle-cliff-clearance-browser.mjs` (`--lite` for the fast pass). The original numeric input recording is retained in `tools/fixtures/carlisle-cliff-replay.json`; it is replay data, not executable instructions.
