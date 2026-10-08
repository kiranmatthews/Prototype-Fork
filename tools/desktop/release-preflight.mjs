import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const pkg = JSON.parse(await readFile(new URL('../../desktop/package.json', import.meta.url), 'utf8'));
assert.equal(process.env.GITHUB_REF_TYPE, 'tag', 'Signed distribution must build an immutable desktop-vX.Y.Z tag');
assert.equal(process.env.GITHUB_REF_NAME, 'desktop-v' + pkg.version, 'Tag and desktop package version must match');
const required = process.platform === 'darwin'
  ? ['CSC_LINK', 'CSC_KEY_PASSWORD', 'APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID']
  : process.platform === 'win32' ? ['CSC_LINK', 'CSC_KEY_PASSWORD'] : [];
for (const name of required) assert(process.env[name], 'Missing release credential: ' + name);
console.log('PASS immutable version and signing prerequisites. Credential values are never printed.');
