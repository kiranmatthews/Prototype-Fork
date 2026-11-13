# Fire v4: reference observations

Sources inspected on 13 November 2026 (NZDT):

- User recordings `IMG_4429.MOV` (torch) and `IMG_4428.MOV` (brazier). Originals remain in Downloads. Camera recordings at approximately 60 Hz; this does not establish sprite drawing rate.
- [Gameplay Only — Rude Awakening](https://www.youtube.com/watch?v=s0eZzoT8mUw), direct 1080p60 capture, 2020-10-01. Inspected the final braziers around 493.5–500 seconds, including a 12 Hz contact sequence. The fixed red pointed shape behind the bowl is scenery: do not mistake it for an animated flame tip. The actual flame is smaller and changes over the luminous base.
- [Beyond-FX — Crash Bandicoot 4 VFX Reel](https://www.youtube.com/watch?v=o1p4bveivco), official studio reel, 2022-01-22. Direct 1080p footage. The burning interior at approximately 25.5 seconds offers a clearer look at stylized orange fire membranes and lower yellow masses. This is corroborating art direction, not the named Rude Awakening torch itself.

Reference videos and extracted frames are private analysis inputs under `/private/tmp/fire-v4-reference/`. They are not runtime art and must not be included in the Pages build.

## Observed shape and motion

The close torch sequence (0–1.13 seconds, 18 samples) gives the strongest useful motion evidence. The low core stays broad and replenished. Upper material rises, thins, opens holes, then disappears. The outer sheet and inner bright material evolve at different phases. Holes migrate upward through the middle and old upper necks tear as a new lower bulge arrives. Much of the apparent detail is changing negative space, not a collection of decorative nested flame outlines. The same upper lobe should not simply rock back and forth or stay intact for a whole loop.

The source has pale luminous yellow/white at the base, warm orange above and translucent reddish upper sheets. Phone scan bands, moire, blue/green patches and scenery visible through the flame are not intended colour bands in a new sprite. The direct reel confirms broad orange cel-like surfaces, uneven rounded bulges and sharp thinning tips. Some soft colour falloff is useful; flat concentric yellow/orange/red logos lose the source's light and air.

## New authoring plan

New artwork, rather than extra in-betweens of v3. Start with six poses per family spaced around a 1.2 second cycle, each with an explicit upward growth/dissipation trajectory. Generate seven individual in-betweens per interval for 48 distinct drawings per family at 40 fps. This is provisional authored timing, not a claimed measurement of Crash's assets. Review motion before accepting the sequence; frame count alone is not a quality gate.

Keep the foot stable, vary the moving sheets rather than the whole quad, and review the last-to-first interval as an ordinary motion transition. All cels are individual built-in imagegen calls. No procedural painting, warped duplicates, optical flow or crossfade substitutes. Preserve native PNGs and lossless native atlas pixels.

Runtime arrangement copies remain anchored to the intended fire bodies. The separate emitter of 70 drifting tiny whole-flame copies has been removed.
