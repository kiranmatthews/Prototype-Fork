# Quaternius Death01

The same author-uploaded CC0 Standard pack used for swimming contains `Death01`. Its 73 native 30 FPS samples are retargeted to 22 semantic joints with the existing importer and `--loop false`.

The importer clamps the source AnimationMixer at its final frame instead of sampling its disabled-action bind pose. The game plays the 2.4-second source once at 2× speed, then holds the final pose through the existing death fade. Physical falling, wall contact and life/respawn accounting remain game-owned. Final rendered vertices are seated against supporting ground.

See `LICENSE.txt` and `provenance.json` for the original author, download and exact archive/file hashes.
