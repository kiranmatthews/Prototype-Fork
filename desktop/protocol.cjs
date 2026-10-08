'use strict';
const path = require('node:path');
const { createReadStream } = require('node:fs');
const { Readable } = require('node:stream');
const { assetKey, byteRange, CSP } = require('./policy.cjs');
const TYPES = {
  html:'text/html; charset=utf-8', js:'text/javascript; charset=utf-8', css:'text/css; charset=utf-8',
  json:'application/json', wasm:'application/wasm', glb:'model/gltf-binary', gltf:'model/gltf+json',
  bin:'application/octet-stream', ktx2:'image/ktx2', png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg',
  webp:'image/webp', svg:'image/svg+xml', wav:'audio/wav', mp3:'audio/mpeg', ogg:'audio/ogg',
  m4a:'audio/mp4', mp4:'video/mp4', webm:'video/webm', ttf:'font/ttf', otf:'font/otf',
  woff:'font/woff', woff2:'font/woff2', webmanifest:'application/manifest+json', txt:'text/plain', md:'text/plain',
};
function assetHandler(root, manifest, onMissing = () => {}) {
  const entries = new Map(manifest.files.map(row => [row.path, row]));
  return request => {
    const key = assetKey(request.url);
    const row = entries.get(key);
    const headers = new Headers({
      'Content-Security-Policy': CSP,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': key?.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'no-store',
    });
    if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status:405, headers });
    if (!row) { onMissing(key); return new Response(null, { status:404, headers }); }
    const range = byteRange(request.headers.get('range'), row.bytes);
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Content-Type', TYPES[path.extname(key).slice(1)] ?? 'application/octet-stream');
    if (range === false) {
      headers.set('Content-Range', 'bytes */' + row.bytes);
      return new Response(null, { status:416, headers });
    }
    const { start, end } = range ?? { start:0, end:row.bytes - 1 };
    headers.set('Content-Length', String(Math.max(0, end - start + 1)));
    if (range) headers.set('Content-Range', `bytes ${start}-${end}/${row.bytes}`);
    const stream = request.method === 'HEAD' || row.bytes === 0 ? null :
      Readable.toWeb(createReadStream(path.join(root, key), { start, end, highWaterMark:64 * 1024 }));
    return new Response(stream, { status:range ? 206 : 200, headers });
  };
}
module.exports = { assetHandler, TYPES };
