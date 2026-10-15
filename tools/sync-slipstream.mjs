import { readFile, writeFile } from 'node:fs/promises';
import { withBlockworksRuntime } from './blockworks-runner.mjs';
await withBlockworksRuntime(async r => {
  const registry = await r.server.ssrLoadModule('/src/level.ts');
  const { slipstreamSnapshotKey } = await r.server.ssrLoadModule('/src/levels/slipstream-migration.ts');
  const { ASTRA_CHIMEWORKS_LEVEL } = await r.server.ssrLoadModule('/src/levels/astra-chimeworks.ts');
  const packPath = new URL('../public/levels.json', import.meta.url);
  const pack = JSON.parse(await readFile(packPath, 'utf8'));
  const candidates = pack.levels.filter(e => ['slip', 'slipstream-2', 'astra-chimeworks', 'slipstream-continuous', 'slipstream-race'].includes(e.id));
  candidates.push({ id: 'astra-chimeworks', name: ASTRA_CHIMEWORKS_LEVEL.name, data: ASTRA_CHIMEWORKS_LEVEL });
  const signaturePath = new URL('../src/levels/slipstream-retired-snapshots.json', import.meta.url);
  const signatures = JSON.parse(await readFile(signaturePath, 'utf8').catch(() => '{}'));
  for (const e of candidates) {
    if (!['slipstream-continuous','slipstream-race'].includes(e.id) && e.data.components.some(c => c.nm === 'Reservoir causeway')) continue;
    const hashes = [e.data, registry.normalizeCustomLevelData(e.data)].filter(Boolean).map(slipstreamSnapshotKey);
    signatures[e.id] = { name: e.name, hashes: [...new Set([...(signatures[e.id]?.hashes ?? []), ...hashes])] };
  }
  if (Object.keys(signatures).length) await writeFile(new URL('../src/levels/slipstream-retired-snapshots.json', import.meta.url), JSON.stringify(signatures, null, 2) + '\n');
  const normalized = registry.normalizeCustomLevelData(r.source);
  if (!normalized) throw Error('Continuous source rejected by level contract');
  pack.levels = pack.levels.filter(e => !['slipstream-2', 'astra-chimeworks', 'bonus-slipstream', 'bonus-chimeworks'].includes(e.id));
  const entry = pack.levels.find(e => e.id === 'slipstream-race') ?? pack.levels.find(e => e.id === 'slipstream-continuous') ?? pack.levels.find(e => e.id === 'slip');
  entry.id = 'slipstream-race';
  entry.name = r.source.name; entry.data = structuredClone(r.source);
  await writeFile(packPath, JSON.stringify(pack) + '\n');
  console.log(JSON.stringify({ components: r.source.components.length, checkpoints: r.l.checkpoints.length,
    cameras: r.l.lanePts.length, cameraRouteLength: r.l.laneArc.at(-1), normalized: true, signatures }, null, 2));
}, { modulePath: '/src/levels/slipstream.ts', source: m => m.SLIPSTREAM_LEVEL, levelId: 'slipstream-race' });
