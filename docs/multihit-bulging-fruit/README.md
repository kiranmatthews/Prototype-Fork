# Multihit fruit — inflated, crowded contents

The fruit fills the open cage with large, smooth oval bellies and a waxy skin
finish. Broad continuous curves preserve a balloon-like silhouette, with red
shoulders, yellow flesh and green bases. The lower fruit sits against the floor;
staggered heights and compact complete crowns fill the upper space.

Art direction: the Wumpa cage in the user's [Crash 4 crate reference](https://www.artstation.com/artwork/9mPL0a),
reviewed directly at its [original Wumpa image](https://cdnb.artstation.com/p/assets/images/images/032/043/401/large/felipe-sanin-crash4-wumpacrates-01.jpg).
`fruit-balloon-direction.png` is the ImageGen study made from our cage concept
and the observed reference. Its smooth inflated shapes guide the authored
runtime geometry; it is not a screenshot of the game.

`src/crateMultihit.ts` owns the cage-only fruit surface, material and packing.
All original fruit indices, UVs, crown/stalk topology and part attributes remain.
The world pickup asset is unchanged. Five instances share one geometry and
material; together with the cage they total **27,880 triangles in two draws**.
The complete geometry remains at every distance and in shadows/reflections.
There is no added asset download or external generation dependency at runtime.

The fruit count follows the existing five-hit state, with a small finite rebound.
The cage, colliders, rewards, wood fracture and other crate types are unchanged.

## Validation

- `node tools/test-multihit-fruit.mjs`: complete topology, finite data, smooth
  cheek normals, full side coverage and a 6,903-ray check against the actual
  timber asset with no fruit through visible timber faces; 5→0→5 state/rebound.
- `node tools/test-crate-art.mjs`: shared assets, bounds, complete model budgets,
  counts, finite animation, fragment cleanup and bounded effects pass.
- `npm run build`: typecheck, bundle and production asset preparation pass.
- `npm run check:release`: recorded in `release-size.txt`.
- Real Player/Level browser test: five stomp contacts remove one fruit each,
  the final hit breaks into 42 timber pieces; spin break, soft restore and hard
  reset pass. Full rendering covers bounce and restoration at MAX/native
  2560×1440 and 853×480 CRT. No game console errors/warnings or failed assets.
- A daylight Jungle pass at 2436×1706 native also passes with a clean console
  and no failed assets; its screenshot includes the active visual-treatment
  panel beside the crate.
- Native studio review covers all six sides, the final remaining fruit and
  480p presentation. Screenshots and JSON reports are in this directory.

No full unrelated test suite was run. The user retired the release coordinator;
this task owns its publication and public deployment verification.
