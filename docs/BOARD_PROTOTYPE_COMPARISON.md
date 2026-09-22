# Board Prototype / Prototype Fork performance comparison

Measured 23 September 2026. Original source: upstream `ee24275` (also the
current upstream HEAD, verified against GitHub). Comparison fork: `d86c517`.
The concurrent enemy release `4cedcc6` arrived during this investigation;
final fixes and validation include it. Unrelated character-study work is excluded
from the release snapshot.

## Findings

The fork has substantially higher CPU and graphics-memory requirements even in
the shared Sky Bridge level. This explains why changing only the output
resolution has limited effect. Its per-tick character work, shadow allocation,
decoded images and geometry remain at essentially the same cost at 540p.

Both versions held approximately 60 FPS in the initial unthrottled Mac test.
That ceiling conceals the difference in remaining frame time. The following are
workload measurements, not predictions of physical iPhone/iPad frame rates.

Chrome, Apple M1 Pro/ANGLE Metal, 1280×720 CSS viewport, DPR 1, clean browser
storage, idle Sky spawn, 12-second warm-up and four-second samples:

| Work | Board Prototype | Fork before this patch |
| --- | ---: | ---: |
| Player simulation CPU per fixed tick | ~0.16 ms | ~2.77 ms |
| Full character interaction bounds within that tick | Not present | ~1.29 ms |
| Character visual update within that tick | ~0.06 ms | ~1.23 ms |
| Actual GL triangle submissions per presentation, including shadows/UI | ~10,800 | ~364,600 |
| Actual GL draw calls per presentation | ~227 | ~313 |
| Attached scene triangle inventory, including hidden objects | 17,570 | 328,455 |
| Drawing buffer | 1280×720 | 2560×1440 |
| CRT / LOOK | Original CSS overlay | Both disabled |

Timings above are nested: do not add bounds and visual update to the complete
player step. RAF-normalized raw data differs by under 0.5% from presentation
counts in this unthrottled sample. Inventory includes hidden objects; submitted
triangles count actual GL calls. Neither metric alone is an FPS measurement.
Raw instrumented samples: [board-prototype-profile.json](performance/board-prototype-profile.json).

### Shadows are the largest measured fixed graphics allocation

Intercepting WebGL texture/buffer/renderbuffer allocation and deletion calls
produced these live requested-storage totals:

| Loaded view | Logical WebGL storage |
| --- | ---: |
| Original Sky | 50.49 MiB |
| Fork Sky | 168.41 MiB |
| Fork Jungle Cup intro | 178.29 MiB |
| Fork Treehouse | 272.75 MiB |
| Fork Sky after the route above | 169.86 MiB |

The original directional shadow uses a 2048² RGBA8 texture (16 MiB) and a
DEPTH24 attachment (12 MiB). The fork uses 4096²: 64 + 48 = **112 MiB**, an
**84 MiB increase**. The shadow frustum also grew from 46 to 192 world units
across, exposing more potential casters. See `src/main.ts` sun setup.

The fixed composer/SMAA path adds approximately another 33.40 MiB at 1280×720
(three RGBA16F color buffers, two RGBA8 buffers and two DEPTH24 attachments).
Together these two rendering choices explain almost all of the measured Sky
graphics-storage gap. Both persist with CRT and LOOK disabled.

These totals describe requested storage, not OS process RSS or measured GPU
residency. DEPTH24 may be padded by the driver. Default framebuffer/MSAA,
browser compositor surfaces, decoded image pixels, JavaScript, audio, shader
programs and driver overhead are excluded. Consequently total process memory
is higher. A process that returns to a stable warmed resource count can still
exceed a physical device's memory budget on entry.
Allocation samples and owners: [board-prototype-memory.json](performance/board-prototype-memory.json).

At 540p/1×, Sky's tracked storage falls to 153.73 MiB; its shadow allocation
remains 112 MiB. The excluded default framebuffer also shrinks from 2560×1440
to 960×540 (7.11× fewer pixels), so total graphics-memory savings can exceed
the tracked 14.68 MiB reduction. Resolution helps pixel costs; it leaves the
character CPU and fixed shadow budgets in place.

### The character and scenery are much more expensive

The original default Fox asset is 2,130 triangles; its optional Roo asset is
1,274. The fork's default head, torso and
shorts alone are 37,255; its two hands add another 23,104. Sky also has multiple
10,080-triangle braided ropes. These are visible geometry and deformation costs,
not merely extra source-file size. A hidden 91,530-triangle spin-effect model
contributes to the attached inventory but is not drawn while idle.

The fork already caches bind-space skinning for exact bounds and skips settled
rope updates. Those earlier improvements are present in the comparison; they
must not be counted again as savings from this patch. Character shape changes
still need to be posed and measured each simulation tick. On a slower CPU,
catch-up simulation performs several of these expensive ticks before one frame.
The bounds measurement visits 27,560 vertices across six live skinned meshes.

A separate controlled Chrome CPU-throttling run used only frame/step counters,
with no builds or other timed profiles running. With CPU throttling set to 4×,
two 6.5-second samples per case measured:

| Sky, CRT off | Original | Fork before | Fork with exact joint-lookup fix |
| --- | ---: | ---: | ---: |
| Default settings, FPS | 60.0 | 18.5–19.4 | 21.2–22.1 |
| 540p preset, FPS | Not sampled | 19.6–20.2 | 22.7–23.7 |

Both forks maintained about 60 simulation ticks/second, paying for 2.5–3.3
ticks per displayed frame versus roughly one in the original. This directly
demonstrates CPU catch-up amplification and a modest improvement from removing
repeated rig searches. It does not emulate a particular phone's CPU/GPU.
Raw samples: [board-prototype-cpu.json](performance/board-prototype-cpu.json).

### Presentation adds work even with CRT off

The original renders directly, with browser-buffer MSAA and DOM HUD. The fork's
fixed-resolution path uses HDR composer targets, four SMAA fullscreen draws,
canvas HUD composition and output transfer. Its desktop default is 720p input
with 2× output. Touch presentation already forces output to 1×, so removing the
desktop multiplier would not fix the reported phone problem.

When enabled, the full CRT graph adds substantial intermediate/history storage
and fullscreen passes. CRT is disabled in factory settings; it is not the cause
of the measured clean-default gap. Water additionally needs reflection/depth
passes where visible; the original water sampled the sky without those passes.
The earlier hidden-water visibility optimization is already in the fork.

Decoded interface artwork is another memory budget outside the game render
resolution: the existing phone font tier is ~11.86 MiB, the iPad tier ~47.41 MiB,
and bottle HUD source frames ~25.25 MiB. These are CPU image budgets, separate
from the WebGL figures. Published folder/download size is not live memory.

## Invisible fixes implemented

1. **Retired prize cleanup.** Combo-gem removal and box-gem hard reset now
   dispose private geometry/materials. Previously detached objects escaped the
   level's final disposal traversal. Forty actual uploaded prize retirements
   leaked forty geometries in the baseline; the changed version stays flat.
2. **Shared resource ownership.** Level disposal no longer destroys Three's
   global Sprite quad or the shared halo texture. Surviving crystal pixels are
   identical before/after another level's retirement.
3. **CRT copy removal.** Two consecutive same-size point-copy stages were
   identical. Keeping one reduces the active graph from 14 to 13 draws, saving
   3.52 MiB at 720p without changing pixel output.
4. **Variant-specific history.** HD no longer allocates the two full-input
   luminance histories used only by Advanced. Combined with the removed copy,
   HD saves 10.55 MiB at 720p, or 5.93 MiB at 540p. Advanced retains its history.
5. **Joint lookup.** Animation rig resolution now finds all declared joint
   names in one depth-first traversal instead of repeatedly searching the
   character tree for each joint. It preserves the first matching node and
   rebuilds the lookup every time, including after renames, hierarchy changes
   and metadata edits. Poses, elasticity and simulation cadence are unchanged.
6. **Bounded enemy loading.** The newly released enemy models join the existing
   two-job scenery queue. Retired queued requests are skipped; peers still share
   an asset and live readiness/failure/retry behavior is preserved. This bounds
   concurrent decode peaks without changing the models or their textures.

Seventeen deterministic browser frames compare exact RGBA8/RGBA16F output,
intermediates and history bits across both CRT variants, switches, resize and
disable/re-enable. They match. These changes do not lower rendering settings,
mesh detail, animation rate, movement tuning or interface quality.

The new eight-enemy roster can add about 16 MiB of full-resolution RGBA/mipmap
texture storage per loaded kind (three 1024² maps). Its bounded loader addresses
decode concurrency; it does not remove that steady-state cost. This roster was
published after the older crash reports and is not their historical cause.

## Changes requiring a visual/gameplay decision

| Priority | Proposed change | Expected benefit | Tradeoff / verification |
| --- | --- | --- | --- |
| 1 | Use 2048² sun shadows on mobile; retain 4096² as high quality | Reclaim 84 MiB logical storage; quarter the shadow-map pixel budget | Softer/coarser shadows at the existing coverage; compare gameplay and Cup overview before acceptance |
| 2 | Create gameplay LODs for the character, hands and braided ropes; retain detailed close-up/editor assets | Reduce submitted vertices and deformation work where those meshes are active | Detail/silhouette changes; validate every authored clip and contact. Rendering LOD alone does not remove full-resolution collision-bound CPU cost |
| 3 | Separate gameplay contact bounds from detailed render deformation, using a validated conservative contact rig | Address the large per-tick CPU floor and catch-up amplification | Contact envelope is a gameplay choice; require collision/ledge/death tests and side-by-side approval before changing it |
| 4 | Extend GPU-compressed textures to remaining large resident scenery/enemy sets | Lower texture residency and upload bandwidth | Compression is lossy; preserve source art and compare close views. Existing Treehouse compression is already included |
| 5 | Optional lightweight mobile presentation/water profile | Lower fullscreen-pass, reflection and decoded-art budgets | Changes antialiasing, CRT/water appearance or interface animation; make each choice explicit and measurable |

Start with shadows, then character CPU/detail. Selecting 540p repeatedly or
turning off an already-disabled CRT does not address the principal fixed costs.
Do not silently cap animation/simulation frequency, remove elasticity, change
movement, replace authored art, or alter the user's stored graphics preferences.

## Stability conclusion and acceptance criteria

The comparison proves a substantially larger working budget and a repeatable
resource leak. It does **not** identify the exact OS-level cause of the reported
iPhone/iPad process restart. A desktop browser and simulated touch viewport
cannot establish a physical-device crash rate. No crashes/context losses were
observed in these comparison runs.

For the next physical-device pass, record build stamp and saved graphics options,
then test cold Sky, map → Cup, three heats/results, and repeated Treehouse → Sky.
Inspect `stability-report.html` after any restart; an abruptly ended session
locates the last completed stage but is not proof of a memory kill. An iOS
jetsam/crash record distinguishes process memory termination from another fault.
Verify the current `Codex/sol fork` build first; stale offline workers were a
separately proven issue in earlier investigations.

Acceptance: no repeat-visit growth after warm-up, no asset/console/GL errors,
unchanged gameplay checks, and a sustained physical-device frame-time/memory
sample. Target 16.7 ms/frame for 60 FPS; choose a lower target only explicitly.

## Reproduction

Validation completed: clean production TypeScript/Vite build; exact collectible
and CRT browser regressions; animation rig/runtime, elasticity, bone/torso and
suite checks; all eight enemy assets with real runtime/gameplay checks; queue,
asset lifetime, collectible shading, results and graphics-memory regressions.
Chrome production completed 12 real level transitions and four results screens,
plus phone/iPad/4K presentation checks, with no console/asset/context errors.
The last three Sky returns each held 151 geometries / 69 textures; repeated
Treehouse visits each held 150 / 90. No full suite was run.
WebKit production also passed cold Cup load, real-menu and repeated entry,
all three heats through final standings, zero exposed-frame allocations/compiles,
and local stability-report recovery with a clean console.
Production Codex Lab smoke also passed supported spawn, keyboard movement,
charge/release jump and landing, K/L checkpoint banking, kill-plane death/life
decrement/automatic respawn, a six-metre collision landing and actual finish-glow
entry. A final full-render Sky pass had no console/asset/context errors.

An existing source-text assertion in `test-crt-resolution.mjs` expects the older
literal `preCrtOverlay({`; it fails identically on `d86c517` and the candidate.
The current fixed-render-pipeline check and actual CRT pixel/lifetime regression
pass. This unrelated assertion was not used to justify any graphics change.

Use separate checkouts/Vite ports for `ee24275`, `d86c517`, and the candidate.
Diagnostic browser tools use a fresh context and preserve user storage.

```sh
node tools/compare-prototype-performance.mjs <original-url> <fork-url>
node tools/compare-prototype-cpu.mjs <original-url> <baseline-url> <candidate-url>
node tools/compare-prototype-budget.mjs --original <original-url> --fork <fork-url> --output budget.json
node tools/test-collectible-lifetime.mjs
node tools/test-collectible-lifetime-browser.mjs <candidate-url> <baseline-url>
node tools/test-crt-resource-browser.mjs <baseline-url> <candidate-url>
```

Set `PLAYWRIGHT_MODULE` if Playwright is supplied outside the project. Resource
and timing profiles must run separately; avoid simultaneous builds/profilers
when drawing conclusions from frame times.
