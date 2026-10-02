import { puzzleControls } from './puzzle-trilogy-pilot.mjs';

/** Continuous input-only main route with every local box; linked bonus is separate. */
export function* runSwitchyardJourney(r) {
  const c = puzzleControls(r), { p, l } = r;
  const at = (x, y) => c.crateSpecAt(x, y);
  const named = name => c.crateNamed(name);
  const foeAt = x => l.enemies.find(enemy => Math.abs(enemy.homePosition.x - x) < .04);
  const shelfTop = name => {
    const component = r.source.components.find(component => component.nm === name);
    c.check(component, `Missing receiving shelf ${name}`);
    return component.p[1] + component.s[1] / 2;
  };
  function* grounded(target, label) {
    yield* c.until(() => p.grounded, () => c.steer(target), { label, limit: 240 });
    yield* c.stepFor(20); c.live(label);
  }
  function* upperFirstStack(x, top, reward, label) {
    yield* c.walk([x - 1.7, 0, 0], `${label} approach`);
    const hits = top.hitsRemaining;
    yield* c.charge(); yield* c.tick({ jumpReleased: true });
    yield* c.until(() => top.hitsRemaining < hits,
      () => c.steer([x, top.box.max.y, 0]), { label: `${label} top support contact`, limit: 160 });
    yield* c.until(() => p.vVel < .65, () => c.steer([x, reward.box.min.y, 0]),
      { label: `${label} rebound apex`, limit: 90 });
    yield* c.tick({ ...c.steer([x, reward.box.min.y, 0]), jumpHeld: true });
    yield* c.tick({ ...c.steer([x, reward.box.min.y, 0]), jumpReleased: true });
    yield* c.until(() => !reward.alive, () => c.steer([x, reward.box.min.y, 0]),
      { label: `${label} upper claim`, limit: 160 });
    c.check(top.alive, `${label} used up its finite support early`);
    yield* grounded([x - 2, 0, 0], `${label} clear landing`);
    for (const crate of l.crates.filter(crate => crate.alive && crate.multiHit && Math.abs(crate.mesh.position.x - x) < .04))
      if (crate.alive) yield* c.hit(crate, `${label} clear conserved striped support`);
  }
  function* highGallery(launcher, target, label) {
    yield* c.bounce(launcher, target, label,
      { boost: true, double: true, airSpinAbove: target[1] - 1.15,
        ascentTarget: [target[0] - 1.2, target[1], 0] });
  }
  function* prime(crate, retreat, label) {
    const x = crate.mesh.position.x, y = crate.box.min.y;
    yield* c.walk([x - 1.65, y, 0], `${label} takeoff`);
    yield* c.charge(); yield* c.tick({ jumpReleased: true });
    yield* c.until(() => crate.fuse !== undefined,
      () => c.steer([x, y + .96, 0]), { label: `${label} stomp fuse`, limit: 140 });
    yield* grounded(retreat, `${label} leave blast radius`);
    yield* c.until(() => !crate.alive && l.explosions.length === 0, {},
      { label: `${label} complete countdown`, limit: 240 });
  }

  yield* c.stepFor(20); c.check(p.grounded, 'Switchyard source spawn unsupported');
  yield* c.hit(at(-2, 0), 'opening protection');
  yield* upperFirstStack(5, at(5, .96),
    named('Upper-first target: lost if both striped supports are cleared early'),
    'finite two-support upper-first puzzle');

  const admissionBox = named('Admission stepping box: no alternate arrow for the finite-stack cap');
  yield* c.walk([12.3, 0, 0], 'admission stepping box takeoff');
  yield* c.charge(); yield* c.tick({ jumpReleased: true });
  yield* c.until(() => !admissionBox.alive,
    () => c.steer([14, admissionBox.box.max.y, 0]),
    { label: 'stomp ordinary admission stepping box', limit: 140 });
  yield* grounded([16.6, 2.8, 0], 'ordinary crate rebound to admission perch');
  if (at(18, 2.8).alive) yield* c.hit(at(18, 2.8), 'admission upper life');
  yield* c.hop([11.5, 0, 0], 'return from admission reward perch');
  yield* c.walk([20.5, 0, 0], 'admission exit takeoff');
  yield* c.hop([24, 1.4, 0], 'raised balcony admission');
  yield* c.enemy(foeAt(26), 'first patrol');

  const keyLaunch = named('Preserve the switch-gallery launcher');
  const keyY = shelfTop('High gallery key perch');
  yield* highGallery(keyLaunch, [34.4, keyY, 0], 'high gallery key ascent');
  if (named('Upper key-gallery reward').alive)
    yield* c.until(() => !named('Upper key-gallery reward').alive && p.grounded && p.pos.x > 34.4,
      i => ({ ...c.steer([35.4, keyY, 0]), spinHeld: i % 26 === 1, jumpHeld: p.state === 'hang' }),
      { label: 'high key reward and full gallery entry', limit: 180 });
  yield* c.hit(named('Gallery bridge circuit local ! switch'), 'first high bridge key');
  yield* c.hop([30, 1.4, 0], 'return below high gallery');
  yield* c.hit(keyLaunch, 'high gallery launcher last');
  yield* c.walk([59, 1.4, 0], 'newly materialized first bridge');
  yield* c.enemy(foeAt(64), 'armor stomp lesson');
  yield* c.enemy(foeAt(73), 'spike spin lesson');
  yield* c.checkpoint(78, 'pre-staircase checkpoint');

  yield* c.walk([78.5, 1.4, 0], 'crate stair takeoff');
  for (const x of [81.8, 84.8]) {
    const reward = at(x, 2.36), anchor = at(x, 1.4);
    yield* c.hop([x, anchor.box.max.y, 0], 'reward over permanent staircase anchor',
      { airButtons: { spinHeld: true }, tolerance: .8 });
    c.check(!reward.alive, 'staircase reward survived its spin approach');
  }
  const workshopArrow = at(89, 1.4);
  yield* c.charge(); yield* c.tick({ jumpReleased: true });
  yield* c.until(() => p.vVel > 15 && p.pos.y < workshopArrow.box.max.y + .2,
    () => ({ ...c.steer([89, workshopArrow.box.max.y, 0]), jumpHeld: true }),
    { label: 'jump from final anchor onto workshop arrow', limit: 160 });
  yield* grounded([94, 2.8, 0], 'arrow into upper explosive workshop');

  const stackWood = at(101, 3.76),
    highLife = named('Upper-first reward needs the intact fuse-stack height'), fuse101 = at(101, 2.8);
  const lifeY = highLife.box.min.y;
  yield* c.walk([98.9, 2.8, 0], 'TNT upper-first staging');
  yield* c.charge(); yield* c.tick({ jumpReleased: true });
  yield* c.until(() => !stackWood.alive,
    () => c.steer([101, 4.72, 0]), { label: 'wood on TNT rebound', limit: 140 });
  yield* c.until(() => p.vVel < .65,
    () => c.steer([101, lifeY, 0]), { label: 'TNT stack rebound apex', limit: 90 });
  yield* c.tick({ ...c.steer([101, lifeY, 0]), jumpHeld: true });
  yield* c.tick({ ...c.steer([101, lifeY, 0]), jumpReleased: true });
  yield* c.until(() => !highLife.alive, () => c.steer([101, lifeY, 0]),
    { label: 'upper life before fuse support', limit: 160 });
  c.check(fuse101.alive, 'TNT support exploded before upper claim');
  yield* grounded([97, 2.8, 0], 'TNT upper-first retreat');
  if (fuse101.alive) yield* prime(fuse101, [97, 2.8, 0], 'first workshop fuse');
  if (at(105, 2.8).alive) yield* c.hit(at(105, 2.8), 'workshop retreat reward');
  yield* prime(at(109, 2.8), [105, 2.8, 0], 'second workshop fuse');
  yield* c.enemy(foeAt(115), 'workshop blade window');

  yield* c.walk([119,2.8,0],'workshop timber hinge approach');
  for(const [index,target] of [[0,125.5],[1,132]]) {
    const bridge=l.spinBridges[index];
    yield* c.tick({spinHeld:true});
    yield* c.until(()=>bridge.deployed,{}, {label:'deploy permanent workshop crossing',limit:90});
    yield* c.walk([target,2.8,0],'cross stable workshop timber');
  }
  yield* c.checkpoint(134, 'machinery checkpoint');

  const returnLaunch = named('Return-loop launch: save it until after the far !');
  yield* c.hop([138.2, 2.8, 0], 'pass the conserved launcher without attacking it');
  yield* c.walk([147 - 1.1, 2.8, 0], 'outward switch approach');
  yield* c.hit(named('Independent workshop circuit local ! switch'), 'outward return circuit key');
  c.check(returnLaunch.alive, 'return arrow was destroyed before the outward key');
  const returnY = shelfTop('Return gallery appears only after the outward switch');
  yield* highGallery(returnLaunch, [138.4, returnY, 0], 'conserved arrow to activated return row');
  for (const crate of l.crates.filter(crate => crate.alive && !crate.bang && crate.box.min.y > 9 && crate.mesh.position.x >= 138 && crate.mesh.position.x <= 145))
    if (crate.alive) yield* c.hit(crate, 'activated upper return row');
  yield* c.hop([134.4, 2.8, 0], 'return to clear conserved loop arrow', { tolerance: 1 });
  yield* c.stepFor(40);
  yield* c.hit(returnLaunch, 'return-loop launcher last');
  yield* c.walk([145, 2.8, 0], 'used second key obstacle approach');
  yield* c.hop([150, 2.8, 0], 'hop over used outward switch');
  yield* c.walk([170, 2.8, 0], 'newly materialized second bridge');
  yield* c.enemy(foeAt(177), 'charger telegraph and recovery');
  yield* c.hit(at(184, 2.8), 'clear later Nitro field');
  yield* c.until(() => !l.crates.some(crate => crate.alive && crate.nitro), {},
    { label: 'Nitro cleanup resolved', limit: 90 });
  yield* c.hop([187.5, 2.8, 0], 'hop over used Nitro clearing switch');
  yield* c.walk([195, 2.8, 0], 'crumble approach bank');
  yield* c.hop([199, 2.8, 0], 'finite footing first landing');
  yield* c.hop([203.8, 4, 0], 'finite footing finale', { tolerance: 1, limit: 180 });
  yield* c.enemy(foeAt(208), 'final armored stomp');
  yield* c.enemy(foeAt(218), 'final spike spin');
  if (at(224, 4).alive) yield* c.hit(at(224, 4), 'final mastery reward');
  yield* c.clearAll('Switchyard active-stage crate dependency route');
  const completion=yield* c.finish('finish plane crossing',{limit:200});
  return { ...completion, id: r.id, done: true, state: p.state, cratesBroken: p.cratesBroken,
    totalCrates: l.totalCrates, gemEarned: p.gemEarned, deaths: p.totalDeaths };
}
