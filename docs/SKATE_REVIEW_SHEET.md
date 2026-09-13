# Skate pose contact sheet

Open [the published sheet](https://kiranmatthews.github.io/Prototype-Fork/skate-pose-review.html). It is a production build entry, not a development-only TypeScript page. Opening the local `skate-pose-review.html` file redirects to that hosted page.

The sheet presents 42 numbered poses in three columns. All loop at half speed by default. Global controls pause, change speed/view, filter a category, scrub normalized phases and restart. Each card can pause independently, change its camera and copy a repair prompt containing its stable number, name and playhead. Off-screen poses retain their clocks; only visible cards render. A single WebGL renderer and character are shared across all viewports.

| Numbers | Contents |
| --- | --- |
| S01–S09 | Skate idle, roll, charge idle, charge transition, ollie, manuals, wallride, revert |
| S10–S17 | Eight flips |
| S18–S25 | Eight grabs |
| S26–S33 | Eight grinds |
| S34–S37 | Axle, rock, nose and tail stalls |
| S38–S40 | McTwist, 900 and Darkslide |
| S41–S42 | Mount and under-rail hang |

These are review material, including the current defects. They are not a new visual approval of the poses rejected by the user. Endpoint contact tests alone cannot establish a convincing silhouette or trick animation.

## Working in the Animation Lab

Every card's **Edit in Lab** link opens its named `Skate · Sxx · …` clip. Opening the Lab explicitly shows its panels even when game debug chrome is hidden. The ordinary Animation Lab also imports the complete list and provides a return link to the contact sheet. The board, its scale-compensation frame and the character presentation parent are exposed as authoring joints, alongside the existing limb and independent length controls. Review framing accounts for the editor panels and timeline; rail, wall and quarter-pipe references appear for the relevant captures. The camera follows captured translation during playback and scrubbing so entries and landings stay visible.

These are editable **study clips**. Their keys and playback settings save with the animation document; they do not automatically replace the game's procedural controller. Use **Use Lab edits** on the sheet to load the saved studies and compare them. Use **Use game captures** to return to the source baseline. Applying an accepted repair to gameplay remains an explicit implementation step.

Imports are additive and versioned. Unedited source captures upgrade to include new transitions; fingerprints are compared after draft normalization. Authored pose changes, custom names, playback speeds and intentional deletions survive upgrades. The main authoring binding retains the additional board/presentation joints when restoring saved documents. A supplied reconciled document wins over a late asynchronous draft read, so a deep link cannot lose its selected skate clip while opening.

## Capture and regeneration

Run `node tools/bake-skate-review.mjs` to regenerate `public/animations/skate-review/catalog.json`. `src/animation/skateCatalog.ts` owns the names and stable IDs. The generator drives the current Player pose path with the normal CharacterAnimationRuntime and shared elasticity profiles. It records the final contact-corrected rotations and translations, removes presentation/proportion layers, and stores independent deformation controls separately. Reapplying those controls and appearance reconstructs the captured joints; the generator checks this before writing.

Held grinds (including Darkslide), manuals, wallrides and lip stalls capture real `Player.step` input sequences through entry, hold, exit and landing. S42 is a 7.2-second sequence: rail catch, swing underneath, return on top, swing underneath again, release, fall, land and settle. Along-rail travel is centered for the card; vertical motion and cross-rail/ramp travel are retained. Other clips capture the gameplay presentation at controlled trick/flight phases. No input-cue overlays are needed to judge the motion.

The board frame is created at rig construction with its original identity transform, so binding it does not change the live stance. Captures include the board transform and use a separate authoring presentation root to retain body motion without deforming the whole skeleton. Existing gameplay clip IDs and routing remain intact.

Keys are reduced against the 30 fps capture with 0.0002 local-unit/scalar tolerance and 0.0009 radian quaternion tolerance, then written to six decimals. The 42-clip file is about 6.7 MiB before HTTP compression, fetched only by the sheet or when opening the Lab. The renderer reuses the same character surfaces; it does not allocate a WebGL context per card.

`node tools/test-skate-review.mjs` checks all entries, schema/rig references, 1,890 sampled playback frames, independent deformation bounds, board tracks/visibility, native transition evidence, source upgrades, preserved edits/deletions and complete preview restoration. Preview cleanup restores the deformation-control values as well as bone transforms, preventing garment length from inheriting a study frame after closing. Existing animation suite/runtime and skate contact checks cover the shared integration. Browser QA must cover scrolling, loops, pause/scrub/restart, category and camera controls, a Lab deep link, saved study loading, and the deployed file-link redirect. Run the production build; no full repository suite is required for this change.

Validated the packaged sheet and Lab in a real browser: 42 clips, a three-column grid, S42 hang/return/drop/landing views, native ramp exits, visible authoring panels with debug chrome hidden, and preview close. Lite and full rendering were checked with no console errors.
