# Rumblewater camera impact review

`approach-0.png` and `impact-0.png` through `impact-2.png` are actual full-render game frames at Max/native **2560 × 1356**, captured after ordinary walk inputs and genuine pursuing-boulder deaths. Each PNG combines the native game capture with the live physical-glass DOM layer at that same resolution; that layer deliberately sits above the game canvas and CRT. They are not image-generated game scenes. All four were inspected at original resolution.

`report.json` records three consecutive deaths, distinct crack and sound variants, three clean natural resets, and no browser errors. `runtime.json` checks continuous movement of the same fatal sphere into the frozen lens, empty gameplay colliders, pause behavior, one life loss, natural respawn, and exclusion of water deaths. `lite.json` records the separate lightweight behavior check; it was not used for image-quality review.

The three transparent assets were separately inspected at their full **3840 × 2160** export resolution over light, dark, and game backgrounds. See `tools/boulder-camera/README.md` for their provenance and reproduction commands.

`gameover.json` covers a separate full-render final-life impact, using a declared zero-reserve fixture. The actual collision plays the full approach/glass/sound sequence, then clears the display before the Game Over menu.
