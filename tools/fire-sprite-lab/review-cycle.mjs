// Review original, individually authored PNG frames without trimming, aligning,
// interpolating or otherwise changing the drawings. This is an authoring tool;
// its previews are not runtime assets and do not constitute art approval.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve, dirname, join} from 'node:path';
import {createHash} from 'node:crypto';

const [manifestArg, outputArg] = process.argv.slice(2);
if (!manifestArg || !outputArg) {
  console.error('Usage: node tools/fire-sprite-lab/review-cycle.mjs <cycle.json> <output-directory>');
  process.exit(1);
}
const sharp = (await import(process.env.SHARP_MODULE || 'sharp')).default;
const manifestPath = resolve(manifestArg);
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
if (!Array.isArray(manifest.frames) || manifest.frames.length < 2 || manifest.frames.length > 64) {
  throw Error('A cycle needs 2–64 explicitly ordered frames.');
}
if (!Number.isFinite(manifest.fps) || manifest.fps < 1 || manifest.fps > 60) {
  throw Error('Set fps explicitly between 1 and 60; do not infer source animation timing.');
}
const output = resolve(outputArg);
const frames = [];
let width, height;
for (const [index, entry] of manifest.frames.entries()) {
  if (typeof entry.file !== 'string') throw Error(`Frame ${index}: missing file`);
  const path = resolve(dirname(manifestPath), entry.file);
  const png = await readFile(path);
  const meta = await sharp(png).metadata();
  if (meta.format !== 'png' || !meta.hasAlpha || (meta.pages || 1) !== 1) {
    throw Error(`${entry.file}: expected one PNG drawing with alpha`);
  }
  width ??= meta.width;
  height ??= meta.height;
  if (meta.width !== width || meta.height !== height) {
    throw Error(`${entry.file}: canvas ${meta.width}×${meta.height} differs from ${width}×${height}; fix the source rather than auto-scaling it`);
  }
  const rgba = await sharp(png).toColourspace('srgb').ensureAlpha().raw().toBuffer();
  let left = width, top = height, right = -1, bottom = -1, area = 0, clear = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const alpha = rgba[(y * width + x) * 4 + 3];
    if (alpha === 0) clear++;
    if (alpha > 16) {
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y); area++;
    }
  }
  if (!area || !clear) throw Error(`${entry.file}: drawing must have visible content and transparent surroundings`);
  frames.push({png, rgba, path, file: entry.file, index, area,
    bounds: {left, top, right, bottom},
    sha256: createHash('sha256').update(png).digest('hex')});
}

// Include the seam as an ordinary consecutive transition. These measurements
// help find registration mistakes; a low pixel error does not prove good fire.
const transitions = frames.map((a, index) => {
  const b = frames[(index + 1) % frames.length];
  let union = 0, intersection = 0, difference = 0;
  for (let i = 0; i < a.rgba.length; i += 4) {
    const aa = a.rgba[i + 3] / 255, ba = b.rgba[i + 3] / 255;
    if (aa > .06 || ba > .06) union++;
    if (aa > .06 && ba > .06) intersection++;
    difference += Math.abs(aa - ba);
    for (let c = 0; c < 3; c++) difference += Math.abs(a.rgba[i + c] * aa - b.rgba[i + c] * ba) / 255;
  }
  return {from: index + 1, to: b.index + 1, seam: b.index === 0,
    silhouetteOverlap: intersection / Math.max(1, union),
    premultipliedDifference: difference / (width * height * 4)};
});

await mkdir(output, {recursive: true});
const stack = Buffer.concat(frames.map(f => f.rgba));
const raw = {width, height: height * frames.length, channels: 4, pageHeight: height};
// Round each presentation timestamp, avoiding cumulative duration drift.
const delays = frames.map((_, i) => Math.round((i + 1) * 1000 / manifest.fps) - Math.round(i * 1000 / manifest.fps));
await sharp(stack, {raw}).webp({lossless: true, exact: true, loop: 0, delay: delays, effort: 3}).toFile(join(output, 'loop.webp'));
await sharp(stack, {raw}).webp({lossless: true, exact: true, loop: 0, delay: delays.map(t => t * 4), effort: 3}).toFile(join(output, 'loop-quarter-speed.webp'));

const thumb = 256, gap = 12, labelHeight = 30, columns = Math.min(4, frames.length + 1);
const rows = Math.ceil((frames.length + 1) / columns);
const tileWidth = thumb + gap, tileHeight = thumb + labelHeight + gap;
const sheetWidth = columns * tileWidth + gap, sheetHeight = rows * tileHeight + gap;
const layers = [];
const labels = [];
for (const [i, frame] of [...frames, frames[0]].entries()) {
  const x = gap + (i % columns) * tileWidth, y = gap + Math.floor(i / columns) * tileHeight;
  layers.push({input: await sharp(frame.png).resize(thumb, thumb, {fit: 'contain', background: '#17252e00'}).png().toBuffer(), left: x, top: y});
  labels.push(`<text x="${x}" y="${y + thumb + 22}">${i === frames.length ? 'RETURN TO 01' : String(i + 1).padStart(2, '0')}</text>`);
}
layers.push({input: Buffer.from(`<svg width="${sheetWidth}" height="${sheetHeight}"><g fill="#e0e8ee" font-family="sans-serif" font-size="16">${labels.join('')}</g></svg>`), left: 0, top: 0});
await sharp({create: {width: sheetWidth, height: sheetHeight, channels: 4, background: '#17252e'}}).composite(layers).png().toFile(join(output, 'contact-sheet.png'));

// Last and first at native size, side by side. Transparent padding is retained.
await sharp({create: {width: width * 2, height, channels: 4, background: '#17252e'}})
  .composite([{input: frames.at(-1).png, left: 0, top: 0}, {input: frames[0].png, left: width, top: 0}])
  .png().toFile(join(output, 'seam-last-first.png'));
const report = {
  id: manifest.id || null, manifest: manifestPath, fps: manifest.fps,
  canvas: {width, height}, frameCount: frames.length,
  durationMs: delays.reduce((a, b) => a + b, 0), delaysMs: delays,
  frames: frames.map(({file, index, bounds, area, sha256}) => ({frame: index + 1, file, bounds, area, sha256})),
  duplicateFrames: frames.flatMap((a, i) => frames.slice(0, i).filter(b => b.sha256 === a.sha256).map(b => [b.index + 1, i + 1])),
  transitions,
  reviewStatus: 'UNREVIEWED — inspect motion, silhouette progression, colour shapes, base registration and loop seam visually',
};
await writeFile(join(output, 'review.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({output, frames: frames.length, width, height, durationMs: report.durationMs, duplicates: report.duplicateFrames}));
