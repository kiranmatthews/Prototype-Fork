// A stand-in for the image-model style pass: restyles the capture sheets in code, so the round trip
// "stills out -> restyled stills in -> slices" can be exercised without an image model.
//
//   node tools/sprite-stack/style-standin.mjs ink            reads .work/sheets/captured, writes .work/sheets/ink
//   node tools/sprite-stack/style-standin.mjs neon
//
// It keeps the sheet layout and resolution exactly, which an image model will not: that difference is the real risk
// of the pipeline, and this script says nothing about it.
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng } from './png.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), argv = process.argv.slice(2), style = argv[0] ?? 'ink';
const option = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const IN = path.resolve(option('--in') ?? path.join(HERE, '.work/sheets/captured')), OUT = path.resolve(option('--out') ?? path.join(HERE, '.work/sheets', style));

const toHsv = (r, g, b) => { r /= 255; g /= 255; b /= 255; const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min; let h = 0; if (d) { h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; if (h < 0) h += 1; } return [h, max ? d / max : 0, max]; };
const toRgb = (h, s, v) => { const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s); const [r, g, b] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6]; return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]; };

/** Covered pixels within `radius` of an uncovered one (the silhouette band), and strong inner contrast edges. */
const edges = (px, w, h, radius) => {
  const covered = new Uint8Array(w * h), lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) { covered[i] = px[i * 4 + 3] > 127 ? 1 : 0; lum[i] = .299 * px[i * 4] + .587 * px[i * 4 + 1] + .114 * px[i * 4 + 2]; }
  let band = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (covered[i] && (!x || !y || x === w - 1 || y === h - 1 || !covered[i - 1] || !covered[i + 1] || !covered[i - w] || !covered[i + w])) band[i] = 1; }
  for (let pass = 1; pass < radius; pass++) { const next = new Uint8Array(band); for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; if (covered[i] && !band[i] && (band[i - 1] || band[i + 1] || band[i - w] || band[i + w])) next[i] = 1; } band = next; }
  const inner = new Uint8Array(w * h);
  for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) { const i = y * w + x; if (!covered[i] || band[i]) continue; const d = Math.max(covered[i + 2] ? Math.abs(lum[i] - lum[i + 2]) : 0, covered[i + 2 * w] ? Math.abs(lum[i] - lum[i + 2 * w]) : 0); if (d > 58) inner[i] = 1; }
  return { covered, band, inner };
};

const STYLES = {
  // Comic ink: flat posterised colour, hotter saturation, a dark line round every shape.
  ink: (px, w, h) => {
    const { covered, band, inner } = edges(px, w, h, 4), out = new Uint8Array(px);
    for (let i = 0; i < w * h; i++) {
      if (!covered[i]) continue; const o = i * 4;
      if (band[i] || inner[i]) { out[o] = 27; out[o + 1] = 20; out[o + 2] = 48; continue; }
      let [hh, s, v] = toHsv(px[o], px[o + 1], px[o + 2]);
      v = [.2, .46, .74, 1][Math.min(3, Math.floor(v * 4))];
      if (s < .22) { hh = .11; s = v > .6 ? .16 : .3; } else s = Math.min(1, s * 1.4 + .08); // bone goes warm cream; colour goes hot
      if (v <= .2) { hh = .7; s = .45; v = .24; } // blacks become deep violet, never dead black
      const c = toRgb(hh, s, v); out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2];
    }
    return out;
  },
  // Neon night: a dark body drawn in light: cyan on the silhouette, magenta on inner edges, anything already hot stays lit.
  neon: (px, w, h) => {
    const { covered, band, inner } = edges(px, w, h, 4), out = new Uint8Array(px);
    for (let i = 0; i < w * h; i++) {
      if (!covered[i]) continue; const o = i * 4, [hh, s, v] = toHsv(px[o], px[o + 1], px[o + 2]);
      let c;
      if (band[i]) c = [80, 240, 255]; else if (inner[i]) c = [255, 72, 214];
      else if (s > .62 && v > .72) c = toRgb(hh, 1, 1); // the eyes
      else c = toRgb(.68 + (hh - .5) * .08, .55, .1 + v * .2);
      out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2];
    }
    return out;
  },
};
if (!STYLES[style]) throw new Error(`unknown style ${style}: ${Object.keys(STYLES).join(', ')}`);
await mkdir(OUT, { recursive: true });
let count = 0;
for (const name of (await readdir(IN)).filter(n => n.endsWith('.png'))) {
  const sheet = decodePng(await readFile(path.join(IN, name)));
  await writeFile(path.join(OUT, name), encodePng(STYLES[style](sheet.pixels, sheet.width, sheet.height), sheet.width, sheet.height));
  count++;
}
console.log('STYLE', style, 'sheets', count, '->', OUT);
