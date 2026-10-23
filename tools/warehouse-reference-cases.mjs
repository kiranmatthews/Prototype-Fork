// Ordinary controls shared by the physics and real-browser checks. Placement
// is only the fixture setup; each line then uses the production controller.
export function warehouseCases(p, geometry) {
  const size = geometry.WAREHOUSE_SIZE;
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
    ['over the pipe', 280, forward, 332, 476],
    ['over the pipe reverse', 496, [0, 0, 1], 444, 300],
  ]) {
    let released = false;
    add(name, [u, 277, 0], h, (_f, _r, [u]) => {
      if (h[2] < 0 ? u > release : u < release) released = true;
      return { jumpHeld: !released, moveY: p.grounded ? 1 : 0 };
    }, (_f, r, [u]) => r.nearLipClear && r.farLipClear && (h[2] < 0 ? u > finish : u < finish) && p.grounded, 400, 23);
  }
  // From the actual balcony, build speed with the native controls and pop
  // across both lips. Five release positions cover a useful input window.
  for (const release of [320, 324, 328, 332, 334]) {
    let released = false;
    add(`opening halfpipe gap ${release}`, [79, 268, 6.3], forward, (_f, _r, [u]) => {
      if (u > release) released = true;
      return { jumpHeld: !released, moveY: p.grounded ? 1 : 0 };
    }, (_f, r, [u]) => r.nearLipClear && r.farLipClear && u > 474 && p.grounded, 700, 0);
  }
  add('outside bank roll-in', [280, 277, 0], forward, () => ({jumpHeld:true,moveY:1}),
    (_f, _r, [u]) => u > 370 && p.grounded && p.rideNormal.y > .97, 400, 0);
  for(const [name,u] of [['halfpipe mouth floor',388],['halfpipe mouth near hip',350],['halfpipe mouth far hip',426],['outside bank end hip',320]])
    add(name,[u,175,0],[1,0,0],()=>({jumpHeld:true,moveY:1}),
      (_f,_r,[_u,v])=>v>240&&p.grounded,300,16);
  const hipY=2.8-Math.sqrt(2.8**2-((388-350)*.14-3.5)**2);
  add('halfpipe mouth exit',[350,240,hipY],[-1,0,0],()=>({jumpHeld:true,moveY:1}),
    (_f,_r,[_u,v])=>v<175&&p.grounded,300,16);
  add('outside bank coping grind', [280, 250, 0], [.6,0,-.8], (_f, _r, [u]) =>
    ({jumpHeld:true,grindHeld:u>335,moveY:p.grounded?1:0,moveX:balance()}),
    (_f, r) => r.railFrames > 30, 400, 18);
  // Charge on the floor, then use the bank's upward momentum to enter the
  // enlarged room at ordinary skating speed and land on its supported floor.
  for (const speed of [18, 20]) for (const release of [330, 332, 334])
    add(`secret room ${speed}/${release}`, [280, 365, 0], forward,
      (_f, _r, [u]) => ({ jumpHeld: u < release, moveY: p.grounded ? 1 : 0 }),
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
  for(const [name,v,release,end]of [['left channel gap',110,154,212],['right channel gap',212,250,311]])
    add(name,[262,v,1.73],[1,0,0],(f,_r,[_u,v])=>({jumpHeld:f>0&&v<release,grindHeld:v<release-6||v>end-18,moveX:balance()}),
      (_f,r,[_u,v])=>r.airFrames>8&&v>end&&p.state==='grind',300,20);
  add('high rail', [558, 245, 0], forward,
    () => ({ jumpHeld: true, grindHeld: p.pos.y > 4.6 * size || p.state === 'grind', moveX: balance() }),
    (_f, r) => r.highRailFrames > 50, 300, 20);
  return cases;
}

export function warehouseUV(p, geometry) { return [253 - p.pos.z / geometry.WAREHOUSE_SCALE, 208 + p.pos.x / geometry.WAREHOUSE_SCALE]; }
export function observeWarehouse(p, r, wasVert, old, geometry) {
  const [u, v] = warehouseUV(p, geometry), size = geometry.WAREHOUSE_SIZE;
  const oldU = 253 - old.z / geometry.WAREHOUSE_SCALE;
  for (const [lip, key] of [[343, "nearLipClear"], [433, "farLipClear"]]) {
    if ((oldU < lip && u >= lip) || (oldU > lip && u <= lip)) {
      const y = old.y + (p.pos.y - old.y) * (lip - oldU) / (u - oldU);
      if (v > 208 && v < 351 && !p.grounded && y >= 2.8 * size + .1) r[key] = true;
      r.lipCrossings.push({lip, y, airborne:!p.grounded});
    }
  }
  r.frames++;
  if (u > 374 && u < 402 && v > 351 && v < 405 && p.pos.y >= 6.3 * size && p.pos.y < 8.6 * size) r.roomFrames++;
  if (u > 441 && u < 472 && v > 57 && v < 81 && !p.grounded && p.pos.y > .15) r.gapAirFrames++;
  r.airFrames += !p.grounded; r.vertAirs += p.vertAir && !wasVert;
  r.railFrames += p.state === 'grind'; r.highRailFrames += p.state === 'grind' && p.pos.y > 5 * size;
  r.bails += p.isBailing; r.peak = Math.max(r.peak, p.pos.y);
  r.maxStep = Math.max(r.maxStep, old.distanceTo(p.pos)); r.minSpeed = Math.min(r.minSpeed, p.speed);
}
export const warehouseResult = name => ({ name, ok: false, frames: 0, airFrames: 0, vertAirs: 0,
  nearLipClear: false, farLipClear: false, lipCrossings: [], railFrames: 0, highRailFrames: 0, roomFrames: 0, gapAirFrames: 0, bails: 0, peak: 0, maxStep: 0, minSpeed: Infinity, trace: [] });
