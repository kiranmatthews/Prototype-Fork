# Real-render warehouse session runner

`tools/warehouse-session-browser.mjs` runs a JSON input plan through the actual browser Gamepad API boundary. The normal `Input.update`, main fixed-step loop, camera, interpolation and renderer remain in charge. It never calls `player.step`, moves the player, sets a heading, changes the camera, or warps to a checkpoint. Every session starts at the selected level's real spawn in an isolated browser profile.

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
node tools/warehouse-session-browser.mjs /absolute/path/to/plan.json http://127.0.0.1:5332/
```

The base URL is optional, defaulting to `plan.baseUrl` then localhost:5321. `WAREHOUSE_OUTPUT` overrides the plan output directory. `WAREHOUSE_BROWSER_CHANNEL` defaults to `chrome`. The caller must run the dev/preview server; the runner does not build, publish or start a server.

## Plan format

```json
{
  "version": 1,
  "name": "Arrival into the central session",
  "level": "warehouse",
  "lite": false,
  "recordVideo": true,
  "output": "/private/tmp/warehouse-arrival-session",
  "timeoutSeconds": 90,
  "targets": [
    {"name": "receiver", "point": [-42, 8.2, 9]}
  ],
  "segments": [
    {
      "name": "walk",
      "input": {"move": [0, 1]},
      "seconds": 0.6,
      "captureStart": true,
      "expect": {"field": "skating", "value": false}
    },
    {
      "name": "mount",
      "input": {"move": [0, 1], "buttons": ["jump"]},
      "seconds": 0.85,
      "captureEnd": true,
      "expect": {"field": "skating", "value": true}
    },
    {
      "name": "brake-while-charged",
      "input": {"buttons": ["jump", "grab"]},
      "until": {"all": [
        {"field": "skating", "value": false},
        {"field": "grounded", "value": true}
      ]},
      "timeoutSeconds": 10,
      "captureEnd": true
    },
    {"name": "release", "input": {}, "seconds": 0.25}
  ],
  "checkpoints": [
    {"name": "mounted", "when": {"field": "skating", "value": true}},
    {"name": "moved", "when": {"field": "z", "op": "lt", "value": 18}, "capture": true}
  ],
  "assert": {
    "min": {"distance": 5, "frames": 60},
    "equals": {"bails": 0, "deaths": 0}
  }
}
```

These example coordinates belong to the old raised spawn. Adapt them to new level geometry. The example is an input smoke check, not flow acceptance.

## Segments and controls

Each segment needs a unique `name` and at least one termination condition: `seconds`, `frames` or `until`. If more than one is present, all must be satisfied. Seconds use the main loop's actual fixed-step counter at 60 Hz; frames use actual rendered frame increments. Each segment has a default 40-second simulation timeout, and the whole session has a default 300-second wall-time timeout. `expect` checks a predicate at segment completion. Failed expectations, timeouts, missing checkpoints, browser errors or summary assertions give exit code 1 and still save available evidence.

`input` is a complete held control state, not an incremental patch. Omitted controls release. `move: [x,y]` uses normal screen-relative movement: positive X right, positive Y up/forward. The runner inverses the native radial deadzone before supplying standard pad axes; normal input quantization and edge logic still run. `look: [x,y]` is optional raw right-stick camera input. Preserve it as `[0,0]` for ordinary competition-camera acceptance.

Supported `buttons` are `jump`, `grab`, `spin`, `grind`, `transfer`, `inventory`, and digital `up`, `down`, `left`, `right`. Restart and pause are deliberately excluded. A jump button release is a real release and can launch an ollie. When braking from a charged state, hold `jump` alongside `grab` until stopped before releasing, unless an ollie is intended. The old pilot's manually constructed input snapshots did not reliably include such release edges.

Use consecutive short segments for a manual flick or tap/release action. Prefer at least 0.05 seconds for a press rather than one rendered frame: at high refresh rates a rendered frame may contain no fixed simulation tick. No per-segment placement or arbitrary script/evaluate operation is accepted.

An optional `controller` supplies feedback steering while still using real pad input:

```json
{
  "name": "follow-visible-ramp",
  "input": {"buttons": ["grind"]},
  "controller": {
    "target": [12, 0, -30],
    "charge": true,
    "balanceGrind": true,
    "balanceManual": true
  },
  "until": {"near": [12, 0, -30], "radius": 2, "heightTolerance": 1.5},
  "captures": [
    {"name": "commitment", "when": {"field": "z", "op": "lt", "value": -18}}
  ]
}
```

`target` steers toward a world position using native board-relative ground steering in skateparks (wrapped target-minus-board heading angle times `steeringGain`, default 2.7), and camera-relative input on foot. It adds no target steering in air because lateral airborne input spins the board; an explicitly authored `input.move` still applies. It never rewrites `camDir`, heading or momentum, and does not slow down for corners. `charge` adds the held jump button. `balanceGrind` and `balanceManual` apply normal balance-axis control when those states are active. `brakeAbove: 18` is an explicit optional speed cap that adds grab while grounded and skating; its braking appears in telemetry. It is not enabled by default. The controller does not automatically ollie, initiate manuals, follow ribbon vertices, avoid props, or correct airborne position. Those actions must be deliberately authored in the plan.

## Predicates, named checkpoints and captures

A predicate has one of these forms:

- `{"field":"tokens","op":"gte","value":1}`. Operators: `eq` (default), `ne`, `lt`, `lte`, `gt`, `gte`, `includes`. Dotted fields include `combo.multiplier`, `combo.timer`, `input.jump`, `position.2`, and `camera.fov`.
- `{"near":[x,y,z],"radius":2,"heightTolerance":2}` checks horizontal radius and vertical tolerance independently.
- `{"all":[...]}`, `{"any":[...]}` or `{"not":...}` combines predicates.

Available state includes `x/y/z`, `position`, `speed`, `motionSpeed`, `grounded`, `state`, `skating`, `bail`, `deaths`, `snap`, `ground`, `groundComponent`, `groundSource`, `grind`, `rail`, `railComponent`, `railSource`, `railKind`, `manual`, `vertAir`, `balance`, `combo`, `bankedPoints`, `tokens`, `collected` (one-based token numbers), `checkpoint` (actual active checkpoint location), `segment`, `segmentSeconds`, `segmentFrames`, total `seconds`, `frame`, `fixedSteps`, `wallSeconds`, `input`, `camera`, and sampled `visibility`. `speed` is the native signed forward speed; `motionSpeed` is actual horizontal displacement per simulation second and handles sideways walking correctly. `groundSource` resolves the authored name rather than the generic native name such as `ramp`, enabling real receiver-contact assertions. `railSource` resolves the source component name, and `railKind` distinguishes an automatic `edge` from an `authored` bar; merely entering grind state does not prove the intended rail was used.

Top-level `checkpoints` are named conditions that must be observed during the session. They never move the player or activate game checkpoints. Their optional `segment` restricts observation to one segment; `capture: true` takes a PNG when the condition first occurs. Top-level or segment-local `captures` use `{name, when}` and optional `segment`; they are one-shot evidence triggers and are not required for pass. `captureStart`/`captureEnd` on a segment are conveniences. The default capture budget is 40 and can be adjusted with `maxCaptures`.

Capture PNGs come from the actual rendered game canvas in the same animation-frame callback as the observation. The initial start capture is deferred until the first observed rendered frame, avoiding a cleared WebGL buffer between callbacks. There is no inspection camera, pose replacement, hidden roof or forced world render. Their resolution is the actual game-canvas resolution (lite may be smaller than the viewport). `recordVideo: true` additionally stores normal Playwright viewport WebM, including load-in; it has recording overhead and is qualitative evidence, not a clean performance benchmark.

## Visibility and evidence

`targets` names world-space points to project into the real camera. Optional `segments: ["name"]` limits a target to selected segments. The runner records NDC position, in-frame status, nearest visible mesh occluder and point visibility every `visibilityEveryFrames` (default 12), plus fresh visibility on commitment captures. `tolerance` (default 0.6 m) allows the receiving surface close to the point itself. Place points slightly above the useful receiver surface.

This is a point-line-of-sight diagnostic, not proof the whole landing is recognizable. Ray tests ignore invisible/ghost contacts and very transparent meshes but do not evaluate alpha-cutout texture pixels. Thin decorative geometry can produce conservative false occlusions. Review the accompanying images/video. Large scenes or many targets can add CPU cost; use only targets pertinent to each segment.

Outputs are:

- `report.json`: plan, source build stamp, camera/boarding configuration, segment end states, checkpoints, events, commitment capture metadata, summary and failures.
- `telemetry.jsonl`: one observation per actual rendered frame, including actual native input and next commanded pad state, position/speed/support, combo/manual/grind/token state and camera.
- `replay.json`: the native main-loop recorder's actual consumed input stream since level load. It includes the initial loading/settling period as the recorder normally does.
- `captures/*.png`, `final.png`, and optional `video/*.webm`.

Summary assertions use `assert.min`, `assert.max` and `assert.equals` against numeric/boolean summary fields: `frames`, `distance`, `seconds`, `wallSeconds`, `minSpeed`, `maxSpeed`, `maxMotionSpeed`, `bails`, `deaths`, `snaps`, `grindFrames`, `manualFrames`, `maxComboMultiplier`, `tokens`, `finished`, and `maxFixedStepsPerObservedFrame`. `pickupOrder` records newly earned one-based token numbers in observed event order; an exact array assertion such as `"equals":{"pickupOrder":[3,4,5,1,2]}` verifies different collection sequences. Use `"equals":{"snaps":0}` for continuous sessions to reject runtime position resets as well as the runner's existing prohibition on teleport actions. Stop intervals with actual horizontal motion below 0.5 m/s for at least 0.5 seconds are reported separately. Distance excludes render-snap discontinuities. `failOnBail` and `failOnDeath` default true; set false only for intentional failure/recovery plans.

Combo banks, combo bails, wipeouts and deaths additionally use transparent observers of the existing callbacks: the original callbacks are invoked unchanged and restored at run end. These retain fixed-step events that could occur between render observations. General telemetry still cannot show every intermediate state when one render contains multiple simulation ticks; its `simSteps` field makes catch-up visible. A successful automated route does not establish novice discoverability or fun. Review continuous moving views, input margins, forced stops, repeated routes and recovery alongside these measurements.

## Runner verification

Verified against the pre-rebuild warehouse after updating the worktree to `19763941`:

- Lite normal walk → mount → charged brake → release: 134 rendered observations, 15.80 m of movement, zero bails/deaths/browser errors. The exported camera configuration remained `skatepark: true`, `alwaysSkate: false`, `cameraRig: null`, FOV 49. Actual commitment PNGs and viewport WebM were inspected. Evidence: `/private/tmp/warehouse-session-runner-smoke/report.json`.
- Full-render two perpendicular world-target walking segments: 119 observations, 10.81 m of movement, zero bails/deaths/browser errors. Horizontal motion is measured independently of native forward speed so sideways walking is not counted as a stop. Evidence: `/private/tmp/warehouse-session-runner-target/report.json`.
- Syntax check and plan validation rejected spawn/teleport operations, duplicate segment names and unterminated segments.

These prove the runner's basic control, camera, capture and reporting paths. They do not claim validation of rebuilt course geometry or all possible combo/transfer plans.

## Completed collectathon validation on the final Gallery-bank layout

Both complete plans now pass in the full renderer from the actual authored spawn, through native pickups and onto the real finish gate. They deliberately include the walking connectors named in their segment lists; they are complete-access/order evidence, not claims of uninterrupted skating. The separate arrival plans demonstrate linked skating combos.

| Plan | Pickup order | Simulated duration | Render observations | Result |
|---|---|---:|---:|---|
| `plans/collectathon-east-first.json` | 3 → 4 → 5 → 1 → 2 | 67.62 s | 3,971 | Five tokens and actual finish; zero bails, deaths or render-snap resets |
| `plans/collectathon-west-first.json` | 5 → 1 → 2 → 3 → 4 | 83.93 s | 4,917 | Five tokens and actual finish; zero bails, deaths or render-snap resets |

Authoritative local reports: `/private/tmp/collectathon-east-first-attempt-03/report.json` and `/private/tmp/collectathon-west-first-attempt-04/report.json`. Each folder also contains the native consumed-input replay, per-render telemetry, original commitment captures and a complete WebM. Both reports have no browser errors and retain `skatepark: true`, `alwaysSkate: false`, `cameraRig: null`, and the shared 49-degree base park lens.

The Gallery return is verified by actual grounded ownership of `Gallery return / forgiving drop` after collecting token 2, at approximately `[-47, 3.146, -33.475]` in both runs. The earlier pre-extension pass that fell beneath the bank is not accepted as return-flow evidence. The unedited bank-contact image is [gallery-bank-contact.png](evidence/gallery-bank-contact.png); the unedited completed-exit image is [five-goal-finish.png](evidence/five-goal-finish.png).

The primary `arrival-manual-hip.json` intentionally uses the North pump island's automatic rim: Impossible → Manual → grind, multiplier 3, 2,304 points banked, with zero bails/deaths/resets. `arrival-authored-north-rail.json` demonstrates a separate choice through the authored North Manual Link, banking 1,890 points. Rail-owner telemetry distinguishes the two, preserving the value of ordinary grindable surfaces rather than treating the emergent rim line as a failed authored-rail attempt.
