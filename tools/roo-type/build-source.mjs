// Preserve Roo's original curves and advances; no tracing or substitute face.
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import opentype from '../../node_modules/three/examples/jsm/libs/opentype.module.js';

const root = new URL('../../', import.meta.url);
const bytes = await fs.readFile(new URL('public/fonts/RooRegular.ttf', root));
const font = opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
const repertoire = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 !?.,:;/-+×°\'"()%&';
const caps = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'].map(c => font.charToGlyph(c).getBoundingBox());
const bottom = Math.min(...caps.map(b => b.y1));
const top = Math.max(...caps.map(b => b.y2));
const height = top - bottom;
const glyphs = {};
const kern = {};
const round = n => Math.round(n * 1e7) / 1e7;
for (const char of repertoire) {
  const glyph = font.charToGlyph(char);
  if (!glyph.index && char !== ' ') continue;
  const box = glyph.getBoundingBox();
  glyphs[char] = {
    advance: round(glyph.advanceWidth / height),
    bounds: [box.x1 / height, (box.y1 - bottom) / height, box.x2 / height, (box.y2 - bottom) / height].map(round),
    commands: glyph.path.commands.map(cmd => Object.fromEntries(Object.entries(cmd).map(([key, value]) =>
      [key, key === 'type' ? value : round((value - (key.startsWith('y') ? bottom : 0)) / height)]))),
  };
  for (const next of repertoire) {
    const value = font.getKerningValue(glyph, font.charToGlyph(next));
    if (value) kern[char + next] = round(value / height);
  }
}
const source = { version: 1, family: 'Roo', source: 'RooRegular.ttf', sha256: createHash('sha256').update(bytes).digest('hex'),
  capBand: { bottom, top, height, unitsPerEm: font.unitsPerEm }, glyphs, kern };
await fs.writeFile(new URL('public/fonts/roo-bevel-source-v1.json', root), JSON.stringify(source));
console.log(JSON.stringify({ glyphs: Object.keys(glyphs).length, capBand: source.capBand, sha256: source.sha256 }));
