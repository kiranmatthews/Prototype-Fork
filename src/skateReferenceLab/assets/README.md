# Board scribble flipbook

`board-scribble.png` is a 1536 × 1024 transparent PNG atlas with **32 distinct
source drawings**, arranged in four columns and eight rows. They play once
at 60 fps (0.533 seconds). The first eight drawings chatter at full deck size;
the following twenty-four progressively clear to short pen ticks. Thin strokes
retain their weight throughout; the smaller drawings use shorter/fewer marks.

Generated with the built-in imagegen tool on 6 November 2026, extending the
earlier thin-stroke atlas at the user's request for more source frames. No game
reference textures were used. The renderer selects fixed 384 × 128 pixel
windows, with measured UV origins/anchors accommodating the source's uneven
row spacing. Every window has different source pixels. Sprite dimensions and
pixel density stay fixed; there is no scale tween or opacity fade. An alpha
cutout discards the generated soft fringe around the ink.

## Final generation prompt

Use case: stylized-concept. Production transparent PNG sprite atlas for a rapid skateboard appear/disappear scribble effect.
Use the attached twelve-frame sheet ONLY as the thin-ink style reference. REPLACE IT with THIRTY-TWO distinct source drawings, arranged in EXACTLY FOUR COLUMNS AND EIGHT ROWS on a 1536x1024 canvas. Each cell is 384 pixels wide by 128 pixels tall. Read left to right, then top to bottom. Draw EVERY one of the 32 cells.
Crisp flat black fine-tip pen scribbles, 2.5 to 3 pixel stroke thickness. Small equally fine ivory accents. Dense rapid crossing pen paths, scratchy zigzags and tiny irregular loops, lively DIY skate-punk animation. No fat marker ribbons, no smoke, NO glow, no gradients, no shadow. Transparent outside the actual opaque ink. No background, labels, grid or text.
All drawings must be centered exactly in their own cell and fit safely within it. Their apex is a long narrow skateboard silhouette about 350 pixels wide and 76 pixels high. Every frame has a NEW pen path, clearly a fresh energetic redraw. Do not repeat a signature S, W or Z shape across frames. No duplicate frames, no resized copies, no interpolation. Keep pen thickness identical across all 32 frames; smaller drawings use fewer and shorter strokes.
Detailed layout:
Row1 frames1-4: FOUR DIFFERENT densely scribbled full-size deck silhouettes, each 350x76px.
Row2 frames5-8: FOUR more DIFFERENT dense full-size redraws, widths 350,346,342,336px and height74px. Visibly restless/chattering lines, coherent outline.
Row3 frames9-12: NEW drawings shrinking in extent 320x72,308x70,296x68,284x66px.
Row4 frames13-16: NEW drawings 272x64,260x62,248x60,236x58px.
Row5 frames17-20: NEW drawings 224x56,212x54,200x52,188x50px.
Row6 frames21-24: NEW drawings 176x48,164x46,152x44,140x42px.
Row7 frames25-28: NEW drawings 128x40,112x36,96x32,80x28px.
Row8 frames29-32: NEW drawings 64x24,48x20,32x16,16x12px. Last frame is just two or three fine ink ticks.
One consistent 3px pen at this resolution, especially in the small frames. It should feel like 32 hand-drawn frames of aggressive fast punk ink scrawling over a skateboard, then scribbling itself away. No actual skateboard or character. EXACT 4x8 atlas, 32 source drawings, transparent background.
