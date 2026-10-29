# Ancient Gates mechanism audio

Crushers and phase pads checked only the distance along Z. Ancient Gates runs
along X, so each repeated impact and phase switch was audible across the whole
course. The shared level helper now measures X, Y and Z and applies a squared
fade to silence. Crushers stop at 45 metres, phase pads at 40, falling platforms
at 45 and snapping ropes at 55. The crusher peak is reduced from 0.8 to 0.4.

The existing SFX bus still applies the user's volume and mute controls. No
scenery, level data, collision or mechanism timing changed.

`tools/test-hazard-audio-distance.mjs` drives the actual Level update paths and
records calls to the SFX engine for all four mechanisms, with equal X/Y/Z
offsets, a diagonal beyond range, one cue per transition and the stable human
listener used during rival simulation. See `distance-check.json`.

`tools/test-audio-loops.mjs` verifies the unchanged SFX bus, mute/volume scaling
and audio lifecycle. The local review page's “Sample audio (6s)” control records
actual calls, whether playback nodes started, the current SFX bus gain and
player position. Browser results are in `browser.json`; final build/release
results are in `validation.json`.

Browser outcome: no impact/phase cues at the entrance (X=-20) or Crown Ascent
(X=1195), with SFX at 100%. At X=473 the near hammer plays at gain 0.3265 and the
next at 0.0237; distant hammers are silent. Near Lantern Crossing only the local
phase transitions play. SFX mute reaches bus gain 0 and the prior preference was
restored after testing. The full scene has all 21 main mechanism assemblies
ready, with no asset or console errors.

Build: offline version `1d5b0deec80975f55a09`, 999,808,728 bytes out of the existing
1,000,000,000-byte release cap. No level data changed, so the earlier level
validation remains applicable; only the focused audio checks were rerun.
