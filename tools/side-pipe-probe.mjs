// Measurement probe: the REAL Player/Level on a side-on pipe inside an east
// travel zone (docs/SIDE_ON_PIPES.md). Walks in from the west deck, is put on
// his board at the lip and told to go six frames later (Jump), and prints the
// swing-by-swing record. Read-only: a throwaway level, no tuning changed.
//   RL/RR wall radii, F flat half-width, DL/DR deck depths, RUN approach length,
//   MODES input sets (right, left, pop, pump, charge, letgo, grind, grindhold, spin, ...).
//   `pop` presses Jump once in each east hang: with `right` that is the pop-out.
//   `wait` leaves him waiting at the lip instead of telling him to go.
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

const num = (k, d) => Number(process.env[k] ?? d);
const RL = num('RL', 4), RR = num('RR', 4), F = num('F', 3), DL = num('DL', 8), DR = num('DR', 8), LEN = num('LEN', 6);
const lipL = -(F + RL), lipR = F + RR;
const components = [
  { t: 'platform', p: [0, -1.5, 0], s: [90, 1, LEN] },
  { t: 'vertramp', vkind: 'half', sideOn: true, p: [0, 0, 0], len: LEN, rise: Math.max(RL, RR), w: F, yaw: 0,
    wallRise: [RL, RR], wallDeck: [DL, DR] },
  { t: 'zone', p: [0, 0, 0], s: [120, 1, 18], dir: 'E', sideOn: true },
  { t: 'camnode', p: [-50, 0, 0] }, { t: 'camnode', p: [50, 0, 0] },
  { t: 'gate', p: [lipR + DR + 30, 0, 0], yaw: 90 },
];
// optional receiving pipe beyond the east ridge: SPINE="floorY,flatHalf,wallRadius[,eastRadius,eastDeck]"
// (open on its east side unless an east wall is given)
if (process.env.SPINE) {
  const [by, bf, br, er = 0, ed = 0] = process.env.SPINE.split(',').map(Number);
  const bx = lipR + bf + br;
  components.push({ t: 'vertramp', vkind: 'half', sideOn: true, p: [bx, by, 0], len: LEN, rise: Math.max(br, er), w: bf, yaw: 0, wallRise: [br, er], wallDeck: [0, ed] });
  components.push({ t: 'platform', p: [bx + bf + er + ed + 20, by + er - 0.5, 0], s: [40, 1, LEN] });
}
// extras: RAIL="x0,x1,y" (along X) · ENEMY="foe,x,range,speed" · BANG="x,y" · CRATE="kind,x,y"
if (process.env.RAIL) { const [x0, x1, y] = process.env.RAIL.split(',').map(Number);
  components.push({ t: 'rail', p: [(x0 + x1) / 2, y, 0], len: x1 - x0, yaw: 90 });
  components.push({ t: 'platform', p: [x1 + 10, y - 1.5, 0], s: [20, 1, LEN] }); }
if (process.env.ENEMY) { const [foe, x, range, speed] = process.env.ENEMY.split(',');
  components.push({ t: 'enemy', foe, p: [Number(x), 0, 0], range: Number(range), speed: Number(speed) }); }
if (process.env.BANG) { const [x, y] = process.env.BANG.split(',').map(Number); components.push({ t: 'crate', kind: 'bang', p: [x, y, 0], grp: 7 });
  components.push({ t: 'crate', kind: 'wood', p: [lipR + 3, RR, 0], outline: true, grp: 7 }); }
if (process.env.CRATE) { const [kind, x, y] = process.env.CRATE.split(','); components.push({ t: 'crate', kind, p: [Number(x), Number(y), 0] }); }
if (process.env.WALLS !== '0') for (const z of [-0.83, 0.83]) components.push({ t: 'wall', p: [0, -14, z], s: [120, 60, 0.6], invisible: true });
const levelEntry = { id: '__pipe_probe', name: 'pipe probe',
  data: { v: 1, name: 'pipe probe', spawn: [lipL - Math.min(DL - 1, num('RUN', 5)), RL + 0.12, 0], killY: -20, components } };

await withSkateRuntime(async ({ THREE, player: p, level, step, TUNING, CONST }) => {
  p.competitionMode = false;
  const fmt = (v, n = 2) => v.toFixed(n);
  for (const mode of (process.env.MODES ?? 'right,right+pump').split(',')) {
    level.reset?.(true); p.respawn(level, true);
    const events = []; let prev = { state: p.state, free: p.freeSkate, bail: p.isBailing, vert: p.vertAir, gnd: p.grounded, stall: false };
    let apex = -Infinity, wallMax = -Infinity, lastSide = -1, t = 0, grindWas = false, spinWas = false, ollieWas = false, hangN = 0, xWas = false, perched = 0;
    const foes = level.enemies ?? []; let foesAlive = foes.filter(e => e.alive).length; let bangs = level.crates.filter(c => c.bang && c.bangUsed).length; let deaths = p.totalDeaths; let masks = p.masks;
    for (let i = 0; i < num('N', 1500); i++) {
      t = i * CONST.fixedStep;
      const input = makeInput();
      if (mode.includes('right')) input.moveX = 1;
      if (mode.includes('left')) input.moveX = -1;
      if (mode.includes('letgo') && p.freeSkate) input.moveX = 0; // let go once riding
      if (mode.includes('pump')) input.jumpHeld = p.freeSkate && p.grounded && p.state === 'ride' && !!p.groundHit?.halfpipe;
      // 'charge': skate the approach (X + direction) and arrive at the lip on the board
      if (mode.includes('charge') && !p.groundHit?.halfpipe && p.grounded && p.pos.x < lipL - 0.8) input.jumpHeld = true;
      // At a lip he is waiting on (walked up to, or rolled up to slowly): Jump, six frames in.
      perched = p.dropInPerch && p.dropInTipT < 0 ? perched + 1 : 0;
      if (!mode.includes('wait') && perched >= 6 && perched < 9) input.jumpHeld = true;
      if (mode.includes('grind')) { const want = p.state === 'air' && p.pos.y > num('GY', 0); input.grindHeld = want || p.state === 'grind'; input.grindPressed = want && !grindWas; grindWas = want; }
      // 'grindhold': the grind button held from the drop-in on (what does the lip do with it?)
      if (mode.includes('grindhold') && p.freeSkate) { input.grindHeld = true; input.grindPressed = !grindWas; grindWas = true; }
      if (mode.includes('neutralair') && p.state === 'air') input.moveX = 0;
      if (mode.includes('railneutral') && p.state === 'grind') input.moveX = 0;
      if (mode.includes('railup') && p.state === 'grind') { input.moveX = 0; input.moveY = 1; }
      if (mode.includes('spin')) { const near = p.grounded && Math.abs(p.pos.x - num('SX', 0)) < num('SR', 4); input.spinHeld = near; input.spinPressed = near && !spinWas; spinWas = near; }
      // 'pop': Jump once in each hang on the east side of whichever pipe the rider is in
      if (mode.includes('pop')) { const hp = p.hangPipe; hangN = p.vertAir && hp && p.pos.x > hp.cross ? hangN + 1 : 0; if (hangN >= 3 && hangN < 7) input.jumpHeld = true; }
      if (!mode.includes('ollie')) { input.jumpPressed = input.jumpHeld && !xWas; input.jumpReleased = !input.jumpHeld && xWas; xWas = input.jumpHeld; }
      if (mode.includes('ollie')) { const zone = p.grounded && p.freeSkate && p.pos.x > num('OX', -3) - 6 && p.pos.x < num('OX', -3); input.jumpHeld = zone; input.jumpPressed = zone && !ollieWas; input.jumpReleased = !zone && ollieWas; ollieWas = zone; }
      step(input);
      if (process.env.TRACE && i >= num('T0', 0) && i <= num('T1', 1e9)) console.log(i, p.state, 'x', fmt(p.pos.x), 'y', fmt(p.pos.y), 'z', fmt(p.pos.z), 'spd', fmt(p.speed), 'vV', fmt(p.vVel), 'free', +p.freeSkate, 'gnd', +p.grounded, 'vert', +p.vertAir, 'axF', fmt(p.axisF.x), fmt(p.axisF.z), 'ny', fmt(p.rideNormal.y), p.surfaceName, 'spin', fmt(p.grabSpinAngle ?? 0));
      const at = `t${fmt(t)} x${fmt(p.pos.x)} y${fmt(p.pos.y)}`;
      if (p.freeSkate !== prev.free) events.push(`${at} ${p.freeSkate ? 'MOUNT' : 'on foot'} spd${fmt(p.speed)} surf=${p.surfaceName}`);
      if (p.vertAir && !prev.vert) { events.push(`${at} HANG vV${fmt(p.vVel)}`); apex = p.pos.y; }
      if (p.vertAir) apex = Math.max(apex, p.pos.y);
      if (!p.vertAir && prev.vert) events.push(`${at}   hang over, apex y${fmt(apex)} -> state=${p.state} gnd${+p.grounded} spd${fmt(p.speed)} vV${fmt(p.vVel)}`);
      if (p.state !== prev.state) events.push(`${at} state ${prev.state}->${p.state} spd${fmt(p.speed)} z${fmt(p.pos.z)}`);
      if (p.isBailing !== prev.bail) events.push(`${at} bail->${+p.isBailing} balance${fmt(p.balance ?? 0)}`);
      if ((p.lipStallT > 0) !== prev.stall) events.push(`${at} lip stall ${p.lipStallT > 0 ? 'ON' : 'off'}`);
      if (p.state === 'grind' && i % 6 === 0) events.push(`${at} grinding spd${fmt(p.speed)} gv${fmt(p.grindVel ?? 0)} bal${fmt(p.balance ?? 0)} meter=${p.balanceMeter?.mode ?? '-'}/${p.balanceMeter?.horizontal ?? p.balanceMeter?.h ?? '?'}`);
      const alive = foes.filter(e => e.alive).length; if (alive !== foesAlive) { events.push(`${at} ENEMY count ${foesAlive}->${alive} spd${fmt(p.speed)}`); foesAlive = alive; }
      const used = level.crates.filter(c => c.bang && c.bangUsed).length; if (used !== bangs) { events.push(`${at} ! SWITCH hit vV${fmt(p.vVel)}`); bangs = used; }
      if (p.totalDeaths !== deaths) { events.push(`${at} DIED`); deaths = p.totalDeaths; }
      const side = Math.sign(p.pos.x);
      if (p.grounded && p.groundHit?.halfpipe && Math.abs(p.pos.x) > F) wallMax = Math.max(wallMax, p.pos.y);
      if (p.grounded && p.groundHit?.halfpipe && side !== lastSide && Math.abs(p.pos.x) < 0.4) {
        events.push(`${at} cross flat spd${fmt(p.speed)} (prev wall max y${wallMax > -1e9 ? fmt(wallMax) : '-'})`); wallMax = -Infinity; lastSide = side; }
      prev = { state: p.state, free: p.freeSkate, bail: p.isBailing, vert: p.vertAir, gnd: p.grounded, stall: p.lipStallT > 0 };
      if (p.state === 'dead' || p.state === 'finished' || events.length > num('MAXE', 26)) break;
      if (p.pos.x > lipR + DR + 14 && p.grounded) { events.push(`${at} OUT past the east side spd${fmt(p.speed)} free${+p.freeSkate}`); break; }
    }
    console.log(`\n== ${mode}  (RL${RL} RR${RR} F${F} decks ${DL}/${DR})  end t${fmt(t)}: state=${p.state} x${fmt(p.pos.x)} y${fmt(p.pos.y)} z${fmt(p.pos.z)} spd${fmt(p.speed)} free${+p.freeSkate}`);
    for (const e of events) console.log('  ' + e);
  }
}, { levelEntry });
