# Jak 1 character lab — 9 November 2026

[Open the character browser](https://kiranmatthews.github.io/Prototype-Fork/tools/enemies/reference-review.html) · [Our enemy lab](https://kiranmatthews.github.io/Prototype-Fork/tools/enemies/motion-review.html)

The reference lab now shows **one Jak 1 character at a time**, with its model variants, original rig and actions. The user requested all Jak 1 enemies and bystanders, and removal of the roster comparison and later-game candidates. Those candidates, game filters and comparison controls are removed. Old links such as `?candidate=jak2-predator` recover to a loaded Jak 1 character.

## Available characters

There are **72 character entries, 111 model variants and 670 action entries: 637 timed clips and 33 single poses**. Every model has at least one action entry. The initial effects-pack-only selection has been replaced by a fresh character export from the supplied Jak 1 disc.

| Category | Character entries | Model variants | Actions / poses |
| --- | ---: | ---: | ---: |
| Enemies and training targets | 35 | 40 | 287 |
| Bosses | 4 | 15 | 130 |
| Bystanders and companions | 21 | 34 | 177 |
| Wildlife | 12 | 22 | 76 |
| **Total** | **72** | **111** | **670** |

The bystanders include Keira, Samos, all three other Sages, Bird Lady, Mayor, Explorer, Farmer, Fisherman, Sculptor, Gambler, Geologist, Warrior, both Miners, Boggy Billy, Oracle, Gol, Maia and Daxter. Wildlife includes Flut Flut’s life stages, Muse, Yakows, Pelican, Seagull, Farthy, fishing and underwater fish, Starfish, Scout Fly and animated plants. The enemy set includes the Ice Lurker, which was missing from the first curated audit.

Variants group scene-specific rigs under the same character. Detached animated parts (Mother Spider’s leg and Gnawer’s segment), Plant Boss parts, and robot attachments are explicitly selectable components, rather than extra species. Two Double Lurker partners remain separate entries. Area duplicates with the same art are collapsed; the export with the richest action set is selected. No camera-distance LOD substitution or decimation is used.

The preparation report accounts for all 484 distinct highest-detail model names in the source export. Its included/excluded names are reviewable. Player Jak, cameras, scenery, platforms, projectiles, mechanical props and non-character debris are outside this character browser. Dialogue audio, whole cinematic scene staging, game AI and encounter effects are not action clips. A source action with one frame is labelled **Pose**, with playback disabled; it is never presented as a moving animation.

Oracle’s visible body is assembled from its five complete named village-background meshes, with its original attachment rig and single pose. The hidden two-triangle helper is replaced by the actual statue. Shover is a moving-wall helper with one dummy triangle, not a character, and is excluded.

## Recovered actions and corrected rig assignments

The official v0.3.9 exporter routes many animations using the art-group name. That loses actions when the model has an additional suffix, and puts some detached-part or camera animations onto the main actor. The new original data adapter resolves the model prefix and verifies the complete joint count.

**95 missing action entries are recovered from the supplied game’s animation data:**

- Plant Boss: 17 body actions, plus 21 arm, back-arm, leaf, vine and root actions.
- Puffer: all seven hover, fly, puff and death actions on both calm and angry variants.
- Final Robot Boss: all 34 body actions.
- Mother Spider leg, Gnawer segment and Balloon Lurker pilot: two actions each.
- Underwater fish: the swim action on all three colour variants.

**26 incorrectly assigned actions are removed from the wrong model.** Examples include the Bully’s broken cage animation, Mother Spider leg animations on its body, Gnawer segment animations on the whole creature, pilot animations on the balloon, and Klaww’s camera/projectile animations on Klaww. Component clips remain available on their correct character component where applicable.

The data reader was checked against **74,043 existing exported animation channels**, comparing every stored output key byte-for-byte. It retains existing valid clips and facial morph channels, and adds only missing clips. Packing independently verifies all rendered geometry streams, skin inverse-bind matrices, animation keys, material metadata and image bytes. The new character assets add 11,637,580 bytes; existing identical effects-pack models are reused.

## Using the lab

Choose a character in the left list, then select **Model / variant** and an action on the right. The action list is searchable. The bottom controls provide an action dropdown, previous/next action, play/pause, frame stepping, restart, speed, loop and timeline. Front, quarter, side and back views, a rig overlay and MAX/native rendering remain available.

Only the selected reference character is displayed. The separate **Our enemy lab** link preserves access to the existing nine-enemy review. Character notes and source evidence are collapsed beneath the action list. Shortlist/export remains available and uses the existing `solProtoEnemyReferenceShortlistV1` key; obsolete later-game selections are filtered out.

Camera fitting measures the complete selected clip. For Keira and the Fisherman, camera focus uses the character body rather than the rigs’ parked props; **Include parked props** frames the complete rig. Every original triangle remains present. Before each measurement it refreshes attached skin bind inverses, so changing a model or action cannot inherit the previous display scale. A browser regression check verifies that every sampled action stays inside the camera, and that each model’s representative pose is large enough to inspect.

## Original implementation boundary

No OpenGOAL enemy/controller function bodies are copied. The browser and data adapter are original project code. The adapter reads asset-format fields and source animation data; source scripts are used for identifiers and evidence, not as runtime behaviour tables. The official extractor runs locally as an authoring tool. The disc, raw objects, disassembly, source installation and full world export remain ignored local data.

The reference models, rigs and actions remain placeholders. Future enemy work should implement the selected behaviour independently, choose original tuning and meshes, and map anatomy, contacts, attachments, stretch/compression and reactions deliberately. Crab, Hopper and Bat remain useful first behaviour studies; the expanded lab lets the user select alternatives directly.

Pinned source: OpenGOAL v0.3.9, commit `b6c8430c0b0a5cb139b939bcf0ffd25285b896c7`, with the supplied USA SCUS-97124 NTSC-v1 game. All 68 referenced script files match the pinned official Git tree. Each model records its source GLB hash, source art-object hash, packed hash, rig measurements, clips and any repaired assignments. The 360 disassembled source art groups were verified against the supplied disc archives before preparation. The effects-only lab and held animation/particle experiments are unchanged.

## Reproduction

Use an existing verified official installation and the supplied extracted game directory. All output below is task-local ignored authoring data.

```sh
python3 tools/jak-lab/extract_assets.py \
  --installation /path/to/official-installation \
  --game-data /path/to/supplied/jak1 \
  --output .jak-lab-data/characters

python3 tools/jak-lab/extract_art_data.py \
  --installation /path/to/official-installation \
  --game-data /path/to/supplied/jak1 \
  --output .jak-lab-data/characters

python3 tools/enemies/prepare_jak1_characters.py \
  --project .jak-lab-data/characters/opengoal \
  --source-tree /path/to/official-v039-tree.json \
  --art-manifest .jak-lab-data/characters/art-extraction-manifest.json

PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs \
  node tools/test-opengoal-enemy-browser.mjs http://127.0.0.1:5297/
```

The explicit character/variant manifest is `tools/enemies/opengoal-candidates.json`. The generated public catalogue is `public/enemies/opengoal-audit.json`; new assets are under `public/enemies/jak1/`. `audit_opengoal.py` delegates its command-line entry point to the new preparation pipeline and retains the shared model measurement helpers.

## Verification

[Character packing and coverage report](opengoal-enemy-audit/jak1-character-pack.json) records every selected model, recovered clip, rejected wrong-rig assignment and original-channel verification count. The browser checks all 111 models and 670 actions at three points per clip, finite bone and actual skinned/morphed vertex transforms, exact triangle counts, one-character-only display and camera containment. UI checks cover old links, category/search filters, variants, action search/selection/stepping, shortlist persistence/export, overlapping loads, autoplay, rig overlay, native rendering, narrow screens and the separate existing enemy lab.

Visual inspection covers all models and front/quarter/side captures of the recovered bosses, Puffer, Ice Lurker, bystanders and wildlife. TypeScript, production build, the complete browser run and the built-site UI smoke test pass with no console errors. The hosted output is **985,648,986 / 1,000,000,000 bytes**. No full regression suite was run, and level geometry, gameplay and movement tuning are unchanged.

Evidence: [all-character browser results](opengoal-enemy-audit/jak1-character-browser.json), [production UI results](opengoal-enemy-audit/jak1-character-production.json), and visual contact sheets [1](opengoal-enemy-audit/jak1-characters-1.jpg), [2](opengoal-enemy-audit/jak1-characters-2.jpg), [3](opengoal-enemy-audit/jak1-characters-3.jpg), [4](opengoal-enemy-audit/jak1-characters-4.jpg), [5](opengoal-enemy-audit/jak1-characters-5.jpg). Native examples: [Keira](opengoal-enemy-audit/jak1-native-keira-front.png), [Oracle](opengoal-enemy-audit/jak1-native-oracle-quarter.png), [Fisherman](opengoal-enemy-audit/jak1-native-fisher-quarter.png).
