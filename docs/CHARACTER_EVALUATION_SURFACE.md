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
`BODY` in the Tuner or `BODY · FEMALE` in Animation Studio to compare it with
the procedural source body. The Studio continues to select and edit the source
joint IDs in either view. Its animation selector, timeline, keyframes,
procedural drivers and per-clip playback speed all operate identically.

Quaternius animation clips added later should be imported as motion evidence
and converted to the semantic animation document. They should not replace the
source rig or bypass the browser-editable layers.
