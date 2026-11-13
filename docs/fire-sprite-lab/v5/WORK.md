# Fire v5 — preserved motion with shared paint

## User direction

The user rejected v4 before publication: increasing the independently generated cel count did not fix inconsistent contours, interior repainting or brightness pulses. The courtyard remains part of the requested result.

The supplied torch and basin recordings, direct 4K Rude Awakening gameplay, and the Beyond-FX reel were inspected. All 288 torch capture frames and their original timestamps were retained locally. Subsequent imagegen trials from both footage and isolated Unity source frames still drifted between adjacent outputs. The user then explicitly chose: **“Preserve source motion with shared imagegen artwork (Recommended)”**. This supersedes the earlier requirement that every cel be generated separately.

## Current implementation

Two CC0 Unity Labs flipbooks supply 64 unchanged native source poses each. The longer raw exports are not loop-safe. The supplied packaged cycles have close boundary poses, confirmed by frame stepping across 63→0 in the actual material. Flame03 is shared by narrow arrangements; Flame02 by the basin, altar and hearth.

`clean-pilot/120.png` is selected only as shared palette artwork. Its six sampled colours are applied identically to every source frame. The full native painting and all rejected outputs are preserved. Alpha and intensity are remapped by one fixed shader curve. There is no per-frame repainting, exposure normalization, geometric warp or default interpolation. Playback is an authored 48 fps, not a measured Crash 4 rate.

The first material test incorrectly used source RGB alone, which turned the thin sheets into a white ghost. Source alpha also carries intensity; incorporating it restored the red/orange sheets. A fixed alpha curve makes the native material read as stronger cel-like masses. Additive layering then washed out the basin and ring in the court; screen compositing retains colour in those overlaps. These are material changes, not changes to source frame geometry.

Wall torches have different starting phases. The jet's two tongues remain fixed at the outlet. The former emitter of tiny whole-flame copies is removed. The supplied source's own small separating remnants are retained. There are 34 exhibition sprites or 41 in the courtyard. Existing shared Jak heat code and main-game movement are unchanged.

## Visual review so far

The local three-panel comparison uses the supplied phone capture, rejected v4 and the actual v5 shader. Reviewed both packaged loop boundaries and quarter/normal playback; recorded all 64 rendered poses from each cycle. The lower source stays registered while upper shapes rise and separate. V4's independent paint changes are absent because the new sequence has one fixed material. The capture remains a visual target, not a matching phase or a source of shipped pixels.

Reviewed the new material in the playable court at native resolution, including the central basin and overlapping distant arrangements, and in the focused bonfire view. Screen compositing retains red/orange detail where additive layering clipped to white. Paused heat-on/off captures verify the existing refraction. Browser console has no warnings/errors in these checks.

Source detail is limited by the author's packaged frame sizes (128×256 and 64×128). Native preservation does not imply high-resolution source art. Do not call the result pixel-identical to Crash 4, and do not substitute counts or pixel audits for aesthetic acceptance.

## Validation and delivery

Native TGA conversion and runtime visible pixels/alpha pass exact checks. Production TypeScript/build, release size (935,986,203 / 1,000,000,000 bytes), tool directory and diff checks pass. No rejected v4 runtime will be published. All original artwork remains in the authoring archive.


Final production review used the Pages subpath and build stamp **Codex/sol fork · 11-13 00:43 UTC**, first lite then full rendering. Walked to the hearth, around the basin, through the checkpoint and stairs, jumped the altar, reached the temple finish, and returned with R. Saved native hearth and sanctuary views. Tested source 63→0 stepping, hue presets, quarter-speed playback, 720p/MAX and the rooted jet. The first collection framing cropped outer exhibits in a tall window; the final framing fits all eight. Compact 390×844 review verified movement-button holds, exhibit paging and opening the inspector without page overflow. Browser consoles were clean.

The paused interior-scene comparison excludes FPS text and controls. Repeat pause is identical; heat-on/off changes 1,592 pixels above a 3-level channel difference; zero strength matches disabled heat exactly. See `browser/heat-check.json`. These are heat/playback checks, not aesthetic scores.

The local normal-speed comparison video records 230 actual browser poses over 4.79 seconds, including three v5 loop joins, beside the supplied torch recording and rejected v4. It retains their independent time progressions, rather than repeating a short reference segment. It is in ignored `reference-media/final-comparison/normal-speed.mp4` because it includes supplied game footage. All final source shapes use the shared palette/screen material. No external headless browser harness was run in this revision; browser checks used CUA.

Timing: the requested courtyard was first playable in about 13 minutes (10:24–10:37 NZDT). After the source-first correction at approximately 12:11, the v5 source-motion review page was created at 13:10:58 (about 60 minutes). Final local validation completed around 13:50 (about 99 minutes after that correction). These are the recorded local milestones, not a claim that the rejected v4 work was accepted.
