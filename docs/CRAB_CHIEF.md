# Tidebreak · Crab Chief

A source-owned, three-phase reef boss encounter. Play `/?playtest&level=crab-chief`, or select **Tidebreak · Crab Chief** in the developer MENU. `src/levels/crab-chief.ts` owns the supported arena, entrance pier, terraces, ramps, two curved grind rails, lagoon pit, normal follow camera and defeat-driven completion. There is no checkpoint crate; old editor/import copies also lose that retired component. `encounter: 'crab-chief'` survives editor copy, export and validated import.

## Fight

The chief has nine pearl segments, three per phase. Every attack has a visible warning followed by a punish window. A walk into the pearl cannot damage it, and each opening accepts one hit.

| Phase | Attacks | How to strike |
| --- | --- | --- |
| Clawbreaker | Alternating aimed claw slams and expanding ripples | Leave the locked red circle, jump the ripple and spin the lowered golden pearl. A fast board strike also works. |
| Tongue Rider | Aimed pincer bubble volleys alternate with claw slams; shots and expanding ripples finish travelling before the opening | After the attack, his tongue unfurls from his mouth into an uphill rail. Hold grind near its broad, low tip while walking or skating; the tongue carries the caught board steadily to his mouth. No timed ollie or balance correction is required. The terrace rails do not grant boss damage. |
| Sand Launch | Low sweeps, paired ripples, slams and bubble volleys | A sand skate ramp forms. Build speed, ride up the ramp and spin into the chief while airborne. Walking up, jumping from elsewhere or reaching him without a spin cannot damage him. |

Keyboard: arrows/WASD move, Space jumps (hold while moving to push on the board; release for a charged ollie), F strikes, E catches a rail, Q uses the existing grab/brake controls. Ordinary rails use left/right balance; the chief's tongue has a stable assisted ride and no balance meter. Its rounded tip is 0.32 m high and about 2.8 m wide, with a generous 2.3 m catch radius near the entry and at least 6.5 m/s uphill travel. Misses do not trigger metal-rail trips. A valid late catch can finish before retraction. The HUD contains no hearts, attack instructions, phase/charge text or control prompts. Global movement and rail tuning defaults are unchanged.

Every attempt starts with two masks at the original arrival pier. Ordinary mask damage, invulnerability and uber rules apply; an unmasked attack is fatal. There is no separate heart pool or phase heal. Reaching a new phase banks that phase for a soft retry. A soft retry restarts that phase's three health segments; a hard restart returns to phase one. Successful tongue and sand-spin hits recoil the rider into the arena. Once the chief yields, a lagoon retry keeps the victory. After the finite kneeling defeat animation, victory completes the level automatically at the chief. Boss levels have no bonus, crystal pickup or warp pad.

## Art and motion

The chief uses the actual textured **Meshy-generated 7,667-triangle surface**, made from an original OpenAI imagegen reference. Its two broad boots, oversized pincers, shell crown, carved shoulder mantle, pearl necklace and woven skirt retain the generated topology and UVs. Meshy's humanoid auto-rig failed; a model-specific 21-joint skin fits this surface instead. The wider boot toes are measured through welded surface connectivity and stay rigidly planted. Skin boundaries blend across UV/normal seams. Head, crown, pincers and skirt have independent semantic joints.

The shared editable character elasticity profiles drive anticipation compression, limb extension, impact rebound and hurt recovery. Individual segments deform between solved endpoints; the actor root stays at `(1,1,1)`. The chief hops toward the locked slam position, lowers its pearl while recovering and finishes with a finite kneeling bow. Claw height is fitted to the actual long generated pincers to maintain floor clearance. Body collision and the pearl target follow the moving chief.

The setting reuses the project's **existing coastal ocean, Island Hopper sand shelf, shoreline foam, Jungle Ruins palm/fern/broadleaf models and map-kit shoreline rocks**. Meshy supplies the new 2,843-triangle throne pavilion and 1,562-triangle conch brazier. The throne sits on the supported islet behind the arena so it does not obstruct the combat or results camera. Boss levels have no bonus entrance, crystal, warp pad or bonus-box tally. A close radial camera stays on the rider’s chief-facing side and pitches toward the fight. Boss controls use that camera's screen direction and preserve a held direction through camera turns; releasing/re-aiming adopts the new view. Airborne board heading and raw grind balance stay stable. Scripted camera views start close, remain within 18 metres, and keep their lens on portrait screens; Cup menus also use the normal close view.

Three image-to-3D jobs consumed **45 existing Meshy credits**; the failed auto-rig consumed zero. No credits were purchased and no plan was upgraded. Delivered models total about 1.81 MB, with 1024² chief/pavilion and 512² brazier diffuse maps. Source references, task IDs, hashes and tooling live in `tools/crab-chief-assets/`; packed-asset reports live beside each GLB in `public/boss/`. Raw provider responses and authoring models remain ignored. Loading waits for all three real assets, and the shared cache releases their leases when the level is disposed.

## Verification

- `node tools/test-crab-chief-skin.mjs`: 900 actual surface motion samples, 9,640 finite vertices per sample, normalized weights, 156 planted sole vertices, floor clearance and whole-rig finite defeat settle. `chief-skin-review.html` provides local front/side/back pose and motion inspection.
- `node tools/test-crab-chief.mjs`: source/editor schema, supported spawn, carapace collision, original-spawn lagoon respawn, no checkpoint/crystal/warp pad, defeat completion, animation finiteness/planted feet, low-poly budget, earned tongue/ramp strike rules, telegraph lock, mask damage and soft/hard/victory retries.
- `node tools/test-chief-attacks.mjs`: production Player hit/dodge cases for front-court volleys and slams/ripples, finished hazard travel before the tongue opening, late-rider support and unchanged phase-one timing.
- `node tools/test-crab-chief-tongue-access.mjs`: fixed-input walking/skating approaches from offsets and angles, no balance correction or precise ollie, real mouth hits, safe misses, mounted board presentation and held-button recatch after retraction.
- `node tools/test-chief-controls.mjs`: screen-relative walking and skating from all sides, held-direction continuity, behind-chief ollies/landings and two-mask start/retry rules.
- `node tools/test-crab-chief-phase-geometry.mjs`: real uphill Rail grind, native sand ground contact, speed-earned ramp launch and geometry lifecycle.
- `node tools/test-crab-chief-journey.mjs`: one complete production `Player` run using only input samples, with all nine earned hits, real grinds, skating strikes, phase transitions, defeat and automatic completion. No pose, health, charge, tuning or phase edits.
- `crab-chief-review.html?playtest&level=crab-chief&lite` and the same URL without `lite`: run the same input pilot in the real browser. The page records rendered rider framing and pre-CRT HUD diagnostics in `#chief-review-evidence`. This authoring page is excluded from the production build.
- `node tools/test-chief-bonus-entrance.mjs`: boss source/runtime exclusion and an old editor copy with an authored pad remain bonus-free; arrival stays supported.
- Required level validation/build scripts and focused boss/control/geometry checks. The full suite is not part of this iteration.

The source encounter lives in its own module, preserving the existing Blockworks geometry lab and the shared published editor pack.

Current full-render combat captures: `docs/crab-chief-tongue.jpg`, `docs/crab-chief-volley.jpg` and `docs/crab-chief-sand-launch.jpg`. Earlier captures document retired iterations.

The repaired production-controller journey clears in 5,079 fixed steps (84.65 seconds): three pearl hits, three actual tongue grinds (57.24 m total), then three earned sand-ramp spins. It uses only held grind plus forward input on the tongue, without timed ollies or balance correction. There are zero deaths/bails and both masks remain. Lite/full Chrome runs finish in 5,138/5,136 steps with no checkpoint, HUD hints/hearts or console errors. Full render records 516 real grind frames without an active balance meter and 138 frames of live phase-two projectiles. The Level Select thumbnail comes from the new real tongue-grind frame.

The access matrix covers 32 fixed-input approaches, including six walking approaches started during the unfurl. Production attack checks prove stationary slams/volleys consume a mask, retreat dodges volleys, and sidestep plus a jump dodges the slam ripple. The optional ordinary `test-rail-air-transfer.mjs` check still fails its existing “Boardslide 1 -1 torso faced opposite input” assertion with both the current code and the published `3e36bff` Player/Rail baseline. That unrelated baseline failure was preserved.

`node tools/test-chief-camera.mjs` checks boss-facing yaw, close-distance bounds, rider/chief vertical framing and base-camera restoration around the arena. The HUD portrait is a transparent render of the existing Meshy chief.
