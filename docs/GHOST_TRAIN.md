# Castle Ghost Train

An indoor, low-poly haunted-castle ride inspired by the theatrical castle,
banquet animatronics and mechanical traps in the Spooky Island ghost train.
The geometry and characters are original assets; the course uses the existing
game movement and collision model.

The source-owned course is `src/levels/ghost-train.ts`, registered as
`ghost-train`. Open `/?playtest&level=ghost-train&lite` for a fast run, or remove
`lite` for the complete renderer. It is also available in the gameplay MENU.
K and L select the previous and next checkpoint during section review.

The 2,250 m route spans approximately the same distance as the original Test Course.
It has eight enclosed halls, fourteen checkpoints, sixteen moving carts, twelve
swinging axes and sixteen banquet/armour enemies.
Enclosed loading and portrait galleries lead into axe halls, a mechanised
banquet, patrol armour, cart relays and collapsed track. Broad cart decks carry
the rider through the existing mover support path. The missing-floor track
sections require native rail grinding and jumps between interrupted rails.
Checkpoints stand on permanent masonry between major obstacle sequences.

`src/ghostTrain.ts` owns the scoped Meshy asset loading and mechanical artwork.
It dresses the existing mover, pendulum and enemy primitives. Armour uses
independent joints and glowing green eyes; food mechanisms animate their
individual parts. Runtime capture preserves the authored skins for editing.
The ordinary game movement tuning is unchanged.

Five original textured Meshy models total 17,642 triangles and 1.17 MB.
Generation used 90 existing Meshy credits. Provenance, asset bounds and the
triangle budget accompany the shipped models. Generated models share geometry and textures between
instances. The castle shell is authored from bounded, batched triangle meshes
with ordinary solid primitives beneath it where collision is needed.

Validation is recorded in `tools/test-ghost-train.mjs` and
`tools/ghost-train-browser.mjs`, `tools/ghost-train-pilot.mjs` and
`tools/test-ghost-train-articulation.mjs`. The physics checks use the production Player
and Level, including supported checkpoints, complete enemy patrol cycles,
moving-cart rider carry and the finish gate. Browser review uses the real
renderer in lite and full mode, inspects all checkpoint sections and checks
the console and generated asset readiness.
