import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import { discoverToolPages } from './tool-directory.mjs';
import { siteEntries } from './site-entries.mjs';

const root = new URL('../', import.meta.url).pathname;
async function load(file) {
  const result = await build({ entryPoints: [root + file], bundle: true, write: false, format: 'esm', platform: 'node' });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const pages = await discoverToolPages(root);
const expected = [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
  .trim().split('\n').filter(file => file.endsWith('.html') && file !== 'labs/index.html' && !file.startsWith('vendor/')))];
assert.deepEqual(pages.map(page => page.source).sort(), expected.sort(), 'Every project-owned HTML entry must be discoverable');
const { toolEntries } = await load('src/toolDirectoryEntries.ts');
const { requestedTool, TOOL_ROUTES } = await load('src/toolRoutes.ts');
const { TUNING_SECTIONS, TUNING_RANGES } = await load('src/tuning.ts');
for (const route of TOOL_ROUTES) {
  assert.equal(requestedTool(`?tool=${route}`, ''), route);
  assert.ok(toolEntries.some(entry => new URL(entry.path, 'https://example.test/').searchParams.get('tool') === route), `Missing ${route}`);
}
assert.equal(requestedTool('?tool=unknown', ''), null);
assert.equal(requestedTool('?tool=__proto__', ''), null);
assert.equal(requestedTool('', '#animationstudio'), 'animationstudio');
assert.equal(requestedTool('', '#fieldstudio'), 'fieldstudio');
assert.equal(requestedTool('', '#not-characterlab'), null);
const all = [...toolEntries, ...pages];
for (const entry of all) {
  await access(root + entry.source);
  assert.ok(entry.name && entry.description && entry.category);
  assert.ok(!entry.path.startsWith('/') && !entry.path.includes('..'), `Unportable ${entry.path}`);
  if (entry.path.split('?')[0].endsWith('.html') && !entry.local)
    assert.ok(Object.values(siteEntries).includes(entry.path.split('?')[0]) || pages.some(page => page.path === entry.path && page.source.startsWith('public/')));
}
for (const section of TUNING_SECTIONS.filter(section => section.keys.some(key => TUNING_RANGES[key])))
  assert.ok(toolEntries.some(entry => entry.name === section.title), `Missing tuning section ${section.title}`);
assert.equal(pages.find(page => page.path === 'tools/enemies/motion-review.html')?.local,false);
assert.ok(!pages.find(page => page.path === 'skate-pose-review.html')?.local);
for (const entry of Object.values(siteEntries)) await access(root + 'dist/' + entry);
const worker = await readFile(root + 'dist/sw.js', 'utf8');
assert.ok(worker.includes('labs/index.html'), 'Directory must ship in offline manifest');
assert.ok(worker.includes('tools/enemies/motion-review.html'), 'Enemy preview must ship in offline manifest');
console.log(`PASS ${pages.length} browser pages, ${toolEntries.length} embedded tools / variants, ${TOOL_ROUTES.length} routes and ${TUNING_SECTIONS.length} tuning sections; production and offline entries present.`);
