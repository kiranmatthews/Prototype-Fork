# Carlisle rendering audit — experiments rejected

The production game retains commit `94f981d135389cef392fef540c158902226921fc`'s
complete runtime and assets. **Neither experimental optimization ships.**
The results establish a current performance baseline and rule out a tempting
triangle-count optimization that did not demonstrate a consistent timing win.
The broader visual/gameplay polish goal remains active and publication is held.

## What was measured

`before/profile.json` records the unmodified compiled game at the arrival quay
in normal 480p/CRT and native 1920×1080, plus the Dredger and Rigging entries in
normal presentation. Each view samples 180 accepted presentation frames after
90 warm-up frames. Medians are 16.6–16.7ms, with 17.8–18.2ms p95s. These are
short stationary samples on this Mac, **not a full-course or hardware-wide
60fps claim**. The profiler records actual color/shadow draw callbacks as well
as whole-frame renderer counts; it does not infer cost from asset file size.

The arrival gameplay frame submits about 18.83 million triangles. Full timber
modules account for 8.70 million color triangles, woven nets 1.70 million, and
several large pier/fender batches include many instances outside the view.
The existing full-geometry deck batching is retained.

## Experiments and decision

The first candidate divided static props, pier members and primitives into
48m cells and added a settled-net shader early return. It retained all 30,098
instances but increased scene batches from 658 to 3,720. In the near arrival
view, submitted triangles fell from 15.23M to 13.19M while draw calls rose from
584 to 1,267. This broad fragmentation was rejected immediately; the original
pier source and cheap primitive batching were restored.

The revised candidate divided only static authored props and dense rings,
retaining 1,542 batches. Its full scene fingerprint exactly matched the old
build: `013fa031954ba62a54c0ec82a7476076202c19913cf125d13befac1dbe7e717a`.
This hashes every actual instance's full source geometry, transform,
per-instance attributes and material settings, independently of visibility.

In six native views and four net phases per view, batch-only comparisons are
pixel-identical. The net shader recompile produces 2–102 differing pixels out
of 2,073,600, with maximum channel differences of 9–30; repeated unchanged
control renders differ by zero pixels. Those differences are isolated to the
net shader, not lost scenery. Do not describe the combined images as exactly
identical. Fixed and moving native bounce impacts, finite settling, bonus
boats and main/bonus/main reloads pass without console errors.

The revised normal arrival frame submits 17.94M triangles instead of 18.83M,
but raises draw calls from 723 to 1,031. Alternating 240-frame windows remain
around 16.6–16.7ms. That cap-limited result cannot prove an improvement.
`render-work.json` therefore alternates four combinations in the same process:
old/new batches crossed with old/new net shader, using synchronous scene renders
and `gl.finish()` fences after compilation. The timings vary substantially
within a run and do **not** show a consistent advantage. They are diagnostic
renderer work measurements, not gameplay FPS. Neither change has sufficient
evidence to justify shipping; both were removed and the original game rebuilt.

No geometry reduction, LOD, silhouette change, new paid asset, Tripo charge,
camera/movement change, course-data edit or publication occurred.

## Evidence and reproduction

- `baseline/equivalence.json`: inventory from the untouched 05:26 compiled build.
- `initial-lite/`, `initial-comparison/`: broad batching candidate, first failed
  exact-pixel assertion, and an amplified difference diagnostic.
- `lite/`, `comparison/`: revised candidate inventory, separated image checks,
  timings, reviewed native/CRT images, actual impacts and lifecycle evidence.
  The raw comparison's `passed` field covers its stated assertions; the decision
  above rejects the candidate despite those checks.
- `render-work.json`: additional fenced measurements that informed rejection.
- `restored/`: final compiled inventory/console check after exact restoration.
- `protected-source.json`: unchanged gameplay and previous presentation sources.
- `validation.json`: final decision, restoration, build and timing details.
- `rejected-candidate.patch`: complete revised experiment, for isolated research.

Use the shared `run_heavy.py` lease for these browser tools. The reusable
`tools/carlisle-render-profile.mjs` profiles the current compiled game.
`tools/carlisle-render-equivalence.mjs --lite` verifies the restored scene
against the preserved baseline; choose `CARLISLE_EQ_OUT` to preserve prior runs.

To reproduce the **rejected** experiment, use an isolated checkout of the base
commit, apply `rejected-candidate.patch` with `git apply --unidiff-zero`, build and serve that checkout, then
run the equivalence tool with `--candidate` and the comparison/work tools with
`--candidate`. Do not apply it to the user's active local playtest. Set
`CARLISLE_BASE` to the isolated experimental preview. The comparison
tools reconstruct the original grouping only inside their test browser, retain
all geometry, and use paired renders at the exact same pose/time. No screenshot
wait drives gameplay feedback. Test-owned browsers close on completion.

No full-suite run, new uninterrupted 4km clear, public deployment or subjective
claim that the broad polish objective is complete is made by this audit.
