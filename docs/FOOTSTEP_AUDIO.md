# Footstep audio

Walking and running use the final rendered shoe poses. `Player.updateFootstepAudio()` runs after render interpolation, measures both outsole meshes above the current support plane, and sends contacts to `FootstepContacts`. A foot must lift relative to its partner before another attack is possible. The attack occurs when it reaches the floor or finishes its downward stroke; the imported jog intentionally retains a small visual clearance above the floor. This includes animation blends, saved clip speeds, elasticity and sole seating.

There is no footstep timer and no forward-speed gate. Sideways, diagonal and backward motion use the same detector. Speed magnitude controls loudness and walk/run bank choice, not cadence or sample playback speed. Idle, airborne, sliding, skating, bailing, dead and world-map presentations clear pending contacts. Teleports and interpolation resets clear them too. Each player and foot has a separate audio debounce channel. Existing jump/landing effects and skate/grind loops keep their own ownership.

The ice animation uses small asymmetric recoveries separated by glides. Its contact detector measures each foot's rise and fall relative to the other, removing shared torso bounce; a completed corrective scuff emits one attack. Sliding continuously with planted feet emits none.

## Adding supplied foley

1. Place trimmed, attack-first files under `public/sfx/`, preferably grouped by surface. Do not bake the interval between steps into a sample.
2. Register the sound IDs and relative filenames in `FILES` in `src/audio.ts`. They use the existing bounded decoder, offline packaging and SFX volume/mute bus.
3. Assign those IDs to `FOOTSTEP_BANKS` in `src/footstepAudio.ts`, for example:

```ts
grass: {
  walk: ['grassWalk1', 'grassWalk2', 'grassWalk3'],
  run: ['grassRun1', 'grassRun2', 'grassRun3'],
},
wood: { walk: ['boardwalk1', 'boardwalk2'], run: ['boardwalkRun1'] },
stone: { walk: ['rock1', 'rock2'], run: ['rockRun1'] },
ice: { walk: ['iceScuff1', 'iceScuff2'], run: ['iceCatch1'] },
```

Supported material banks are `generic`, `grass`, `wood` (including boardwalks), `stone` (including rock), `ice`, `snow`, `concrete`, `sand`, `dirt` and `metal`. Selection reads the current collision support's existing material classification; ice is separated from snow by its surface/texture name. A missing or empty gait bank falls back to the existing three generic samples. No distinct surface recordings ship with this change. Sound selection does not change traction or edge grinding.

`node tools/test-footstep-audio.mjs` checks real animation cadence in every travel direction, both feet, analog speeds, 30/60 Hz presentation, contact suppression, material banks and movement invariance. `node tools/test-footstep-audio-browser.mjs <preview-url>` checks real Chrome lite/full rendering and one Web Audio source per visible foot contact.
