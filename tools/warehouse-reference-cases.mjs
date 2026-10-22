// Ordinary controls shared by the physics and real-browser checks. Placement
// is only the fixture setup; each line then uses the production controller.
export function warehouseCases(p) {
  const cases = [];
  const add = (name, at, h, sample, stop, max = 400, speed = 16) =>
    cases.push({ name, at, h, sample, stop, max, speed });
  const forward = [0, 0, -1];
  const balance = () => p.state === 'grind' ? -Math.max(-1, Math.min(1, p.balance * 2 + p.balanceVel * .2)) : 0;
  add('supported start', [79, 268, 6.3], forward, () => ({}), f => f === 90, 100, 0);
  for (const v of [182, 268]) add(`roll-in ${v}`, [79, v, 6.3], forward,
    () => ({ jumpHeld: true, moveY: 1 }), (_f, _r, [u]) => u > 288, 400, 0);
  for (const [name, u, v, y, h] of [
    ['halfpipe near', 388, 292, 0, [0, 0, 1]], ['halfpipe far', 388, 292, 0, forward],
    ['far wall', 555, 250, 0, forward], ['near wall', 309, 345, 0, [0, 0, 1]],
    ['kicker wall', 380, 85, 0, [-1, 0, 0]], ['start quarterpipe', 75, 230, 6.3, [0, 0, 1]],
    ['loading bay transition', 310, 105, 0, [0, 0, 1]],
  ]) add(name, [u, v, y], h, () => ({ jumpHeld: true }),
    (_f, r) => r.vertAirs > 0 && p.grounded && p.rideNormal.y > .97);
  add('halfpipe repeated airs', [388, 292, 0], forward, () => ({ jumpHeld: true }),
    (_f, r) => r.vertAirs >= 4 && p.grounded && p.rideNormal.y > .97, 1500);
  for (const [name, u, h, release, finish] of [
    ['over the pipe', 290, forward, 337, 448],
    ['over the pipe reverse', 486, [0, 0, 1], 439, 328],
  ]) {
    let released = false;
    add(name, [u, 277, 0], h, (_f, _r, [u]) => {
      if (h[2] < 0 ? u > release : u < release) released = true;
      return { jumpHeld: !released, moveY: p.grounded ? 1 : 0 };
    }, (_f, r, [u]) => r.airFrames > 8 && (h[2] < 0 ? u > finish : u < finish) && p.grounded, 400, 23);
  }
  // Quick ollies at ordinary pace pass through the room and roll out. A
  // full bank pop can also clear its roof; it is a distinct, higher line.
  for (const speed of [14, 15]) for (const release of [329, 330, 331])
    add(`secret room ${speed}/${release}`, [315, 365, 0], forward,
      (_f, _r, [u]) => ({ jumpHeld: u > release - 5 && u < release, moveY: p.grounded ? 1 : 0 }),
      (_f, r, [u]) => r.roomFrames > 2 && u > 448 && p.grounded, 180, speed);
  add('taxi transfer', [485, 279, 0], forward,
    (_f, _r, [u]) => ({ jumpHeld: u < 525, moveY: p.grounded ? 1 : 0 }),
    (_f, r, [u]) => r.airFrames > 3 && u > 548 && p.grounded);
  for (const [name, at, h, release] of [
    ['kicker gap', 386, forward, 436], ['kicker reverse', 519, [0, 0, 1], 477],
  ]) add(name, [at, 69, 0], h,
    (_f, _r, [u]) => ({ jumpHeld: h[2] < 0 ? u < release : u > release, moveY: p.grounded ? 1 : 0 }),
    (_f, r, [u]) => r.gapAirFrames > 3 && p.grounded && (h[2] < 0 ? u > 476 : u < 441), 300);
  add('Big Rail kink', [315, 148, 0], forward,
    f => ({ jumpHeld: f < 4, grindHeld: f > 5, moveY: 1, moveX: balance() }),
    (_f, r, [u]) => r.railFrames > 20 && u > 470, 350, 12);
  for(const [name,v,release,end]of [['left channel gap',126,151,212],['right channel gap',222,252,311]])
    add(name,[262,v,1.73],[1,0,0],(_f,_r,[_u,v])=>({jumpHeld:v>release-4&&v<release,grindHeld:v<release-6||v>end-18,moveX:balance()}),
      (_f,r,[_u,v])=>r.airFrames>8&&v>end&&(p.state==='grind'||p.grounded),300,12);
  add('high rail', [558, 245, 0], forward,
    () => ({ jumpHeld: true, grindHeld: p.pos.y > 4.6 || p.state === 'grind', moveX: balance() }),
    (_f, r) => r.highRailFrames > 50, 300, 20);
  return cases;
}

export function warehouseUV(p) { return [253 - p.pos.z / .14, 208 + p.pos.x / .14]; }
export function observeWarehouse(p, r, wasVert, old) {
  const [u, v] = warehouseUV(p);
  r.frames++;
  if (u > 374 && u < 402 && v > 351 && v < 405 && p.pos.y >= 6.3 && p.pos.y < 8.6) r.roomFrames++;
  if (u > 441 && u < 472 && v > 57 && v < 81 && !p.grounded && p.pos.y > .15) r.gapAirFrames++;
  r.airFrames += !p.grounded; r.vertAirs += p.vertAir && !wasVert;
  r.railFrames += p.state === 'grind'; r.highRailFrames += p.state === 'grind' && p.pos.y > 5;
  r.bails += p.isBailing; r.peak = Math.max(r.peak, p.pos.y);
  r.maxStep = Math.max(r.maxStep, old.distanceTo(p.pos)); r.minSpeed = Math.min(r.minSpeed, p.speed);
}
export const warehouseResult = name => ({ name, ok: false, frames: 0, airFrames: 0, vertAirs: 0,
  railFrames: 0, highRailFrames: 0, roomFrames: 0, gapAirFrames: 0, bails: 0, peak: 0, maxStep: 0, minSpeed: Infinity, trace: [] });
