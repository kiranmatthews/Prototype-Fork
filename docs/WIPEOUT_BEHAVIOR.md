# Bail and breakup behavior

The damage result and the presentation are separate. The controller still owns collision, shield use, lives, checkpoint respawn, and supported recovery. Breakup moves existing semantic joints after collision and animation have finished, then restores them before the next simulation step. It never creates attacking limbs or changes movement tuning.

| Incident | Presentation | Reason |
| --- | --- | --- |
| Failed balance, missed trick, PvP knockdown, ordinary cliff tumble | Intact physics tumble and supported shoulder-roll recovery | Loss of control alone does not imply a destructive impact. |
| Protected skating crash | Intact, shorter bail; existing mask/combo/board rules | A shield visibly softens the same crash. |
| Wall or clothesline hit below 18 m/s into the obstacle | Intact backward tumble | Preserve the body silhouette for moderate hits. |
| Wall or clothesline hit at least 18 m/s into the obstacle | Head pops off; body tumbles backward | Make the head-first contact readable. |
| Low obstacle or crate trip below 16 m/s into the obstacle | Intact forward tumble | Ordinary catches should still feel physical. |
| Low obstacle trip at least 16 m/s | Waist separation: legs stay near the catch; torso carries forward | Match the split to the obstruction. |
| Rail landing with at least 16 m/s incoming planar or downward speed | Loose head, arms and lower legs | A severe bar impact reads differently from simply losing grind balance. |
| Huge-drop landing with at least 22 m/s normal impact, after existing huge-drop judgment accepts the bail | Loose limbs, ordinary recovery | Use actual surface-normal impact; aligned transition landings retain their existing rules. |
| Fatal TNT/nitro/explosion | All pieces scatter away from the actual blast centre with an upward fan | Explosion direction comes from the source. |
| Fatal descending metal crate, active crusher, rolling stone, overhead descending hopper, or direct chief claw slam | Low outward scatter, downward impulse and individual segment compression/rebound | A crushing hit spreads pieces close to the floor instead of launching a firework. |
| Ordinary enemy/projectile contact, pit, lethal floor or water | Intact authored defeat; unsupported corpses continue into a tumble | Keep quiet/unsupported deaths legible and avoid gratuitous scattering. |
| A severe spill becomes fatal | Existing pieces remain loose; a new blast/crush can escalate it | Death cannot recall the body or charge another life. |

Thresholds live in `src/character/wipeoutPolicy.ts`. They classify presentation only; they do not create new bails or change damage thresholds. Wall and trip severity uses the component of incoming speed directed into the obstacle. Mask, invulnerability and uber checks occur before fatal hazard presentation. A protected bail means the controller actually spent a mask: merely carrying one does not soften a wall crash, preserving the existing wall rules. A late boss ripple is ordinary contact; only the direct downward claw hit is crushing.

Regular bails resolve restitution against the contact normal, retain tangential carry, and integrate one world-space angular velocity. Sparse cached surface samples seat the posed body on its existing support. Conservative bounds reject meshes that cannot provide the lowest contact, retaining the same sampled surface while reducing vertex work. Recovery retains planted animation contacts and editable segment elasticity. The system remains an animated rigid-body tumble, not an unconstrained articulated joint solver.

Detached joints use measured local boxes with orientation-dependent support, swept wall contacts, floor normals, bounded surface probes and finite settling onto a stable broad face. Newly solid floors enter the bounded collision set, and moving or removed supports wake resting pieces. Segment recoil uses shared editable elasticity amplitudes. Recoverable pieces dock in order during the existing get-up; fatal pieces stay loose until the normal respawn. Gameplay bounds are measured on the restored character, and existing render batching/interpolation carries the visible pieces.

Run the focused checks with `node tools/test-wipeout-policy.mjs`, `node tools/test-break-apart.mjs`, `node tools/test-ragdoll-recovery.mjs`, `node tools/test-death-performance.mjs`, and `node tools/test-campaign-death-flow.mjs`. `tools/test-break-apart-browser.mjs` and `tools/profile-death.mjs` provide rendered review and descriptive CPU measurements.
