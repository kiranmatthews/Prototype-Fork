// Aggregates the per-level Crash crate maps in docs/crate-bible/data/*.json
// into cross-level statistics for docs/CRATE_DESIGN_BIBLE.md.
//
//   node tools/crate-bible-stats.mjs            -> writes docs/crate-bible/STATS.md
//   node tools/crate-bible-stats.mjs --json     -> also prints the raw aggregate
//
// Level files follow the schema in docs/crate-bible/README.md. Files that are
// not level maps (current-game audit, probe output, stage-count tables) are
// skipped by shape, not by name.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'docs/crate-bible/data');
const OUT = path.join(ROOT, 'docs/crate-bible/STATS.md');

const levels = [];
for (const name of (await readdir(DATA)).filter(f => f.endsWith('.json')).sort()) {
  let json;
  try { json = JSON.parse(await readFile(path.join(DATA, name), 'utf8')); } catch (e) { console.warn(`skip ${name}: ${e.message}`); continue; }
  if (!json || !Array.isArray(json.clusters) || !json.game) continue;
  levels.push({ file: name, ...json });
}

const norm = s => String(s ?? '').trim().toLowerCase().replace(/[\s_]+/g, '-');
const gameKey = g => /4/.test(g) ? 'Crash 4' : /3|warped/i.test(g) ? 'Crash 3' : 'Crash 2';
const count = (map, key, n = 1) => map.set(key, (map.get(key) ?? 0) + n);
const pct = (a, b) => b ? `${(100 * a / b).toFixed(1)}%` : '—';
const EXPLOSIVE = new Set(['tnt', 'nitro']);
const ROUTE_TAGS = ['ON-PATH', 'EDGE-BAIT', 'DETOUR', 'BACKTRACK', 'HIDDEN', 'HIGH', 'LOW'];

// Agents describe arrangements in free text; fold them into canonical shape
// classes, preferring the standardised structure tags when present.
const SHAPES = ['SANDWICH', 'BRIDGE', 'STEPPING', 'FLOAT-LINE', 'COLUMN-BOUNCE', 'PYRAMID', 'WALL', 'GRID', 'STACK', 'ROW', 'PAIR', 'SINGLE'];
const shapeOf = c => {
  const tags = new Set((c.tags ?? []).map(t => String(t).toUpperCase()));
  for (const s of SHAPES) if (tags.has(s)) return s.toLowerCase();
  const a = norm(c.arrangement);
  const rules = [[/sandwich/, 'sandwich'], [/bridge/, 'bridge'], [/stepping|stepping-stone/, 'stepping'],
    [/float|arc|trail|hover|in-the-air|mid-air/, 'float-line'], [/column|tower/, 'column-bounce'], [/pyramid/, 'pyramid'],
    [/wall/, 'wall'], [/grid|block|\d+x\d+|×/, 'grid'], [/stack|\d-high|on-top|tall/, 'stack'],
    [/row|line|slalom|chain/, 'row'], [/pair|two/, 'pair'], [/single|lone|solo/, 'single']];
  for (const [re, k] of rules) if (re.test(a)) return k;
  return clusterCount(c) === 1 ? 'single' : 'other';
};
const baseKind = k => norm(k).replace(/\?+$/, '');

const clusterCount = c => {
  if (Number.isFinite(c.count)) return c.count;
  return Object.values(c.composition ?? {}).reduce((a, b) => a + (Number(b) || 0), 0);
};

const perLevel = [];
const byGame = new Map();
const blank = () => ({ levels: 0, boxes: 0, clusters: 0, mappedBoxes: 0, arrangement: new Map(), tags: new Map(),
  composition: new Map(), explosiveClusters: 0, mixedClusters: 0, floating: 0, sizes: [], sections: 0,
  firstSeen: new Map(), access: new Map() });

for (const lv of levels) {
  const g = gameKey(lv.game);
  if (!byGame.has(g)) byGame.set(g, blank());
  const agg = byGame.get(g);
  const sectionsInOrder = (lv.sections ?? []).map(s => s.id);
  const mainSections = (lv.sections ?? []).filter(s => !s.route || norm(s.route) === 'main').map(s => s.id);
  let mapped = 0, explosive = 0, mixed = 0, floating = 0;
  const arr = new Map(), tags = new Map();
  for (const c of lv.clusters) {
    const n = clusterCount(c);
    mapped += n;
    agg.sizes.push(n);
    const a = shapeOf(c);
    count(arr, a); count(agg.arrangement, a);
    for (const t of c.tags ?? []) { const k = String(t).toUpperCase(); count(tags, k); count(agg.tags, k); }
    for (const acc of c.access ?? []) count(agg.access, norm(acc));
    const kinds = Object.entries(c.composition ?? {}).filter(([, v]) => Number(v) > 0).map(([k]) => baseKind(k));
    for (const [k, v] of Object.entries(c.composition ?? {})) {
      count(agg.composition, baseKind(k), Number(v) || 0);
      if (/\?$/.test(String(k))) count(agg.composition, '(of which uncertain type)', Number(v) || 0);
    }
    if (kinds.some(k => EXPLOSIVE.has(k))) {
      explosive++;
      if (kinds.some(k => !EXPLOSIVE.has(k) && !['steel', 'arrowsteel', 'switch', 'switchgreen'].includes(k))) mixed++;
    }
    if (c.floating) floating++;
    // How far into the main route a tag first appears (0 = first section).
    const si = mainSections.indexOf(c.section);
    if (si >= 0 && mainSections.length > 1) for (const t of c.tags ?? []) {
      const k = `${String(t).toUpperCase()}`, f = si / (mainSections.length - 1);
      const key = `${lv.id}|${k}`;
      if (!agg.firstSeen.has(key) || agg.firstSeen.get(key) > f) agg.firstSeen.set(key, f);
    }
  }
  agg.levels++; agg.boxes += Number(lv.totalBoxes) || 0; agg.clusters += lv.clusters.length; agg.mappedBoxes += mapped;
  agg.explosiveClusters += explosive; agg.mixedClusters += mixed; agg.floating += floating;
  agg.sections += sectionsInOrder.length;
  perLevel.push({ id: lv.id, game: g, name: lv.name, total: lv.totalBoxes, mapped, clusters: lv.clusters.length,
    meanSize: lv.clusters.length ? mapped / lv.clusters.length : 0, singles: arr.get('single') ?? 0,
    sections: sectionsInOrder.length, explosive, mixed, enemies: (lv.enemies ?? []).length,
    puzzles: (lv.puzzles ?? []).length, topTags: [...tags].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ${v}`).join(', ') });
}

const median = xs => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };
const table = (head, rows) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map(r => `| ${r.join(' | ')} |`)].join('\n');

const lines = [];
lines.push('# Crate bible — aggregate statistics', '');
lines.push(`Generated by \`node tools/crate-bible-stats.mjs\` from ${levels.length} level maps in \`docs/crate-bible/data/\`.`);
lines.push('Counts are only as complete as each map; "mapped" is the sum of cluster counts, "total" the guide/HUD total.', '');
lines.push('## Per level', '');
lines.push(table(['Level', 'Game', 'Total', 'Mapped', 'Clusters', 'Mean size', 'Singles', 'Sections', 'Explosive clusters (mixed)', 'Enemies', 'Puzzles', 'Most used tags'],
  perLevel.map(l => [l.id, l.game, l.total ?? '—', l.mapped, l.clusters, l.meanSize.toFixed(2), `${l.singles} (${pct(l.singles, l.clusters)})`, l.sections,
    `${l.explosive} (${l.mixed})`, l.enemies, l.puzzles, l.topTags])));
lines.push('');
for (const [g, a] of [...byGame].sort()) {
  lines.push(`## ${g} — ${a.levels} levels, ${a.boxes} boxes (guide totals), ${a.mappedBoxes} mapped in ${a.clusters} clusters`, '');
  lines.push(`Mean cluster size ${(a.mappedBoxes / Math.max(1, a.clusters)).toFixed(2)}, median ${median(a.sizes)}, largest ${Math.max(0, ...a.sizes)}. ` +
    `Explosive clusters ${a.explosiveClusters} (${pct(a.explosiveClusters, a.clusters)}), of which mixed with collectibles ${a.mixedClusters}. ` +
    `Floating clusters ${a.floating} (${pct(a.floating, a.clusters)}). Sections ${a.sections}.`, '');
  lines.push('### Arrangements', '', table(['Arrangement', 'Clusters', 'Share'],
    [...a.arrangement].sort((x, y) => y[1] - x[1]).map(([k, v]) => [k, v, pct(v, a.clusters)])), '');
  lines.push('### Tags', '', table(['Tag', 'Clusters', 'Share'],
    [...a.tags].sort((x, y) => y[1] - x[1]).map(([k, v]) => [k, v, pct(v, a.clusters)])), '');
  lines.push('### Composition (crate types, summed)', '', table(['Type', 'Crates', 'Share of mapped'],
    [...a.composition].sort((x, y) => y[1] - x[1]).map(([k, v]) => [k, v, pct(v, a.mappedBoxes)])), '');
  lines.push('### Access methods', '', table(['Access', 'Clusters'], [...a.access].sort((x, y) => y[1] - x[1]).map(([k, v]) => [k, v])), '');
  // Teaching curve: median relative position (0..1 along the main route) of each tag's first use.
  const first = new Map();
  for (const [key, f] of a.firstSeen) { const tag = key.split('|')[1]; if (!first.has(tag)) first.set(tag, []); first.get(tag).push(f); }
  lines.push('### Where each tag first appears along the main route (median of levels; 0 = first section, 1 = last)', '',
    table(['Tag', 'Levels', 'Median first position'], [...first].filter(([, v]) => v.length >= 2).sort((x, y) => median(x[1]) - median(y[1]))
      .map(([k, v]) => [k, v.length, median(v).toFixed(2)])), '');
  const route = ROUTE_TAGS.map(t => [t, a.tags.get(t) ?? 0, pct(a.tags.get(t) ?? 0, a.clusters)]);
  lines.push('### Placement relative to the route', '', table(['Tag', 'Clusters', 'Share'], route), '');
}
await writeFile(OUT, lines.join('\n') + '\n');
console.log(`wrote ${path.relative(ROOT, OUT)} from ${levels.length} level maps`);
if (process.argv.includes('--json')) console.log(JSON.stringify({ perLevel }, null, 2));
