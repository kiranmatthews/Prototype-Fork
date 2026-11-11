// Cold Storage (Powderkeg Peak bonus) · input-only headless pilot.
// From the spawn, ordinary device samples only: break every counted box, finish through the gate, zero deaths.
// Run: node tools/test-powderkeg-bonus.mjs 2>&1 | grep -v "sculpt could not load"
// POWDERKEG_BONUS_DEBUG=1 logs every frame's pose.
import assert from 'node:assert/strict';
import { withBlockworksRuntime } from './blockworks-runner.mjs';

const debug = process.env.POWDERKEG_BONUS_DEBUG === '1';
const UNCOUNTED = new Set(['metal', 'metalbounce', 'bang', 'nitrobang']);

await withBlockworksRuntime(async r => {
  const { p, l } = r, m = r.sourceModule, data = m.POWDERKEG_BONUS_LEVEL, dt = r.CONST.fixedStep;
  const { normalizeCustomLevelData } = await r.server.ssrLoadModule('/src/level.ts');
  const normalized = normalizeCustomLevelData(JSON.parse(JSON.stringify(data)));
  assert.ok(normalized, 'Cold Storage data must pass normalizeCustomLevelData');
  assert.equal(normalized.components.length, data.components.length, 'normalization must keep every component');
  assert.equal(data.hudMode, 'bonus');
  assert.equal(data.components.filter(c => c.t === 'gate').length, 1, 'exactly one gate');
  const counted = data.components.filter(c => c.t === 'crate' && !UNCOUNTED.has(c.kind ?? 'wood')).length;
  assert.ok(counted >= 16 && counted <= 18, `16-18 counted boxes (found ${counted})`);
  assert.ok(data.components.filter(c => c.t === 'crusher').length <= 2 && data.components.filter(c => c.t === 'crumble').length <= 2);
  assert.equal(data.components.filter(c => c.t === 'enemy').length, 0);

  const pose = () => ({ x: +p.pos.x.toFixed(2), y: +p.pos.y.toFixed(2), z: +p.pos.z.toFixed(2), state: p.state, grounded: p.grounded,
    vVel: +p.vVel.toFixed(2), deaths: p.totalDeaths, t: +(r.frame * dt).toFixed(1), ground: p.groundHit?.name ?? null });
  const fail = message => { throw new Error(`${message} at ${JSON.stringify(pose())}`); };
  const dead = () => p.isBailing || ['dead', 'gameover'].includes(p.state) || p.totalDeaths > 0;
  const live = () => l.crates.filter(c => c.alive && !c.pending);
  const isPlain = c => !c.metal && !c.metalBounce && !c.bang && !c.nitroBang && !c.bouncy && !c.tnt && !c.nitro;
  const near = (c, d) => c.box.distanceToPoint(p.pos) < d;
  // Spin policy: spin plain boxes that come close, never beside TNT or Nitro, never inside `noSpin`.
  let lastSpin = false, noSpin = () => false;
  const autoSpin = sample => {
    if (!p.grounded || 'spinHeld' in sample || noSpin()) { lastSpin = false; return sample; }
    const plain = live().some(c => isPlain(c) && near(c, 2.6));
    const explosive = live().some(c => (c.tnt || c.nitro) && near(c, 3.6));
    if (plain && !explosive) { const held = p.spinning || !lastSpin; lastSpin = held; return { ...sample, spinHeld: held }; }
    lastSpin = false; return sample;
  };
  const step = (sample, label) => {
    r.tick(autoSpin(sample));
    if (debug) console.log('dbg', label, JSON.stringify(pose()));
    if (dead()) fail(`${label}: lost control`);
  };
  const toward = (x, pace = 1) => {
    const q = r.worldDirectionInput({ x: x - p.pos.x, z: -p.pos.z * .2 }, pace);
    if (Math.abs(q.moveX) < .1 * pace) q.moveX = 0; if (Math.abs(q.moveY) < .1 * pace) q.moveY = 0;
    return q;
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const run = (label, pred, sampler, max) => { let done = pred(); for (let i = 0; i < max && !done; i++) { step(sampler(i), label); done = pred(); } if (!done) fail(`${label} timed out`); };
  const still = (frames, label = 'wait') => { for (let i = 0; i < frames; i++) step({}, label); };
  const walk = (x, { tol = .3, label = 'walk', pace = 1, keep = false, max = 1500 } = {}) => {
    run(label, () => Math.abs(x - p.pos.x) < tol, () => toward(x, keep ? pace : clamp((Math.abs(x - p.pos.x) - .15) / 1.4, .14, pace)), max);
    if (!keep) run(`${label} stop`, () => p.grounded && p.walkVelocity.length() < .3, () => ({}), 600);
  };
  const fly = (x, y, { double = false, label = 'air', tol = 1.2 } = {}) => {
    let doubled = false;
    run(`${label} air`, () => p.grounded, () => {
      const sample = toward(x, clamp(Math.abs(x - p.pos.x) / 1.2, 0, 1));
      if (double && !doubled && p.vVel < 1.5) { doubled = true; return { ...sample, jumpHeld: true, jumpPressed: true }; }
      if (double && doubled && p.vVel > 0) return { ...sample, jumpHeld: true };
      return sample;
    }, 360);
    if (Math.abs(x - p.pos.x) > tol) fail(`${label} missed the landing (${(x - p.pos.x).toFixed(2)} m off)`);
    if (y !== undefined && Math.abs(p.pos.y - y) > .6) fail(`${label} landed at the wrong height`);
  };
  const jump = (x, y, { label = 'jump', charge = 24, tol = 1.2, double = false } = {}) => {
    for (let i = 0; i < charge; i++) step({ jumpHeld: true }, `${label} charge`);
    step({ ...toward(x, 1), jumpHeld: false, jumpReleased: true }, `${label} release`);
    if (p.grounded) fail(`${label} did not launch`);
    fly(x, y, { label, tol, double });
  };
  const leap = (edge, land, ly, { label = 'leap', hold = 3.4, tol = 1.5, tap = false } = {}) => {
    const along = () => edge - p.pos.x;
    run(`${label} run-up`, () => along() < (tap ? .55 : hold), () => toward(land, 1), 900);
    if (!tap) run(`${label} charge`, () => along() < .32 || !p.grounded, () => ({ ...toward(land, 1), jumpHeld: true }), 240);
    else step({ ...toward(land, 1), jumpHeld: true, jumpPressed: true }, `${label} tap`);
    step({ ...toward(land, 1), jumpHeld: false, jumpReleased: true }, `${label} release`);
    if (p.grounded) step({ ...toward(land, 1) }, `${label} lift`);
    fly(land, ly, { label, tol });
  };
  const spinOnce = label => { for (let i = 0; i < 16; i++) step({ spinHeld: i < 8 }, label); };
  const cratesIn = (x0, x1) => live().filter(c => c.mesh.position.x > x0 && c.mesh.position.x < x1);
  const cleared = (x0, x1, label) => { const left = cratesIn(x0, x1).filter(c => !c.metal && !c.bang && !c.nitroBang && !c.nitro); if (left.length) fail(`${label}: ${left.length} boxes left`); };
  const log = (name, f0) => console.log('BONUS', `beat ${name}: ${((r.frame - f0) * dt).toFixed(1)} s · ${JSON.stringify(pose())}`);

  const S = m.POWDERKEG_BONUS_LEDGES;
  let f0 = r.frame;
  // Beat 1 · loading pile on snow.
  still(20, 'settle at the spawn');
  run('clear the loading pile', () => cratesIn(0, 8).length === 0, () => toward(5.6, .35), 900);
  log('loading bay', f0); f0 = r.frame;

  // Beat 2 · ice locker: wait on the snow for the stamper, leap down and slide under it into the brake row.
  const stamper = l.crushers.find(c => Math.abs(c.x - m.POWDERKEG_BONUS_STAMPER_X) < 1) ?? fail('no stamper');
  const phase = c => (((l.time + c.phase) % c.cycle) + c.cycle) % c.cycle / c.cycle;
  const go = Number(process.env.POWDERKEG_BONUS_GO ?? .62);
  walk(6.4, { label: 'wait spot on the snow' });
  run('watch the stamper', () => Math.abs(phase(stamper) - go) < .01, () => ({}), 600);
  noSpin = () => p.pos.x < stamper.x + stamper.w / 2 + .4;
  let enter = null, exit = null;
  const watch = () => { const f = phase(stamper); if (enter === null && p.pos.x > stamper.x - stamper.w / 2 - .4) enter = f; if (exit === null && p.pos.x > stamper.x + stamper.w / 2 + .4) exit = f; };
  leap(S.arrival[1], 18.5, S.ice[2], { label: 'leap down onto the ice', tol: 3 });
  run('slide under the stamper', () => (watch(), exit !== null), () => (watch(), toward(30, 1)), 600);
  console.log('BONUS', `stamper passage: entered at phase ${enter?.toFixed(2)}, cleared at ${exit?.toFixed(2)}`);
  noSpin = () => false;
  run('break the brake row', () => cratesIn(22, 29).length === 0, () => toward(28.5, .4), 1200);
  cleared(14, 37, 'ice locker');
  log('ice locker', f0); f0 = r.frame;

  // Crumbling shelf and the climb to the high shelf.
  leap(S.ice[1], 40.6, S.crumble[2], { label: 'onto the crumbling shelf', tap: true, tol: 1.4 });
  leap(S.crumble[1], 46.6, S.arrow[2], { label: 'up to the arrow shelf', tap: true });
  log('crumbling shelf', f0); f0 = r.frame;

  // Beat 3 · arrow gate: bounce, double jump at the apex, bonk the floating pair; break the arrow last.
  const ax = m.POWDERKEG_BONUS_ARROW_X;
  const high = () => live().filter(c => c.box.min.y > 4 && Math.abs(c.mesh.position.x - ax) < 2);
  if (high().length !== 2) fail('the high shelf should hold two boxes');
  // Gate check: a full floor jump plus double jump under the high boxes must fall short.
  walk(ax - 1.05, { label: 'under the high boxes', tol: .08 });
  for (let i = 0; i < 26; i++) step({ jumpHeld: true }, 'floor jump charge');
  step({ jumpHeld: false, jumpReleased: true }, 'floor jump release');
  { let doubled = false, peak = 0; run('floor double jump', () => p.grounded && doubled, () => { peak = Math.max(peak, p.crateBodyBox.max.y); if (!doubled && p.vVel < 3) { doubled = true; return { jumpHeld: true, jumpPressed: true }; } return {}; }, 360);
    console.log('BONUS', `floor double jump under the high boxes: silhouette top ${peak.toFixed(2)} m against an underside at ${m.POWDERKEG_BONUS_HIGH_Y} m, boxes left ${high().length}`); }
  if (high().length !== 2) fail('the floor double jump reached the arrow-gated boxes');
  if (p.pos.y > .3) fail('the floor check landed on the arrow');
  walk(ax - 2.1, { label: 'arrow approach' });
  for (let i = 0; i < 18; i++) step({ jumpHeld: true }, 'arrow jump charge');
  step({ ...toward(ax, 1), jumpHeld: false, jumpReleased: true }, 'arrow jump release');
  let bounces = 0, pressed = false;
  for (let i = 0; i < 2400 && high().length; i++) {
    const before = p.vVel;
    const targets = high(), tx = targets.length ? targets[0].mesh.position.x : ax;
    const rising = p.vVel > 0;
    const sample = toward(bounces ? tx : ax, clamp(Math.abs((bounces ? tx : ax) - p.pos.x) / .8, 0, .6));
    if (bounces && rising && p.vVel < 4 && !p.airJumpUsed && !pressed) { sample.jumpHeld = sample.jumpPressed = true; pressed = true; }
    step(sample, 'arrow bounce');
    if (before < 0 && p.vVel > 8) { bounces++; pressed = false; }
    if (p.grounded && p.pos.y < .3) fail('fell off the arrow before the high boxes broke');
  }
  if (high().length) fail('arrow gate not cleared');
  run('land after the high boxes', () => p.grounded && p.pos.y < .3, () => toward(ax + 2.2, 1), 900);
  walk(ax + 1.25, { label: 'beside the arrow', tol: .2 });
  for (let k = 0; k < 4 && cratesIn(ax - 1, ax + 1).length; k++) spinOnce('break the arrow');
  cleared(42, 56, 'arrow shelf');
  log('arrow gate', f0); f0 = r.frame;

  // Beat 4 · powder vault: stomp the cap, light the TNT, retreat to the refuge, then the Nitro-framed life from above.
  const tx = m.POWDERKEG_BONUS_TNT_X, refuge = m.POWDERKEG_BONUS_REFUGE_X, vy = S.vault[2];
  leap(S.arrow[1], refuge, vy, { label: 'up to the powder vault' });
  walk(tx - 1.7, { label: 'TNT approach', tol: .2 });
  const tnt = live().find(c => c.tnt) ?? fail('no TNT');
  for (let i = 0; i < 26; i++) step({ jumpHeld: true }, 'cap jump charge');
  step({ ...toward(tx, 1), jumpHeld: false, jumpReleased: true }, 'cap jump release');
  run('stomp the cap and light the TNT', () => tnt.fuse !== undefined && tnt.fuse > 0 || !tnt.alive, () => toward(tx, clamp(Math.abs(tx - p.pos.x) / .8, 0, 1)), 360);
  if (!tnt.alive) fail('the TNT went off early');
  run('retreat to the refuge', () => p.grounded && Math.abs(p.pos.x - refuge) < .5, () => toward(refuge, clamp(Math.abs(refuge - p.pos.x) / 1.2, .14, 1)), 600);
  if (Math.abs(tx - p.pos.x) < 3.25) fail('refuge too close to the TNT');
  run('wait out the fuse', () => !tnt.alive, () => ({}), 400);
  still(40, 'blast settles');
  cleared(S.vault[0], tx + 4, 'fuse order');
  const lx = m.POWDERKEG_BONUS_LIFE_X;
  walk(lx - 4, { label: 'Nitro frame approach', tol: .2 });
  const lifeBox = live().find(c => c.life && Math.abs(c.mesh.position.x - lx) < .5) ?? fail('no framed life');
  for (let i = 0; i < 24; i++) step({ jumpHeld: true }, 'frame jump charge');
  step({ ...toward(lx, 1), jumpHeld: false, jumpReleased: true }, 'frame jump release');
  run('stomp the framed life', () => !lifeBox.alive || p.grounded, () => toward(lx, clamp(Math.abs(lx - p.pos.x) / .8, 0, 1)), 360);
  if (lifeBox.alive) fail('missed the framed life');
  fly(lx + 4.6, vy, { label: 'bounce clear of the far Nitro', tol: 1 });
  log('powder vault', f0); f0 = r.frame;

  // Beat 5 · the switch, the steel bridge and its cargo, the green switch and the gate.
  const sx = m.POWDERKEG_BONUS_SWITCH_X;
  walk(S.vault[1] - 1.4, { label: 'vault exit', tol: .4 }); walk(S.vault[1] - 6, { label: 'run-up room', tol: .4 });
  leap(S.vault[1], S.switch[0] + 1.7, S.switch[2], { label: 'onto the switch landing', hold: 2.6 });
  walk(sx - 1.1, { label: 'switch approach', tol: .15 }); spinOnce('hit the bridge switch');
  if (live().filter(c => c.metal && c.mesh.position.x > S.bridge[0] && c.mesh.position.x < S.bridge[1]).length !== 6) fail('the switch did not build the bridge');
  walk(sx - 1.6, { label: 'back off for the hop', tol: .2 });
  jump(sx + 1.4, S.switch[2], { label: 'hop over the spent switch', charge: 20 });
  run('cross the steel bridge and spin its cargo', () => p.pos.x > S.bridge[1] + 1.2 && cratesIn(S.bridge[0], S.bridge[1]).filter(isPlain).length === 0,
    () => toward(S.bridge[1] + 1.6, .45), 2400);
  const gx = m.POWDERKEG_BONUS_GREEN_X;
  walk(gx - 1.1, { label: 'green switch approach', tol: .15 }); spinOnce('hit the green switch');
  still(60, 'Nitro credited');
  walk(gx - 1.6, { label: 'back off for the hop', tol: .2 });
  jump(gx + 1.4, S.finish[2], { label: 'hop over the green switch', charge: 20 });
  run('through the gate', () => p.state === 'finished', () => toward(m.POWDERKEG_BONUS_GATE_X + 4, 1), 900);
  log('switch and gate', f0);

  const leftover = l.crates.filter(c => c.alive && !c.metal && !c.metalBounce && !c.bang && !c.nitroBang);
  const seconds = +(r.frame * dt).toFixed(1);
  console.log('BONUS', JSON.stringify({ state: p.state, seconds, deaths: p.totalDeaths, cratesBroken: p.cratesBroken, counted, leftover: leftover.length }));
  assert.equal(p.state, 'finished');
  assert.equal(p.totalDeaths, 0);
  assert.equal(leftover.length, 0, `every counted box broken (${leftover.map(c => c.mesh.position.x.toFixed(1)).join(', ')} left)`);
}, { modulePath: '/src/levels/powderkeg-bonus.ts', levelId: 'bonus-powderkeg-peak', source: m => m.POWDERKEG_BONUS_LEVEL,
  endlessDeaths: true, maxFrames: 30000, controlFrame: () => ({ x: 0, z: -1 }) });
