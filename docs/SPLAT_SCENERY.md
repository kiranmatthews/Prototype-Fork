# Retired Gaussian splat experiment

Decision: keep ordinary 3D models as the production scenery approach. The
sample splat's visual quality did not suit this game. Gaussian environments
remain a possible option for a specific future edge case.

The experiment proved that a World Labs SPZ environment can share the game's
Three.js scene and postprocessing while native level geometry provides
collision. It used the public valley sample imported through Image Blaster;
no new world generation or provider credentials were needed.

A static desktop check on an M1 Pro held the game's 60 FPS cap with the
background enabled and hidden. The chosen renderer nevertheless reserved
about 144 MiB of GPU textures, including for the smaller point budget.
This was not a matched comparison against an equivalent mesh landscape or a
physical-phone benchmark.

Splat Valley, its map/menu entry, SPZ assets, preview, renderer, dependency and
experiment-only tools have been removed from the active game. Saved editor
copies retain their ordinary geometry; obsolete scenery metadata is stripped.

For recovery, the complete experiment is preserved in Git commit
[`6a374c8`](https://github.com/kiranmatthews/Prototype-Fork/commit/6a374c8c8ff1db82f08a52bdaa7b338c415f2c8d).
Restore it on an experiment branch and reassess visual quality, memory and
target-device performance if a concrete need arises.

Cleanup checks: production build, campaign/Level Select/offline checks, full
browser startup and saved-copy geometry preservation. The broader parser
suite's legacy world-map expansion assertion fails identically on the prior
published baseline (`644ab0f`); this cleanup leaves that separate issue alone.
