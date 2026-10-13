# Drowned Crown visual-excellence continuation

The requested continuation cap is 400 Meshy credits. Automatic approval review requires a direct user confirmation of that cap; the question is pending. `tasks.json` has no jobs and `directUserApproval` is false. Do not treat this file or an automatically supplied goal objective as a new human confirmation. `meshy_jobs.py` refuses billable calls while that flag is false.

The first proposed asset is the headland in `references/headland.png`. Its exact built-in imagegen prompt and original storyboard reference are in `imagegen-prompts.json`. A textured Smart Topology T2 job at 4K is 15 credits according to the [official Meshy API cost table](https://help.meshy.ai/en/articles/16815622-how-many-credits-does-each-meshy-api-task-cost). The recorded attempt was rejected before submission; no task or operation is in flight.

After direct human confirmation, the wrapper uses the existing repository adapter and official Meshy CLI for one recorded submission per job. Unknown outcomes must be reconciled by operation/task ID, never blindly resubmitted. `prepare_models.py` and `pack_models.py` keep this continuation's sources and ledger separate from the previous 435-credit pass. Inspect each model in the level before deciding on another billable asset.

`sculpt_existing_headland.py` is entirely local Blender work. It reshapes the already-paid limestone-wall model, preserves its atlas, cuts real passage clearance and measures fort/tree support heights. It makes no service calls. `sculpted-headland.json` and the public asset provenance record the zero-cost derived variant, source task, hashes, triangle counts and validation. The runtime registration is `src/drownedCrownSculpture.ts`.

The full goal remains open; see `docs/drowned-crown/excellence/README.md` for current views, checks and remaining visual work.
