# Jump motion study — 3 November 2026 NZDT

The local Jak and Daxter study informs the timing and silhouettes of original
Prototype Fork animation curves. Extracted models and animation samples remain
outside the repository and the published game.

The source's arms trail low at takeoff, spread into bent wings as the knees
gather, and rise during descent. Its compact apex pitches the body forward while
the head counterbalances. The OpenGOAL controller retimes the rising pose toward
authored frame 20 at the physical apex; double jump restarts the same jump family
at frame 5 with a 50 ms blend. We adapt those principles to this character's
proportions and existing controller. This is not a claim of identical game feel:
A and B preserve the existing physics. The later C experiment changes only
normal on-foot flight, retaining the existing release/hold-to-skate input rules.

`src/animation/jumpReferenceMotion.ts` supplies the editable pose changes:

- Jump keeps the large independent torso/limb stretch, begins gathering sooner,
  and reaches an asymmetric knee tuck at the physical apex. Fall begins from
  that same pose and lifts the arms while opening the legs for landing. Fall's
  timeline is normalized downward speed; the recovery spans that interval.
- Double jump replaces the wide split with a second pop, compact asymmetric tuck,
  and descent recovery. A 50 ms presentation blend catches the interrupted pose.
- Landing retains the existing compression, rebound and finite settle. The
  chest, head, elbows and wrists follow through at different times.

The shared elasticity profiles retain ownership rules; segment length curves
remain editable in Animation Studio. A/B introduce no whole-skeleton scale animation, root motion, movement
constants, jump impulses, steering, collisions or jump-input changes. Slide jumps and specialized launch/board clips keep their poses.
Holding jump while running still mounts the board according to the existing rule.

Catalogue 38 upgrades only exact untouched old defaults, including normalized
saved drafts. Edited clips and deliberate deletions remain intact. The old
factory curves are retained for that comparison. The regression fixture
`tools/fixtures/pre-reference-jump-clips.json` contains **Prototype Fork's own
catalogue 37 curves**, generated from `createPlayerStarterClips()` at commit
`1a191907`; it contains no extracted Jak keyframes.

## Review and validation

`jump-review.html?playtest&level=codex-lab&nocrt` starts in **live play** on the
selected level, with normal keyboard/controller input and the regular camera.
Press **1 / 2 / 3** or click the three visible buttons:

| Variant | Animation | On-foot physics | Sounds |
| --- | --- | --- | --- |
| A · Original | Previous catalogue 37 | Original | Original |
| B · Animation | Revised jump family | Original | Local Jak placeholders |
| C · Jak feel | Earlier gather, deeper body fold, shorter stretch | Experimental Jak fit | Local Jak placeholders |

Switching does not respawn or reset velocity. A physics selection takes effect
at the next ground jump; each in-flight arc retains the profile it launched
with. A's double-jump blend is the original zero-length transition; B/C use
50 ms. Uncheck **Jak sounds in B / C** to compare motion without audio changes.
The session uses ephemeral campaign progress and never saves animation drafts.

C uses symmetric 60 m/s² gravity, approximately 1.05–2.8 m first-jump heights,
1.8 m additional second-jump height, 120 ms directional steering and 220 ms
neutral air coasting. The reference has 1.01–3.5 m first-jump and 1–2.5 m
second-jump targets with a 0.7 m collision offset; our values fit those principles
to the existing character and collision controller. The source's animation
time-to-apex calculation uses 245760 GOAL units/s² (60 m/s²). C retains
release-to-jump so the existing held-button skateboard mount stays intact.
This is an experimental feel variant, not a reconstruction of every Jak input
or collision rule. No global tuning is modified. Board, park/vert, slide,
crouch, spring, grind-exit, kite and ragdoll paths retain their normal rules.

Measured on the real controller at 60 Hz: three-frame tap peaks at 1.268 m
with 0.417 s airtime; full jump peaks at 2.799 m with 0.617 s airtime; a second
jump adds 1.799 m. Tests compare both directions of mid-flight profile switching
against an uninterrupted control trajectory. The existing 1,344-frame skating
suite runs with C selected on one rider and default settings on the other;
all movement and contact checks match, as does the 180-frame hold-to-mount test.

**Playtest options → Watch motion** retains the automated tap/full/double/run
sequences, camera angles, slow motion and phase pauses. **Play course** returns
to the previous course position. Add `lite` to the URL for the fast renderer.
This development page is excluded from production. Per the user's follow-up,
the change remains local for A/B/C evaluation and has not been pushed/published.

## Local sound placeholders

The resident `COMMON.SBK` in the supplied USA NTSC-v1 data contains `jump` and
`jump-double`. The local extractor decodes PS-ADPCM, applies each tone's pitch
and volume, and schedules the second jump's voice at 12 sound ticks (50 ms).
There are three variations for each cue. The resulting WAVs use linear
resampling rather than the original SPU interpolation and mixer. The four pitch
register values match OpenGOAL's table calculation: 1675, 1774, 1880 and 1364.

```sh
python3 tools/extract-jak-jump-audio.py /path/to/SBK/COMMON.SBK /path/to/local-study/audio
JAK_REFERENCE_AUDIO_DIR=/path/to/local-study/audio npm run dev -- --host 127.0.0.1
```

The development server exposes only the six named WAVs and manifest. It loads
them atomically and routes semantic launch cues through the normal SFX bus,
volume controls and unlock policy, avoiding immediate repeated variants. This
also works in the playable level. Missing files retain the project sounds.
Extracted assets stay outside the repository, `public/` and production builds.
The extractor, sound routing and review tools are reproducible source code.

Primary implementation evidence:
[jump controller](https://github.com/open-goal/jak-project/blob/v0.3.9/goal_src/jak1/engine/target/target.gc),
[bank reader](https://github.com/open-goal/jak-project/blob/v0.3.9/game/sound/989snd/loader.cpp),
[grain sequencing](https://github.com/open-goal/jak-project/blob/v0.3.9/game/sound/989snd/sfxgrain.cpp),
[240 Hz sound clock](https://github.com/open-goal/jak-project/blob/v0.3.9/game/sound/989snd/player.cpp).

Focused checks:

- `node tools/test-jump-reference-motion.mjs`: original pose intent, exact and
  normalized saved upgrades, preserved edits/deletions, 1,820 frames across tap,
  full, running and early/apex/late double jumps, exact before/after controller
  position/velocity/steering parity, and finite landing recovery.
- `npm run check:animation`: suite/schema, IK, runtime routing, fixed-length leg
  solve, all four clips' arm clearance, board contact regression, and elasticity.
- `node tools/test-idle-recovery-charge.mjs`: planted charge, tap/full input,
  landing's timely idle recovery, and no second recovery fade.
- `node tools/test-jak-jump-physics.mjs`: C heights/airtime, momentum, finite
  recovery, selection continuity and unchanged hold-to-skate behavior.
- `node tools/test-jump-audio.mjs`: launch fallback, atomic bank installation,
  sound selection and non-repeating variants with no extra pitch jitter.
- `npm run check:audio`: existing loop, replay and footstep behavior.

Review at full render resolution as well as the normal game presentation. The
reference is pose/timing guidance, not an assertion that our motion reconstructs
the original game's renderer, physics, animation blending or effects.
