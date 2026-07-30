// Turn the hand-supplied HUD artwork into icons the game can actually ship.
//
//   node tools/bake-hudicons.mjs
//     art/hud-apple.png -> public/apple.png
//     art/hud-crate.png -> public/crate.png
//
// The originals are 1024x1024 renders. Three things have to happen to each:
//
//  1. FLOOR the alpha. The crate arrives with a faint wash of low-alpha pixels
//     over the WHOLE canvas — its corner sits at alpha 27 — which would draw as
//     a dim grey square around the icon over bright scenery. Only above alpha
//     ~128 is it actually the crate. Anything under the floor is cleared.
//  2. TRIM to the artwork. Both sit in a wide empty margin (the apple's is a
//     third of the canvas), so untrimmed they render two-thirds the size of
//     their box and refuse to line up with anything.
//  3. DOWNSCALE. The largest these are ever drawn is the HUD's 84px icon at a
//     2x device ratio — 168 device px. Shipping 1024px of apple for that is
//     1.2MB of the two of them for detail no screen will ever resolve.
import { readFileSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');

// Longest side of the emitted icon. The HUD's biggest slot is clamp(52, 9.5vh,
// 84)px; at a 2x device pixel ratio that is 168, so 192 leaves headroom without
// paying for detail nobody sees.
const OUT = 192;

const JOBS = [
  // alphaFloor is per-file: the apple's edge feather is genuine and worth
  // keeping soft, the crate's is cruft that has to go.
  { src: 'art/hud-apple.png', out: 'public/apple.png', floor: 40 },
  { src: 'art/hud-crate.png', out: 'public/crate.png', floor: 128 },
];

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await b.newPage({ viewport: { width: 400, height: 400 } });
await page.goto('data:text/html,<body>');

for (const job of JOBS) {
  const res = await page.evaluate(
    async ([src, floor, OUT]) => {
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
      OUT,
    ],
  );
  const buf = Buffer.from(res.png.split(',')[1], 'base64');
  writeFileSync(job.out, buf);
  console.log(
    `${job.out.padEnd(18)} ${res.from} -> trim ${res.trimmed} -> ${res.to}` +
      `  ${(readFileSync(job.src).length / 1024).toFixed(0)}KB -> ${(buf.length / 1024).toFixed(0)}KB`,
  );
}
await b.close();
