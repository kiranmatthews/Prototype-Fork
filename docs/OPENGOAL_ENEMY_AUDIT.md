# OpenGOAL enemy audit — 9 November 2026

The best first step is eight focused enemy studies, with a complete attack/reaction vocabulary for each. Adding more skins to the current patrol behaviours would leave most of the reported problem intact. This audit adds a reference mode to the existing enemy lab; it does not replace enemies or introduce copied AI.

[Open the reference audit](https://kiranmatthews.github.io/Prototype-Fork/tools/enemies/reference-review.html) · [Current enemy lab](https://kiranmatthews.github.io/Prototype-Fork/tools/enemies/motion-review.html)

## What is actually available

The measured set contains **28 retained Jak 1 enemy meshes, 254 exported animation entries (249 timed clips and 5 single poses), and rigs with 14–67 skin joints**. These are the full `lod0` models already used as dependencies by the published effects lab, with their existing textures, weights and keyframes. No new source models, source AI, or held animation-branch changes are included. Area duplicates are collapsed to one chosen export; the two Double Lurker parts and the two bunny variants remain separate inspection records, not four new gameplay roles.

The wider curated audit has **61 candidate records**:

| Evidence tier | Records | What it establishes |
| --- | ---: | --- |
| Measured, playable source clips | 28 | Packed model hashes, mesh triangles, skin joints, animation duration/channels and keys were inspected. Browser playback is available. |
| Historical Jak 1 export inventory | 9 | The earlier complete export recorded these models/clip names. The active effects pack no longer contains their bytes. Rigs are **not** declared verified. |
| Jak II/3 source survey | 24 | Dedicated enemy state and animation references exist in the official source. No matching local extracted meshes/rigs/clips were verified. |

This is a curated enemy and encounter-host audit, **not an exhaustive trilogy asset inventory**. Jak II/3 models require the corresponding user-supplied game and a separate extraction. Ambient creatures, bosses and multipart actors are explicitly labelled because they cannot be counted as ordinary drop-in enemies.

Pinned reference: **OpenGOAL v0.3.9**, tag commit `b6c8430c0b0a5cb139b939bcf0ffd25285b896c7`, verified against the official GitHub tag. Jak 1 export provenance is the existing user-supplied USA SCUS-97124 NTSC-v1 disc. The source release archive hash remains documented in `JAK_ASSET_LAB.md`. Each candidate records source-file SHA-256, source links, state identifier line numbers, and any measured asset hashes. Source code is read for understanding; none of its function bodies are copied into this audit or runtime.

## First-pass selection

These are recommendations; the lab's personal shortlist starts empty. The proposed behaviours are original implementation briefs, not transcriptions or claims of complete source-game fidelity.

| Study | Source rig / clips | Existing enemy | Behaviour/design lesson | Work to make it our own |
| --- | --- | --- | --- | --- |
| Lurker Crab | 25 joints / 8 clips | Coral Crab | Guarded sideways movement, a distinct exposed peek, snip and kickback. | A new exposure rule, precise claw/hit sockets, transition clips and original crab silhouette. |
| Aphid Lurker | 36 / 9 (4 single poses) | Bristleback | Raised spikes change the threat; ordinary and deadly walks read differently. | Explicit safe/armed phases, spike segment rig and readable anticipation. |
| Jungle Hopper | 39 / 7 | Spring Frog | Separate short/long takeoffs and landings, plus idle personality. | New foot-contact mapping and impact/settle motions; our controller must still own jump travel. |
| Babak | 47 / 14 | Russet Bull / future ground pursuer | Notice, turn, chase, lose interest and give up are visible actions. | Original perception/pursuit state machine within our support/ledge constraints. A biped clip is not a bull retarget. |
| Driller Lurker | 67 / 12 | Heavy charger study | Walk/run/attack has level/up variants, and a failed attack becomes a jam. | Semantic upper-body blend and weapon clearance, original jam/recovery decision. Use the animated Robocave export. |
| Quicksand Lurker | 49 / 8 | Ember Sentry | Hide, emerge, track and spit express range and commitment through the whole body. | Original hide/approach logic and animated projectile socket; ground concealment is not contained in a clip. |
| Swamp Bat | 16 / 6 | Violet Watcher | Separate idle, notice, swoop, strafe and return vocabulary. | Original attack path/return host and wing rig; preserve silhouette and telegraph before entering the lane. |
| Bully | 44 / 10 | Brass Whirler | Spin start, bounce response, deceleration and dizziness make the danger cycle legible. | Original travel/bounce logic and safe recovery window; root rotation is not supplied by the clip alone. |

For the first playable behaviour iteration, start with **Crab, Hopper and Bat**. They test an exposure window, grounded-to-airborne timing, and an aerial commitment/return without a large new navigation framework. Keep Bull's existing deliberate charge and recovery, Moa's locked attack bearing, and the goblin/guardian improvements as useful local foundations.

## Current roster findings

The published baseline inspected for this task is `608cd6e5`. Its ordinary catalogue has **nine kinds**, rather than the eight described in the original September replacement document: Coral Crab, Bristleback, Mossback, Russet Bull, Spring Frog, Violet Watcher, Ember Sentry, Brass Whirler and Moa. Nightworks goblins, Tribal Guardians and ghost skins add specialised presentation/behaviour paths. Retired rooftop pig actors are not counted as current roster features.

- **Design:** the existing roster has recognisable species and basic combat roles, but skin variety does not supply intent. The source candidates demonstrate why posture, silhouette changes, eye/head attention and a recovery pose need to be designed together. Original replacement meshes should be chosen only after these tests identify the roles we want.
- **Behaviour:** ordinary crab, spiker and turtle still use bounded-axis patrol with immediate facing changes. Bull, frog, flyer, sentry and spinner already have state sequences; they need better transition/decision coverage, not a claim that they have no AI. Moa has a committed beak strike and live attack socket; Nightworks has two-hit stagger, supported wandering and lurch/recovery; Tribal Guardian has a planted turn. Retain these strengths.
- **Movement/rigging:** the original four walkers share a sampled quadruped walking source, retargeted with model-specific contacts and IK. Frog and mechanical enemies use custom poses; subsequent species add their own articulation. The generic visual adapter expects semantic node roles and a walk clip rather than a library of fully authored turns, attacks, hits and recoveries. Five source animation entries have zero duration: four Aphid poses and Swamp Rat idle. A further four timed entries did not deform at the three sampled points; this is a sampling observation, not proof that they are universally static. Source rigs have different names, hierarchies, proportions and attachment structures. Bone count or the existence of a GLB does not establish retargetability.
- **Review coverage:** the old lab plays isolated fixture cycles with root travel held in place. The new reference panel uses the same current-roster cycle fixtures for comparison, with separate source-clip playback. Neither is a proof of live detection, navigation, reach, hit timing, collision or reset behaviour.

Primary local evidence: `src/enemies/types.ts`, `runtime.ts`, `review.ts`, `reviewCycles.ts`, `moaBehavior.ts`, `nightworksGoblin.ts`, `tribalGuardian.ts`, and `src/level.ts` enemy state/update paths. The earlier production/retargeting record is in `ENEMY_ROSTER_REPLACEMENT.md`.

## Further candidates and dependencies

**Next after the first pass:** Kermit's tongue attack, Snake's close/far strike, Baby Spider/Swamp Rat arrival and pursuit, Mother Spider spawning, Gnawer's scenery interaction, Bone Lurker's directional charge, Ram Boss's directional shield, and Robber's objective chase. These broaden decisions rather than merely adding a differently coloured patrol.

**Deliberately later:** Double Lurker needs two actor lifecycles and an attach/split handoff. Kermit's tongue requires targeting, stretch, clearance and release beyond the stored keyframes. Mother Spider needs eggs, offspring, detached parts and a host. Ram Boss's mount/shield/projectiles and the full Plant/Ogre/Robot bosses are encounter assemblies. Several historical main meshes have zero clips because their hosts supply procedural movement. The lab says so instead of showing a pretend animation.

**Jak II/3:** useful source candidates include Grunt/Metal Monk circling and pacing; Grenadier spacing and throws; Crimson Guard rolls, knockdown and front/back get-up; Amphibian lunges and tongue attacks; Centurion/Spyder ranged stances; hover/wasp attacks and recovery; Jak 3 Mantis staged attacks and evasion; Dark Maker Biped shield deploy/retract; Robo Guard held windups; and Spydroid scanning, hunting and vulnerability states. Treat these as a second extraction/review project. Literal animation references in a state file are not a complete clip inventory and may omit inherited or computed references.

## Adaptation contract

1. Select a **role and response to the player** first. Record detection, anticipation, aim commitment, active attack, recovery, disengage, hit reaction and death/reset in plain language. Use independently chosen tuning and original code. The audit stores source identifiers as evidence; they are not runtime behaviour tables.
2. Test an original controller with a source placeholder or our existing model. Preserve our movement model and authored level support. Travel, contact damage and attack volumes remain gameplay-owned. Animation events must be named semantic events such as `attack-active`, `projectile-release` and `recovery-open`; event time values require deliberate review and testing.
3. Choose an original mesh only after the role works. Map anatomy and attachments explicitly: pelvis, spine, head/jaw, feet, claws, wings, tail, weapon and projectile sockets. Keep source rig and original final art provenance separate.
4. Make a model-specific bind pose, weights and retarget. Preserve foot planting and sole orientation, ground clearance, joint limits, per-segment stretch/compression/rebound and finite settles. Do not scale the gameplay root to fake animation or use a rigged reference GLB as an automatic code-only character factory.
5. Review full motion from front, quarter, side and back at ordinary and MAX/native resolution. Then verify live attacks, safe windows, ledges/slopes, player contact, interrupt/death, despawn, checkpoint reset and reload with the new controller. No distance-based mesh substitution or decimation.

## Lab operation and reproduction

From Labs, open **Enemy lab · OpenGOAL audit**, or use the **OpenGOAL audit** link in the current enemy lab. Search by creature or behaviour, filter by game/evidence tier, and select a source clip. The inspector provides measured rig/mesh facts, known dependencies, source links and the suggested existing enemy pairing. Turn on **Rig**, use the timeline/frame steps, or switch **MAX / native** resolution. Comparison fits display size through a parent transform; source bone scales and keys and our gameplay root scale remain intact. It does not claim equal real-world size or speed.

The **Our roster** tab and pairing link open the existing detailed combat-cycle lab. The reference and current model play independent source/current motions. There is no automatic retarget and no imported source AI, particles, projectiles, root travel controller or hitbox logic. The effects-only lab and its catalogue remain unchanged.

**Shortlist** saves choices under `solProtoEnemyReferenceShortlistV1`. **Export shortlist** downloads names, proposed pairings and source links as JSON. Recommendations and personal choices remain separate.

All 59 distinct inspected source files match the official Git blob hashes at the pinned tag. Regenerate facts from the existing official source and historical inventory:

```sh
gh api 'repos/open-goal/jak-project/git/trees/b6c8430c0b0a5cb139b939bcf0ffd25285b896c7?recursive=1' > /tmp/opengoal-v039-tree.json
python3 tools/enemies/audit_opengoal.py \
  --source-tree /tmp/opengoal-v039-tree.json \
  --source /path/to/opengoal/goal_src \
  --historical-catalogue /path/to/catalogue.before-effects-only.json
```

The output is `public/enemies/opengoal-audit.json`; editorial assessments are in `tools/enemies/opengoal-candidates.json`. The generator checks packed and decoded hashes and records triangle, skin and clip facts. It reads source files for identifiers/hashes, never copies source expressions or changes the source pack. Pin the supplied checkout to the recorded release before regenerating; this script is not an upstream version downloader.

Reference assets remain placeholders from the supplied game; this audit makes no new asset-licensing claim. The implementation and adaptation briefs are original project work. Final selected enemies need original meshes.

## Validation

- Every one of the 59 distinct source files matches its official Git blob at the pinned tag.
- Browser asset audit: all 28 source meshes, 254 animation entries, three skin/bone samples per entry, matching triangle counts, finite transforms, and unscaled gameplay roots on the paired current models. 245 entries visibly change the sampled skin coordinates; five are single poses and four did not change at those three points. This is not a full source-game behaviour reconstruction.
- Filter/empty states, explicit unavailable-asset cases, shortlist persistence/export, stale-load disposal, playback/scrub, skeleton and compare controls, current nine-enemy lab, narrow viewport and full/native resolution checks passed without console warnings/errors.
- Visual review caught side-view overlap from world-axis spacing. The exhibits now separate in the selected camera plane, preserving both silhouettes. Source/current models remain independent and can be inspected alone.
- Focused existing enemy polish and catalogue checks, TypeScript, production build and hosting-size check passed. No level data, enemy gameplay or movement tuning changed; no full suite was run.

[Production smoke test](opengoal-enemy-audit/production-smoke.json) · [Source verification](opengoal-enemy-audit/source-verification.json) · [All-asset browser audit](opengoal-enemy-audit/browser-all-assets.json) · [Final UI check](opengoal-enemy-audit/browser-ui-final.json) · [Native crab comparison](opengoal-enemy-audit/crab-comparison-native.png) · [Native side-view comparison](opengoal-enemy-audit/bat-side-native.png)

The final integrated production build passes at **973,742,766 bytes / 1,000,000,000 bytes**. The production browser smoke test repeats filter/shortlist/export/lifecycle controls, all eight first-pass comparisons, the current lab and native/narrow presentation using the built assets.
