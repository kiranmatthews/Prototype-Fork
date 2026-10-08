'use strict';
const ORIGIN = 'boneman://game';
const CSP = [
  "default-src 'none'",
  "script-src 'self' blob: 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self' blob: data:",
  "connect-src 'self' blob: data:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

function localURL(raw) {
  try {
    const url = new URL(raw);
    return url.protocol === 'boneman:' && url.host === 'game' &&
      !url.username && !url.password && !url.port;
  } catch { return false; }
}
function allowedRequest(raw) {
  return localURL(raw) || raw.startsWith('data:') || raw.startsWith('blob:' + ORIGIN + '/');
}
function allowedNavigation(raw) {
  if (!localURL(raw)) return false;
  return ['/', '/index.html', '/reset-local-data.html'].includes(new URL(raw).pathname);
}
function assetKey(raw) {
  if (!localURL(raw)) return null;
  try {
    const name = decodeURIComponent(new URL(raw).pathname).slice(1) || 'index.html';
    // Only manifest members can be served. Reject ambiguous Windows/URL paths too.
    if (name.includes('\\') || name.includes('\0') || name.includes(':') ||
        name.split('/').some(p => !p || p === '.' || p === '..')) return null;
    return name;
  } catch { return null; }
}
function byteRange(header, size) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) return false;
  let start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  let end = match[1] && match[2] ? Number(match[2]) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) ||
      start < 0 || start >= size || end < start) return false;
  return { start, end: Math.min(end, size - 1) };
}
module.exports = { ORIGIN, CSP, localURL, allowedRequest, allowedNavigation, assetKey, byteRange };
