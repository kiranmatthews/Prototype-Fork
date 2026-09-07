import { MAX_LEVEL_PACK_BYTES, normalizeUserLevelEntries, levelJsonTextWithinLimits } from "./level";

// CROSS-DEVICE LEVEL SYNC
// Your level list lives in one JSON file committed to the repo and served by
// GitHub Pages (public/levels.json -> ./levels.json in the build). SYNC UP
// PUSHES the whole list there with a GitHub token (Contents: write); a device
// that has none of its own FETCHES it on load, and RESTORE FROM CLOUD re-reads
// it on demand. The phone needs no token — it just reads the public Pages
// file, so a published level shows up with zero setup.
//
// Payload shape: { v: 2, levels: LevelEntry[] }. (v1 was a map of per-level
// overrides keyed by list index; that scheme is gone with the index ids.)
//
// The token is the real write credential; it lives only in the editing
// browser's localStorage. A ~30s Pages rebuild is the propagation delay.

const REPO = 'kiranmatthews/Prototype-Fork';
const BRANCH = 'main';
const FILE_PATH = 'public/levels.json';
const API = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`;

export function getToken(): string {
  return localStorage.getItem('solProtoGHToken') ?? '';
}
export function setToken(t: string): void {
  const v = t.trim();
  if (v) localStorage.setItem('solProtoGHToken', v);
  else localStorage.removeItem('solProtoGHToken');
}

// UTF-8 → base64 (the contents API wants base64-encoded file content).
function toB64(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

// Read the deployed levels file from the Pages origin (cache-busted, no auth).
// Returns an entirely validated version-2 level pack, or null without changing local data.
export async function fetchRemoteLevels(): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const r = await fetch(`./levels.json?t=${Date.now()}`, { cache: 'no-store', signal: controller.signal });
    if (!r.ok || !r.body) return null;
    const declared = Number(r.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > MAX_LEVEL_PACK_BYTES) { controller.abort(); return null; }
    const reader = r.body.getReader();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    const chunks: string[] = [];
    let bytes = 0;
    let reads = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (++reads > 65_536) { await reader.cancel(); return null; }
        bytes += value.byteLength;
        if (bytes > MAX_LEVEL_PACK_BYTES) { await reader.cancel(); return null; }
        chunks.push(decoder.decode(value, { stream: true }));
      }
      chunks.push(decoder.decode());
    } finally { reader.releaseLock(); }
    const text = chunks.join('');
    if (!levelJsonTextWithinLimits(text, MAX_LEVEL_PACK_BYTES, 14)) return null;
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const pack = parsed as Record<string, unknown>;
    if (pack.v !== 2 || Object.keys(pack).some(key => key !== 'v' && key !== 'levels')) return null;
    const levels = normalizeUserLevelEntries(pack.levels);
    return levels ? { v: 2, levels } : null;
  } catch {
    return null;
  } finally { clearTimeout(timeout); }
}

interface PushResult {
  ok: boolean;
  msg: string;
}

async function currentSha(headers: HeadersInit): Promise<{ sha?: string; err?: string }> {
  try {
    const g = await fetch(`${API}?ref=${BRANCH}&t=${Date.now()}`, { headers, cache: 'no-store' });
    if (g.ok) return { sha: ((await g.json()) as { sha: string }).sha };
    if (g.status === 404) return {}; // file not created yet — first push
    if (g.status === 401 || g.status === 403) return { err: `auth rejected (${g.status}) — check the token + its repo access` };
    return { err: `couldn't read the current file (${g.status})` };
  } catch {
    return { err: 'network error reading the current file' };
  }
}

// Commit the payload to public/levels.json on the Pages branch. Retries once on
// a 409 (a stale sha because another push landed in between).
export async function pushLevels(payload: Record<string, unknown>): Promise<PushResult> {
  const token = getToken();
  if (!token) return { ok: false, msg: 'paste a GitHub token first' };
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' };
  const content = toB64(JSON.stringify(payload));

  for (let attempt = 0; attempt < 2; attempt++) {
    const { sha, err } = await currentSha(headers);
    if (err) return { ok: false, msg: err };
    const body: Record<string, unknown> = {
      message: 'Update synced levels from the in-game editor',
      content,
      branch: BRANCH,
    };
    if (sha) body.sha = sha;
    try {
      const p = await fetch(API, { method: 'PUT', headers, body: JSON.stringify(body) });
      if (p.ok) return { ok: true, msg: 'pushed — live on your phone in ~30s' };
      if (p.status === 409) continue; // sha raced; refetch and retry
      if (p.status === 401 || p.status === 403)
        return { ok: false, msg: `auth rejected (${p.status}) — the token needs Contents: write on this repo` };
      if (p.status === 422) return { ok: false, msg: 'GitHub rejected the commit (422) — is the branch name right?' };
      return { ok: false, msg: `push failed (${p.status})` };
    } catch {
      return { ok: false, msg: 'network error pushing' };
    }
  }
  return { ok: false, msg: 'kept conflicting — try again in a moment' };
}
