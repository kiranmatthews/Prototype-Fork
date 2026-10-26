# Compact triple-nozzle side module

`references/triple-nozzle.png` is the newly generated, single connected three-nozzle reference. `reference.json` contains its exact built-in ImageGen prompt. The earlier single-nozzle task is retained in the ledger as superseded and must not be assembled into this replacement.

The prepared Meshy request uses 15 existing credits for one textured Smart Topology model with 1,600 authored triangles. The balance check on 26 October 2026 returned 1 credit, so the triple-nozzle request has not been submitted. No credit purchase was made.

Once credits are available, run `meshy_jobs.py create`, then use the official CLI-backed `wait` and `download` commands. Review all three openings and the source orientation before running `bake.py` in Blender. Bake retains every triangle and the original UV surface. Fit one complete module to each kart side, roughly one-third the earlier hardware size, with its three outlets facing outward. Hook the flame emitters to those three actual openings. Square is damage-only and must never add propulsion or chassis spin.
