# The Storm Parlour — waterfront manor bonus

The Rooftop Relay bonus is an original 23-crate route along an aged Carolina estate's extended covered veranda. It takes place at garden and tidal-river level. The main rooftop course keeps its geometry and atmosphere.

The reference is the river-facing piazza, white classical columns, broad lawns and live oaks of Lowndes Grove, used as Tannyhill in Outer Banks:

- https://www.netflix.com/tudum/articles/outer-banks-filming-location-guide
- https://www.pphgcharleston.com/venues/lowndes-grove/
- https://npgallery.nps.gov/GetAsset/20adef66-176e-45ff-8262-5613a1ae7f9a

Two new ImageGen references commissioned Meshy 7.1 models: an entire weathered veranda bay (77,130 triangles) and a turned white balustrade (23,828 triangles). The original meshes, normals, UVs and PBR textures are retained. The stored prompts and ledger are in `tools/rooftop-kook-assets/`. Both jobs succeeded, consuming 70 credits; the verified balance is 156. The already commissioned Meshy clubhouse, hydrangeas and coastal garden props complete the setting.

The playable line lies just beneath the veranda's measured eave and in front of its recessed columns. All placements use uniform asset scales; the native model silhouette stays identical at every distance. Bowed roofs, carved brackets, peeling paint, mossy plinths, shaped riverbanks and softly uneven lawns provide the aged character.

## Original route

- Preserve the bounce crate to reach the high delivery shelf, collect its provisions, then return for the launcher.
- Spin down a six-metre repair bridge and wait for it to settle before crossing.
- Climb the pantry benches and clear the multi-hit hamper and stacked deliveries.
- Ring the grouped switch to reveal three separate stepped repair boards, then jump across the flooded channel.
- Collect the final parcels and return all 23 bonus boxes to the suspended parent run.

Covered surfaces retain normal dry traction. A bounded world-space shelter removes rain streaks and splash rings inside the canopy. The exposed gardens remain rainy, while the bonus camera's lens stays clear. The river borrows the actual storm sky, with ordinary distance fog and no elevated fog floor.

## Validation

`tools/test-rooftop-porch.mjs` completes the real Player/Level route using only ordinary inputs: 23/23 crates, zero deaths, gem earned in direct-stage mode, dry surfaces, actual unrepaired openings, and no rain impacts inside cover. `tools/rooftop-porch-browser.mjs` runs the same inputs in Chrome, checks GPU streak/splash sheltering, verifies retry and reward banking, and captures native 2560×1440 plus normal CRT presentation. The character visibility issue at the first shelf was caught at native resolution and corrected by recessing the entire Meshy bays.

Required level checks, weather and stream regressions, type-check and production build pass. The broad legacy themed-bonus-flow check has an unchanged baseline failure for The Skystream's existing shared fallback; the new room's complete browser lifecycle is checked independently.

The release adds lossless Meshopt buffer packing after the existing texture packing. Eighteen existing asset files retain every decoded geometry byte, every image byte, all meshes, materials, transforms and UVs. `tools/test-release-native-geometry.mjs` compares all 200 buffer views; storage drops by 16,296,556 bytes. No simplification, quantization or distance-dependent representation is introduced. The finished release is 999,470,639 bytes against the existing 1,000,000,000-byte hosting budget.

The final visual review also found inherited rooftop height fog whitening shared wooden-crate and pickup materials. `Level.setActive(false)` now releases that parent fog while retaining its level state. The suspension regression checks both clearing and restoration; updated native/CRT captures show the actual warm crate textures and orange pickups.

The garden now meets the veranda foundation and wraps around both ends, grounding the live-oak roots and flower boxes. Real repair openings remain empty. Expanded face UVs give the three revealed boards the same metre-scale plank direction as the porch, without changing their dimensions or jumps. The garden-contact and deeper gap-ray checks pass; falling off the porch still returns the player to the parent run without losing lives.
