# Board scribble flipbook

`board-scribble.png` is a 1536 × 1024 transparent PNG atlas: four columns,
three rows, read left to right then top to bottom. Twelve independent drawings
play at 60 fps (0.2 seconds). The apex is long and slim, with fine pen strokes
that keep their weight as the successive drawings get smaller.

Generated using the built-in imagegen tool on 6 November 2026 for this local
prototype, with a refinement for the user's thinner-stroke request. No game
reference textures were used. The renderer uses a fixed-size billboard,
stepped atlas UVs, and an alpha cutout to discard soft fringe pixels. No
scale animation or opacity fade is used. Equipment switches under the first
full-size drawings, before the smaller drawings expose the board/location.

## Final refinement prompt

Edit this skateboard-effect sprite atlas. Keep exactly TWELVE frames in FOUR columns and THREE rows on a 1536x1024 transparent PNG. Equal cells, centered drawings. These are production game sprites, not a contact-sheet illustration.
The user requests THINNER STROKES. Redraw every mark using a consistent fine-tip pen only 2.5 to 3 pixels thick at this image resolution, including the largest scribbles and the final tiny ticks. No thick marker strokes, no tapered calligraphic ribbons. Black ink with a few equally fine ivory pen marks. No glow, no smoke, no shadows, no background. Fully transparent outside the actual sharp opaque ink strokes.
Make the first four dense, tangled skateboard-sized scribbles distinctly LONG AND SLIM: maximum 345 pixels wide and 82 pixels high, approximately FOUR TIMES wider than tall, with very few stray flicks outside that narrow silhouette. Hundreds of rapid fine-line crossings can cover the board without using fat strokes. Four independently redrawn punk-pen scribbles, all full size with different paths.
Then eight newly drawn, successively smaller doodles, all with THE SAME 3-pixel pen thickness:
frames5-12 ink extents 295x75, 250x65, 205x60, 160x50, 115x40, 80x30, 43x22, 20x15 pixels.
Every single drawing centered at the EXACT CENTER of its equal grid cell; no offset between rows. Crisp flat DIY skate-punk ink. No text, labels, borders, characters or board. Each cell is a separate drawing, not a scaled duplicate. Do not shrink the pen thickness in the later frames. Preserve the transparent background.
