import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';

const fixture = await readFile(new URL('./test-crouch-jump-slam.mjs', import.meta.url), 'utf8');
new Function('noop', fixture.slice(fixture.indexOf('function installHeadlessDom()'), fixture.indexOf('\nconst held')) + '\ninstallHeadlessDom();')(() => {});
// Inventory serialized authoring separately from the derived runtime rails.
const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true, hmr: false, ws: false } });
try {
  const { BUILTIN_LEVELS, normalizeCustomLevelData } = await server.ssrLoadModule('/src/level.ts');
  const pack = JSON.parse(await readFile(new URL('../public/levels.json', import.meta.url), 'utf8'));
  const entries = BUILTIN_LEVELS.filter(e => e.data).map(e => ({ ...e, data: normalizeCustomLevelData(e.data) ?? e.data }));
  const report = [];
  for (const entry of entries) {
    const disabled = entry.data.components.flatMap((c, index) => c.edgeGrinding === false && c.solid !== false ?
      [{ index, t: c.t, nm: c.nm, invisible: c.invisible, outline: c.outline,
        shore: c.shoreProfile, loop: c.loopRadius, outOfBounds: c.outOfBounds }] : []);
    report.push({ id: entry.id, components: entry.data.components.length, disabled });
    console.log(`${entry.id}: ${disabled.length} solid opt-outs (${disabled.filter(c => !c.invisible).length} visible)`);
  }
  const output = process.env.EDGE_AUDIT_OUTPUT;
  if (output) await writeFile(output, JSON.stringify({ entries, published: pack.levels, report }));
  else console.log(JSON.stringify(report, null, 2));
} finally { await server.close(); }
