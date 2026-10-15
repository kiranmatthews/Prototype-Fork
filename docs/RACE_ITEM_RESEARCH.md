# Race item playability research — 15 October 2026

Scope: Mario Kart 8 Deluxe and Crash Team Racing Nitro-Fueled. The goal is readable competition with decisions for the leader, meaningful recovery for trailing riders, and a response to each weapon. This is an eight-rider skating game with walking, jumping, swimming and ledge traversal; the exact kart rules are not automatically appropriate.

## Evidence and decisions

| Evidence | Implication for this race |
| --- | --- |
| Nintendo describes distinct item roles: straight shells, homing shells, a leader attack, a global lightning attack, boosts, invulnerability and a horn that clears nearby vehicles/items. [Official MK8 Deluxe items](https://mariokart8deluxe.nintendo.com/) | Give the leader a mixture of placement, projectile, protection, speed and area defense. Make lightning recognisable by shape and action, rather than another shell colour. |
| Nintendo-hosted guidance describes rear-held banana/shell defense, the horn's ability to destroy a Spiny Shell, and waiting for a useful moment to spend an item. It is authored by GameWith and published by Nintendo. [Advanced item use](https://www.nintendo.com/jp/ichikara/aabpa/02_en.html) | A leader's item should remain useful under attack. This implementation uses a dropped peel, backward-fired green shell and horn with the existing item action; it does not introduce a second inventory slot or new button. |
| Activision's CTR guide describes target crosshairs, missiles blocked by dropped traps/bombs, timed turns into walls, and keeping defensive items when leading. Its shield blocks weapons and traps; its global clock and leader-seeking orb have different roles. [Power-Up Planning](https://blog.activision.com/au/en/crash-bandicoot/2019-06/Crash-Team-Racing-Nitro-Fueled-Power-Up-Planning) | Warn the actual target. Allow physical interception, a committed final approach, and terrain cover. Bots should retain defensive tools and react with normal inputs. |
| MK8 Deluxe version 2.4.0 expanded rear warnings, prioritised red/Spiny warnings and stopped showing red warnings for someone else's target. [Nintendo update notes](https://www.nintendo.com/en-gb/Support/Nintendo-Switch/Game-Updates/How-to-Update-Mario-Kart-8-Deluxe-1482895.html) | Show up to two real incoming threats, ordered by urgency. A receding green projectile or another rider's homing shell should not cause a false alert. |
| Earlier Nintendo updates extended post-hit protection and made lightning leave an airborne glider open. [Nintendo update history, versions 1.3.0 and 2.2.0](https://www.nintendo.com/en-gb/Support/Nintendo-Switch/Game-Updates/Mario-Kart-8-Deluxe-Update-History-1558546.html) | Prevent immediate repeated knockdowns. Preserve a rider's gap jump and normal traversal; a well-timed hop can evade our ground strike. This hop counter is our adaptation, not a claim about Mario Kart lightning. |
| Beenox explicitly reduced Warp Orb and N. Tropy Clock distribution in online racing to improve balance, while testing a speed-based catch-up tool. [Beenox balancing update, 23 August 2019](https://blog.activision.com/es/crash-bandicoot/2019-08/Super-Engines-Warp-Orbs-and-a-brand-new-GP-Decal) | Catch-up should favour speed and local attacks. Global/leader weapons need rarity, opening protection and shared spacing rather than overwhelming the front of the pack. |

These publisher sources establish roles, counters and documented balance changes. They do not establish a complete current item probability table. The weights and timings below are this prototype's tuning, not purported Nintendo/Beenox probabilities.

## Implemented rules

- First and second place draw banana, green shell, shield, mushroom or horn. Base weights are 24/18/24/18/16. The previous two draws are excluded, so three successive race pickups are always different. Actual frequencies therefore differ from the base weights.
- Middle positions favour red shells, shields and boosts. Trailing riders favour boosts; a real gap above 70 m increases that boost weight. Time trials still always award mushrooms.
- Heavy attacks require 20 elapsed seconds, fifth place or lower and a 45 m deficit. Lightning additionally requires sixth or lower and 90 m. Only one heavy item can be held/in flight at once. Both award and use enforce a shared 25-second cooldown. A rider must progress beyond their last pickup to become eligible for another heavy roll.
- Each rider has a separate seeded item stream, independent of AI reaction draws. Replays retain deterministic input simulation and their existing file format.
- A full inventory leaves an item box intact for another rider. It neither silently rerolls the held item nor pretends to award the same item again.

| Threat | Readable approach | Available response |
| --- | --- | --- |
| Green shell | Actual approaching trajectory, directional item picture, timer and audible ticks | Move/jump clear; timed normal spin; shield; horn; peel or another shell intercepts |
| Red shell | Target-only warning; at least 0.65 s near-target windup before the committed straight attack | Jump/sidestep, timed normal spin, shield, horn, dropped peel, backward green shell or a wall |
| Blue shell | Visible orbit for 1.1 s, followed by a marked predicted impact point and 0.8 s committed dive; 3.2 m blast radius | Leave the marked circle using ordinary movement; shield; nearby horn; mushroom timed within its final 0.55 s dodge window |
| Lightning | Distinct cloud/bolt inventory model; 1.6 s charge, overhead storm markers, countdown, branching sky-to-ground bolts and impact rings | A normal hop timed to be airborne when it strikes, or an active shield; existing airborne traversal is preserved |

Warnings reuse the competition surface, Roo labels, shared item model slots and SVG support. The held-item use glyph remains the only control hint and exists only with a held item. Lightning uses transient world geometry and existing sound assets, without a fullscreen flash or another UI/rendering system.

Successful shell interception, a spin deflection, a shield block and a horn blast produce visible impact feedback. Normal hits grant 2.4 s of race knockdown protection. Bot reactions have their existing delayed steering and imperfect attack decisions; they do not receive a different weapon collision rule.

## Validation

`tools/test-skate-race-counterplay.mjs` measures 10,000 leader draws, repeat protection and deterministic streams, heavy-item restrictions, full-slot pickup behaviour, true/false warnings, physical interception, normal spin, walls, shields, a timed boost, horn defense, an on-foot dodge and a normal jump through a lightning strike. Existing race item/rule, movement, pool and full-course tests remain part of the focused checks. Browser reviews cover real desktop/touch item use, warning composition and the full-render course.
