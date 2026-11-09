// Aggregates the geometry, obstacle and enemy records in the Crash level maps
// (docs/crate-bible/data/*.json: platforms, gapsDetailed, jumpSequences,
// obstacles, enemiesDetailed, sectionBeats, camera/cameraSections) into
// cross-level statistics for the design bible.
//
//   node tools/crate-bible-geometry-stats.mjs          -> writes docs/crate-bible/GEOMETRY_STATS.md
//   node tools/crate-bible-geometry-stats.mjs --json   -> also prints the per-level aggregate
//
// Agents describe shapes, kinds and placements in free text that starts from
// the vocabulary in the geometry brief (docs/crate-bible/README.md). This
// script folds that text into canonical classes with ordered regular
// expressions; anything unmatched is counted as "other" so the tables show how
// much was left unclassified. Widths are crate units (u) as recorded.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'docs/crate-bible/data');
const OUT = path.join(ROOT, 'docs/crate-bible/GEOMETRY_STATS.md');

const levels = [];
for (const name of (await readdir(DATA)).filter(f => f.endsWith('.json')).sort()) {
  let json;
  try { json = JSON.parse(await readFile(path.join(DATA, name), 'utf8')); } catch (e) { console.warn(`skip ${name}: ${e.message}`); continue; }
  if (!json || !json.game || !Array.isArray(json.clusters)) continue;
  if (!Array.isArray(json.platforms) && !Array.isArray(json.gapsDetailed) && !Array.isArray(json.enemiesDetailed)) continue;
  levels.push({ file: name, ...json });
}

const text = v => (Array.isArray(v) ? v.join(' ') : String(v ?? '')).toLowerCase();
const gameKey = g => /4/.test(g) ? 'Crash 4' : /3|warped/i.test(g) ? 'Crash 3' : 'Crash 2';
const count = (map, key, n = 1) => map.set(key, (map.get(key) ?? 0) + n);
const pct = (a, b) => b ? `${(100 * a / b).toFixed(0)}%` : '—';
const median = xs => { const s = xs.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN; };
const quantile = (xs, q) => { const s = xs.filter(Number.isFinite).sort((a, b) => a - b); if (!s.length) return NaN; const i = (s.length - 1) * q; const lo = Math.floor(i); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (i - lo); };
const fmt = x => Number.isFinite(x) ? (Math.round(x * 10) / 10).toString() : '—';
const table = (head, rows) => rows.length ? [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map(r => `| ${r.join(' | ')} |`)].join('\n') : '_No records._';
const classify = (rules, s, fallback = 'other') => { for (const [re, k] of rules) if (re.test(s)) return k; return fallback; };
const classifyAll = (rules, s) => { const out = new Set(); for (const [re, k] of rules) if (re.test(s)) out.add(k); return out; };

// --- canonical vocabularies -------------------------------------------------
const PLATFORM_SHAPE = [
  [/vehicle lane|open (river|water|sea)|\blane\b.*(board|jet|vehicle)|road\b|highway|track\b|race/, 'vehicle lane / road'],
  [/\brail\b|grind|pipe\b|\bwire\b|cable|zip/, 'rail / pipe / wire'],
  [/\bcrates?\b|\bbox(es)?\b|\bsteel blocks?\b|\bblock(s)? of crates/, 'crate-built'],
  [/stepping|stones?\b(?! (tile|wall))|lily|discs?\b|row of (pads|pillars|tiles)|tiles\b/, 'stepping stones'],
  [/pillar|column|post\b|pole\b|totem|stump|pylon|pedestal/, 'pillar / post'],
  [/bridge|plank|walkway|catwalk|girder|beam\b|pier\b|causeway|jetty|dock/, 'bridge / plank / walkway'],
  [/\blogs?\b|barrel|trunk/, 'log / barrel'],
  [/ramp|slope|downhill|uphill|hill\b|kicker|half-?pipe|quarter/, 'ramp / slope'],
  [/stair|terrace|steps?\b|tiered|tier\b/, 'stairs / terraces'],
  [/narrow|ledge|ridge|\blip\b|strip|rim\b|one-tile|single-tile/, 'narrow ledge'],
  [/square|\bpad\b|\btile\b|\bblock\b|platform\b|island|disc|raft|float/, 'pad / tile / small platform'],
  [/corridor|hall|tunnel|alley|aisle|passage|street|path\b|bore\b|lane\b|maze/, 'corridor / lane'],
  [/wide|floor|arena|room|courtyard|plaza|deck|ground|area|bank|shore|beach|field|yard|patch|pocket|spot/, 'wide floor / room'],
  [/wall|fence|barrier|ceiling/, 'wall / barrier (as geometry)'],
];
const PLATFORM_BEHAVIOUR = [
  [/crumbl|collaps|break-?away|falls? (away|after)|gives way|drop(s)? (after|when)|slabs? drop/, 'crumbling / collapsing'],
  [/phase|timed|appear|vanish|blink|materiali|switch|outline|on\/off/, 'phase / switch-made'],
  [/sink|submerg|bob|float(s|ing)? (up|down)|dip|tilt|see-?saw|wobbl/, 'sinking / bobbing / tilting'],
  [/rotat|spin|turn(s|ing)\b|revolv|carousel|wheel|flip/, 'rotating'],
  [/moving|mover|travel|lift|elevator|shuttle|ride|rises|lowers|oscillat|slid(es|ing) (left|right|back)|orbit|vertical|lateral|forced scroll|current|flow/, 'moving / riding'],
  [/bounc|trampol|spring|launch/, 'bouncy'],
  [/conveyor/, 'conveyor'],
  [/breakable|smash|crate/, 'breakable (crates)'],
];
const SURFACE = [
  [/\bice\b|\bicy\b|iced|slip|low traction|frozen/, 'ice / slippery'],
  [/\bsnow/, 'snow'],
  [/\btar\b|\bmud\b|slow traversal|sticky|goo|sludge|swamp/, 'tar / mud / slow'],
  [/water|swim|wade|river|sea\b|pool/, 'water'],
];
const GAP_KIND = [
  [/timed-?lethal|eel|electri/, 'timed lethal water'],
  [/safe water|wadable|shallow|\bmud\b|slows/, 'safe water / mud'],
  [/whirlpool|water|river|pond|pool|sea\b|lake|orca|ice hole|surf/, 'lethal water'],
  [/lava|magma|fire/, 'lava / fire'],
  [/spike|thorn/, 'spikes'],
  [/crumbl|collaps|break/, 'crumble run'],
  [/moving-?platform|moving platform|disc trough|raft|\bride\b|lift|elevator|conveyor/, 'moving-platform crossing'],
  [/swing|vine|rope/, 'swing / vine'],
  [/bounce|trampol|spring/, 'chasm with bounce'],
  [/drop-?down|drop down|drop to|one-way/, 'drop-down'],
  [/nitro|tnt|barrier|hurdle|totem|wall|fence|ceiling/, 'hurdle / barrier (no gap)'],
  [/floor hole|hole in the floor|\bhole\b/, 'floor hole'],
  [/pit|chasm|trench|bottomless|gap|void|abyss|cliff/, 'bottomless pit'],
];
const MOVE = [
  [/double/, 'double'],
  [/spin-?extend|spin jump|spin-?jump|spin/, 'spin-extended'],
  [/slide-?jump|long jump|slide/, 'slide-jump'],
  [/held|high/, 'held/high'],
  [/running|run|dash/, 'running'],
  [/crate-?bounce|bounce crate|striped|crate/, 'crate-bounce'],
  [/enemy-?bounce|enemy/, 'enemy-bounce'],
  [/arrow/, 'arrow'],
  [/body-?slam|slam/, 'body-slam drop'],
  [/swing|vine|rope/, 'swing'],
  [/trampoline|mushroom|bounce pad|spring/, 'bounce pad'],
  [/ride|vehicle|board|surf|jet|bike|bear|boost/, 'ride'],
  [/drop|fall/, 'drop'],
  [/walk|step|wade/, 'walk/step'],
  [/plain|jump/, 'plain'],
];
const OBSTACLE_KIND = [
  [/nitro|tnt/, 'explosive crates'],
  [/electr|laser|beam|zap|spark|tesla|eel|lightning|shock/, 'electric / laser'],
  [/flame|fire|torch|lava|burn|heat|steam|vent/, 'fire / flame / steam'],
  [/propeller|\bfan\b|blade|axe|saw\b|scythe|whirl|spinning/, 'rotating blade / fan'],
  [/crush|piston|smash|press|stomp|slab|up-down pillar|drop-?pillar|hammer/, 'crusher / piston'],
  [/pendulum|swinging/, 'pendulum'],
  [/roll|boulder|barrel|\blog\b|snowball|disc stone|\bball\b|wheel/, 'rolling object'],
  [/spike|thorn|needle/, 'spikes'],
  [/icicle|falling|drop(ping)?|debris|rockfall|stalactite/, 'falling object'],
  [/wind|gust|blow/, 'wind'],
  [/rising|flood|tide/, 'rising water / tar'],
  [/conveyor/, 'conveyor'],
  [/\bmines?\b|bomb/, 'mine'],
  [/turret|cannon|shoot|projectile|dart|missile|gun|mortar/, 'turret / projectile'],
  [/car\b|cars\b|truck|traffic|vehicle|train|\bbus\b|tank\b/, 'traffic / vehicle'],
  [/collaps|crumbl|bridge/, 'collapsing scenery'],
  [/whirlpool|water|pool|wave/, 'water hazard'],
  [/ice|slip/, 'slippery surface'],
  [/totem|fence|wall|barrier|ceiling|maze|blocker|fake/, 'static blocker'],
  [/hole|pit/, 'floor hole / pit'],
];
const PLACEMENT_OBS = [
  [/pursu|chase|behind/, 'pursuer'],
  [/overhead|above|ceiling/, 'overhead'],
  [/flank|side/, 'flank'],
  [/on platform|on the platform|landing/, 'on platform'],
  [/in pit|in the pit|below|under/, 'in pit / below'],
  [/across|path|lane|line/, 'across path'],
];
const ARCHETYPE = [
  [/boss/, 'mini-boss'],
  [/pursu/, 'pursuer'],
  [/shield|armou?r/, 'shielded/armored'],
  [/burrow|ambush|pop/, 'burrower/ambusher'],
  [/swim/, 'swimmer'],
  [/fli|fly|flier|flyer|hover/, 'flier'],
  [/hop|jump/, 'hopper'],
  [/chas/, 'chaser'],
  [/projectile|shoot|throw|spit/, 'projectile'],
  [/loop|circl/, 'patrol-loop'],
  [/patrol|1-?d|back.?and.?forth|pace/, 'patrol-1D'],
  [/static|stationary|idle|rooted/, 'static'],
];
const COUNTER = [
  [/flip/, 'flip-then-spin'],
  [/body.?slam|slam/, 'body slam'],
  [/spin/, 'spin'],
  [/stomp|jump on|bounce on|jump-on/, 'stomp'],
  [/slide/, 'slide'],
  [/tnt|blast|explo|nitro/, 'TNT/blast'],
  [/fling|knock .* into|kick/, 'fling into'],
  [/enemy-?bounce|bounce off|as a step/, 'bounce off (tool)'],
  [/shoot|bazooka|fruit/, 'shoot'],
  [/ram|vehicle|bear|board|charge through/, 'ram (vehicle)'],
  [/avoid|dodge|wait|outpace|outrun|jump over|go around|pass|leave at once|hop/, 'avoid'],
  [/mask|aku/, 'mask/invincibility'],
];
const FAILS = [
  [/stomp|jump on|bounce on|landing on/, 'stomp fails'],
  [/spin/, 'spin fails'],
  [/slide/, 'slide fails'],
  [/front|approach|contact|touch|head-?on/, 'contact from the front'],
  [/timing|while|during|active|extended|out\b/, 'wrong phase'],
];
const PLACEMENT_EN = [
  [/take-?off/, 'take-off edge'],
  [/landing/, 'landing platform'],
  [/moving platform|on a raft|on the disc/, 'moving platform'],
  [/between hazards|between/, 'between hazards'],
  [/guard/, 'guarding crate'],
  [/above|overhead|air\b|hover/, 'above'],
  [/in pit|in the pit|pool|water|below/, 'in pit / water'],
  [/flank|side|beside/, 'flank'],
  [/on line|on the line|line|lane|path|road|arena|floor/, 'on line'],
];
const RHYTHM = [[/accel/, 'accelerating'], [/syncop|uneven|irregular|waits|timed/, 'syncopated'], [/stop|wait|pause/, 'stop-and-go'],
  [/isolated|one jump per screen/, 'isolated'], [/even|steady|regular|cadence/, 'even']];
const OBS_COUNTER = [
  [/slide under|duck/, 'slide under'],
  [/wait|pause|time the pass|stop|sideways|pocket|while it is up|rise/, 'wait-and-go'],
  [/jump|hop|ramp|leap/, 'jump over'],
  [/go around|keep (left|right)|\bleft\b|\bright\b|slalom|zig-?zag|thread|free side|bear |jam |steer|lane/, 'go around / steer'],
  [/destroy|break|detonat|spin|stomp|smash|shoot/, 'destroy'],
  [/outrun|dash|boost|turbo|never stop|sprint|run/, 'outrun / pass at speed'],
  [/slow|walk|approach/, 'approach slowly'],
  [/avoid|do not/, 'avoid'],
];
const CAMERA = [[/top-?down|aerial|overhead/, 'top-down / aerial'], [/toward|chase|run at camera|front/, 'toward-camera chase'],
  [/vehicle|board|jet|bike|bear|plane|sub/, 'vehicle'], [/side/, 'side-scroll'], [/into|behind|3d|forward/, 'into-screen']];
const TELEGRAPH = /telegraph|warn|flash|shake|sound|audio|rise|rising|glow|blink|light|signal|count|visible|tell|cue|pulse|crouch|wind-?up|charge/;
const ROLE_SET = new Set(['REST', 'STEPPING', 'LANDING', 'SAFE-ISLAND', 'PERCH', 'CHECKPOINT-PAD', 'BONUS-PAD', 'ARENA', 'CHOKE', 'TIMING-STEP',
  'TIMING-GATE', 'LANE-BLOCK', 'PURSUIT', 'AREA-DENIAL', 'RHYTHM', 'TEACH', 'TEST', 'GUARD', 'TOOL/STEP', 'PROJECTILE', 'BAIT', 'HURDLE',
  'AMBUSH', 'PURSUER', 'GATEKEEPER']);
const roleKey = r => { const k = String(r).trim().toUpperCase(); return ROLE_SET.has(k) ? k : 'OTHER'; };

// Widths: every number or range in the text, skipping numbers that are
// heights, lengths, multipliers or counts; the widest span counts.
const parseWidth = v => {
  if (typeof v === 'number') return v;
  const s = text(v);
  if (!s || /not visible|^-$|^—$|n\/a/.test(s) && !/\d/.test(s)) return NaN;
  const spans = [];
  for (const m of s.matchAll(/(?<![x×\d.])(\d+(?:\.\d+)?)(?:\s*[-–]\s*(\d+(?:\.\d+)?))?(\s*(?:u\b)?\s*(high|tall|long|deep|apart|wide lane|crates? high|hits?|times|s\b|sec))?/g)) {
    if (m[4]) continue;
    const a = Number(m[1]), b = m[2] ? Number(m[2]) : a;
    if (a > 40) continue;
    spans.push((a + b) / 2);
  }
  return spans.length ? Math.max(...spans) : NaN;
};
const heightClass = v => {
  if (typeof v === 'number') return v > 0 ? 'up' : v < 0 ? 'down' : 'level';
  const s = text(v).trim();
  if (!s || /not visible/.test(s) && !/[+\-−]/.test(s)) return 'unknown';
  if (/^0(\b|$)/.test(s) && !/[+\-−]/.test(s.slice(1))) return 'level';
  if (/^0\s*\/\s*[+]|\+.*[-−]|[-−].*\+|mixed|varies/.test(s)) return 'mixed';
  if (/^[-−]|down|drop|lower|fall/.test(s)) return 'down';
  if (/^\+|up|lift|launch|climb|rise|higher|^\d/.test(s)) return 'up';
  return 'unknown';
};
const failureClass = v => classify([
  [/not a failure/, 'not a failure (it is the route)'],
  [/bonus/, 'ejected from the bonus'],
  [/trapped|slowed|no death|\bmud\b/, 'trapped or slowed, no death'],
  [/lost|irreversible|drop to the floor|lower|fall to a|below/, 'falls to a lower route / boxes lost'],
  [/mask|aku|damage|knock/, 'damage / mask lost'],
  [/death|die|lethal|drown|bitten|sucked|crush|topple|freeze|discharge|nitro|kill|\bfall\b/, 'death'],
  [/climb|walk back|back up|retry|swim back|return/, 'climb or walk back'],
  [/not visible|not stated|^none$/, 'not recorded']], text(v), text(v) ? 'other' : 'not recorded');
const coupled = v => { const s = text(v).trim(); return !!s && !/^none\b|^—$|^-$|^no\b|not coupled/.test(s); };

// --- aggregate ---------------------------------------------------------------
const blank = () => ({ levels: 0, platforms: 0, shape: new Map(), behaviour: new Map(), surface: new Map(), proles: new Map(),
  gaps: 0, gkind: new Map(), lethal: 0, widths: [], widthByMove: new Map(), moves: new Map(), height: new Map(), coupledGaps: 0, failure: new Map(),
  lethalMainWidths: [], jumps: 0, jcounts: [], rhythm: new Map(), noStop: 0, jmax: [], jmoves: new Map(),
  obstacles: 0, okind: new Map(), oplace: new Map(), ocounter: new Map(), oroles: new Map(), olethal: 0, otelegraph: 0,
  enemies: 0, arch: new Map(), ecounter: new Map(), efails: new Map(), eplace: new Map(), eroles: new Map(), firstAlone: 0, firstAloneKnown: 0,
  debuts: 0, debutsAlone: 0, debutPlace: new Map(),
  sections: 0, sgaps: [], senemies: [], shazards: [], sbeats: [], camera: new Map(),
  firstPos: { enemy: new Map(), obstacle: new Map(), gap: new Map() } });
const byGame = new Map([['All', blank()]]);
const perLevel = [];

for (const lv of levels) {
  const g = gameKey(lv.game);
  if (!byGame.has(g)) byGame.set(g, blank());
  const aggs = [byGame.get(g), byGame.get('All')];
  const main = (lv.sections ?? []).filter(s => !s.route || /^main/i.test(String(s.route))).map(s => s.id);
  const isMain = sec => main.includes(sec) || (!main.length && /^S\d/.test(String(sec)));
  const relPos = sec => { const i = main.indexOf(sec); return i >= 0 && main.length > 1 ? i / (main.length - 1) : NaN; };
  const firstSeen = { enemy: new Map(), obstacle: new Map(), gap: new Map() };
  const seen = (kind, key, sec) => { const f = relPos(sec); if (!Number.isFinite(f)) return; const m = firstSeen[kind]; if (!m.has(key) || m.get(key) > f) m.set(key, f); };

  const plats = lv.platforms ?? [], gaps = lv.gapsDetailed ?? [], jumps = lv.jumpSequences ?? [], obs = lv.obstacles ?? [], ens = lv.enemiesDetailed ?? [];
  const beats = lv.sectionBeats ?? [];
  const cams = Array.isArray(lv.camera) ? lv.camera : Array.isArray(lv.cameraSections) ? lv.cameraSections : [];
  const lvWidths = [];
  let lvLethal = 0, lvAlone = 0, lvAloneKnown = 0;
  for (const a of aggs) { a.levels++; a.platforms += plats.length; a.gaps += gaps.length; a.jumps += jumps.length; a.obstacles += obs.length; a.enemies += ens.length; a.sections += beats.length; }

  for (const p of plats) {
    const s = text([p.shape, p.size]);
    const shape = classify(PLATFORM_SHAPE, text(p.shape));
    const beh = classify(PLATFORM_BEHAVIOUR, text([p.behaviour, p.shape]), 'static');
    const surf = classify(SURFACE, text([p.shape, p.behaviour]), 'normal');
    for (const a of aggs) { count(a.shape, shape); count(a.behaviour, beh); count(a.surface, surf); for (const r of p.roles ?? []) count(a.proles, roleKey(r)); }
    void s;
  }
  for (const gp of gaps) {
    const kind = classify(GAP_KIND, text(gp.kind));
    const w = /hurdle|barrier/.test(kind) ? NaN : parseWidth(gp.width);
    const moves = gp.move?.length ? [...new Set(gp.move.map(m => classify(MOVE, text(m))))] : ['not recorded'];
    const hc = heightClass(gp.heightDelta);
    const lethal = gp.lethal === true || /^(y|yes|true)/i.test(String(gp.lethal));
    if (lethal) lvLethal++;
    if (Number.isFinite(w)) lvWidths.push(w);
    for (const a of aggs) {
      count(a.gkind, kind); count(a.height, hc); count(a.failure, failureClass(gp.failure));
      if (lethal) a.lethal++;
      if (coupled(gp.coupling)) a.coupledGaps++;
      for (const m of moves) { count(a.moves, m); if (Number.isFinite(w)) { if (!a.widthByMove.has(m)) a.widthByMove.set(m, []); a.widthByMove.get(m).push(w); } }
      if (Number.isFinite(w)) { a.widths.push(w); if (lethal && isMain(gp.section) && !moves.includes('ride')) a.lethalMainWidths.push(w); }
    }
    seen('gap', kind, gp.section);
  }
  for (const j of jumps) {
    const n = Number(j.count);
    const r = classify(RHYTHM, text(j.rhythm));
    const mx = parseWidth(j.maxGap);
    const ns = j.noStop === true || /^(y|yes|true)/i.test(String(j.noStop));
    for (const a of aggs) {
      if (Number.isFinite(n)) a.jcounts.push(n);
      count(a.rhythm, r); if (ns) a.noStop++; if (Number.isFinite(mx)) a.jmax.push(mx);
      for (const m of new Set((j.moves ?? []).map(m => classify(MOVE, text(m))))) count(a.jmoves, m);
    }
  }
  for (const o of obs) {
    const kinds = classifyAll(OBSTACLE_KIND, text(o.kind));
    if (!kinds.size) kinds.add('other');
    const places = classifyAll(PLACEMENT_OBS, text(o.placement));
    if (!places.size) places.add(text(o.placement) ? 'other' : 'not recorded');
    const counters = new Set((o.counter ?? []).flatMap(c => { const k = classifyAll(OBS_COUNTER, text(c)); return k.size ? [...k] : ['other']; }));
    const lethal = o.lethal === true || /^(y|yes|true)/i.test(String(o.lethal));
    const tele = TELEGRAPH.test(text(o.timing));
    for (const a of aggs) {
      for (const k of kinds) count(a.okind, k);
      for (const p of places) count(a.oplace, p);
      for (const c of counters) count(a.ocounter, c);
      for (const r of o.roles ?? []) count(a.oroles, roleKey(r));
      if (lethal) a.olethal++;
      if (tele) a.otelegraph++;
    }
    for (const k of kinds) seen('obstacle', k, o.section);
  }
  for (const e of ens) {
    const arch = classify(ARCHETYPE, text(e.archetype));
    const counters = new Set((e.counter ?? []).map(c => classify(COUNTER, text(c))));
    const fails = new Set((e.fails ?? []).flatMap(f => [...classifyAll(FAILS, text(f))]));
    const place = classify(PLACEMENT_EN, text(e.placement), text(e.placement) ? 'other' : 'not recorded');
    const fa = e.firstAlone;
    for (const a of aggs) {
      count(a.arch, arch);
      for (const c of counters) count(a.ecounter, c);
      for (const f of fails) count(a.efails, f);
      count(a.eplace, place);
      for (const r of e.roles ?? []) count(a.eroles, roleKey(r));
      if (fa === true || fa === false) { a.firstAloneKnown++; if (fa) a.firstAlone++; }
    }
    seen('enemy', arch, e.section);
  }
  // Debut = the first record of each enemy kind in the level (records are in route order).
  const debutKinds = new Set();
  for (const e of ens) {
    const kind = text(e.kind).replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim();
    if (!kind || debutKinds.has(kind) || !isMain(e.section)) continue;
    debutKinds.add(kind);
    const fa = e.firstAlone;
    if (fa !== true && fa !== false) continue;
    lvAloneKnown++; if (fa) lvAlone++;
    for (const a of aggs) { a.debuts++; if (fa) a.debutsAlone++; count(a.debutPlace, classify(PLACEMENT_EN, text(e.placement), 'other')); }
  }
  for (const b of beats) {
    for (const a of aggs) {
      if (Number.isFinite(Number(b.gaps))) a.sgaps.push(Number(b.gaps));
      if (Number.isFinite(Number(b.enemies))) a.senemies.push(Number(b.enemies));
      if (Number.isFinite(Number(b.hazards))) a.shazards.push(Number(b.hazards));
      if (Array.isArray(b.beats)) a.sbeats.push(b.beats.length);
    }
  }
  const lvCams = new Set();
  for (const c of cams) { const m = classify(CAMERA, text(c.mode)); lvCams.add(m); for (const a of aggs) count(a.camera, m); }
  for (const a of aggs) for (const kind of Object.keys(firstSeen)) for (const [k, f] of firstSeen[kind]) {
    if (!a.firstPos[kind].has(k)) a.firstPos[kind].set(k, []);
    a.firstPos[kind].get(k).push(f);
  }
  perLevel.push({ id: lv.id, game: g, platforms: plats.length, gaps: gaps.length, lethal: lvLethal, medianWidth: median(lvWidths), maxWidth: lvWidths.length ? Math.max(...lvWidths) : NaN,
    jumps: jumps.length, longestRun: Math.max(0, ...jumps.map(j => Number(j.count)).filter(Number.isFinite)), obstacles: obs.length, enemies: ens.length,
    alone: lvAloneKnown ? `${lvAlone}/${lvAloneKnown}` : '—', sections: beats.length, camera: [...lvCams].join(', ') || '—' });
}

// --- report ------------------------------------------------------------------
const sorted = m => [...m].sort((x, y) => y[1] - x[1]);
const shareTable = (title, m, total, label = 'Share') => [`#### ${title}`, '', table(['Class', 'Records', label], sorted(m).map(([k, v]) => [k, v, pct(v, total)])), ''];
const lines = [];
lines.push('# Geometry, obstacle and enemy statistics', '');
lines.push(`Generated by \`node tools/crate-bible-geometry-stats.mjs\` from the geometry records of ${levels.length} level maps in \`docs/crate-bible/data/\`.`);
lines.push('Classes are folded from free text by ordered patterns in the script; "other" counts what no pattern matched.');
lines.push('Widths are crate units (u) estimated from guide maps and screenshots: treat them as ranges, not measurements.', '');
lines.push('## Per level', '');
lines.push(table(['Level', 'Game', 'Platforms', 'Gaps (lethal)', 'Median / widest gap (u)', 'Jump runs (longest)', 'Obstacles', 'Enemies (kinds debuting alone)', 'Sections', 'Camera modes'],
  perLevel.map(l => [l.id, l.game, l.platforms, `${l.gaps} (${l.lethal})`, `${fmt(l.medianWidth)} / ${fmt(l.maxWidth)}`, `${l.jumps} (${l.longestRun || '—'})`, l.obstacles, `${l.enemies} (${l.alone})`, l.sections, l.camera])));
lines.push('');

const order = ['All', 'Crash 2', 'Crash 3', 'Crash 4'].filter(k => byGame.has(k));
for (const g of order) {
  const a = byGame.get(g);
  if (!a.levels) continue;
  lines.push(`## ${g === 'All' ? 'All games' : g} — ${a.levels} levels`, '');
  lines.push(`${a.platforms} platforms, ${a.gaps} gaps (${pct(a.lethal, a.gaps)} lethal), ${a.jumps} jump sequences, ${a.obstacles} obstacles, ${a.enemies} enemies in ${a.sections} sections. ` +
    `Per section (median): ${fmt(median(a.sgaps))} gaps, ${fmt(median(a.senemies))} enemies, ${fmt(median(a.shazards))} hazards, ${fmt(median(a.sbeats))} beats.`, '');
  lines.push('### Platforms', '');
  lines.push(...shareTable('Shape', a.shape, a.platforms));
  lines.push(...shareTable('Behaviour', a.behaviour, a.platforms));
  lines.push(...shareTable('Surface', a.surface, a.platforms));
  lines.push(...shareTable('Roles (a platform can have several)', a.proles, a.platforms, 'Per platform'));
  lines.push('### Gaps', '');
  lines.push(`Widths recorded for ${a.widths.length} of ${a.gaps} gaps: median ${fmt(median(a.widths))} u, quartiles ${fmt(quantile(a.widths, 0.25))}–${fmt(quantile(a.widths, 0.75))} u, ` +
    `90th percentile ${fmt(quantile(a.widths, 0.9))} u. Lethal main-route gaps crossed on foot or by bounce (not ridden): median ${fmt(median(a.lethalMainWidths))} u ` +
    `(n = ${a.lethalMainWidths.length}). Coupled to a cycle, chaser, crate or enemy: ${pct(a.coupledGaps, a.gaps)}.`, '');
  lines.push(...shareTable('Kind', a.gkind, a.gaps));
  lines.push('#### Width by required move', '', table(['Move', 'Gaps with a width', 'Median (u)', 'Quartiles (u)', 'Widest (u)'],
    [...a.widthByMove].sort((x, y) => median(x[1]) - median(y[1])).map(([k, v]) => [k, v.length, fmt(median(v)), `${fmt(quantile(v, 0.25))}–${fmt(quantile(v, 0.75))}`, fmt(Math.max(...v))])), '');
  lines.push(...shareTable('Required move (a gap can need several)', a.moves, a.gaps, 'Per gap'));
  lines.push(...shareTable('Height difference, take-off to landing', a.height, a.gaps));
  lines.push(...shareTable('Failure result', a.failure, a.gaps));
  lines.push('### Jump sequences', '');
  lines.push(`${a.jumps} sequences: median ${fmt(median(a.jcounts))} jumps, longest ${a.jcounts.length ? Math.max(...a.jcounts) : '—'}; ` +
    `no-stop ${pct(a.noStop, a.jumps)}; widest gap in a sequence, median ${fmt(median(a.jmax))} u.`, '');
  lines.push(...shareTable('Rhythm', a.rhythm, a.jumps));
  lines.push(...shareTable('Moves used in sequences', a.jmoves, a.jumps, 'Per sequence'));
  lines.push('### Obstacles and hazards', '');
  lines.push(`${a.obstacles} obstacles: ${pct(a.olethal, a.obstacles)} lethal; timing text names a telegraph or warning for ${pct(a.otelegraph, a.obstacles)}.`, '');
  lines.push(...shareTable('Kind (an obstacle can combine several)', a.okind, a.obstacles, 'Per obstacle'));
  lines.push(...shareTable('Placement', a.oplace, a.obstacles, 'Per obstacle'));
  lines.push(...shareTable('Counter', a.ocounter, a.obstacles, 'Per obstacle'));
  lines.push(...shareTable('Roles', a.oroles, a.obstacles, 'Per obstacle'));
  lines.push('### Enemies', '');
  lines.push(`${a.enemies} enemies. "First appears alone on safe ground" is recorded for ${a.firstAloneKnown} records (${pct(a.firstAlone, a.firstAloneKnown)} yes); ` +
    `counting only each enemy kind's debut on the main route, ${a.debutsAlone} of ${a.debuts} debuts (${pct(a.debutsAlone, a.debuts)}) are alone on safe ground.`, '');
  lines.push(...shareTable('Placement of each enemy kind\'s debut', a.debutPlace, a.debuts));
  lines.push(...shareTable('Archetype', a.arch, a.enemies));
  lines.push(...shareTable('Counter (an enemy can have several)', a.ecounter, a.enemies, 'Per enemy'));
  lines.push(...shareTable('What fails', a.efails, a.enemies, 'Per enemy'));
  lines.push(...shareTable('Placement', a.eplace, a.enemies));
  lines.push(...shareTable('Roles', a.eroles, a.enemies, 'Per enemy'));
  lines.push('### Camera modes by section', '', table(['Mode', 'Sections'], sorted(a.camera)), '');
  lines.push('### Where each element first appears along the main route', '',
    '0 = first main section, 1 = last; median over the levels that use it (two or more levels).', '');
  for (const [kind, title] of [['enemy', 'Enemy archetype'], ['obstacle', 'Obstacle kind'], ['gap', 'Gap kind']]) {
    const rows = [...a.firstPos[kind]].filter(([, v]) => v.length >= 2).sort((x, y) => median(x[1]) - median(y[1]))
      .map(([k, v]) => [k, v.length, fmt(median(v))]);
    lines.push(`#### ${title}`, '', table([title, 'Levels', 'Median first position'], rows), '');
  }
}
await writeFile(OUT, lines.join('\n') + '\n');
console.log(`wrote ${path.relative(ROOT, OUT)} from ${levels.length} level maps with geometry records`);
if (process.argv.includes('--json')) console.log(JSON.stringify({ perLevel }, null, 2));
