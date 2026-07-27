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

const REPO = 'kiranmatthews/Game-prototype';
const BRANCH = 'claude/ps1-board-platformer-proto-n3mcnw';
const FILE_PATH = 'public/levels.json';
const API = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`;

export function getToken(): string {
  return localStorage.getItem('protoGHToken') ?? '';
}
export function setToken(t: string): void {
  const v = t.trim();
  if (v) localStorage.setItem('protoGHToken', v);
  else localStorage.removeItem('protoGHToken');
}

// UTF-8 → base64 (the contents API wants base64-encoded file content).
function toB64(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

// Read the deployed levels file from the Pages origin (cache-busted, no auth).
// Returns the parsed { "<id>": levelData } map, or null if none is published.
export async function fetchRemoteLevels(): Promise<Record<string, unknown> | null> {
  try {
    const r = await fetch(`./levels.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return null;
    return (await r.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
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
