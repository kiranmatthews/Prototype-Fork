# Character evaluation surface

The browser animation suite authors the project's semantic 22-joint humanoid
rig. The visible evaluation body is the female mannequin from Quaternius'
Universal Animation Library 2. These are deliberately separate contracts:

- The procedural rig owns gameplay contacts, stable joint IDs, keyframes,
  procedural drivers, IK targets and independent segment-length controls.
- The Quaternius mannequin keeps its original 65-joint skeleton, inverse bind
  matrices and smooth skin weights. It is a presentation surface, never a new
  gameplay authority.
- Animation documents therefore survive a later character redesign. A future
  humanoid skin needs an adapter to the semantic rig; it does not require the
  animation library to be rewritten.

## Final-pose order

Every frame resolves in this order:

1. legacy/gameplay pose;
2. browser-authored keyframes and procedural drivers;
3. source-rig IK and independent limb/torso length controls;
4. canonical-pose retargeting onto the intact Quaternius skeleton;
5. presentation-only foot/hand contact correction;
6. volume and shoulder corrective morphs;
7. render interpolation of bones and morph weights.

The retarget step uses world-space deltas from the source rig's published
canonical T-pose. The source body's rendered neutral stance has its arms down,
so treating that stance as the retarget reference would leave a skinned target
stuck in a T-pose.

## Corrective deformation

The shipped mannequin has no authored morph targets. At load time the adapter
generates relative position morphs on both skinned primitives for the upper and
lower arms, thighs, shins and two torso sections. For a segment length ratio
`L`, the radial corrective influence is:

```text
radial scale delta = 1 / sqrt(L) - 1
```

This keeps segment volume approximately constant: stretched segments get
narrower and squashed segments get wider without non-uniformly scaling child
joints. Separate pose-space correctives preserve the left and right deltoid
volume during elevated and forward/back shoulder poses.

The existing procedural sole and grip sockets remain the contact targets. A
presentation-only two-bone solve fits the mannequin's different proportions to
those targets, so evaluation does not trade smooth shoulders for sliding feet.

## Authoring workflow

The female mannequin is the default visible body after its local GLB loads. Use
`BODY` in the Tuner or the Animation Studio BODY control to cycle through:

1. `FEMALE` — Quaternius' conventional 65-joint evaluation mannequin;
2. `MESHY FOX` — the user-supplied Violet Vixen with its intact native
   24-joint A-pose skeleton and smooth skin;
3. `RIG` — the procedural source body.

The Meshy FBX is loaded only when selected. The Studio continues to select and
edit the source joint IDs in every view. Its animation selector, timeline,
keyframes, procedural drivers and per-clip playback speed all operate
identically.

The Meshy surface is deliberately a comparison instrument, not a replacement
rig decision. It propagates independent endpoint lengths but does not yet own
the Quaternius model's generated volume/shoulder corrective morphs. Its source
also has 3,911 vertices with more than four weights; standard Three.js retains
the strongest four, with the largest discarded weights concentrated around the
upper torso and shoulders. Those source limitations must be separated from
proportion and rest-pose differences when judging the result.

`player.run` demonstrates the import path: Pack #1's in-place
`Jog_Fwd_Loop` is sampled at its native 30 FPS, transferred through canonical
world-space deltas, and stored as 29 ordinary linear keys on each semantic body
joint. The source GLB's limb translations and scales are deliberately omitted,
so neither the procedural rig nor the female evaluation body's proportions are
replaced. The final seam is closed exactly and every resulting key remains
editable in Animation Studio.

Catalog revision 4 also makes the replacement durable across browser storage:
an older local `player.run` is replaced by Jog_Fwd, while a genuinely edited
pre-Jog clip is retained as `player.run.pre-jog-local` instead of silently
overriding the requested Run or being discarded.

Additional Quaternius clips should follow the same conversion path. They should
not replace the source rig or bypass the browser-editable layers.
