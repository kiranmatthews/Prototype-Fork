# Boulder camera glass and sound

Three original variants were made with the **built-in ImageGen** tool, using `transparent_background: true`. The exact prompts are in `imagegen-prompts.json`; untouched generated PNGs are archived in `source/`. The generator returned **1672 × 941**, despite the requested resolution. The user explicitly approved image-processing refinement to 4K.

`refine-cracks.py` neutralizes colored artifacts, suppresses low-opacity haze, preserves fracture detail, resamples with Lanczos to **3840 × 2160**, and adds a very fine opposing dark edge for contrast over bright backgrounds. These are refined/resampled 4K exports, not native 4K generations. Output transparency and dimensions are recorded in `public/boulder-camera/manifest.json`. The three overlays are `cracks-a.png` (central starburst), `cracks-b.png` (diagonal impact), and `cracks-c.png` (lower impact with a secondary rosette).

`generate-sfx.py` produces an original stereo rolling rush and three distinct rock/glass impacts at 48 kHz, with a quiet layer of the existing project `crunch.wav`. There are no external sample downloads. The sound manifest records durations, peak levels and zero clipped samples. Runtime playback uses the existing SFX bus and volume/mute controls.

From the repository root, with Python, NumPy, Pillow and the project's Node dependencies available:

```sh
python3 tools/boulder-camera/refine-cracks.py
python3 tools/boulder-camera/generate-sfx.py
node tools/test-boulder-camera-impact.mjs
```

Run Vite on 127.0.0.1:5200 and open `/tools/boulder-camera-review.html` for the full-render Max/native review, or append `?lite` for the lightweight behavior check. Click **Run three impacts** to unlock audio and drive three real deaths with ordinary inputs. The page reports variants, audio calls, life loss and reset state, and captures the native game image with its crack layer and shared death fade already composited; the full review explicitly enables CRT. To save those artifacts locally, run `node tools/boulder-camera/save-review.mjs`, then click **Save review artifacts**. The receiver binds only to loopback, accepts only the review origin and known artifact names, and exits after all ten files are saved under `/private/tmp/boulder-camera-review/browser`.

Append `?gameover` to the review page to check the terminal-death path at full resolution. This declares zero reserve lives before walking normally into the chase; the display must be idle when the genuine Game Over screen opens.

The impact hold now lasts 2.55 seconds after lens contact, two seconds longer than the first release. Glass is painted before the existing death curtain and CRT. The direct/lite path also draws the glass, HUD and curtain into the game canvas, so it reaches complete black as one image. The browser review samples the hold, intermediate fade and blackout and checks actual image luminance.
