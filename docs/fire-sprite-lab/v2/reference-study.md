# Study of the supplied Crash 4 flame recordings

Source: user-provided `IMG_4428.MOV` (7.69 seconds, brazier) and `IMG_4429.MOV` (4.80 seconds, narrow torch), received 11 November 2026. The originals remain in `/Users/kiki/Downloads/`. Both are camera recordings of a display at approximately 59.96 fps, rotated into portrait presentation. The recording rate does not establish the game's sprite drawing rate.

Frames were decoded in presentation order with the display rotation applied. Every fourth camera frame was extracted with its actual presentation timestamp: 116 samples for the brazier and 72 for the torch. The reference crops retain environmental context. They are analysis inputs, not assets for the published game. Local analysis directory: `/private/tmp/fire-reference-20261111/`.

## Direct observations

- **Connected luminous base:** the lower portion stays substantial while the upper outline changes dramatically. The torch's base is roughly a rounded bulb around the wooden support; the brazier supports a wide connected bed. The entire flame does not rock as one unchanging flame emblem.
- **Broad masses and large negative shapes:** the red upper shapes have rounded shoulders, deep concave scoops and sizeable holes. There are relatively few meaningful contours, rather than many wispy filaments or evenly spaced serrations.
- **Upward transport and separation:** in `IMG_4429`, inspect 0.133, 0.267, 0.400 and 0.533 seconds. A large hollow red upper form progresses upwards and breaks into separate tapered regions while the next substantial lobe grows below. The gap on the right of the orange/red body opens and changes shape. Small detached fragments continue above the main body.
- **Core and outline differ:** the bright lower colour shapes change inside the body; they are not a miniature copy of the entire outside silhouette. The red/orange upper part is visibly more transparent than the luminous lower region.
- **Overlapping activity:** the brazier has several rising lobes at once. At 0.667 seconds the upper centre has cleared considerably; by 1.133 seconds a new broad red mass occupies it. Neighbouring tongues are at different stages. A composite fire should not synchronize every tongue to the same drawing.
- **Recording artifacts:** display moire, scan bands, camera exposure and blue/green banding across the bright region are visible. These are not instructions to paint stripes into the artwork or to make the original fire cyan.

## Limits and authoring choices

The footage does not establish the original texture, number of source drawings or an exact global loop boundary. Overlapping flame regions and hand-held recording movement prevent a defensible claim of pixel-identical whole-fire repetition. The new work therefore follows the observed birth → rise → hollowing → separation → decay progression, with explicitly authored cyclic drawings, rather than claiming to reconstruct an extracted game flipbook.

Each family will use an independently generated base drawing and separately generated subsequent frames. The provisional cycle has twelve drawings; playback rate is an authoring choice to be judged against the recording, not a measured source rate. Narrow/tall, medium/upright and broad/low shapes must differ in their actual drawing and movement. Hue and arrangement reuse happens after those cycles are reviewed.

For the new loop, upper material exits while new lower material grows, so the final drawing leads back into the first without reversing the sequence or freezing a repeated end drawing. Check the loop at normal speed and quarter speed, with individual cells and the last-to-first transition exposed. No shader sway or blended frames should conceal registration or silhouette mistakes during this review. Then review the combined exhibits with the unchanged Jak heat pass at native resolution.
