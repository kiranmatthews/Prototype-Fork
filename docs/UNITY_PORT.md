# Unity port readiness — core gameplay

Written from an audit of the shipping code (not from memory). Line references
are to the commit that added this file; they will drift, but the shape holds.
Scope is the **core mechanics**: `player.ts`, `tuning.ts`, `input.ts`,
`replay.ts`, the fixed-step loop in `main.ts`, and the runtime contract
`player.ts` demands of `Level`. The level editor, the per-level builders and
2-player split are explicitly out of scope.

---

## 1. Systems inventory

Everything below lives in `src/player.ts` unless noted. The file is one large
`Player` class: ~11k lines, one `step(dt, input, level)` entry point, called
from the fixed-step loop.

| System | Where | Consumes | Notes for the port |
| --- | --- | --- | --- |
| Fixed-step loop | `main.ts` `while (acc >= CONST.fixedStep)` | `CONST.fixedStep` = 1/60 | Straight to `FixedUpdate` at 0.01666667. |
| State machine | `step()` switch on `this.state` | — | `MoveState` = `ride \| air \| grind \| hang \| rope \| dead \| gameover \| finished` (player.ts:67). The `switch` only cases `ride`/`air`/`grind`/`finished`; `rope` and `hang` early-out **before** it and run their own timers; `dead`/`gameover` are driven by the respawn path. |
| Walk / skate / carve | `stepRide` | `walkSpeed`, `cruiseSpeed`, `maxSpeed`, `carveGripLow`, `carveGripHigh`, `turnaround`, `friction`, `rollFriction`, `windDrag`, `chargeBoost`, `chargeDecay` | Free-heading model: `axisF`/`axisL` **are** the board's heading; the stick carves them. There is no separate "rotation" — see §2. Low/high grip are direct deg/s endpoints blended from zero to `maxSpeed`; overspeed holds the high endpoint. |
| Ollie / charge jump | `tryJump`, `stepAir` | `jumpVelocity`, `jumpMinVelocity`, `ollieVelocity`, `ollieMinVelocity`, `ollieDownCouple`, `chargeMax` | Charge-on-hold, fire-on-release. Identity (ollie vs platform jump) is decided **at release** from state + speed. |
| Air / gravity | `stepAir` | `riseGravity`/`fallGravity` (foot), `boardRiseGravity`/`boardFallGravity` (board), `rampFallGravity` (ramp launches), `pipeAirGravity` (vert), `wallrideGravity` | Four distinct gravity pairs selected by `airGrav` + launch origin. Port these as an enum-driven table, not `if`-chains. |
| Slide / crouch / crawl | `stepRide` + `sliding`/`crouch` flags | `slideSpeed`, `slideTime`, `slideRecover` | |
| Manual | `manualing` block in `step()` | `manualDrift`, `manualControl`, `balance*` | Shares the balance core with grinds. |
| Grind + balance | `stepGrind`, `stepBalanceCore` | `grindSpeed`, `grindGrav`, `balanceDrift`, `balanceControl`, `balanceGrace`, `balanceRamp`, `balanceNoise`, `balanceGravity`, `balanceRespSnap` | Balance is a 1-D inverted-pendulum needle. **Draws from the sim PRNG** (§4). |
| Vert / pipe / hang / lip | `stepVert`, `stepHang`, lip block in `stepRide` | `vertMax`, `vertLaunchConserve`, `vertGravityBlend`, `hangLateral`, `lipMaxTime`, `lip*`, `transfer*` | The most intricate subsystem and the one most reworked; port last. |
| Wallride | wallride block | `wallrideGravity`, `wallrideMaxTime`, `wallCharge*` | |
| Ledge grab | `stepHang` + `tryLedgeGrab` | `ledgeGrabTime` | |
| Rope swing | `stepRope` | `rope*` | Rope is driven by `Level`; the player never bends it. |
| Ragdoll / bail | `bail()`, `startRagdoll()`, `settle()` | `bailSpeedKeep`, `bailMash*`, `ragSpin`, `CONST.bailDownTime`, `CONST.maskInvuln` | `isBailing` ⇔ `bailDownT > 0`. **Every** interaction handler must consult it (see §6 gotchas). |
| Collision | `collide(level)` | `CONST.playerHalf` | AABB vs `level.walls`, crates, enemies, killboxes. See §3. |
| Scoring / combo | `score()`, combo fields | `combo*`, `pts*` in CONST | Repeat-devaluation table, spin+grab merge, mask specials. |
| Checkpoints / lives | `respawn()`, `settle()` | `CONST.respawnDelay` | `respawn(level, hard)`: soft = checkpoint, hard = new run (**reseeds the PRNG**). |
| Camera rig | `main.ts` `updateCamera` | `cam*` keys | Ground-anchored Crash-style rig + optional chase cam + editor-drawn camera lane. |
| Input | `input.ts`, `touch.ts` | — | See §5. |
| Replay | `replay.ts` | — | See §4. |

---

## 2. Units & conventions — read this before writing any code

- **World units**: 1 unit ≈ 1 metre. The player AABB half-extents are
  `CONST.playerHalf = {x: 0.5, y: 0.46, z: 0.5}` → 0.92 tall, deliberately just
  under one crate (0.96). Crates are 0.96 cubes. Keep the scale 1:1 in Unity;
  every tuning number assumes it.
- **Handedness**: three.js is **right-handed, Y-up**. Unity is **left-handed,
  Y-up**. This is the single biggest source of silent bugs in this port.
  - Screen-forward in this codebase is **−Z** (`player.ts:769`, `1536`). In
    Unity, forward is **+Z**.
  - The travel frame is `axisF` (forward) and `axisL` (left), built as
    `axisL = (axisF.z, 0, -axisF.x)`. That specific cross-product convention
    **flips sign** in a left-handed space. Port it as an explicit
    `axisL = Vector3.Cross(Vector3.up, axisF)` and re-derive, do not transcribe.
  - Every `Math.atan2(z, x)` heading, every `sign` test on a lateral component,
    and the grind-balance stick axis need re-deriving, not translating.
  - Recommendation: mirror the **content** on Z at import and keep gameplay
    math in a right-handed helper, or accept the flip and re-derive every sign
    with a test per mechanic. Do not mix the two.
- **Fixed timestep**: `CONST.fixedStep = 1/60`. Gameplay reads only this `dt`;
  no gameplay code reads wall-clock time. `FixedUpdate` maps cleanly.
- **Gravity** is in units/s² and is **not** a single value:
  `riseGravity` 33 / `fallGravity` 119 (on foot),
  `boardRiseGravity` 33 / `boardFallGravity` 70 (board),
  `rampFallGravity` 40 (ramp launches), `pipeAirGravity` 31 (vert),
  `groundGravity` 45 (slope, symmetric), `wallrideGravity` 16.
  Unity's `Physics.gravity` is irrelevant — the player is **kinematic** and
  integrates its own vertical velocity. Keep it that way.
- **Rotation**: the sim stores no quaternion for the player. Facing is
  `axisF`; the mesh's yaw is derived for rendering only.

---

## 3. Engine coupling (what has to be replaced)

`player.ts` uses three.js for: `Vector3` (133 refs), `Box3` (19),
`Raycaster` (5), `Quaternion` (16), plus `Mesh`/`Group`/geometry/materials —
but the last group is **all in the visual half** (pose rig, model
segmentation, particles) and is not sim state.

| Coupling | Used for | Unity equivalent |
| --- | --- | --- |
| `THREE.Vector3` | positions, velocities, axes | `Vector3` (watch handedness) |
| `THREE.Box3` | player AABB, walls, crates, killboxes, tumble zones | `Bounds` |
| `THREE.Raycaster` + `intersectObjects(level.groundMeshes)` | **ground detection**, ledge probing, pit tests | `Physics.Raycast` against a ground layer |
| `THREE.Quaternion` | pose/visual only | `Quaternion` |
| `localStorage` (`player.ts:864`) | character pick persistence | `PlayerPrefs` — **not** sim state |
| `document.createElement('canvas')` (`player.ts:920`) | procedural textures | offline texture assets |

**Ground model** — port this deliberately: the player is **not** a Unity
`CharacterController`. It raycasts straight down against `level.groundMeshes`
and snaps, keeping a `GroundHit { point, normal, slippy, vert }`. Surface flags
(`slippy` for oil/ice, `vert` as a **tri-state**: `true` = always vert,
`false` = never vert i.e. a road, `undefined` = decide by angle) ride on the
mesh's userData. In Unity these become a `SurfaceTag` MonoBehaviour or a
per-collider lookup. Using a `CharacterController` instead would silently
change the vert/transition detection that half the trick system keys off.

**Wall model**: `level.walls` is an array of AABBs and collision is a swept
Minkowski push-out with a "head-on hit kills speed, angled scrape slides"
rule. Do **not** replace it with Unity colliders + rigidbody resolution — the
"bump = full stop" behaviour is authored, and physics-engine resolution will
feel different. Port the routine as-is against `Bounds`.

---

## 4. Determinism & replay

`replay.ts` records, per fixed step: `moveX`, `moveY`, and a 12-bit button
mask (`jumpHeld/Pressed/Released`, `grindHeld/Pressed`, `spinHeld/Pressed`,
`grabHeld/Pressed`, `transferHeld/Pressed`, `restartPressed`), plus the TUNING
snapshot and every mid-run tuning change as `[frame, key, value]`.

**Input coverage is complete**: the only `Input` member not recorded is
`pausePressed`, which is handled outside the fixed step and cannot affect the
sim. A Unity port can keep this exact format.

**The sim's randomness is seeded.** `Player.simRand()` is a mulberry32 stream
reseeded to a fixed constant on hard reset. Ten draws go through it — grind
balance start direction, balance noise phase, trick-switch jolt, crate/rail
trip launch velocities, and `?`-crate rewards. Visual randomness (sparks,
dust, ragdoll flail, thrown-deck spin) stays on `Math.random()` **by design**,
so a headless run that skips particles cannot shift the sim's draw order.

For the port: reimplement mulberry32 **exactly** (it is 5 lines, uses
`Math.imul` semantics = `unchecked((int)(a*b))` in C#) or replays will not
survive the move. Do **not** use `UnityEngine.Random` for sim draws.

---

## 5. Input model

`Input` exposes analog `moveX`/`moveY` (unit-clamped) plus held/pressed/
released edges for jump, grind, spin, grab, transfer, restart, pause. Edges
are consumed once per fixed step via `consumeEdges()` — the pause path
consumes them too so a press during pause cannot fire on resume.

Touch (`touch.ts`) feeds the same `Input` object; it is a skin, not a second
path. Unity: one `IInputSource` with the same edge semantics; keep
`consumeEdges` explicit rather than relying on `GetButtonDown`, which is
Update-scoped and will double-fire or drop under a fixed step.

---

## 6. Port order & the top gotchas

**Order** (each stage playable before the next):

1. `tuning.ts` → a `ScriptableObject`. Mechanical; do it first so everything
   else can reference real numbers.
2. Fixed-step loop + `Input` + the mulberry32 stream.
3. Ground probe + `GroundHit` + surface flags. Nothing works before this.
4. `ride` state: walk, carve, brake, friction. Playable checkpoint.
5. Jump/ollie + `air` + the four gravity pairs. Playable checkpoint.
6. AABB wall push-out + crates + killboxes.
7. `grind` + the balance core (manual shares it — free once done).
8. Ragdoll/bail + `settle()`/`respawn()`. **Do this before vert**: half the
   vert code paths defer to `isBailing`.
9. Scoring/combo.
10. Vert / pipe / hang / lip / wallride / transfer — the deepest subsystem,
    and the one whose comments have drifted most from its code.
11. Rope + ledge.
12. Replay recorder/player, then validate against exported `.json` takes.

**Top 10 gotchas**

1. **Handedness.** `axisL = (axisF.z, 0, -axisF.x)` and every `atan2(z,x)` is a
   right-handed assumption. Re-derive, don't transcribe.
2. **Forward is −Z here, +Z in Unity.** Affects camera framing, the stick
   decomposition, and the lane/chase frames.
3. **`vert` is a tri-state, not a bool.** `false` ≠ `undefined`: a road must
   never be ridden as vert even where its angle says otherwise.
4. **Don't use a CharacterController.** The raycast-and-snap ground model is
   what the transition/vert detection is built on.
5. **Don't use physics resolution for walls.** "Bump = full stop" is authored.
6. **`isBailing` must gate every interaction.** This audit found TNT and the
   spin attack missing that gate; assume any new handler needs it too.
7. **Gravity is four pairs, not one number**, chosen by air origin.
8. **The balance needle is a sim system, not a UI widget** — it consumes the
   seeded PRNG and decides bails.
9. **`consumeEdges()` placement is load-bearing.** Edges must be consumed
   exactly once per fixed step, including on the pause path.
10. **Comments in the vert/lip/grind regions have drifted** across many
    reworks. Trust the code, and re-verify any comment before porting the
    behaviour it describes.
11. **One gameplay decision reads an animation value.** `stepAir`'s pipe-end
    landing judgement gates on `alignPose > 0.5` — a smoothed board-alignment
    blend weight written only by `syncVisual`, and eased at two different
    rates (24/s on a pipe, 12/s elsewhere). Today this is safe *only* because
    `syncVisual` is called from inside the fixed step, so the smoothing is
    deterministic. The browser now snapshots that completed hierarchy and
    temporarily interpolates previous→current for drawing, then restores the
    authoritative fixed pose immediately after the render; `syncVisual` itself
    still never runs on the render clock. **If the port puts pose smoothing on
    `Update` while physics stays on `FixedUpdate`, this crash/no-crash verdict
    silently becomes frame-rate dependent.** Either preserve the same
    snapshot/interpolate/restore boundary, keep smoothing in `FixedUpdate`, or
    replace the test with a sim-owned tilt quantity before porting.

---

## 7. Known-stale documentation (verify before trusting)

Found during the audit and **not** yet corrected in place:

- `TUNING_INFO.hangLateral` still describes the pre-rework capped/damped/glued
  hang drift; the cap is effectively off and no damping code exists.
- `pipeAirGravity`'s description says "30", the default is 31.
- `railLandSmack`'s header documents a −1.5 fall-speed gate its own body says
  was replaced.
- `stepAir`'s slam gate comment misstates the `updateGrab` call order.

These are comment-only defects (no behaviour impact) — listed here so the port
does not encode the prose instead of the code.
