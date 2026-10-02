# Tidebreak · Crab Chief

A source-owned, three-phase reef boss encounter. Play `/?playtest&level=crab-chief`, or select **Tidebreak · Crab Chief** in the developer MENU. `src/levels/crab-chief.ts` owns the supported arena, entrance pier, terraces, ramps, two curved grind rails, checkpoint, lagoon pit, camera and victory gate. `encounter: 'crab-chief'` survives editor copy, export and validated import.

## Fight

The chief has nine pearl segments, three per phase. Every attack has a visible warning followed by a punish window. A walk into the pearl cannot damage it, and each opening accepts one hit.

| Phase | Attacks | How to strike |
| --- | --- | --- |
| Clawbreaker | Alternating aimed claw slams and expanding ripples | Leave the locked red circle, jump the ripple and spin the lowered golden pearl. A fast board strike also works. |
| Reef Rider | Aimed pincer bubble volleys alternate with claw slams | Grind eight metres on either pearl rail to earn a charge. Carry it into the opening and spin or skate into the pearl. |
| Storm Crown | Low sweeps, paired ripples, slams and bubble volleys | Earn charge through rail grinding or 26 metres of fast, supported skating. Jump the moving red sweep, then punish the opening. |

Keyboard: arrows/WASD move, Space jumps (hold while moving to push on the board; release for a charged ollie), F strikes, E catches/balances a rail, Q uses the existing grab/brake controls. Charge the board ollie for the storm sweep: a tiny tap does not reach its height. The HUD uses the shared controller/keyboard prompt artwork and gives that cue while skating. No movement or camera tuning defaults are changed.

Three encounter hearts are separate from campaign lives. Masks absorb a hit before a heart is spent, and the ordinary invulnerability/uber rules still apply. Reaching a new phase heals the encounter hearts and banks that phase for a soft retry. A soft retry restarts that phase's three pearl segments; a hard restart returns to phase one. Once the chief yields, a lagoon retry keeps the victory. The gate opens after the finite defeat/crown fall animation; the ordinary production finish pad ends the run.

## Art and motion

The chief is an original articulated low-poly model with **3,330 triangles**: crab claws and six planted supporting feet, eye stalks, expressive brows, shell crown, layered carapace, gold pearl necklace and independently moving woven skirt strips. Geometry is authored in code. The shared editable character elasticity amplitudes and finite enemy pulse drive compression, extension, impact rebound and hit recovery. Actual shafts stretch between solved endpoints; the actor root stays at scale `(1,1,1)`. Wind-up and recovery blend from the preceding claw pose, and the impact claw lands at its locked target.

The setting uses a level-owned vertex-colored sunset dome, banded sun, faceted lagoon, shoreline foam, coral, palms, open thatched meeting houses, woven banners, outrigger canoes, distant islands and a shell victory arch. Palm crowns, flags, canoes, water, bubbles, ripples and pooled shards animate. Rigid details batch per material/articulated part. All added art is original procedural geometry; there are no new remote model requests or texture downloads. Level disposal releases its materials and geometries through the existing ownership traversal.

## Verification

- `node tools/test-crab-chief.mjs`: source/editor schema, supported spawn, carapace collision, both actual grind paths, checkpoint and lagoon respawn, gate lock, animation finiteness/planted feet, low-poly budget, phase/armor/charge rules, telegraph lock, hearts/masks, and soft/hard/victory retries.
- `node tools/test-crab-chief-journey.mjs`: one complete production `Player` run using only input samples, with all nine earned hits, real grinds, skating strikes, phase transitions, defeat and finish pad. No pose, health, charge, tuning or phase edits.
- `crab-chief-review.html?playtest&level=crab-chief&lite` and the same URL without `lite`: run the same input pilot in the real browser. The page records rendered rider/chief vertex framing and pre-CRT HUD diagnostics in `#chief-review-evidence`. This authoring page is excluded from the production build.
- Required level validation/build scripts plus ordinary enemy, level-security and interface-cache regressions. The full suite is not part of this iteration.

The source encounter lives in its own module, preserving the existing Blockworks geometry lab and the shared published editor pack.
