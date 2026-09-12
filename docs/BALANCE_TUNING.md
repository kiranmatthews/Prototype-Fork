# Balance tuning audit v21

The supplied `replay-JungleCup-2026-09-12T05-29-24.json` contains 14,165 fixed steps. It records the user's edits at frame 7,510 (125.17 s): rail snap 2.1 → 1.5, manual drift 0.65 → 0.35, grind drift 0.9 → 0.65, correction 3 → 3.7. Those controls did write to the simulation.

Four problems made the results misleading:

- A held direction used to choose a grind also immediately pushed its needle. Raising correction strengthened this outward input as well. Two fresh first-heat catches failed after 0.35 and 0.317 seconds; a linked catch with outward momentum failed after 0.167 seconds.
- Grind calm was cached at catch, scaled by speed, then evaluated against accumulated **combo** balance time. A later re-entry could skip it entirely, and moving its slider during a catch did not update the cached duration.
- Replay load, recorded tuning edits and replay exit changed the simulation without refreshing the visible sliders. A replay tuning callback now refreshes those readouts without clamping or altering historical playback physics.
- The old `balanceSafePeriod` suppressed **inward** correction while leaving outward input unrestricted. Its name made it look helpful for preventing early bails when it could do the opposite.

Each catch now has its own settling clock. Natural drift, edge pull and noise ease in smoothly; inward correction is always fully available. Catch Input Ease temporarily reduces outward input. There is still no default rescue buffer after the meter reaches an end. Re-entry continues to retain **90% of position and velocity**, all accumulated difficulty and the noise phase. A banked/broken combo starts fresh.

One apparent instant failure was a catch 9 cm from a rail's end, immediately followed by a clean end-of-rail exit. Catches that would run off their endpoint within two physics ticks are now rejected, avoiding a one-frame grind/meter flash. Approaching the same end inward remains valid.

## Current defaults

| Control | v20 | v21 |
| --- | ---: | ---: |
| Grind Drift | 0.9 | 0.7 |
| Grind Correction | 3 | 3.4 |
| Grind Entry Lean | fixed 0.15 | tunable 0.10 |
| Grind Catch Settle | 0 s | 0.50 s |
| Manual Drift | 0.65 | 0.50 |
| Manual Correction | 4 | 4 |
| Manual Catch Settle | absent | 0.35 s |
| Catch Input Ease | 0 s, inward suppression | 0.25 s, outward easing |
| Balance Edge Pull | 6 | 4.5 |
| Balance Momentum | 0.85 | 0.70 |
| Combo Difficulty Delay | 0 s | 1 s |
| Combo Difficulty Ramp | 0.25/s | 0.18/s |
| Combo Difficulty Cap | 3× | 2.5× |
| Edge Curve Power | 3 | 3 |
| Linked Catch Relief | 10% | 10% |
| Balance Bail Buffer | 0 s | 0 s |

The edge term remains cubic: `sign(balance) × abs(balance)^3 × edgePull × modeDrift`. Counter-input brakes velocity rather than replacing it. Catch settling changes pressure, not the stored entry position/velocity. Linked hops remain useful without erasing balance risk.

## Slider audit

The panel separates **GRINDS**, **BALANCE · SHARED**, and **MANUAL & LIP**. Storage/replay keys remain stable when labels change. Saved values are clamped to the displayed range on load/reset, preserving deliberate in-range edits. Untouched saved defaults follow v21 automatically.

| Key / control | Runtime effect and scope |
| --- | --- |
| `railSnapDistance` | Live 3D catch radius; does not influence the balance force. |
| `grindApproachMargin` | Moving-catch angular eligibility; 0 permits perpendicular approaches. |
| `railTripSpeed` | Side-impact bail threshold when hitting a rail without a valid grind; not a balance control. |
| `railSpeedBoost` | Extra speed applied at the next catch. |
| `grindDrag` | Live speed loss per second, weighted by grind style. |
| `perfectGrindSpeed`, `perfectGrindHold` | Speed and duration of the earned full-rail reward; not ordinary grind speed or balance immunity. |
| `grindSpeed` | Live reference speed for balance instability. Actual rail speed comes from the approach. |
| `grindJumpForce` | Ollie release velocity, scaled from 72% to 100% by charge. |
| `underRailCooldown` | Cooldown assigned on the next under-rail switch. |
| `balanceDrift`, `balanceControl` | Live grind pressure/correction. Drift also scales the cubic edge term. |
| `balanceEntryLean` | Initial offset only for a new-combo grind; linked catches use retained balance. |
| `grindCalm` | Live duration of each grind catch's pressure/noise easing; no speed scaling or cached value. |
| `balanceSpeedEffect` | Live influence of speed on instability; 0 ignores speed. |
| `balanceReentryRelief` | Fraction relieved at the next linked entry, shared across grind/manual/lip. Does not alter an already-live meter. |
| `balanceGrace` | Shared accumulated-balance delay before difficulty grows, not a new grace on each entry. |
| `balanceRamp`, `balanceRampMax` | Live growth/cap; manual growth is 1.5× and lip growth 2× the grind rate. |
| `balanceGravity`, `balanceEdgePower` | Live strength/shape of outward edge pull, shared by all balance modes. Near centre the edge term is deliberately small. |
| `balanceInertia` | Live velocity response; 0 is direct, higher values retain more momentum. |
| `balanceNoise`, `balanceNoiseFreq` | Live wander amplitude/rate. Rate has no visible effect when amplitude is 0; catch settling also quiets noise. |
| `balanceSafePeriod` | **Catch Input Ease**: outward input eases in per catch; inward correction is always full. 0 disables it. |
| `bailGrace` | Live optional time beyond the boundary; 0 remains immediate failure. |
| `manualMinSpeed` | Start threshold; an existing manual survives down to 70% of it. |
| `manualDrift`, `manualControl` | Live manual pressure and up/down correction. |
| `manualCalm` | Live duration of pressure/noise easing after every manual entry. |
| `manualFlickWindow` | Maximum interval between the two directional taps. |
| `manualArmWindow` | **Manual Landing Buffer**, newly exposed from the former fixed 0.35 s constant: how long a completed airborne flick waits for touchdown. |
| `manualLandGrace` | **Landing Combo Grace**: minimum post-landing/revert link time. Its range now starts at the real 0.15 s combo floor rather than presenting an ineffective 0–0.15 interval. |
| `manualCoyote` | Brief unsupported-ground tolerance. The needle freezes while airborne; an intentional ollie still ends the manual. |
| Lip angle/max time/drift/control | Existing lip catch angle, hold cap and pressure/correction remain connected. Shared balance settings are now clearly grouped above them. |

Entry-only controls naturally do not change a catch after their window has elapsed. Replays intentionally restore their recorded settings and mid-run edits; replaying an old file alone is not a test of the new factory defaults.

## Evidence and review

`tools/fixtures/grind-entry-inputs.json` preserves three first-heat catch windows. Replaying these inputs on an isolated long rail avoids changes in later trajectories masking the balance comparison:

| Source catch frame | Old uncorrected failure | v21 uncorrected failure |
| --- | ---: | ---: |
| 1788 | 0.350 s | 0.983 s |
| 2791 | 0.317 s | 0.850 s |
| 3294, linked | 0.167 s | 0.833 s |

A fresh untouched grind now lasts about 1.417 s versus the earlier 0.78–0.83 s. Holding outward indefinitely still fails. A twelve-second active sequence stays within 0.251 without a powerup. Exact 90% linked carry, immediate boundaries, inward coping drop-in, trick chords, endpoint directions and live motion/balance/manual tuners are covered by focused checks.

The real browser's editable Grind/Manual Catch Settle controls were exercised at **8 seconds of combo age** and **0.05 seconds of entry age**. Changing 0 → 1 s reduced first-step grind velocity from 0.495 → 0.0063 and manual velocity from 0.544 → 0.0069, confirming the sliders reach the live handlers and no longer get bypassed by combo age.

Local review: `balance-slider-review.html?playtest&level=jungle-cup`. It provides the captured direction patterns and fixed grind/manual probes alongside the actual TUNER. No tuning save is needed. `tools/audit-balance-replay.mjs <replay.json> [report.json]` records catches and exits. Replay v2 has no menu-triggered heat-reset markers, so only first-heat windows are claimed as path reproductions; isolated input comparisons are used beyond that limitation. No full suite is required for this audit.
