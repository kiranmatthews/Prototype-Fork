# Balance profile v20

Correction strength is slightly higher than v19: grind **2.8 → 3** (+7.1%), manual **3.8 → 4** (+5.3%), lip **2.1 → 2.2** (+4.8%). Cubic edge pull, momentum, noise and immediate boundary failure remain unchanged.

Re-entering a grind, manual or lip stall during a live combo now retains **90% of the previous needle offset and velocity**. For example, a needle at +0.80 returns at +0.72, still moving in the same direction at 90% of its departure velocity. The new `balanceReentryRelief` tuner defaults to 0.10. Accumulated time spent balancing and the noise phase carry through each link, including grind/manual switches; actual airtime pauses them. Repeated valid hops each grant that small relief, while continuous grind-style changes grant none. Banking or breaking the combo, respawning and starting a new run clear the history for a fresh catch.

Focused coverage includes six real charged-ollie/Square/Triangle re-catches with mirrored needle signs, manual and lip transitions, continuous style switches and combo reset boundaries. The browser review's **Rejoin left/right** actions show departure/catch offset, velocity and accumulated time beside the actual combo and meter.

## Underlying v19 edge model

Grinds, manuals and lip stalls share a needle position and velocity. The previous edge term was linear in position, with instant velocity reversal at the default inertia setting. Fast grinds also received a 56% drift discount, and the peg grace allowed another 150 ms of recovery after reaching an end.

The new edge term is `sign(balance) × |balance|³ × balanceGravity × modeDrift`. At the default gravity of 6, the outward rate target before input/noise grows as follows:

| Distance from centre | Base drift multiplier |
| --- | --- |
| 0% | 1.00× |
| 25% | 1.09× |
| 50% | 1.75× |
| 75% | 3.53× |
| 90% | 5.37× |
| 100% | 7.00× |

Velocity approaches that target over time. Counter-input first brakes the existing outward motion; it cannot reverse the needle instantly. The response and its travel are integrated over the whole fixed step. The zero-inertia option remains available for direct response.

| Tuner | Previous default | New default | Purpose |
| --- | --- | --- | --- |
| Balance Edge Power | Linear formula | 3 | Cubic escalation, especially through the outer third |
| Balance Gravity | 2 | 6 | Stronger pull near the ends |
| Balance Inertia | 0 | 0.85 | Carried velocity and overshoot |
| Balance Speed Effect | 1.4 | 0.75 | Fast grinds keep 70% of base drift instead of 44% |
| Grind Calm | 0.45 s | 0 s | No protected catch period |
| Balance Grace | 2 s | 0 s | Difficulty starts increasing immediately |
| Balance Safe Period | 0.10 s | 0 s | Full control authority at entry |
| Bail Grace | 0.15 s | 0 s | Resolve a boundary crossing on that physics step |
| Balance Ramp Max | 6× | 3× | Stronger edge dynamics without overpowering centred ordinary-speed grinds solely through elapsed time |

Base drift, noise, and the time-ramp rate retain their existing defaults; v20's control changes are listed above. The saved-tuning merger makes untouched values follow new build defaults while retaining deliberate edits. The ranges/help text expose Edge Power, Reentry Relief and the disabled optional grace settings.

The catch-direction filter has been removed: holding a direction can push the needle out, even if it was held when the rail was caught. High rails and open gaps no longer receive the old automatic clean-air save. Actual coping transitions retain the verified wheels-down drop-in, and inward lip failures retain their intended lip release. Explicit earned perfect-balance powerups are unchanged.

The meter warns from 70% rather than waiting for a peg that no longer has a recovery period. Focused checks cover mirrored edge pull, early versus late recovery, carried velocity, same-step failures for grind/manual/lip, and the coping drop-in regression. At speed 8 in the test setup, untouched grinds fail in approximately 0.78–0.83 s; a wrong-direction hold fails in about 0.28 s. A predictive control sequence holds the middle for twelve seconds through the difficulty cap without any balance powerup, demonstrating that there is no forced time limit.

Local review: `balance-dynamics-review.html?playtest&level=jungle-cup`. Its scenarios use real rail catches and the current live tuning; the controls do not save tuning or campaign changes.
