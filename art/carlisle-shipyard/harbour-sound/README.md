# Carlisle coastal soundscape

The harbour previously had gameplay effects but no environmental sound bed.
Carlisle now has a long stereo water loop around its docks and a separate wind
loop that opens up with height above the authored water and vertical movement.
At a big bounce apex, water recedes and wind becomes the dominant ambient layer.
The bonus has a quieter base wind level. These are scenery inputs only; the
sound controller never writes player, camera, collision or course state.

Water eases over roughly a second and wind over 0.6 seconds. Respawn teleports
are excluded from speed estimates. Both source phases stay continuous through
ordinary movement. The existing SFX bus controls volume and mute; the existing
pause/navigation policy stops loops. Level disposal removes both Carlisle
channels. Changing to another level leaves no harbour sound behind.

## Source and mastering

`sources.json` records the complete downloaded originals, hashes, creators and
CC0 source pages. The shipped credit record is `public/sfx/carlisle/CREDITS.md`.

- RandomMind's **Sea and river wave sounds** supplies the stereo water recording.
  A 49-second excerpt becomes a 44-second loop with a five-second overlap.
- Luke.RUSTLTD's **wind1** supplies synthesized wind. A 59.9-second excerpt becomes
  a 55.9-second loop with a four-second overlap.

`tools/prepare-carlisle-audio.mjs` decodes originals with Chrome's native decoder.
`tools/master-carlisle-audio.py` applies equal-power overlaps, removes low rumble,
softens high frequencies, levels the beds and repairs the PCM join. Both output
files are 32kHz / 16-bit PCM, with measured peaks below 0.68 and zero boundary
step at the audio engine's one-sample-early loop endpoint. `mastering.json`
records exact lengths, RMS, peaks, processing and compiled asset hashes.

These long beds load only when Carlisle requests them. Preparation uses the
existing two-worker sound decoder queue, deduplicates repeated requests and
respects navigation cancellation. Other levels retain their ordinary sound
bank without downloading these additional 8.8MiB of audio. The first iteration
loaded them globally; that version's passing playback evidence is retained in
`initial-lite/` and `initial-review/`.

## Verification

`tools/test-carlisle-harbour-sound.mjs` verifies a full bounce envelope at
30/60/144 FPS, gain bounds, stable pitch, teleport rejection, invalid-input
handling, position immutability and teardown. `tools/test-audio-loops.mjs`
verifies deferred preparation, deduplicated downloads, decoder concurrency,
navigation cancellation/recovery and the existing shared audio controls.

`tools/carlisle-audio-review.mjs` exercises the compiled game in lite and full
rendering, with actual arrow/Space/spin events. It captures a cargo flight,
measures nonzero audio output and zero output under SFX mute, checks pause/resume,
an unrelated level, the boat bonus and main-level return. It also checks that
ordinary movement retains the same audio sources and that level round trips
do not redownload the beds. The full review saves a live bounce recording and
native 1920×1080 plus normal 480p/CRT screenshots.

Twenty protected source files match the prior steel-deck commit, including
player, camera, tuning, course/bonus, cargo/nitro, slippery slopes and every
earlier art system. Only the existing sound engine's preparation path and
Carlisle presentation integration are shared runtime edits. No mesh, texture,
collision, input or animation change, and no paid services or Tripo spending.

Exact final build/check results are in `validation.json`. This bounded sound
pass does not establish a new continuous four-kilometre clear, sustained FPS,
or completion of the broader polish goal. Local-only publication hold remains.

[Play locally](http://127.0.0.1:5483/?playtest&level=carlisle-coast&art=harbour).
