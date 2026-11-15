# Sprite Stack Lab

`sprite-stack-lab.html` answers one question, asked on 15 November 2026: could the rider be drawn by sprite stacking,
with stills of every core animation captured from four angles, restyled by an image model, then cut into slices?

The lab draws Bone Man from stacks of flat slices baked from 18 Animation Studio clips. There is no 3D character on
the page. He can be walked, jumped and ridden under the game's measured cameras, the game's own rider can be shown
beside the stack from the same camera, and every finding below has a "show me" button on the page.

## Verdict

It can be done, and the lab runs it on the real animations. It is not a good way to rebuild the rider.

1. **It works as a way to draw him.** From the game's normal cameras, behind the rider on foot and on the board,
   the stack reads clearly.
2. **It replaces more than it adds.** The squares are 5 cm, so his whole head is 16 across, and each clip becomes a
   handful of fixed poses (10 for the run) where the game poses him fresh every frame, blending clips and stretching
   limbs. The lab's side-by-side shows the two from one camera, in step.
3. **The planned pipeline does not hold.** Slices cannot be worked out from four pictures. They are cut from the 3D
   rider, so the model stays the real source either way and stacking is one more step after it, not a replacement
   for it. Colour also needs a fifth view from above: the cameras look down on the rider, and without it the deck of
   the board loses its grip tape.
4. **The image-model step can add little.** A still keeps 56 by 72 squares once it is on the stack, and
   anything painted relative to a picture's edge (an outline, a rim light) wraps onto the model as smears, because
   it is not on the figure's edge from any other side; thin limbs are all edge. This was tested with two stand-ins
   written in code. No image model was run: none was available to the session that built the lab. The two limits
   are properties of the stack, not of the painter, so the best a real model can do here is a flat recolour.
5. **A look added while drawing does that job for free.** A palette rule and an outline found from the model are
   identical from every angle and in every frame. The lab has two (`Comic`, `Neon`).
6. **Side-on rooms need a second way of drawing it.** Seen edge-on, flat slices become a pile of lines. Each slice
   drawn several times through its thickness, or the same data drawn as solid cubes, holds at any angle.

Where it would fit: as an extra, not a replacement. An unlockable skin, a retro bonus room, the figures on a menu or
map: things seen from above that only turn. The bake in `tools/sprite-stack/` makes a stack of any clip.

Costs that weigh against using it for the rider, beyond the six points:

- Every animation change means a re-bake, and blends between clips do not exist unless they are baked too.
- The stack carries the light it was captured under. It will not pick up a level's own lighting without more work.
- It cuts against two standing rules in `AGENTS.md`. One is to keep the complete authored geometry at every viewing
  distance. The other is that stretch, compression and rebound are core to every character animation: a deformation
  smaller than a square vanishes, and one driven by play is not in a baked frame at all.

## The reference post

The idea came with a link to a post on X by the maker of an AI pixel-art generator. X could not be opened from the
session that built the lab, so the lab was not checked against the post itself. What was checked instead is the open
recipe behind the current run of sprite-stacking posts, `loktar00/sprite-stacking` on GitHub. Its drawing rule is
the one the lab uses (the "Classic top-down" camera is the same thing): slices drawn bottom to top, squashed by
`sin(elevation)` and spaced by `cos(elevation)`. Its stated limits match what the lab found: an object cannot roll
or bank, because every slice stays horizontal, and a side view collapses the slices into lines. Its examples are
rigid props on turntables, not animated characters.

## What was measured

Play cameras, read from the running game on Powderkeg Peak, relative to the rider:

| Camera | Height above the feet | Distance | Lens pitch | Angle above mid-body |
| --- | --- | --- | --- | --- |
| On foot (chase) | 5.1 m | 5.1 to 5.4 m behind | 25° down | about 37° |
| On the board | 5.5 to 5.8 m | 4.4 to 4.6 m behind | 32 to 34° down | about 44° |
| Side-on rows and bonus rooms | 3.2 m | 16.4 m to the side | 7° down | about 7° |

When flat slices look solid: a feature `w` squares wide, with each slice drawn `n` times through its thickness, has
no gaps once `tan(angle) >= 1 / (w * n)`. One slice per layer needs 45° for a one-square feature and 27° for two
squares, which is why thin bones stripe faintly at the chase camera (the head is seen at only 24° from there). Four
per layer holds to 14°, eight to 7°. Layers level with the camera's eye are edge-on whatever the count, so side-on
sections want the solid-cube drawing.

The bake, on this container's software renderer:

- Grid: 56 x 72 x 56 squares of 5 cm (2.8 m x 3.6 m x 2.8 m), anchored on each pose.
- 18 clips, 176 frames. Capture 324 s (1.8 s a frame); every later build 5 to 17 s.
- 4,600 to 5,500 filled squares a frame, about 2.3% of the grid.
- Slice sheets: 776 KB for the 176 frames (4.4 KB a frame), one 255-colour palette.

Everything in the studio (102 clips, 216.3 s) at 12 frames a second is 2,596 frames: 12,980 stills at five views,
about 11 MB of slice sheets, and 559 MiB if every frame were unpacked into memory at once (about 55 MB stored
sparsely). Halving the square size multiplies those by eight.

## How a frame is made

1. `tools/sprite-stack/page-capture.js` runs inside the game page. It poses the real rider through the Animation
   Studio and renders him alone, under one fixed light, from six sides (front, left, back, right, above, below) with
   orthographic cameras: colour, and depth read from the same pass.
2. `tools/sprite-stack/volume.mjs` rebuilds the volume. A square is filled when every view covers it and none sees
   past it. Each filled square takes its colour from the view that faces its surface most squarely among the views
   that can see it.
3. The clip becomes one grey PNG (`public/sprite-stack-lab/<style>/<clip>.png`): one row per frame, one 56 x 56 tile
   per layer from the feet up, grey value = palette index, 0 = empty. `manifest.json` lists clips, frame offsets and
   each style's palette.
4. `src/sprite-stack-lab/lab.ts` draws a frame as instanced quads sampling that sheet (one or several per layer), or
   marches the same texture as cubes. The outline is the stack drawn again one square fatter, in one colour, pushed
   back along each sight line.

The side-by-side uses loops of the real rider (`public/sprite-stack-lab/reference/`, run, walk and ollie) rendered
by the same capture script from the chase camera's angle, at 20 to 60 poses a second. The lab draws the stack from
that same camera and steps both from one clock.

## Running it

```bash
npx vite --port 5190
```

```bash
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tools/sprite-stack/bake.mjs capture
```

```bash
node tools/sprite-stack/bake.mjs build
```

```bash
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tools/sprite-stack/bake.mjs reference
```

`capture` stores colour and depth for every frame under `tools/sprite-stack/.work/captures/` (46 MB, not committed).
`build` needs no browser: it writes the slice sheets and manifest, and the stills an image model would restyle to
`tools/sprite-stack/.work/sheets/captured/` (one sheet per clip, and one strip per frame in `strips/`).
`reference` writes the loops of the real rider for the side-by-side.

The variants in the lab:

```bash
node tools/sprite-stack/style-standin.mjs ink
```

```bash
node tools/sprite-stack/bake.mjs build --recolour tools/sprite-stack/.work/sheets/ink --style ink
```

```bash
node tools/sprite-stack/bake.mjs build --colour-views 0,1,2,3 --style four-sides
```

## Testing a real image model

The round trip is ready for a session that has one.

1. Capture and build as above.
2. Restyle the strips in `tools/sprite-stack/.work/sheets/captured/strips/` (1120 x 288, five views in a row) and
   save them under the same names in a new folder. Any uniform scale is accepted; the background is ignored.
3. Bake it as a new style. It appears in the lab's Style card on the next load.

```bash
node tools/sprite-stack/bake.mjs build --recolour <folder> --style <name>
```

Start with one cycle (the ten `run-f00` to `run-f09` strips). The things to look for are the ones the stand-ins
cannot show: whether the figure stays in register with the capture, and whether the paint holds still from one frame
to the next. The shape always comes from the capture, so a restyle that moves the figure paints the wrong squares.

## Open points

- No image model has been run through the round trip.
- The lab has not been checked against the X post that prompted it.
- Frame rate was only seen on a software renderer. The page shows the live figure in its top-left corner.
- 18 of 102 clips are baked. The clip list is `CLIPS` in `tools/sprite-stack/bake.mjs`.
- Enemies, pickups and scenery are untouched; a cube rider beside smooth models is an art-direction call.
- A screen-space pixel-and-outline filter on the live rider would keep the animation system and cost no baking, but
  its squares belong to the screen, not to the rider, so it is a different look.

## Files

| Path | Role |
| --- | --- |
| `sprite-stack-lab.html`, `src/sprite-stack-lab/` | The lab page |
| `public/sprite-stack-lab/` | Baked slice sheets, manifest, reference loops and one example still (3.8 MB) |
| `tools/sprite-stack/bake.mjs` | Capture, build and reference |
| `tools/sprite-stack/page-capture.js` | In-page six-sided capture and reference render |
| `tools/sprite-stack/volume.mjs`, `png.mjs` | Volume rebuild, palette, slice sheets, PNG read and write |
| `tools/sprite-stack/style-standin.mjs` | The two code stand-ins for an image-model pass |
