// Turn the hand-supplied HUD artwork into icons the game can actually ship.
//
//   node tools/bake-hudicons.mjs
//     art/hud-apple.png      -> public/apple.png
//     art/hud-crate.png      -> public/crate.png
//     art/hud-roo.png        -> public/roo.png
//     art/hud-crossbones.png -> public/crossbones.png
//
// The sources are 640-1024px renders of things the game draws at 30-100px, so
// each gets up to three passes:
//
//  1. FLOOR the alpha. The crate arrives with a faint wash of low-alpha pixels
//     over the WHOLE canvas — its corner sits at alpha 27 — which would draw as
//     a dim grey square around the icon over bright scenery. Only above alpha
//     ~128 is it actually the crate. Anything under the floor is cleared.
//  2. TRIM to the artwork, where that's safe. The apple and crate sit in a wide
//     empty margin (a third of the canvas for the apple), so untrimmed they
//     render two-thirds the size of their slot and line up with nothing.
//  3. DOWNSCALE, always. These were 1.5MB between them for detail no screen
//     resolves: the biggest is the HUD's 84px icon at a 2x device ratio.
import { readFileSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');

// size:  longest side of the emitted image. The HUD's biggest slot is
//        clamp(52, 9.5vh, 84)px, so 192 covers it at a 2x device ratio with
//        headroom; the mask sticker is only ever drawn ~100px on a crate face.
// floor: alpha below this is cleared. Per-file, because one file's faint edge
//        is genuine feather and another's is cruft.
// trim:  crop to the artwork. OFF where a crop would change the aspect the game
//        already draws the art at — see crossbones.
const JOBS = [
  { src: 'art/hud-apple.png', dst: 'public/apple.png', size: 192, floor: 40, trim: true },
  { src: 'art/hud-crate.png', dst: 'public/crate.png', size: 192, floor: 128, trim: true },
  // The life icon fills its frame edge to edge — nothing to crop, just oversized.
  { src: 'art/hud-roo.png', dst: 'public/roo.png', size: 192, floor: 8, trim: false },
  // The mask crate's sticker is stretched into a SQUARE box on the crate face
  // (see maskTexture). Its ink is 552x473, so trimming to that and then drawing
  // it square would stretch the bones 17% taller. Scale only.
  {
    src: 'art/hud-crossbones.png',
    dst: 'public/crossbones.png',
    size: 128,
    floor: 8,
    trim: false,
  },
];

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await b.newPage({ viewport: { width: 400, height: 400 } });
await page.goto('data:text/html,<body>');

for (const job of JOBS) {
  const res = await page.evaluate(
    async ([src, floor, OUT, trim]) => {
      const im = await new Promise((r) => {
        const i = new Image();
        i.onload = () => r(i);
        i.src = src;
      });
      const c = document.createElement('canvas');
      c.width = im.width;
      c.height = im.height;
      const cx = c.getContext('2d');
      cx.drawImage(im, 0, 0);
      const img = cx.getImageData(0, 0, c.width, c.height);
      const D = img.data;

      // 1. floor the alpha, and find what's left
      let x0 = c.width,
        y0 = c.height,
        x1 = -1,
        y1 = -1;
      for (let y = 0; y < c.height; y++)
        for (let x = 0; x < c.width; x++) {
          const o = (y * c.width + x) * 4 + 3;
          if (D[o] < floor) {
            D[o] = 0;
            continue;
          }
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      if (x1 < 0) throw new Error('nothing left above the alpha floor');
      cx.putImageData(img, 0, 0);
      if (!trim) {
        x0 = 0;
        y0 = 0;
        x1 = c.width - 1;
        y1 = c.height - 1;
      }

      // 2 + 3. trim and fit the longest side to OUT, keeping the aspect
      const tw = x1 - x0 + 1,
        th = y1 - y0 + 1;
      const k = OUT / Math.max(tw, th);
      const o = document.createElement('canvas');
      o.width = Math.max(1, Math.round(tw * k));
      o.height = Math.max(1, Math.round(th * k));
      const ox = o.getContext('2d');
      ox.imageSmoothingEnabled = true;
      ox.imageSmoothingQuality = 'high';
      ox.drawImage(c, x0, y0, tw, th, 0, 0, o.width, o.height);
      return {
        png: o.toDataURL('image/png'),
        from: `${im.width}x${im.height}`,
        trimmed: `${tw}x${th}`,
        to: `${o.width}x${o.height}`,
      };
    },
    [
      'data:image/png;base64,' + readFileSync(job.src).toString('base64'),
      job.floor,
      job.size,
      job.trim,
    ],
  );
  const buf = Buffer.from(res.png.split(',')[1], 'base64');
  writeFileSync(job.dst, buf);
  console.log(
    `${job.dst.padEnd(22)} ${res.from} -> trim ${res.trimmed} -> ${res.to}` +
      `  ${(readFileSync(job.src).length / 1024).toFixed(0)}KB -> ${(buf.length / 1024).toFixed(0)}KB`,
  );
}
await b.close();
