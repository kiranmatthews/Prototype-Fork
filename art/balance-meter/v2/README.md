# Three-finger balance pointer

The glove was regenerated with the built-in `image_gen` tool. It now matches the character's three fingers plus one thumb: a pointing index, two curled fingers, and a folded thumb. The four approved meter cels remain unchanged.

Selected image-model artwork is `glove-three-fingers-source.png`. The image service produced a painted checkerboard on that output and on a requested alpha correction. A subsequent **background-only image-model edit** produced `glove-matte-source.png`, with a flat magenta working matte. No finger or hand anatomy was drawn procedurally.

The final prompt set is [the glove regeneration prompt](prompts/three-finger-selected.txt) and [the matte correction prompt](prompts/glove-matte.txt). `three-finger-pointer.txt` records the initial request rejected by the image service; `glove-alpha.txt` records the unsuccessful transparency-only request. Those attempts are not runtime artwork.

`tools/balance-meter/pack-hand.mjs` uses the existing sprite cutout/export pipeline, with black outline preservation enabled, and packs a 320×182 RGBA sprite. It measures the pointing fingertip again rather than inheriting the old sprite's anchor. The export preserves the generated illustration; it only converts the matte to alpha, trims transparent margins and scales for the HUD.

Run the packer with Node, TypeScript, `@napi-rs/canvas` and `pngjs` available. `CANVAS_MODULE` may point to the canvas package in the bundled workspace runtime. If rebuilding the original meter cels with `bake.mjs`, run this hand packer afterwards. The packed image, dimensions, source hash, runtime hash and exact selected prompts are in `public/hud/balance-v2/`.

`balanceMeterPointerPose` follows a broad section of each cel's measured curve, avoiding its tiny painted notches. The middle stays straight; off-centre tilt points inward. The shared DOM/Canvas renderer translates to the fingertip contact before applying that tilt, so rotation cannot move the indicated balance position.
