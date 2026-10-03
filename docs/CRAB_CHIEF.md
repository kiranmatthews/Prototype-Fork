# Tidebreak · Crab Chief

A source-owned, three-phase reef boss encounter. Play `/?playtest&level=crab-chief`, or select **Tidebreak · Crab Chief** in the developer MENU. `src/levels/crab-chief.ts` owns the supported arena, entrance pier, terraces, ramps, two curved grind rails, checkpoint, lagoon pit, normal follow camera and defeat-driven completion. `encounter: 'crab-chief'` survives editor copy, export and validated import.

## Fight

The chief has nine pearl segments, three per phase. Every attack has a visible warning followed by a punish window. A walk into the pearl cannot damage it, and each opening accepts one hit.

| Phase | Attacks | How to strike |
| --- | --- | --- |
| Clawbreaker | Alternating aimed claw slams and expanding ripples | Leave the locked red circle, jump the ripple and spin the lowered golden pearl. A fast board strike also works. |
| Tongue Rider | Aimed pincer bubble volleys alternate with claw slams | After the attack, his tongue unfurls from his mouth into an uphill rail. Catch it and grind all the way up to strike him. The terrace rails do not grant boss damage. |
| Sand Launch | Low sweeps, paired ripples, slams and bubble volleys | A sand skate ramp forms. Build speed, ride up the ramp and spin into the chief while airborne. Walking up, jumping from elsewhere or reaching him without a spin cannot damage him. |

Keyboard: arrows/WASD move, Space jumps (hold while moving to push on the board; release for a charged ollie), F strikes, E catches a rail and left/right balances it, Q uses the existing grab/brake controls. The HUD shows only a chief portrait, name and continuous green-to-orange health bar. It contains no hearts, attack instructions, phase/charge text or control prompts. No movement tuning defaults are changed.

Every attempt starts with two masks. Ordinary mask damage, invulnerability and uber rules apply; an unmasked attack is fatal. There is no separate heart pool or phase heal. Reaching a new phase banks that phase for a soft retry. A soft retry restarts that phase's three health segments; a hard restart returns to phase one. Successful tongue and sand-spin hits recoil the rider into the arena. Once the chief yields, a lagoon retry keeps the victory. After the finite kneeling defeat animation, victory completes the level automatically at the chief. Boss levels have no bonus, crystal pickup or warp pad.

## Art and motion

The chief uses the actual textured **Meshy-generated 7,667-triangle surface**, made from an original OpenAI imagegen reference. Its two broad boots, oversized pincers, shell crown, carved shoulder mantle, pearl necklace and woven skirt retain the generated topology and UVs. Meshy's humanoid auto-rig failed; a model-specific 21-joint skin fits this surface instead. The wider boot toes are measured through welded surface connectivity and stay rigidly planted. Skin boundaries blend across UV/normal seams. Head, crown, pincers and skirt have independent semantic joints.

The shared editable character elasticity profiles drive anticipation compression, limb extension, impact rebound and hurt recovery. Individual segments deform between solved endpoints; the actor root stays at `(1,1,1)`. The chief hops toward the locked slam position, lowers its pearl while recovering and finishes with a finite kneeling bow. Claw height is fitted to the actual long generated pincers to maintain floor clearance. Body collision and the pearl target follow the moving chief.

The setting reuses the project's **existing coastal ocean, Island Hopper sand shelf, shoreline foam, Jungle Ruins palm/fern/broadleaf models and map-kit shoreline rocks**. Meshy supplies the new 2,843-triangle throne pavilion and 1,562-triangle conch brazier. The throne sits on the supported islet behind the arena so it does not obstruct the combat or results camera. Boss levels have no bonus entrance, crystal, warp pad or bonus-box tally. A close radial camera stays on the rider’s chief-facing side and pitches toward the fight. Boss controls use that camera's screen direction and preserve a held direction through camera turns; releasing/re-aiming adopts the new view. Airborne board heading and raw grind balance stay stable. Scripted camera views start close, remain within 18 metres, and keep their lens on portrait screens; Cup menus also use the normal close view.

Three image-to-3D jobs consumed **45 existing Meshy credits**; the failed auto-rig consumed zero. No credits were purchased and no plan was upgraded. Delivered models total about 1.81 MB, with 1024² chief/pavilion and 512² brazier diffuse maps. Source references, task IDs, hashes and tooling live in `tools/crab-chief-assets/`; packed-asset reports live beside each GLB in `public/boss/`. Raw provider responses and authoring models remain ignored. Loading waits for all three real assets, and the shared cache releases their leases when the level is disposed.

## Verification

- `node tools/test-crab-chief-skin.mjs`: 900 actual surface motion samples, 9,640 finite vertices per sample, normalized weights, 156 planted sole vertices, floor clearance and whole-rig finite defeat settle. `chief-skin-review.html` provides local front/side/back pose and motion inspection.
- `node tools/test-crab-chief.mjs`: source/editor schema, supported spawn, carapace collision, checkpoint and lagoon respawn, no crystal/warp pad, defeat completion, animation finiteness/planted feet, low-poly budget, earned tongue/ramp strike rules, telegraph lock, mask damage and soft/hard/victory retries.
- `node tools/test-chief-controls.mjs`: screen-relative walking and skating from all sides, held-direction continuity, behind-chief ollies/landings and two-mask start/retry rules.
- `node tools/test-crab-chief-phase-geometry.mjs`: real uphill Rail grind, native sand ground contact, speed-earned ramp launch and geometry lifecycle.
- `node tools/test-crab-chief-journey.mjs`: one complete production `Player` run using only input samples, with all nine earned hits, real grinds, skating strikes, phase transitions, defeat and automatic completion. No pose, health, charge, tuning or phase edits.
- `crab-chief-review.html?playtest&level=crab-chief&lite` and the same URL without `lite`: run the same input pilot in the real browser. The page records rendered rider framing and pre-CRT HUD diagnostics in `#chief-review-evidence`. This authoring page is excluded from the production build.
- `node tools/test-chief-bonus-entrance.mjs`: boss source/runtime exclusion and an old editor copy with an authored pad remain bonus-free; arrival stays supported.
- Required level validation/build scripts plus ordinary enemy, level-security and interface-cache regressions. The full suite is not part of this iteration.

The source encounter lives in its own module, preserving the existing Blockworks geometry lab and the shared published editor pack.

Current full-render combat captures: `docs/crab-chief-tongue.jpg` and `docs/crab-chief-sand-launch.jpg`. Earlier captures document retired iterations.

The revised production-controller journey clears in 4,983 fixed steps (83.05 seconds): three pearl hits, three actual tongue grinds (56.85 m total), then three earned sand-ramp spins. Lip speeds are 12.28, 10.46 and 12.08 m/s. There are zero deaths/bails and both masks remain. Lite and full Chrome runs each finish in 5,023 steps, with the same nine strike kinds, no HUD hints/hearts and no console errors. Full-render inspection records 332 rider/chief framing samples with no vertices behind the camera. The Level Select thumbnail comes from the new real tongue-grind frame.

`node tools/test-chief-camera.mjs` checks boss-facing yaw, close-distance bounds, rider/chief vertical framing and base-camera restoration around the arena. The HUD portrait is a transparent render of the existing Meshy chief.
