# Level-editor round-trip contract

Opening the level editor is transactional. Until source data actually changes:

- the live `Level` object remains in the scene;
- player, world, pause, replay, split-screen, run-mode, and camera state remain
  frozen in place;
- the original fog object, fallback sky texture, global random stream, fixed-step
  remainder, transient message, and viewport-correct play lens are restored;
- a separate unbatched build supplies raycast targets and editor-only guides;
- selection, property rendering, resize mode, camera orbit, export, and closing
  do not autosave or normalize the stored level;
- closing disposes the proxy and resumes the original object without rebuilding
  or respawning it.

Data-backed levels promote their working copy only on a real commit. Hand-built
legacy courses contain bespoke systems that cannot be represented completely by
`CustomComponent`; their first committed change therefore creates a separate
`<name> edit` user level. The shipped course is never silently replaced by a
lossy capture. Undoing the first change back to the opening baseline removes
that new override/copy relationship and restores the pristine source entry.

Editor property getters must be pure. Runtime defaults are displayed without
being inserted into JSON; a concrete field is materialized only when the user
changes or transforms it. Pointer cancellation, Escape, window blur, and editor
exit roll back every live move/scale/resize gesture.

The level registry is part of the transaction. If a fork, paste, edit or history
operation would exceed the library count/byte limits, neither the current draft
nor its undo/redo stacks advance. A storage quota failure is different: the
validated session copy remains accepted and exportable, and the editor reports
that it is unsaved. Locked components are excluded from selection and protected
from indirect replacement or group rewiring.

The inspector and palette use exclusive docks below 720 pixels of viewport
width. The EDIT toggle reveals the canvas without changing the working level.
The active inspector pane scrolls independently while history, status and TEST
remain accessible. Non-editor side tools are hidden only while editing.

Pointer gestures belong to one pointer ID. A second touch cancels a geometry
preview before handing camera control to OrbitControls; foreign pen/mouse
contacts cannot mutate or commit it. Capture loss, blur, resize, view changes,
framing and keyboard nudges terminate old gestures before applying new work.
Synthetic pointer behavior is tested in Node and a real browser DOM harness;
physical-device coverage is reported separately.

Committed rebuilds borrow only the immutable snapshot just accepted by the
registry. Uncommitted preview builds continue to read the mutable working copy.
The public normalization API still returns an isolated editable copy. Prepared
changes cannot be forged, reused after intervening edits, or accepted at stale
library capacity. Support-bearing edits additionally build disposable geometry
before acceptance so exact ray-work rejection cannot leave saved data diverged
from the visible course.

Non-uniform group transforms use the runtime's own component axes. Procedural
wood paths mirror the runtime's linear/Catmull-Rom tangents, banked frames, arc
sampling density, and sample cap when scaling widths and plank/support spacing.

## Regression checks

```sh
npm run check:editor-security
npm run check:editor-roundtrip
npm run check:editor-capture
```

`check:editor-roundtrip` is part of `npm run build`. It runs source-owned,
published, starter, sparse-new-primitive, and malformed-group fixtures through
both lite and full modes, loose editor builds, baked play builds, migration,
storage, capture, world transforms, materials/shadows, and gameplay contracts.

`check:editor-capture` is the deliberately strict audit of legacy hand-built
conversion fidelity. Those courses are protected by the automatic-copy rule,
so its remaining diagnostics describe representational limits rather than a
way to damage the shipped levels.
