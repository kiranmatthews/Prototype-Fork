// Minimal PNG writer (8-bit RGBA or 8-bit grey) and helpers shared by the sprite-stack tools.
import { deflateSync } from 'node:zlib';
const crcTable = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc = (buf) => { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(type, 'ascii'), data]); const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body)); return Buffer.concat([len, body, sum]); };
/** Encode `pixels` (Uint8Array, row 0 at the top) as PNG. `channels` is 4 (RGBA) or 1 (grey). */
export const encodePng = (pixels, width, height, channels = 4) => {
  const stride = width * channels, raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) { raw[y * (stride + 1)] = 0; Buffer.from(pixels.buffer, pixels.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1); }
  const head = Buffer.alloc(13); head.writeUInt32BE(width, 0); head.writeUInt32BE(height, 4); head[8] = 8; head[9] = channels === 4 ? 6 : 0; head[10] = 0; head[11] = 0; head[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
};
export const fromB64 = (s) => new Uint8Array(Buffer.from(s, 'base64'));

import { inflateSync } from 'node:zlib';
/** Decode a non-interlaced 8-bit PNG (grey, RGB, palette, grey+alpha or RGBA) to RGBA rows, top row first. */
export const decodePng = (buffer) => {
  const data = Buffer.from(buffer); if (data.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let at = 8, width = 0, height = 0, depth = 0, type = 0, interlace = 0, palette = null, alpha = null; const idat = [];
  while (at < data.length) {
    const len = data.readUInt32BE(at), name = data.toString('ascii', at + 4, at + 8), body = data.subarray(at + 8, at + 8 + len); at += 12 + len;
    if (name === 'IHDR') { width = body.readUInt32BE(0); height = body.readUInt32BE(4); depth = body[8]; type = body[9]; interlace = body[12]; }
    else if (name === 'PLTE') palette = body; else if (name === 'tRNS') alpha = body; else if (name === 'IDAT') idat.push(body); else if (name === 'IEND') break;
  }
  if (depth !== 8 || interlace) throw new Error(`unsupported PNG (bit depth ${depth}, interlace ${interlace}): re-save as 8-bit, non-interlaced`);
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type]; if (!channels) throw new Error('unsupported PNG colour type ' + type);
  const raw = inflateSync(Buffer.concat(idat)), stride = width * channels, rows = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), row = rows.subarray(y * stride, (y + 1) * stride), up = y ? rows.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? row[x - channels] : 0, b = up ? up[x] : 0, c = up && x >= channels ? up[x - channels] : 0;
      let v = src[x];
      if (filter === 1) v += a; else if (filter === 2) v += b; else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      row[x] = v & 255;
    }
  }
  const pixels = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4, s = i * channels;
    if (type === 6) { pixels[o] = rows[s]; pixels[o + 1] = rows[s + 1]; pixels[o + 2] = rows[s + 2]; pixels[o + 3] = rows[s + 3]; }
    else if (type === 2) { pixels[o] = rows[s]; pixels[o + 1] = rows[s + 1]; pixels[o + 2] = rows[s + 2]; pixels[o + 3] = 255; }
    else if (type === 0) { pixels[o] = pixels[o + 1] = pixels[o + 2] = rows[s]; pixels[o + 3] = 255; }
    else if (type === 4) { pixels[o] = pixels[o + 1] = pixels[o + 2] = rows[s]; pixels[o + 3] = rows[s + 1]; }
    else { const p = rows[s] * 3; pixels[o] = palette[p]; pixels[o + 1] = palette[p + 1]; pixels[o + 2] = palette[p + 2]; pixels[o + 3] = alpha && rows[s] < alpha.length ? alpha[rows[s]] : 255; }
  }
  return { width, height, pixels };
};
