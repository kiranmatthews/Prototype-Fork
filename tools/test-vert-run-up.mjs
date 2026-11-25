// Running up a vert on foot: he climbs out, or leaps and catches the lip, or
// leaps, misses and is thrown back down, and which it is depends on one
// measurement of the wall.
//
//   node tools/test-vert-run-up.mjs        (npm run check:vert-run-up)
//
// What is asserted:
//   · THE RULE: the lip's height above the last place a running foot holds
//     picks the outcome, and nothing else does; a drawn wall of eight facets
//     and one of ninety-six measure the same;
//   · THE PLAN, on walls from a 1.2 m kicker to a 9 m face: the pelvis starts
//     exactly where the run had it and never jumps; a climb only ever goes up
//     and ends stood on the deck running; a leap is a throw (it slows all the
//     way to its top), a grab takes the lip AT the top with the pelvis the
//     length of his arms under it and ends in the dead hang, a miss stops a
//     hand's breadth short and ends stood at rest on the flat; the clip's own
//     moments (hands on, over, loaded, caught) are the plan's whatever the
//     wall makes of their timing; nothing depends on the frame rate;
//   · THE CLIPS: three one-shots scrubbed by gameplay, on the starter
//     catalogue with elasticity of their own; no joint pops between samples;
//     no beat is done by both sides at once; the miss's body pitch IS the
//     plan's roll;
//   · THE REAL PLAYER on fixture walls: the same wall always ends the same way
//     and each way ends where it should (on the deck running, in the game's
//     own hang and from it up the ordinary clamber, back on the flat); a wall
//     he is not running at, or with no deck behind its lip, is left alone;
//   · THE DRAWN BODY in every one of them: its pelvis is where the plan has it
//     from the first frame (no pop from the run into the move, none from the
//     move into the hang), a hand that holds is on the coping and a foot that
//     holds is on the wall, his head (0.8 m of it) is never in the wall or the
//     floor, with the guard that would shove it out left with nothing to do, and
//     drawing the same instant twice draws the same body;
//   · SIDE PIPE LAB's wall yard is those four walls.
import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

const RADIUS = 2.5, LANE = 14, WALL_X = 12;
// (name, radius, straight section above the curve, deck, what must happen)
const FIXTURES = [
  ['kicker', 1.2, 0, 6, 'climb'],
  ['plain quarter', RADIUS, 0, 6, 'climb'],
  ['big quarter', 3.5, 0, 6, 'climb'],
  ['extended', RADIUS, 1.35, 6, 'climb'],
  ['top of the climb', RADIUS, 1.7, 6, 'climb'],
  ['low grab', RADIUS, 1.85, 6, 'grab'],
  ['grab', RADIUS, 2.75, 6, 'grab'],
  ['top of the grab', RADIUS, 2.8, 6, 'grab'],
  ['just too high', RADIUS, 2.95, 6, 'miss'],
  ['far too high', RADIUS, 5.0, 6, 'miss'],
  ['no deck', RADIUS, 1.0, 0.4, 'none'],
];
const components = [{ t: 'zone', p: [0, 0, LANE * FIXTURES.length / 2], s: [160, 1, LANE * (FIXTURES.length + 2)], dir: 'E', sideOn: true },
  { t: 'camnode', p: [-40, 0, 0] }, { t: 'camnode', p: [60, 0, 0] }, { t: 'gate', p: [-38, 0, 0], yaw: 90 }];
FIXTURES.forEach(([, radius, lipRise, deck], lane) => {
  const z = lane * LANE;
  components.push({ t: 'platform', p: [-10, -0.5, z], s: [44, 1, 8] });
  components.push({ t: 'vertramp', vkind: 'quarter', p: [WALL_X, 0, z], len: 8, rise: radius, w: 0, yaw: 0, deck, lipRise });
});
const levelEntry = { id: '__vert_run_up', name: 'vert run-up', data: { v: 1, name: 'vert run-up', spawn: [-6, 0.2, 0], killY: -30, components } };

await withSkateRuntime(async ({ server, player: p, level, step, CONST, THREE }) => {
  const R = await server.ssrLoadModule('/src/vertRunUp.ts');
  const { VERT_RUN_UP: A, VERT_MISS_ROLL, VertWall, VertRunPlan, vertRunOutcome, throughKeys } = R;
  const f2 = v => v.toFixed(2);
  p.competitionMode = false;

  // ---- the rule ------------------------------------------------------------------
  assert.equal(vertRunOutcome(0.3), 'climb');
  assert.equal(vertRunOutcome(A.climbRise), 'climb');
  assert.equal(vertRunOutcome(A.climbRise + 0.01), 'grab');
  assert.equal(vertRunOutcome(A.grabRise), 'grab');
  assert.equal(vertRunOutcome(A.grabRise + 0.01), 'miss');
  assert.ok(A.climbRise < A.grabRise, 'the bands are in order');
  // (the top of the grab band is what his stance, his leap and the length of him add up to)
  assert.ok(Math.abs(A.grabRise - (A.stanceHips + A.leapRise + A.catchDrop)) < 0.12, 'the highest lip he catches is the highest his leap reaches');
  const order = ['climb', 'grab', 'miss'];
  for (let rise = 0.3, last = 0; rise < 9; rise += 0.05) { const now = order.indexOf(vertRunOutcome(rise)); assert.ok(now >= last, 'a higher lip is never an easier one'); last = now; }

  const quarter = (radius, lipRise, facets = 24, deck = 2) => {
    const points = [];
    for (let s = -6; s < -1e-9; s += 0.08) points.push({ s, y: 0 });
    for (let i = 0; i <= facets; i++) { const a = (i / facets) * Math.PI / 2; points.push({ s: radius * Math.sin(a), y: radius * (1 - Math.cos(a)) }); }
    if (lipRise > 0) points.push({ s: radius, y: radius + lipRise });
    return new VertWall(points, deck);
  };
  for (const radius of [1.2, 2.5, 3.5, 5]) for (const lipRise of [0, 1.5, 4]) {
    const rises = [8, 24, 96].map(facets => quarter(radius, lipRise, facets).rise);
    for (const rise of rises) assert.ok(Math.abs(rise - (radius / 2 + lipRise)) < 0.09, `R ${radius} +${lipRise}: the lip is ${f2(radius / 2 + lipRise)} above the 60° point, measured ${rises.map(f2)}`);
    assert.ok(Math.max(...rises) - Math.min(...rises) < 0.09, `R ${radius} +${lipRise}: 8 facets and 96 measure the same (${rises.map(f2)})`);
  }

  // ---- the plan ------------------------------------------------------------------
  const HANG = { hangSkin: 0.56, hangDepth: 1.25 };
  // Where the game begins the move: at the run-out point, or sooner under a face that would have his head.
  const beginLen = W => { let len = W.runOutLen;
    for (let i = 0; i < 400 && len > W.footLen + 0.05; i++, len -= 0.02) { const at = W.at(len), headY = at.y + A.headOver;
      if (!(headY - A.headRadius < W.lipY && at.s + A.headLead + A.headRadius + 0.06 >= W.faceAt(Math.min(headY, W.lipY - 0.01)))) break; }
    return len; };
  const planFor = (radius, lipRise, startHips, back = 0) => {
    const W = quarter(radius, lipRise);
    const len = Math.max(W.footLen + 0.05, beginLen(W) - back), at = W.at(len), start = { len, hipS: at.s - 0.04, hipY: at.y + startHips, velS: 4.5, velY: 7.8, ...HANG };
    return { W, start, plan: new VertRunPlan(W, start) };
  };
  const walk = (plan, dt, each) => { const out = []; for (let t = 0, n = 0; ; n++, t = n * dt) { const frame = plan.sample(t); each?.(frame, t); out.push({ ...frame, hands: { ...frame.hands }, feet: frame.feet.map(foot => ({ ...foot })) }); if (frame.done) break; assert.ok(n < 2000, 'a plan ends'); } return out; };
  const seen = new Set();
  for (const radius of [1.2, 1.8, 2.5, 3.5, 5]) for (const lipRise of [0, 0.6, 1.35, 1.7, 2.2, 2.75, 3.1, 3.4, 5, 6.5]) for (const back of [0, 0.4]) {
    // (the run draws him higher over the controller point the steeper it has got)
    const startHips = back ? 1.25 : radius < 2 ? 1.1 : A.stanceHips;
    const { W, start, plan } = planFor(radius, lipRise, startHips, back), name = `R ${radius} +${lipRise}${back ? ' (begun early)' : ''} [${plan.outcome}]`;
    assert.equal(plan.outcome, vertRunOutcome(W.rise), `${name}: the wall's one measurement decides`);
    seen.add(plan.outcome);
    const frames = walk(plan, 1 / 60), first = frames[0], last = frames[frames.length - 1];
    assert.ok(Math.hypot(first.hipS - start.hipS, first.hipY - start.hipY) < 1e-9, `${name}: it begins exactly where the run had his pelvis`);
    assert.ok(plan.duration > 0.4 && plan.duration < 3.4, `${name}: it takes ${f2(plan.duration)} s`);
    const startClear = start.hipY < W.lipY ? W.faceAt(start.hipY) - start.hipS : 9;
    let maxStep = 0, maxProgress = 0, reversals = 0, direction = 0;
    for (let i = 1; i < frames.length; i++) {
      const a = frames[i - 1], b = frames[i];
      maxStep = Math.max(maxStep, Math.hypot(b.hipS - a.hipS, b.hipY - a.hipY));
      assert.ok(b.progress >= a.progress - 1e-9, `${name}: the clip never runs backwards`);
      maxProgress = Math.max(maxProgress, b.progress - a.progress);
      const vy = (b.hipY - a.hipY) * 60;
      if (Math.abs(vy) > 0.35) { if (direction && Math.sign(vy) !== direction) reversals++; direction = Math.sign(vy); }
      for (const hold of [b.hands, ...b.feet]) assert.ok(hold.weight >= -1e-9 && hold.weight <= 1 + 1e-9, `${name}: a hold is held between not at all and fully`);
      // under the lip his pelvis keeps off the wall
      // (as much room as the move keeps, or as much as the run had left him, whichever is less)
      if (b.hipY < W.lipY - 0.36 && b.beat !== 'tumble' && b.beat !== 'rest' && b.beat !== 'rise')
        assert.ok(W.faceAt(b.hipY) - b.hipS > Math.min(0.27, startClear - 0.005), `${name}: pelvis ${f2(W.faceAt(b.hipY) - b.hipS)} m off the wall at ${f2(b.progress)}`);
    }
    assert.ok(maxStep < 0.17, `${name}: the pelvis never moves more than ${f2(maxStep)} m in a step`);
    assert.ok(maxProgress < 0.09, `${name}: the clip never skips (${f2(maxProgress)} in a step)`);
    assert.ok(Math.abs(last.progress - 1) < 1e-6, `${name}: the clip is played out when it ends`);
    if (plan.outcome === 'climb') {
      if (W.rise >= 1.2) assert.equal(reversals, 0, `${name}: a climb only ever goes up`);
      assert.ok(Math.abs(last.hipS - (W.lipS + 0.98)) < 1e-6 && Math.abs(last.hipY - (W.lipY + A.hipStand)) < 1e-6, `${name}: it ends stood on the deck`);
      assert.ok(Math.abs(last.posY - W.lipY) < 1e-6 && last.posS > W.lipS + 0.9, `${name}: and the controller point is on it`);
      assert.ok(last.velS > 3.5 && Math.abs(last.velS - A.climbExitSpeed) < 0.05, `${name}: running (${f2(last.velS)} m/s)`);
      // the clip's moments are the plan's
      const hands = frames.find(frame => frame.progress >= A.climb.hands), over = frames.find(frame => frame.progress >= A.climb.over);
      // (a coping at his hips or higher is taken in his hands; one the run has left by his knees is bounded over)
      if (W.lipY > start.hipY + 0.35) assert.ok(hands.hands.weight > 0.99 && hands.secondHand > 0.99, `${name}: both palms are on the coping when the clip says so`);
      if (W.lipY > start.hipY + 0.05) assert.ok(Math.max(...frames.map(frame => Math.min(frame.hands.weight, frame.secondHand))) > 0.9, `${name}: both palms take the coping`);
      for (const frame of frames) if (frame.hands.weight > 0.5) assert.ok(frame.hipY < W.lipY + 0.25, `${name}: a hand is never left reaching back down for the coping (pelvis ${f2(frame.hipY - W.lipY)} m over it)`);
      if (W.lipY < start.hipY - 0.45) assert.ok(frames.every(frame => frame.hands.weight < 0.01), `${name}: he does not stoop for a lip by his knees`);
      assert.ok(Math.abs(hands.hands.s - (W.lipS + 0.05)) < 0.02 && Math.abs(hands.hands.y - (W.lipY + 0.025)) < 0.02, `${name}: and the coping is where they go`);
      assert.ok(over.hipY > W.lipY + 0.55 && over.hipS > W.lipS, `${name}: and his pelvis is over the edge when the clip says so`);
      // each planted foot is let go of before the leg could be asked to stretch
      for (const frame of frames) for (const foot of frame.feet) if (foot.weight > 0.6 && frame.progress < 0.6) assert.ok(Math.hypot(frame.hipS - foot.s, frame.hipY - foot.y) < A.legReach + 0.12, `${name}: a foot is planted only where his leg reaches`);
      // speed off the deck gathers: he never stops on it
      const onDeck = frames.filter(frame => frame.progress > A.climb.over);
      assert.ok(Math.min(...onDeck.map(frame => frame.velS)) > 1.0, `${name}: he never stops on the deck (${f2(Math.min(...onDeck.map(frame => frame.velS)))} m/s)`);
    } else {
      const loaded = frames.find(frame => frame.progress >= (plan.outcome === 'grab' ? A.leap.load : A.miss.leap * A.leap.load / A.leap.catch));
      const top = frames.reduce((best, frame) => frame.beat === 'leap' || frame.beat === 'catch' || frame.beat === 'reach' ? (frame.hipY > best.hipY ? frame : best) : best, frames[0]);
      // a throw: from the load to the top the rise only ever slows
      const rise = frames.filter(frame => frame.hipY >= loaded.hipY && frames.indexOf(frame) > frames.indexOf(loaded) && frames.indexOf(frame) <= frames.indexOf(top));
      for (let i = 2; i < rise.length; i++) assert.ok(rise[i].hipY - rise[i - 1].hipY <= rise[i - 1].hipY - rise[i - 2].hipY + 0.004, `${name}: the leap slows all the way to its top`);
      if (plan.outcome === 'grab') {
        assert.ok(Math.abs(top.hipY - Math.max(W.lipY - A.catchDrop, plan.sample(0).hipY + 0.06, W.runOutY + A.stanceHips + 0.06)) < 0.03, `${name}: he takes the lip at the top of the jump, ${f2(W.lipY - top.hipY)} m under it`);
        const caught = frames.find(frame => frame.progress >= A.leap.catch);
        assert.ok(caught.hands.weight > 0.99 && Math.abs(caught.hands.y - (W.lipY + 0.025)) < 0.02, `${name}: hands on the coping at the clip's catch`);
        assert.ok(Math.abs(last.hipY - (W.lipY - A.deadHang)) < 1e-6 && Math.hypot(last.velS, last.velY) < 0.05, `${name}: it ends in the dead hang, still`);
        assert.ok(Math.abs(last.posS - (W.lipS - HANG.hangSkin)) < 1e-6 && Math.abs(last.posY - (W.lipY - HANG.hangDepth)) < 1e-6, `${name}: with the controller point where the game's hang holds it`);
      } else {
        assert.ok(W.lipY - (top.hipY + A.reachDrop) >= 0.1, `${name}: his fingers stop ${f2(W.lipY - (top.hipY + A.reachDrop))} m short`);
        const beats = frames.map(frame => frame.beat).filter((beat, i, all) => beat !== all[i - 1]);
        assert.deepEqual(beats, ['leap', 'reach', 'slide', 'tumble', 'rest', 'rise'], `${name}: leap, reach, slide, tumble, rest, rise`);
        const rest = W.at(W.lenAtS(last.posS));
        assert.ok(rest.slope < 0.12 && Math.abs(last.posY - rest.y) < 0.02, `${name}: he ends on the flat`);
        assert.ok(Math.abs(last.hipY - (rest.y + A.hipStand)) < 0.02 && Math.hypot(last.velS, last.velY) < 0.05, `${name}: stood, and still`);
        assert.ok(last.posS < W.footS + 0.3 && last.posS > W.s[0] + 0.3, `${name}: in front of the wall, on ground that was looked at`);
        for (const frame of frames) if (frame.beat === 'tumble' || frame.beat === 'rest') assert.ok(frame.hipY - W.groundAt(frame.hipS) > 0.15, `${name}: his seat is never in the ground`);
        const slide = frames.filter(frame => frame.beat === 'slide'), tumble = frames.filter(frame => frame.beat === 'tumble');
        assert.ok(slide.length >= 7 && tumble.length >= 25, `${name}: the slide (${slide.length} steps) and the fall back (${tumble.length}) are long enough to be seen`);
      }
    }
    // the same instant read at another frame rate is the same instant
    for (const t of [0.05, 0.21, 0.4, plan.duration * 0.5, plan.duration * 0.93]) {
      const a = plan.sample(t), b = { ...a, hands: { ...a.hands } }; walk(plan, 1 / 144); const c = plan.sample(t);
      assert.ok(Math.abs(b.hipS - c.hipS) < 1e-12 && Math.abs(b.hipY - c.hipY) < 1e-12 && b.progress === c.progress, `${name}: it does not depend on the frame rate`);
    }
  }
  assert.deepEqual([...seen].sort(), ['climb', 'grab', 'miss'], 'all three were planned');

  // ---- the clips ------------------------------------------------------------------
  const { VERT_RUN_CLIP_IDS, buildVertRunClips, isVertRunClip } = await server.ssrLoadModule('/src/animation/vertRunUp.ts');
  const catalog = await server.ssrLoadModule('/src/animation/playerCatalog.ts');
  const { characterElasticityAmplitudes } = await server.ssrLoadModule('/src/animation/elasticity.ts');
  const clips = buildVertRunClips('test-rig');
  assert.deepEqual(clips.map(clip => clip.id), [VERT_RUN_CLIP_IDS.climb, VERT_RUN_CLIP_IDS.leap, VERT_RUN_CLIP_IDS.miss]);
  const angleAt = (clip, joint, progress, axis = 0) => {
    const track = clip.tracks.find(candidate => candidate.target === joint), keys = track.keys;
    const i = Math.max(0, Math.min(keys.length - 1, Math.round(progress * (keys.length - 1))));
    assert.ok(Math.abs(keys[i].time / clip.duration - progress) < 0.006, `${clip.id} is keyed at ${f2(progress)}`);
    return new THREE.Euler().setFromQuaternion(new THREE.Quaternion().fromArray(keys[i].value), 'XYZ').toArray()[axis];
  };
  for (const clip of clips) {
    assert.ok(isVertRunClip(clip.id) && catalog.PLAYER_STARTER_CLIP_IDS.includes(clip.id), `${clip.id} is on the starter catalogue`);
    assert.equal(clip.loop.mode, 'once');
    assert.equal(clip.metadata.progressSource, 'gameplay-actionProgress', `${clip.id} is scrubbed by gameplay`);
    assert.ok(characterElasticityAmplitudes(clip.id.replace('player.', '')).some(value => value > 0.05), `${clip.id} has elasticity of its own`);
    for (const joint of ['root', 'spine', 'chest', 'neck', 'head', 'shoulderLeft', 'shoulderRight', 'elbowLeft', 'elbowRight', 'hipLeft', 'hipRight', 'kneeLeft', 'kneeRight', 'ankleLeft', 'ankleRight'])
      assert.ok(clip.tracks.some(track => track.target === joint && track.keys.length >= 121), `${clip.id} keys ${joint}`);
    let worst = 0, where = '';
    for (const track of clip.tracks) for (let i = 1; i < track.keys.length; i++) {
      const turn = new THREE.Quaternion().fromArray(track.keys[i - 1].value).angleTo(new THREE.Quaternion().fromArray(track.keys[i].value));
      if (turn > worst) { worst = turn; where = `${track.target} at ${f2(i / (track.keys.length - 1))}`; }
    }
    // (the miss plays its whole leap in the first fifth of a long clip: the same arm, thrown as fast, over fewer samples)
    assert.ok(worst < (clip.id === VERT_RUN_CLIP_IDS.miss ? 0.50 : 0.30), `${clip.id}: no joint turns more than ${f2(worst)} rad between two samples (${where})`);
  }
  const [climb, leap, miss] = clips;
  // one side leads: at the plant and at the take-off the two arms are nowhere near each other
  assert.ok(Math.abs(angleAt(climb, 'shoulderLeft', 0.09) - angleAt(climb, 'shoulderRight', 0.09)) > 0.4, 'the climb reaches with one hand first');
  assert.ok(Math.abs(angleAt(leap, 'shoulderLeft', 0.47) - angleAt(leap, 'shoulderRight', 0.47)) > 0.4, 'the leap is thrown with one arm ahead of the other');
  assert.ok(Math.abs(angleAt(leap, 'kneeLeft', 0.66) - angleAt(leap, 'kneeRight', 0.66)) > 0.25, 'and its legs do not trail as a pair');
  // the miss falls back as far as the plan's roll says, when it says
  VERT_MISS_ROLL.forEach(key => { const at = A.miss.slide + (A.miss.tumble - A.miss.slide) * key.at;
    assert.ok(Math.abs(angleAt(miss, 'root', at) + key.back) < 0.02, `the miss is ${f2(key.back)} rad over backwards at ${f2(at)} of its clip (drawn ${f2(-angleAt(miss, 'root', at))})`); });
  assert.ok(Math.max(...VERT_MISS_ROLL.map(key => key.back)) > 2, 'he goes right over onto his shoulders');
  assert.ok(Math.abs(throughKeys([0, 1, 2], [0, 1, 0], 1) - 1) < 1e-12 && throughKeys([0, 1, 2], [0, 1, 0], 0.5) <= 1 && throughKeys([0, 1, 2], [0, 1, 0], 1.5) <= 1, 'the shared curve never overshoots a key');

  // ---- the real player ---------------------------------------------------------------
  const rig = p.animationRig?.jointsById, node = id => rig?.get(id)?.node;
  assert.ok(node('hips') && node('head'), 'the drawn rig is there to be measured');
  const world = (object, out = new THREE.Vector3()) => object.getWorldPosition(out);
  const hold = () => { const input = makeInput(); input.moveX = 1; return input; };
  const idle = () => makeInput();
  const place = (lane, x, y = 0.15) => { level.reset?.(true); p.respawn(level, true, false, { position: new THREE.Vector3(x, y, lane * LANE), heading: new THREE.Vector3(1, 0, 0) }); for (let i = 0; i < 20; i++) step(idle()); };
  const runAt = (lane, input = hold, limit = 420, from = -5) => {
    place(lane, from);
    const log = { began: -1, ended: -1, outcome: 'none', rows: [], rise: 0, plan: null };
    let before = null;
    for (let i = 0; i < limit; i++) {
      const hipsBefore = world(node('hips')).clone();
      step(input(i));
      const run = p.vertRun, hips = world(node('hips')).clone();
      if (run && log.began < 0) { log.began = i; log.outcome = run.plan.outcome; log.rise = run.plan.wall.rise; log.plan = run.plan; log.entry = hips.distanceTo(hipsBefore); log.wall = run.plan.wall; log.frame0 = { ox: run.ox, dx: run.dx }; }
      if (run) {
        const frame = run.frame, W = run.plan.wall, s = v => (v.x - run.ox) * run.dx + (v.z - run.oz) * run.dz;
        const planned = new THREE.Vector3(run.ox + run.dx * frame.hipS, frame.hipY, run.oz + run.dz * frame.hipS);
        const head = node('head'), m = head.matrixWorld.elements, joint = world(head), up = Math.hypot(m[4], m[5], m[6]) || 1;
        const skull = new THREE.Vector3(joint.x + m[4] / up * A.headUp, joint.y + m[5] / up * A.headUp, joint.z + m[6] / up * A.headUp), cs = s(skull);
        const inWall = skull.y < W.lipY ? cs + A.headRadius - W.faceAt(skull.y) : -9, inFloor = cs < W.lipS ? W.groundAt(cs) + A.headRadius - skull.y : -9;
        log.rows.push({ i, beat: frame.beat, progress: frame.progress, pin: hips.distanceTo(planned) - p.vertRunPush - p.vertRunLift, hips, push: p.vertRunPush, lift: p.vertRunLift,
          head: Math.min(inWall, inFloor) > 0 ? Math.min(inWall, inFloor) : Math.max(Math.min(inWall, 0), Math.min(inFloor, 0)) > -9 ? Math.min(Math.max(inWall, -9), Math.max(inFloor, -9)) : -9,
          hands: frame.hands.weight > 0.995 ? [world(p.gloveLeft.gripSocket), frame.secondHand > 0.995 ? world(p.gloveRight.gripSocket) : null].filter(Boolean).map(g => Math.hypot(s(g) - frame.hands.s, g.y - frame.hands.y)) : [],
          state: `${p.state}/${p.ledgePhase}`, clip: p.animationClipHint, pos: p.pos.clone(), speed: Math.hypot(frame.velS, frame.velY) });
        before = hips;
        // Drawing the same instant again changes nothing: no turn or shove is added twice.
        if (log.rows.length % 7 === 3) {
          const at = id => { const o = node(id); o.updateWorldMatrix(true, false); return o.matrixWorld.elements.slice(); };
          const was = ['hips', 'head', 'wristLeft', 'ankleLeft'].map(at);
          p.alignVertRun(0);
          const now = ['hips', 'head', 'wristLeft', 'ankleLeft'].map(at);
          log.redraw = Math.max(log.redraw ?? 0, ...was.flatMap((m, k) => m.map((v, e) => Math.abs(v - now[k][e]))));
        }
      } else if (log.began >= 0 && log.ended < 0) { log.ended = i; log.exit = before ? hips.distanceTo(before) : 0; log.after = { state: p.state, phase: p.ledgePhase, grounded: p.grounded, pos: p.pos.clone(), clip: p.animationClipHint, onVert: p.ledgeOnVert }; break; }
    }
    return log;
  };
  const drawn = [];
  for (const [lane, [name, radius, lipRise, deck, expected]] of FIXTURES.entries()) {
    const lipX = WALL_X + radius, lipY = radius + lipRise, label = `${name} (R ${radius} +${lipRise})`;
    const first = runAt(lane), again = runAt(lane);
    assert.equal(first.outcome, expected, `${label}: ${expected === 'none' ? 'left alone' : `he ${expected}s`} (got ${first.outcome}, rise ${f2(first.rise)})`);
    assert.equal(again.outcome, first.outcome, `${label}: the same wall ends the same way every time`);
    if (expected === 'none') { assert.equal(p.state, 'ride', `${label}: he is still simply on his feet`); continue; }
    assert.ok(Math.abs(first.rise - (radius / 2 + lipRise)) < 0.12, `${label}: read as ${f2(first.rise)} m, built as ${f2(radius / 2 + lipRise)}`);
    assert.ok(first.ended > first.began, `${label}: it ends`);
    assert.ok(first.rows.every(row => row.state === 'hang/vert' && row.clip === `player.vert-${expected === 'grab' ? 'leap' : expected}`), `${label}: the move owns him, and plays its own clip`);
    // the drawn body
    assert.ok(first.entry < 0.45, `${label}: no pop from the run into the move (${f2(first.entry)} m in its first step, at a nine metre a second run)`);
    const pin = Math.max(...first.rows.map(row => row.pin));
    assert.ok(pin < 0.02, `${label}: his pelvis is drawn where the plan has it (${f2(pin)} m off at worst)`);
    const push = Math.max(...first.rows.map(row => Math.max(row.push, row.lift))), head = Math.max(...first.rows.map(row => row.head));
    assert.ok(head < 0.015, `${label}: his head is never in the wall or the floor (${f2(head)} m)`);
    assert.ok(push < 0.03, `${label}: and the guard that would shove it out has nothing to do (${f2(push)} m)`);
    const grips = first.rows.flatMap(row => row.hands);
    if (expected !== 'miss' && lipY > first.rows[0].hips.y + 0.1) { assert.ok(grips.length > 3, `${label}: his hands take the coping`); assert.ok(Math.max(...grips) < 0.06, `${label}: and are on it (${f2(Math.max(...grips))} m off at worst)`); }
    assert.ok(first.redraw < 2e-3, `${label}: drawing the same instant twice draws the same body (${first.redraw.toExponential(1)} apart)`);
    let jump = 0; for (let i = 1; i < first.rows.length; i++) jump = Math.max(jump, first.rows[i].hips.distanceTo(first.rows[i - 1].hips));
    assert.ok(jump < 0.17, `${label}: the drawn pelvis never jumps (${f2(jump)} m in a step)`);
    drawn.push(`${name} ${expected} ${f2((first.ended - first.began) * CONST.fixedStep)}s`);
    // where it leaves him
    if (expected === 'climb') {
      assert.ok(first.after.state === 'ride' && first.after.grounded, `${label}: he is on his feet`);
      assert.ok(first.after.pos.x > lipX + 0.8 && Math.abs(first.after.pos.y - lipY) < 0.06, `${label}: on the deck (${f2(first.after.pos.x - lipX)} m past the lip)`);
      assert.ok(first.exit < 0.3, `${label}: no pop from the move into the run (${f2(first.exit)} m)`);
      const x0 = p.pos.x; for (let i = 0; i < 30; i++) step(hold());
      assert.ok(p.pos.x > x0 + 2.5 && p.state === 'ride' && Math.abs(p.pos.y - lipY) < 0.1, `${label}: and runs on along it`);
    } else if (expected === 'grab') {
      assert.ok(first.after.state === 'hang' && first.after.phase === 'grip' && first.after.onVert, `${label}: it is the game's own hang from here`);
      assert.ok(Math.abs(first.after.pos.y - (lipY - 1.25)) < 0.03 && first.after.pos.x < lipX, `${label}: held under the lip`);
      assert.ok(first.exit < 0.05, `${label}: no pop from the catch into the hang (${f2(first.exit)} m)`);
      // ...and the hand-over stays smooth while the hang's own pull-up takes over
      let last = world(node('hips')).clone(), worst = 0, lowest = last.y;
      for (let i = 0; i < 24; i++) { step(idle()); const now = world(node('hips')).clone(); worst = Math.max(worst, now.distanceTo(last)); lowest = Math.min(lowest, now.y); last = now; }
      assert.ok(worst < 0.14, `${label}: the pull up onto bent arms begins without a jerk (${f2(worst)} m in a step)`);
      // (the game's own hang lets a body down to 1.9 m under the lip before it pulls up; eased into, he goes less far)
      assert.ok(lowest > lipY - 1.9 && lowest < lipY - A.deadHang + 0.02, `${label}: he is let down onto his arms, and no further than the hang's own dead hang (${f2(lipY - lowest)} m under the lip)`);
      assert.ok(last.y > lipY - 1.45, `${label}: he ends up on bent arms (${f2(lipY - last.y)} m under the lip)`);
      for (let i = 0; i < 150 && p.state === 'hang'; i++) step(hold());
      for (let i = 0; i < 20; i++) step(idle());
      assert.ok(p.state === 'ride' && p.grounded && p.pos.x > lipX && Math.abs(p.pos.y - lipY) < 0.08, `${label}: and the ordinary clamber takes him up onto the deck`);
    } else {
      assert.ok(first.after.state === 'ride' && first.after.grounded, `${label}: he is on his feet again`);
      assert.ok(first.after.pos.x < WALL_X - 0.5 && Math.abs(first.after.pos.y) < 0.06, `${label}: back on the flat (${f2(WALL_X - first.after.pos.x)} m out from the foot of the wall)`);
      const beats = first.rows.map(row => row.beat).filter((beat, i, all) => beat !== all[i - 1]);
      assert.deepEqual(beats, ['leap', 'reach', 'slide', 'tumble', 'rest', 'rise'], `${label}: leap, reach, slide, tumble, rest, rise`);
      assert.ok(first.rows.every(row => row.pos.y > -0.05), `${label}: the controller point never goes under the ground`);
      for (let i = 0; i < 12; i++) step(idle());
      assert.ok(p.state === 'ride' && Math.hypot(p.walkVelocity.x, p.walkVelocity.z) < 0.5, `${label}: stood still, his to move again`);
    }
  }

  // A wall he is not running at is only a wall: stick let go before it, he just stops on it.
  const coasting = runAt(1, i => (i < 22 ? hold() : idle()), 240);
  assert.equal(coasting.outcome, 'none', 'letting go of the stick before the wall is not a run at it');

  // ---- Side Pipe Lab's wall yard ----------------------------------------------------
  const lab = await server.ssrLoadModule('/src/levels/side-pipe-lab.ts');
  const yard = [[lab.YARD_VAULT, 'climb'], [lab.YARD_CLIMB, 'climb'], [lab.YARD_GRAB, 'grab'], [lab.YARD_MISS, 'miss']];
  for (const [wall, expected] of yard) assert.equal(vertRunOutcome(wall.rise), expected, `${wall.name}: a ${f2(wall.rise)} m lip is a ${expected}`);
  assert.ok(lab.YARD_VAULT.rise < 1.5 && lab.YARD_CLIMB.rise > 2.2, 'the yard shows the climb both as a vault and as a wall run');
  for (let i = 1; i < yard.length; i++) assert.ok(yard[i][0].rise > yard[i - 1][0].rise + 0.4 && Math.abs(yard[i][0].floorY - yard[i - 1][0].lipY) < 1e-6, 'each wall stands on the last one\'s deck, and is taller');
  const vertramps = lab.default?.data?.components ?? lab.SIDE_PIPE_LAB?.data?.components ?? [];
  if (vertramps.length) for (const [wall] of yard) assert.ok(vertramps.some(c => c.t === 'vertramp' && c.nm === wall.name), `${wall.name} is in the level`);

  console.log(`vert run-up: ok (${drawn.join(', ')})`);
}, { levelEntry, animationScheme: 'D' });
