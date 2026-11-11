// Aggregates the Tony Hawk's Pro Skater level maps (docs/thps-bible/data/thps*.json) into
// cross-level statistics for docs/THPS_DESIGN_BIBLE.md: where secret tapes and letters sit,
// how they are shown, the moves and route lengths that reach them, gap kinds, unlocks, lines
// and difficulty across the four careers.
//
//   node tools/thps-bible-stats.mjs          -> writes docs/thps-bible/STATS.md
//   node tools/thps-bible-stats.mjs --json   -> also prints the aggregate as JSON
//
// The level files follow the schema in docs/thps-bible/README.md. Moves, roles, gap kinds and
// speeds use a fixed vocabulary; layers, launch surfaces and visibility are free text that this
// script folds into canonical classes with ordered regular expressions. Anything unmatched is
// counted as "other" so the tables show how much was left unclassified.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'docs/thps-bible/data');
const OUT = path.join(ROOT, 'docs/thps-bible/STATS.md');

const levels = [];
for (const name of (await readdir(DATA)).filter(f => /^thps\d-.*\.json$/.test(f)).sort()) {
  let json;
  try { json = JSON.parse(await readFile(path.join(DATA, name), 'utf8')); } catch (e) { console.warn(`skip ${name}: ${e.message}`); continue; }
  if (!json || !Array.isArray(json.collectibles)) { console.warn(`skip ${name}: no collectibles array`); continue; }
  levels.push({ file: name, ...json });
}

const text = v => (Array.isArray(v) ? v.map(x => (typeof x === 'object' ? JSON.stringify(x) : x)).join(' ') : typeof v === 'object' && v ? JSON.stringify(v) : String(v ?? '')).toLowerCase();
const gameOf = l => (String(l.game ?? l.id ?? l.file).match(/thps\s*([1-4])/i)?.[1] ?? String(l.file).match(/thps([1-4])/)?.[1] ?? '?');
const GAMES = ['1', '2', '3', '4'];
const count = (map, key, n = 1) => map.set(key, (map.get(key) ?? 0) + n);
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '—');
const median = xs => { const s = xs.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN; };
const quantile = (xs, q) => { const s = xs.filter(Number.isFinite).sort((a, b) => a - b); if (!s.length) return NaN; const i = (s.length - 1) * q; const lo = Math.floor(i); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (i - lo); };
const mean = xs => { const s = xs.filter(Number.isFinite); return s.length ? s.reduce((a, b) => a + b, 0) / s.length : NaN; };
const fmt = x => (Number.isFinite(x) ? (Math.round(x * 10) / 10).toString() : '—');
const table = (head, rows) => (rows.length ? [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map(r => `| ${r.join(' | ')} |`)].join('\n') : '_No records._');
const classify = (rules, s, fallback = 'other') => { for (const [re, k] of rules) if (re.test(s)) return k; return fallback; };
const classifyAll = (rules, s) => { const out = new Set(); for (const [re, k] of rules) if (re.test(s)) out.add(k); return out; };
const sorted = map => [...map.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));

// --- canonical vocabularies -------------------------------------------------------------------
// Collectible kinds come from the record's `type` (the agents' vocabulary), with id/label only as a
// fallback for generic types.
const KIND_BY_TYPE = [
  [/tape/, 'tape'],
  [/combo/, 'combo-letter'],
  [/letter/, 'skate-letter'],
  [/deck/, 'hidden deck'],
  [/goal-object/, 'goal object'],
  [/cash|bonus-icon|stat-point|icon/, 'cash / icon / stat point'],
  [/logo|plush|music|cd\b|remake-pickup|pickup|misc|collectible/, 'hidden item'],
  [/reach|objective|target/, 'reach goal'],
  [/secret-area|secret area/, 'secret area'],
];
const LAYER = [
  [/roof gap|gap between|\bair (off|above|past|beyond|over)|outside (the |a )?(wall|window)|past (the |an? )?(edge|end)/, 'mid-air over a gap'],
  [/inside-?room|inside (a |the )?room|sky ?box|secret room/, 'inside a room / secret area'],
  [/mid-?air|over (the )?(gap|channel|street|pool|drop|water|road|pipe)|above (the )?(gap|channel|street|drop)|in (the )?air|hangs? (in|over)/, 'mid-air over a gap'],
  [/above (the )?(half-?pipe|quarter|pipe|ramp|coping|vert|bowl|pool)|over (the )?(half-?pipe|quarter|vert|bowl)|vert/, 'above vert'],
  [/\bwires?\b|powerline|power line|cable|beam|girder|pipe(line)? grind|rafter|truss/, 'wire / beam / rafter'],
  [/catwalk|walkway|scaffold|balcon|gantry|mezzanine|bridge/, 'catwalk / balcony'],
  [/\broofs?\b|rooftop|awning|canopy|top of (the )?(building|tower|bus|train|hut|shop|store|structure)/, 'roof'],
  [/secret (area|room)|hidden (area|room)|inside|indoor|room|interior|behind (glass|the wall|a wall)|vault|cage|tunnel/, 'inside a room / secret area'],
  [/moving|vehicle|bus\b|truck|train|car\b|tram|cable car|helicopter|boat|ferry|gondola|elevator/, 'on a moving object'],
  [/ledge|stairs?|steps|planter|wall top|top of (the )?wall|billboard|sign|pillar|column|pole|tower|platform|statue|fountain|deck/, 'ledge / high object'],
  [/ground|floor|street level|street|bottom|pool floor|flat/, 'ground'],
];
const LAUNCH = [
  [/half-?pipe|quarter|vert|coping|bowl|pool|\bqp\b|\bhp\b|pipe/, 'vert ramp'],
  [/kicker|launch ramp|jump ramp|funbox|ramp|bank|wedge|hip/, 'kicker / ramp / bank'],
  [/rail|grind|ledge|wire|cable|powerline|lip of/, 'grind'],
  [/wallride|wall ride|wallie|wall\b/, 'wall'],
  [/roof|rooftop|awning|stairs?|steps|drop|edge|platform|deck/, 'drop / roof / edge'],
  [/flat|ground|street|ollie/, 'flat ground'],
];
const READS = [
  [/glass|window|caged?|behind/, 'behind glass / bars'],
  [/sky|silhouett|skyline|against/, 'silhouetted / against the sky'],
  [/float|hover|spinning|icon|bob/, 'floating icon'],
  [/glint|glow|light|sparkle|shine/, 'glinting / lit'],
];
const MOVES = ['ollie', 'kicker', 'grind', 'rail-transfer', 'ledge', 'wire', 'manual', 'wallride', 'wallie', 'vert-air', 'transfer', 'spine-transfer', 'hip', 'lip', 'bank', 'acid-drop', 'boneless', 'wallplant', 'revert', 'skitch', 'break-glass', 'smash', 'unlock', 'moving-object', 'walk'];
const TRANSIT = /^(ride|skate into it|drop-in|roll|unknown|roof)$/;
const MOVE_ALIAS = [
  [/hangtime/, 'kicker'], [/portal|teleport/, 'portal'],
  [/spine/, 'spine-transfer'], [/rail[- ]?transfer|rail to rail/, 'rail-transfer'], [/wallie/, 'wallie'], [/wall ?ride/, 'wallride'], [/wall ?plant/, 'wallplant'],
  [/acid/, 'acid-drop'], [/boneless/, 'boneless'], [/vert|air out|pipe air|straight air/, 'vert-air'], [/transfer/, 'transfer'], [/\bhip\b/, 'hip'],
  [/\blip\b|lip trick|stall/, 'lip'], [/bank/, 'bank'], [/revert/, 'revert'], [/manual/, 'manual'], [/skitch/, 'skitch'],
  [/glass/, 'break-glass'], [/smash|break/, 'smash'], [/unlock|switch|trigger/, 'unlock'], [/moving|ride the|vehicle/, 'moving-object'],
  [/walk|climb|on foot|hang|shimmy/, 'walk'], [/wire|powerline|cable/, 'wire'], [/ledge|curb/, 'ledge'], [/kicker|launch|ramp/, 'kicker'], [/grind|rail|50-50|boardslide/, 'grind'], [/ollie|jump|hop/, 'ollie'],
];
const canonMove = m => {
  const s = String(m ?? '').toLowerCase().trim().replace(/\s*\(.*\)\s*$/, '');
  if (!s || TRANSIT.test(s)) return null; // transit steps ("ride", "drop-in") are not moves
  if (MOVES.includes(s)) return s;
  return classify(MOVE_ALIAS, s, 'other');
};
const GAP_KINDS = ['rail-transfer', 'ledge-to-ledge', 'kicker', 'roof', 'wire', 'hip', 'spine', 'channel', 'over-object', 'pool-transfer', 'lip', 'manual', 'wallride', 'hangtime', 'secret-area', 'other'];
const gapKind = g => { const s = String(g.kind ?? '').toLowerCase().trim(); if (GAP_KINDS.includes(s)) return s; return classify([[/rail/, 'rail-transfer'], [/ledge/, 'ledge-to-ledge'], [/kick|ramp/, 'kicker'], [/roof/, 'roof'], [/wire|cable|power/, 'wire'], [/hip/, 'hip'], [/spine/, 'spine'], [/channel/, 'channel'], [/over|object/, 'over-object'], [/pool|bowl/, 'pool-transfer'], [/lip/, 'lip'], [/manual/, 'manual'], [/wall/, 'wallride'], [/hang/, 'hangtime'], [/secret/, 'secret-area']], s); };
const SPEED = [[/max/, 'maximum'], [/high|full|fast/, 'high'], [/mod|medium/, 'moderate'], [/none|low|slow|standing|any/, 'none']];
const COUPLING = [[/unlock|switch|trigger|open|break|glass|goal/, 'unlock'], [/moving|vehicle|bus|car|truck|train|tram|elevator|rotat|swing/, 'moving object'], [/tim(e|ing)|cycle|window/, 'timing'], [/pedestrian|traffic|crowd/, 'traffic'], [/^none|^no\b|^-$|^n\/a/, 'none']];
const ROLES = ['TEASE', 'TEST', 'EXPLORE', 'TEACH-LINE', 'REWARD', 'SECRET-AREA'];
const LEVEL_TYPE = [[/competition|comp\b/, 'competition'], [/bonus|secret|hidden/, 'bonus'], [/park/, 'career-park'], [/street|career/, 'career-street']];

const heightRange = v => {
  const s = String(v ?? '').replace(/–|—/g, '-');
  const m = s.match(/(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)/) ?? s.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const lo = Number(m[1]), hi = Number(m[2] ?? m[1]);
  return Number.isFinite(lo) ? { lo, hi, mid: (lo + hi) / 2 } : null;
};
const firstNumber = v => { const m = String(v ?? '').match(/(\d+(?:\.\d+)?)/); return m ? Number(m[1]) : NaN; };
const kindOf = c => {
  const k = classify(KIND_BY_TYPE, text(c.type), null);
  if (k) return k;
  const s = `${text(c.id)} ${text(c.label)}`;
  if (/^tape|secret tape/.test(s)) return 'tape';
  return OBJECT.test(s) ? 'goal object' : 'other';
};

// --- aggregate -------------------------------------------------------------------------------
const perGame = new Map(GAMES.map(g => [g, { levels: 0, types: new Map(), collectibles: new Map(), gaps: 0, gapsOnRoute: 0, lines: 0, unlocks: 0 }]));
const tapes = [], letters = [], allCollectibles = [];
const gapKinds = new Map(), gapKindsOnRoute = new Map(), gapPoints = [];
const lineLinks = new Map();
let linesTotal = 0, linesWithCollectible = 0, unlocksTotal = 0, unlocksForTape = 0, remakeChanges = 0;
const levelRows = [];
for (const l of levels) {
  const g = gameOf(l);
  const pg = perGame.get(g) ?? perGame.set(g, { levels: 0, types: new Map(), collectibles: new Map(), gaps: 0, gapsOnRoute: 0, lines: 0, unlocks: 0 }).get(g);
  pg.levels++;
  const type = classify(LEVEL_TYPE, text(l.type), 'other');
  count(pg.types, type);
  const tapeIds = new Set();
  for (const c of l.collectibles ?? []) {
    const kind = kindOf(c);
    count(pg.collectibles, kind);
    const moves = new Set([...(c.moves ?? []), ...(c.route ?? []).map(r => r?.move)].map(canonMove).filter(Boolean));
    const rec = {
      level: l.id ?? l.file.replace(/\.json$/, ''), game: g, kind, careerPosition: Number(l.careerPosition), levelType: type,
      layer: classify(LAYER, text(c.layer), null) ?? classify(LAYER, text(c.landmark)),
      height: heightRange(c.heightM), launch: classify(LAUNCH, text(c.launchFrom), 'other'),
      fromSpawn: c.visibility?.fromSpawn === true || /^yes|true/.test(text(c.visibility?.fromSpawn)),
      reads: classifyAll(READS, text(c.visibility?.reads) + ' ' + text(c.visibility?.firstSight)),
      firstSightDistance: firstNumber(c.visibility?.distanceFromFirstSightM),
      steps: Array.isArray(c.route) ? c.route.length : NaN, moves,
      speed: classify(SPEED, text(c.speed), 'unknown'), coupling: classify(COUPLING, text(c.coupling).trim(), 'other'),
      difficulty: Number(c.difficulty), roles: new Set((c.roles ?? []).map(r => String(r).toUpperCase())),
      confidence: text(c.confidence) || 'unknown', id: c.id, label: c.label, zone: c.zone, landmark: c.landmark,
    };
    allCollectibles.push(rec);
    if (kind === 'tape') { tapes.push(rec); tapeIds.add(String(c.id)); }
    if (kind === 'skate-letter' || kind === 'combo-letter') letters.push(rec);
  }
  for (const gap of l.gaps ?? []) {
    const k = gapKind(gap);
    count(gapKinds, k);
    pg.gaps++;
    const on = Array.isArray(gap.onRouteOf) && gap.onRouteOf.length > 0;
    if (on) { count(gapKindsOnRoute, k); pg.gapsOnRoute++; }
    const pts = Number(gap.points);
    if (Number.isFinite(pts) && pts > 0) gapPoints.push(pts);
  }
  for (const line of l.lines ?? []) {
    linesTotal++; pg.lines++;
    if (Array.isArray(line.collectibles) && line.collectibles.length) linesWithCollectible++;
    for (const link of line.links ?? []) count(lineLinks, canonMove(link) ?? String(link));
  }
  for (const u of l.unlocks ?? []) {
    unlocksTotal++; pg.unlocks++;
    if ((u.neededFor ?? []).some(id => tapeIds.has(String(id)) || /tape/i.test(String(id)))) unlocksForTape++;
  }
  remakeChanges += (l.remakeChanges ?? []).length;
  const t = (l.collectibles ?? []).find(c => kindOf(c) === 'tape');
  levelRows.push([l.id ?? l.file, `THPS${g}`, type, String(l.careerPosition ?? '—'), String((l.collectibles ?? []).length), String((l.gaps ?? []).length), String((l.lines ?? []).length),
    t ? `${String(t.layer ?? '—').replace(/\|/g, '/')}; ${String(t.heightM ?? '—').replace(/\|/g, '/')}` : '—', t ? String(t.difficulty ?? '—') : '—']);
}

// --- helpers for distribution tables ------------------------------------------------------------
const distRows = (recs, key, label = k => k) => {
  const all = new Map(), byGame = new Map(GAMES.map(g => [g, new Map()]));
  for (const r of recs) { const ks = r[key] instanceof Set ? [...r[key]] : [r[key]]; for (const k of ks) { count(all, k); count(byGame.get(r.game) ?? byGame.set(r.game, new Map()).get(r.game), k); } }
  const totals = new Map(GAMES.map(g => [g, recs.filter(r => r.game === g).length]));
  return sorted(all).map(([k, n]) => [label(k), String(n), pct(n, recs.length), ...GAMES.map(g => `${byGame.get(g)?.get(k) ?? 0}/${totals.get(g)}`)]);
};
const numberSummary = xs => `n ${xs.filter(Number.isFinite).length}, median ${fmt(median(xs))}, IQR ${fmt(quantile(xs, 0.25))}–${fmt(quantile(xs, 0.75))}, max ${fmt(Math.max(...xs.filter(Number.isFinite)))}`;
const heightBands = recs => {
  const bands = [[0, 1, 'ground (<1 m)'], [1, 3, '1–3 m'], [3, 6, '3–6 m'], [6, 10, '6–10 m'], [10, 20, '10–20 m'], [20, Infinity, '≥ 20 m']];
  return bands.map(([lo, hi, name]) => { const n = recs.filter(r => r.height && r.height.mid >= lo && r.height.mid < hi).length; return [name, String(n), pct(n, recs.filter(r => r.height).length)]; });
};
const moveCounts = recs => {
  const m = new Map();
  for (const r of recs) for (const mv of r.moves) count(m, mv);
  return sorted(m).map(([k, n]) => [k, String(n), pct(n, recs.length)]);
};
const comboRows = recs => {
  const m = new Map();
  for (const r of recs) { const key = [...r.moves].filter(x => !['ollie', 'walk'].includes(x)).sort().join(' + ') || 'ollie only'; count(m, key); }
  return sorted(m).slice(0, 15).map(([k, n]) => [k, String(n)]);
};

// --- report --------------------------------------------------------------------------------------
const md = [];
md.push('# THPS level statistics', '');
md.push(`Generated by \`node tools/thps-bible-stats.mjs\` from ${levels.length} level files in \`docs/thps-bible/data/\`. ` +
  'Counts are over the records the level files contain; heights are the midpoint of each recorded range (metres, estimated from in-game references). ' +
  'Per-game columns read "matching / records in that game".', '');
md.push('## Coverage', '');
md.push(table(['Game', 'Levels', 'Level types', 'Collectibles by kind', 'Gaps (on a collectible route)', 'Lines', 'Unlocks'],
  GAMES.map(g => { const p = perGame.get(g); return [`THPS${g}`, String(p.levels), sorted(p.types).map(([k, n]) => `${k} ${n}`).join(', ') || '—', sorted(p.collectibles).map(([k, n]) => `${k} ${n}`).join(', ') || '—', `${p.gaps} (${p.gapsOnRoute})`, String(p.lines), String(p.unlocks)]; })), '');
md.push(table(['Level', 'Game', 'Type', 'Career #', 'Collectibles', 'Gaps', 'Lines', 'Tape layer; height', 'Tape difficulty'], levelRows), '');

md.push('## Secret tapes', '');
md.push(`${tapes.length} tapes across ${new Set(tapes.map(t => t.level)).size} levels.`, '');
md.push('### Layer', '', table(['Layer', 'Tapes', 'Share', ...GAMES.map(g => `THPS${g}`)], distRows(tapes, 'layer')), '');
md.push('### Height above the ground below', '', `Heights: ${numberSummary(tapes.map(t => t.height?.mid))}.`, '', table(['Band', 'Tapes', 'Share'], heightBands(tapes)), '');
md.push('### Launch surface', '', table(['Launch from', 'Tapes', 'Share', ...GAMES.map(g => `THPS${g}`)], distRows(tapes, 'launch')), '');
const spawnSeen = tapes.filter(t => t.fromSpawn).length;
md.push('### Visibility', '', `Visible from spawn: ${spawnSeen}/${tapes.length} (${pct(spawnSeen, tapes.length)}). First-sight-to-pickup distance: ${numberSummary(tapes.map(t => t.firstSightDistance))} m.`, '',
  table(['How it reads', 'Tapes', 'Share', ...GAMES.map(g => `THPS${g}`)], distRows(tapes, 'reads')), '');
md.push('### Route', '', `Route steps: ${numberSummary(tapes.map(t => t.steps))}. Distinct moves per tape: ${numberSummary(tapes.map(t => t.moves.size))}.`, '',
  table(['Move', 'Tapes using it', 'Share'], moveCounts(tapes)), '', 'Most common move combinations (ollie and walking left out):', '', table(['Combination', 'Tapes'], comboRows(tapes)), '');
md.push('### Speed, coupling, difficulty and role', '', table(['Speed', 'Tapes', 'Share', ...GAMES.map(g => `THPS${g}`)], distRows(tapes, 'speed')), '',
  table(['Coupling', 'Tapes', 'Share', ...GAMES.map(g => `THPS${g}`)], distRows(tapes, 'coupling')), '',
  table(['Game', 'Mean difficulty', 'Median', 'Mean route steps', 'Tapes'], GAMES.map(g => { const ts = tapes.filter(t => t.game === g); return [`THPS${g}`, fmt(mean(ts.map(t => t.difficulty))), fmt(median(ts.map(t => t.difficulty))), fmt(mean(ts.map(t => t.steps))), String(ts.length)]; })), '');
const early = tapes.filter(t => t.careerPosition <= 3), late = tapes.filter(t => t.careerPosition >= 6);
md.push(`Career position 1–3: mean difficulty ${fmt(mean(early.map(t => t.difficulty)))}, mean steps ${fmt(mean(early.map(t => t.steps)))} (n ${early.length}); position 6+: mean difficulty ${fmt(mean(late.map(t => t.difficulty)))}, mean steps ${fmt(mean(late.map(t => t.steps)))} (n ${late.length}).`, '');
md.push(table(['Role', 'Tapes', 'Share', ...GAMES.map(g => `THPS${g}`)], distRows(tapes, 'roles')), '');

md.push('## Letters (S-K-A-T-E and C-O-M-B-O)', '');
md.push(`${letters.length} letter records.`, '', table(['Layer', 'Letters', 'Share', ...GAMES.map(g => `THPS${g}`)], distRows(letters, 'layer')), '',
  `Heights: ${numberSummary(letters.map(t => t.height?.mid))}. Visible from spawn: ${letters.filter(t => t.fromSpawn).length}/${letters.length}.`, '',
  table(['Move', 'Letters using it', 'Share'], moveCounts(letters)), '');
const others = allCollectibles.filter(c => !['tape', 'skate-letter', 'combo-letter'].includes(c.kind));
md.push('## Other collectibles and reach goals', '', `${others.length} records.`, '', table(['Kind', 'Records'], sorted(new Map(others.reduce((m, c) => (count(m, c.kind), m), new Map()))).map(([k, n]) => [k, String(n)])), '',
  table(['Layer', 'Records', 'Share', ...GAMES.map(g => `THPS${g}`)], distRows(others, 'layer')), '');

const gapsTotal = [...gapKinds.values()].reduce((a, b) => a + b, 0);
md.push('## Gaps', '', `${gapsTotal} named gaps; ${[...gapKindsOnRoute.values()].reduce((a, b) => a + b, 0)} lie on a collectible's route. Points where recorded: ${numberSummary(gapPoints)}.`, '',
  table(['Kind', 'Gaps', 'Share', 'On a collectible route'], sorted(gapKinds).map(([k, n]) => [k, String(n), pct(n, gapsTotal), String(gapKindsOnRoute.get(k) ?? 0)])), '');
md.push('## Lines and unlocks', '', `${linesTotal} designed lines; ${linesWithCollectible} (${pct(linesWithCollectible, linesTotal)}) carry at least one collectible. ` +
  `${unlocksTotal} unlock triggers; ${unlocksForTape} are needed for a tape. ${remakeChanges} remake changes recorded.`, '',
  table(['Line link', 'Uses'], sorted(lineLinks).map(([k, n]) => [k, String(n)])), '');

await writeFile(OUT, md.join('\n') + '\n');
console.log(`wrote ${path.relative(ROOT, OUT)} from ${levels.length} levels (${tapes.length} tapes, ${letters.length} letters, ${gapsTotal} gaps)`);
if (process.argv.includes('--json')) console.log(JSON.stringify({ levels: levels.length, tapes, letters: letters.length, gapKinds: Object.fromEntries(gapKinds) }, (k, v) => (v instanceof Set ? [...v] : v), 2));
