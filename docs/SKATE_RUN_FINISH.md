# Timed skate-run finish

1. The live run clock plays one short SFX beep as it crosses 3, 2 and 1 seconds. The cues follow simulation time, respect SFX volume/mute and do not repeat during overtime or pause.
2. At 0:00, ordinary gameplay continues until the skater has landed on standable support, finished every current trick/combo and recovered from any bail. A plain unscored ollie also gets to land. No combo is forcibly banked by the timer.
3. The event enters `finishing`, captures the completed score and closes gameplay input. The skater uses a 0.6-second authored hop to step beside the stopped board. A nearby supported landing is selected; a narrow perch can stow the board in place. The always-skate remount is bypassed only during this finish presentation.
4. The camera, HUD and idle presentation keep running. After dismount, a minimum 0.6-second beat passes, and the actual combo purse and displayed total must finish transferring. The final cash-in ignores the normal display-expiry fallback, so low frame rates or large scores cannot truncate it.
5. Only then is the run judged and the next competition screen shown. The score is committed once. Retry/new-run/level settlement removes the parked board and restores ordinary skating.

`JungleCupEvent.stepRun` now signals the start of finishing. The caller supplies both combo activity and the player's safe-stop readiness. `stepFinish` receives the completed dismount and actual HUD-settled signals; it performs the one-time judging transition.

The finish presentation does not consume or record gameplay replay input. A slower score animation must not exhaust a replay before judging.

The dismount reuses the existing mount pose's hop/tuck/settle shape. It does not introduce a ragdoll or board-physics simulation. The parked visual shares existing board resources and is removed without disposing resources owned by the live skater.

Local review: `run-finish-review.html?playtest&level=jungle-cup`. Scenarios cover grounded expiry, an unscored air at zero, a large final manual, and a bail at zero. The optional dismount hold is for inspecting the pose; it is not part of production gameplay.
