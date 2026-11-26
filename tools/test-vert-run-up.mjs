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
//     own hang and from it up the ordinary clamber, at once if Jump is pressed
//     as he catches; back on the flat); a wall he is not running at, or with no
//     deck behind its lip, is left alone;
//   · THE DRAWN BODY in every one of them: its pelvis is where the plan has it
//     from the first frame (no pop from the run into the move, none from the
//     move into the hang), a hand that holds is on the coping and a foot that
//     holds is on the wall, his head (0.8 m of it) is never in the wall or the
//     floor, with the guard that would shove it out left with nothing to do, and
//     drawing the same instant twice draws the same body;
//   · ROLLED UP TO ON THE BOARD, from the deck, a vert's lip is one of three
//     things by how fast he reaches it: slowly, he is brought to the coping,
//     sets his tail on it and WAITS (Jump or the stick pressed on drops him in
//     after a beat's lean, the stick pressed back rolls him off it tail first,
//     the stick he arrived holding does neither); at a roll he drops straight
//     in, slowed for it but never stopped, whatever he presses; flat out he
//     leaves the edge in the air and clears the curve. And none of it jolts:
//     pelvis, deck pitch and wheels are measured frame to frame;
//   · ON THE BOARD, UP A WALL AND INTO ITS AIR, a hang comes back to the wall
//     it left. Off a face that stands dead straight under its lip the line he
//     rises and falls on is the face's own plane, and the edge of the deck
//     behind the lip is on it: he is met by the FACE the step he is coming
//     down level with it, at his own height, his fall turned down it. He is
//     never stood on the deck, never lifted onto it from just under it and
//     never stopped under it on the way up, whatever the hang's height and
//     whatever the stick is doing; and the way back is one movement, frame to
//     frame. Popped out over the lip instead, the first frames of that air
//     turn the deck a degree or two where they turned it 36: he comes up off
//     the wall on a curve, as long as the air has for it, and is on his wheels
//     by the time they are down;
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
  ['grab', RADIUS, 2.3, 6, 'grab'],
  ['top of the grab', RADIUS, 2.55, 6, 'grab'],
  ['just too high', RADIUS, 2.8, 6, 'miss'],
  ['far too high', RADIUS, 5.0, 6, 'miss'],
  // no ledge at the top: whatever its height, a wall he comes up short on
  ['no deck', RADIUS, 1.0, 0.4, 'miss'],
  ['spine', 5, 0, 0, 'miss', 'spine'],
  ['wall going on up', RADIUS, 0, 0, 'miss', 'wall'],
  ['boxed-in deck', RADIUS, 1.35, 6, 'miss', 'boxed'],
  // ...unless it is no higher than his hips: nothing to leap for, and it is left alone
  ['low spine', RADIUS, 0, 0, 'none', 'spine'],
  // the grab wall again as a side-on course has it: between the two unseen walls that hold play to one plane
  ['grab on a walled plane', RADIUS, 2.3, 6, 'grab', 'plane'],
];
const components = [{ t: 'zone', p: [0, 0, LANE * FIXTURES.length / 2], s: [160, 1, LANE * (FIXTURES.length + 2)], dir: 'E', sideOn: true },
  { t: 'camnode', p: [-40, 0, 0] }, { t: 'camnode', p: [60, 0, 0] }, { t: 'gate', p: [-38, 0, 0], yaw: 90 }];
FIXTURES.forEach(([, radius, lipRise, deck, , extra], lane) => {
  const z = lane * LANE;
  components.push({ t: 'platform', p: [-10, -0.5, z], s: [44, 1, 8] });
  components.push({ t: 'vertramp', vkind: 'quarter', p: [WALL_X, 0, z], len: 8, rise: radius, w: 0, yaw: 0, deck, lipRise });
  // two verts back to back: the same wall again, facing the other way, lip to lip
  if (extra === 'spine') components.push({ t: 'platform', p: [WALL_X + 2 * radius + 10, -0.5, z], s: [20 + 2 * radius, 1, 8] },
    { t: 'vertramp', vkind: 'quarter', p: [WALL_X + 2 * radius, 0, z], len: 8, rise: radius, w: 0, yaw: 180, deck: 0 });
  // a curve at the foot of a building: the face goes on up, far over his head
  if (extra === 'wall') components.push({ t: 'platform', p: [WALL_X + radius + 2, 6, z], s: [4, 12, 8] });
  // a deck with no room on it
  if (extra === 'boxed') components.push({ t: 'platform', p: [WALL_X + radius + 1.0, radius + lipRise + 1.5, z], s: [1.6, 3, 8] });
  // a play plane 1.06 m wide (Side Pipe Lab's own two walls)
  if (extra === 'plane') components.push(...[-0.83, 0.83].map(dz => ({ t: 'wall', p: [0, -14, z + dz], s: [80, 60, 0.6], invisible: true })));
});
// ...and one lane with no vert in it: a block with a square edge, to hang from and let go of
const BLOCK = { lane: FIXTURES.length, edgeX: WALL_X, topY: 4.4 };
components.push({ t: 'platform', p: [-10, -0.5, BLOCK.lane * LANE], s: [44, 1, 8] },
  { t: 'platform', p: [BLOCK.edgeX + 3, BLOCK.topY / 2, BLOCK.lane * LANE], s: [6, BLOCK.topY, 8] });
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
      if (b.hipY < W.lipY - 0.36 && b.beat !== 'tumble' && b.beat !== 'rise')
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
        assert.deepEqual(beats, ['leap', 'reach', 'slide', 'tumble', 'rise'], `${name}: leap, reach, slide, the roll, up`);
        const rest = W.at(W.lenAtS(last.posS));
        assert.ok(rest.slope < 0.12 && Math.abs(last.posY - rest.y) < 0.02, `${name}: he ends on the flat`);
        assert.ok(Math.abs(last.hipY - (rest.y + A.hipStand)) < 0.02 && Math.hypot(last.velS, last.velY) < 0.05, `${name}: stood, and still`);
        assert.ok(last.posS < W.footS + 0.3 && last.posS > W.s[0] + 0.3, `${name}: in front of the wall, on ground that was looked at`);
        for (const frame of frames) if (frame.beat === 'tumble' || frame.beat === 'rise') assert.ok(frame.hipY - W.groundAt(frame.hipS) > 0.15, `${name}: his seat is never in the ground`);
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
    // (read between the two samples either side of the moment asked for)
    const at = Math.max(0, Math.min(keys.length - 1, progress * (keys.length - 1))), i = Math.min(keys.length - 2, Math.floor(at));
    const q = new THREE.Quaternion().fromArray(keys[i].value).slerp(new THREE.Quaternion().fromArray(keys[i + 1].value), at - i);
    return new THREE.Euler().setFromQuaternion(q, 'XYZ').toArray()[axis];
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
  // (a whole turn: compared as angles, since the clip stores the turn and not how many times round)
  const turned = v => Math.atan2(Math.sin(v), Math.cos(v));
  VERT_MISS_ROLL.forEach(key => { const at = A.miss.slide + (A.miss.tumble - A.miss.slide) * key.at;
    assert.ok(Math.abs(turned(angleAt(miss, 'root', at) + key.back)) < 0.02, `the miss is ${f2(key.back)} rad over backwards at ${f2(at)} of its clip (drawn ${f2(-angleAt(miss, 'root', at))})`); });
  for (let i = 1; i < VERT_MISS_ROLL.length; i++) assert.ok(VERT_MISS_ROLL[i].back > VERT_MISS_ROLL[i - 1].back && VERT_MISS_ROLL[i].at > VERT_MISS_ROLL[i - 1].at, 'the roll only ever goes over backwards');
  assert.ok(VERT_MISS_ROLL[VERT_MISS_ROLL.length - 1].back > 5.9 && VERT_MISS_ROLL[VERT_MISS_ROLL.length - 1].back < 2 * Math.PI, 'he goes right over, all the way round onto his feet');
  assert.ok(Math.abs(turned(angleAt(miss, 'root', 1))) < 0.06, 'and the clip ends with him upright');
  // over the top of the roll his pelvis is above his head, and it comes down as his feet do
  const top = VERT_MISS_ROLL.reduce((best, key) => key.off > best.off ? key : best);
  assert.ok(top.back > 3.4 && top.back < 4.6 && top.off > 1.2, `his hips are highest (${f2(top.off)} m) as he goes over his hands`);
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
    let before = null, limbsBefore = null;
    // (his head, hands and feet, each from his pelvis: what a hand-over must not move in a frame)
    const limbs = at => ['head', 'wristLeft', 'wristRight', 'ankleLeft', 'ankleRight'].map(id => world(node(id)).clone().sub(at));
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
        before = hips; limbsBefore = limbs(hips);
        // Drawing the same instant again changes nothing: no turn or shove is added twice.
        if (log.rows.length % 7 === 3) {
          const at = id => { const o = node(id); o.updateWorldMatrix(true, false); return o.matrixWorld.elements.slice(); };
          p.group.updateMatrixWorld(true);
          const was = ['hips', 'head', 'wristLeft', 'ankleLeft'].map(at);
          for (let again = 0; again < 3; again++) { p.syncVisual(hold(), 0); p.group.updateMatrixWorld(true); }
          const now = ['hips', 'head', 'wristLeft', 'ankleLeft'].map(at);
          log.redraw = Math.max(log.redraw ?? 0, ...was.flatMap((m, k) => m.map((v, e) => Math.abs(v - now[k][e]))));
        }
      } else if (log.began >= 0 && log.ended < 0) { log.ended = i; log.exit = before ? hips.distanceTo(before) : 0;
        log.exitLimbs = limbsBefore ? Math.max(...limbs(hips).map((v, k) => v.distanceTo(limbsBefore[k]))) : 0; log.after = { state: p.state, phase: p.ledgePhase, grounded: p.grounded, pos: p.pos.clone(), clip: p.animationClipHint, onVert: p.ledgeOnVert }; break; }
    }
    return log;
  };
  const drawn = [];
  for (const [lane, [name, radius, lipRise, deck, expected]] of FIXTURES.entries()) {
    const lipX = WALL_X + radius, lipY = radius + lipRise, label = `${name} (R ${radius} +${lipRise})`;
    const first = runAt(lane), again = runAt(lane);
    assert.equal(first.outcome, expected, `${label}: ${expected === 'none' ? 'left alone' : `he ${expected}s`} (got ${first.outcome}, rise ${f2(first.rise)})`);
    assert.equal(again.outcome, first.outcome, `${label}: the same wall ends the same way every time`);
    const kind = FIXTURES[lane][5];
    // (left alone, the run takes him wherever running at it takes him: here, over the top of a hip-high spine)
    if (expected === 'none') { assert.ok(p.state !== 'hang' && !p.vertRun, `${label}: it is only a wall`); continue; }
    // (a face that goes on up is as high as the building it is the foot of; a boxed-in deck is its box)
    if (kind !== 'wall' && kind !== 'boxed') assert.ok(Math.abs(first.rise - (radius / 2 + lipRise)) < (kind ? 0.25 : 0.12), `${label}: read as ${f2(first.rise)} m, built as ${f2(radius / 2 + lipRise)}`);
    if (kind === 'wall') assert.ok(first.rise > 8, `${label}: the face is read all the way up (${f2(first.rise)} m)`);
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
      // (he leaves it at the pace it ended on, 7 cm a step, and in the body it last drew: measured before, his head
      // and hands were 14 cm and 10 cm from where they had just been, and a foot 35 cm, in that one frame)
      assert.ok(first.exit > 0.04 && first.exit < 0.11, `${label}: no pop and no stall from the move into the run (${f2(first.exit)} m in the step it ends)`);
      assert.ok(first.exitLimbs < 0.06, `${label}: and no part of him is thrown as it hands over (${f2(first.exitLimbs)} m)`);
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
      // The catch is not a wait: Jump pressed as his hands take the lip starts the clamber at once.
      runAt(lane);
      let waited = 0;
      for (; waited < 30 && p.ledgePhase !== 'climb'; waited++) { const input = makeInput(); input.moveX = 1; input.jumpPressed = waited === 0; input.jumpHeld = waited < 4; step(input); }
      assert.ok(p.state === 'hang' && waited <= 2, `${label}: Jump pressed as he catches starts the clamber at once (${waited} steps)`);
    } else {
      assert.ok(first.after.state === 'ride' && first.after.grounded, `${label}: he is on his feet again`);
      assert.ok(first.after.pos.x < WALL_X - 0.5 && Math.abs(first.after.pos.y) < 0.06, `${label}: back on the flat (${f2(WALL_X - first.after.pos.x)} m out from the foot of the wall)`);
      const beats = first.rows.map(row => row.beat).filter((beat, i, all) => beat !== all[i - 1]);
      assert.deepEqual(beats, ['leap', 'reach', 'slide', 'tumble', 'rise'], `${label}: leap, reach, slide, the roll, up`);
      assert.ok(first.rows.every(row => row.pos.y > -0.05), `${label}: the controller point never goes under the ground`);
      // (handed to the idle, he used to be redrawn 12 cm higher with his feet 17 cm from where they stood)
      assert.ok(first.exit < 0.02 && first.exitLimbs < 0.05, `${label}: he is stood where the roll left him, as it left him: nothing moves in the frame it ends (pelvis ${f2(first.exit)} m, limbs ${f2(first.exitLimbs)} m)`);
      { let last = world(node('hips')).clone(), worst = 0;
        for (let i = 0; i < 26; i++) { step(idle()); const now = world(node('hips')).clone(); worst = Math.max(worst, now.distanceTo(last)); last = now; }
        assert.ok(worst < 0.03, `${label}: and settles into standing with no jerk (${f2(worst)} m in a step at most)`); }
      for (let i = 0; i < 12; i++) step(idle());
      assert.ok(p.state === 'ride' && Math.hypot(p.walkVelocity.x, p.walkVelocity.z) < 0.5, `${label}: stood still, his to move again`);
    }
  }

  // A wall he is not running at is only a wall: stick let go before it, he just stops on it.
  const coasting = runAt(1, i => (i < 22 ? hold() : idle()), 240);
  assert.equal(coasting.outcome, 'none', 'letting go of the stick before the wall is not a run at it');

  // ---- a vert's lip is a ledge to a body that jumped or fell to it ------------------
  // Falling past a coping on foot with the stick toward it catches it, like any ledge. And a body
  // hung from a vert lies along what is under that lip: straight down a straight face, swung out
  // onto the curve where the face curves away, with no part of his legs inside it.
  const lane = name => FIXTURES.findIndex(fixture => fixture[0] === name);
  const fallAt = (name, steps = 70) => {
    const [, radius, lipRise] = FIXTURES[lane(name)], lipX = WALL_X + radius, lipY = radius + lipRise;
    place(lane(name), -5);
    p.pos.set(lipX - 1.3, lipY - 0.8, lane(name) * LANE); p.prevPos.copy(p.pos);
    p.state = 'air'; p.grounded = false; p.vVel = 0; p.groundHit = null; p.walkVelocity.set(2.5, 0, 0);
    let caught = -1;
    for (let i = 0; i < steps; i++) { step(p.state === 'hang' ? idle() : hold()); if (caught < 0 && p.state === 'hang') caught = i; }
    return { caught, radius, lipX, lipY };
  };
  // (how far a joint is on the air side of the wall: of its curve below the top of it, of its face above)
  const offWall = (joint, radius) => { const at = world(node(joint)), s = at.x - WALL_X;
    return at.y < radius ? radius - Math.hypot(s, at.y - radius) : WALL_X + radius - at.x; };
  for (const [name, leans] of [['plain quarter', true], ['extended', true], ['grab', false], ['grab on a walled plane', false]]) {
    const fall = fallAt(name), label = `${name}: fallen to`;
    assert.ok(fall.caught >= 0 && fall.caught < 20 && p.state === 'hang' && p.ledgePhase === 'grip', `${label}: his hands take the lip (state ${p.state}/${p.ledgePhase})`);
    assert.ok(p.ledgeOnVert && Math.abs(p.pos.y - (fall.lipY - 1.25)) < 0.05, `${label}: it is the ordinary hang, under a vert's lip`);
    assert.ok(p.ledgeGripError < 0.06, `${label}: his hands are on the coping (${f2(p.ledgeGripError)} m off)`);
    const clear = Math.min(...['hips', 'kneeLeft', 'kneeRight', 'ankleLeft', 'ankleRight'].map(joint => offWall(joint, fall.radius)));
    assert.ok(clear > 0.1, `${label}: no part of his legs is in the wall (${f2(clear)} m off it at the nearest)`);
    if (leans) assert.ok(p.vertHangLean > 0.03 || p.vertHangLegs > 0.03, `${label}: he lies out along the curve (swung ${f2(p.vertHangLean)} rad, legs ${f2(p.vertHangLegs)} more)`);
    else assert.ok(p.vertHangLean < 0.02 && p.vertHangLegs < 0.02, `${label}: down a straight face he hangs straight`);
    // drawing the same instant again swings him no further
    const before = world(node('ankleLeft')).clone();
    for (let again = 0; again < 3; again++) { p.syncVisual(idle(), 0); p.group.updateMatrixWorld(true); }
    assert.ok(world(node('ankleLeft')).distanceTo(before) < 2e-3, `${label}: drawn twice, he is drawn the same`);
    // HE HANGS STILL. Two and a half seconds with the stick at rest: his arms sway with the hang's own idle,
    // and nothing in them shivers. (Hung out from a vert's face his arms are at full stretch, and the lift
    // that keeps his gloves on the lip once sank and was thrown back up every third frame: his wrists turned
    // round on 99 steps of 150 and travelled three metres going nowhere.)
    // Two more things shook them where the owner met it, and both are held here. Between the walls of a
    // side-on plane both gloves were set down on ONE point over his head (the check on a hand's place
    // asked for room for a second body beside him), so each sway of his chest in the idle's fidget heaved
    // all of him up 18 cm and let him down. And the side an elbow bends to was read again from an arm
    // already solved, so a frame that needed the second pass drew both elbows 2 cm from where the frame
    // before had them: every other frame, for as long as the lift was moving.
    {
      const joints = ['wristLeft', 'wristRight', 'elbowLeft', 'elbowRight', 'hips'];
      const trail = [], lifts = []; let offLip = 0, redrawn = 0;
      for (let i = 0; i < 150; i++) {
        step(idle()); p.group.updateMatrixWorld(true); trail.push(joints.map(id => world(node(id)).clone())); offLip = Math.max(offLip, p.ledgeGripError);
        lifts.push(p.ledgeReachLift);
        // (the same instant drawn again puts no joint of his arms anywhere else)
        p.syncVisual(idle(), 0); p.group.updateMatrixWorld(true);
        redrawn = Math.max(redrawn, ...joints.slice(0, 4).map((id, k) => world(node(id)).distanceTo(trail[i][k])));
      }
      assert.ok(p.state === 'hang' && p.ledgePhase === 'grip', `${label}: he is still hanging there`);
      const apart = p.ledgeHands.left.distanceTo(p.ledgeHands.right), heave = Math.max(...lifts) - Math.min(...lifts);
      assert.ok(apart > 0.5, `${label}: his gloves are on the lip a shoulder's width apart (${f2(apart)} m)`);
      assert.ok(heave < 0.1, `${label}: and he is not heaved up and down to keep them there (the lift moves ${f2(heave * 100)} cm through the idle's fidget)`);
      assert.ok(redrawn < 0.003, `${label}: an instant of the hang drawn twice is drawn the same, elbows included (${f2(redrawn * 1000)} mm apart at most)`);
      const measure = k => { let path = 0, turns = 0, fastest = 0;
        for (let i = 2; i < trail.length; i++) { const was = trail[i - 1][k].clone().sub(trail[i - 2][k]), now = trail[i][k].clone().sub(trail[i - 1][k]);
          path += now.length(); fastest = Math.max(fastest, now.length()); if (was.length() > 5e-4 && now.length() > 5e-4 && was.dot(now) < 0) turns++; }
        return { path, turns, fastest }; };
      const [wristL, wristR, elbowL, elbowR, hips] = joints.map((_, k) => measure(k));
      assert.ok(Math.max(wristL.turns, wristR.turns, elbowL.turns, elbowR.turns, hips.turns) < 12,
        `${label}: hanging still, nothing in his arms shivers (wrists turn round on ${wristL.turns} and ${wristR.turns} steps of 150, elbows ${elbowL.turns} and ${elbowR.turns}, hips ${hips.turns})`);
      assert.ok(Math.max(wristL.path, wristR.path) < 0.9 && Math.max(elbowL.path, elbowR.path) < 1.8,
        `${label}: and they go no further than the idle takes them (wrists ${f2(Math.max(wristL.path, wristR.path))} m, elbows ${f2(Math.max(elbowL.path, elbowR.path))} m in 2.5 s)`);
      assert.ok(hips.fastest < 0.04, `${label}: his body is never thrown (${f2(hips.fastest * 100)} cm in a step at most)`);
      assert.ok(offLip < 0.004, `${label}: with his gloves on the lip throughout (${f2(offLip * 1000)} mm off at most)`);
    }
    // ...and it is a hang like any other: the stick toward the deck clambers up onto it
    for (let i = 0; i < 150 && p.state === 'hang'; i++) step(hold());
    for (let i = 0; i < 12; i++) step(idle());
    assert.ok(p.state === 'ride' && p.grounded && p.pos.x > fall.lipX && Math.abs(p.pos.y - fall.lipY) < 0.08, `${label}: and the ordinary clamber takes him up onto the deck`);
  }
  // On the board the same lip is never a ledge: a rider over a coping is in the pipe's own air.
  {
    const [, radius, lipRise] = FIXTURES[lane('grab')], lipX = WALL_X + radius, lipY = radius + lipRise;
    place(lane('grab'), -5);
    // (at a run's speed, with the lip at arm's length over him: where a walker's hands take it)
    p.pos.set(lipX - 1.3, lipY - 1.2, lane('grab') * LANE); p.prevPos.copy(p.pos);
    p.state = 'air'; p.grounded = false; p.vVel = 0; p.groundHit = null; p.freeSkate = true; p.airFromSkate = true; p.airGrav = 'board'; p.speed = 9;
    let hung = false, through = false;
    for (let i = 0; i < 40; i++) { const input = makeInput(); input.moveY = 1; step(input); hung ||= p.state === 'hang'; through ||= p.pos.x > lipX + 0.2 && p.pos.y < lipY - 0.2; }
    assert.ok(!hung, 'a rider falling past a coping does not ledge-grab it');
    // ...and what he meets instead is the wall: a straight face is solid to a body that flies into it,
    // however much further than its thickness that body moves in a step.
    assert.ok(!through && p.pos.y > -0.1, `a body that flies into the straight face of a wall is met by it (x ${f2(p.pos.x - lipX)} past the face, y ${f2(p.pos.y)})`);
  }
  // The same face, flown into on foot below where his hands could take the lip: he does not pass through it either.
  {
    const [, radius, lipRise] = FIXTURES[lane('far too high')], lipX = WALL_X + radius, lipY = radius + lipRise;
    place(lane('far too high'), -5);
    p.pos.set(lipX - 1.3, radius + 1.2, lane('far too high') * LANE); p.prevPos.copy(p.pos);
    p.state = 'air'; p.grounded = false; p.vVel = 0; p.groundHit = null; p.walkVelocity.set(9, 0, 0);
    let through = false;
    for (let i = 0; i < 60; i++) { step(hold()); through ||= p.pos.x > lipX + 0.2 && p.pos.y < lipY - 0.2; }
    assert.ok(!through && p.pos.y > -0.1 && p.pos.x < lipX + 0.2, `a walker who jumps into a tall face is stopped by it (x ${f2(p.pos.x - lipX)} past the face, y ${f2(p.pos.y)})`);
  }

  // ---- flown into on foot, the steep of a vert is never somewhere to stand ---------------
  // A jump at the wall meets its face. What the wall gives him is its lip, if the lip is there to
  // take, or the way down it: up onto the deck from a hand's breadth under the lip, a catch from
  // within his reach (rising or falling), and from lower than that the come-up-short's own slide
  // and roll. He is never left stood on the face.
  const flyAt = (name, underLip, rising = 0, steps = 260) => {
    const [, radius, lipRise] = FIXTURES[lane(name)], lipX = WALL_X + radius, lipY = radius + lipRise;
    place(lane(name), -5);
    // (two steps from the face at a run's speed: he arrives where he is put, not where a fall has taken him)
    p.pos.set(lipX - 0.3, lipY - underLip, lane(name) * LANE); p.prevPos.copy(p.pos);
    p.state = 'air'; p.grounded = false; p.vVel = rising; p.groundHit = null; p.walkVelocity.set(9, 0, 0); p.speed = 9;
    const log = { stood: 0, hung: -1, run: null, beats: [], lipX, lipY, radius };
    for (let i = 0; i < steps; i++) {
      step(p.state === 'hang' && p.ledgePhase === 'grip' ? idle() : hold());
      // (stood on the wall: grounded, on his feet, on something no foot holds)
      if (p.state === 'ride' && p.grounded && !p.freeSkate && p.rideNormal.y < 0.3) log.stood++;
      if (log.hung < 0 && p.state === 'hang' && p.ledgePhase === 'grip') log.hung = i;
      if (p.vertRun) { log.run ??= p.vertRun.plan; if (log.beats.at(-1) !== p.vertRun.frame.beat) log.beats.push(p.vertRun.frame.beat); }
      if (log.hung >= 0 && i > log.hung + 20) break;
      if (log.run && !p.vertRun && p.state === 'ride') break;
      if (!log.run && log.hung < 0 && p.state === 'ride' && p.grounded && i > 30) break;
    }
    return log;
  };
  {
    const up = flyAt('grab', 0.2);
    assert.ok(up.stood === 0 && up.hung < 0 && !up.run, `flown at a lip a hand's breadth over his feet: he is not left on the face (${up.stood} steps stood on it)`);
    assert.ok(p.state === 'ride' && p.grounded && p.pos.x > up.lipX + 0.2 && Math.abs(p.pos.y - up.lipY) < 0.08, `...he is up: on the deck (x ${f2(p.pos.x - up.lipX)} past the lip, y ${f2(p.pos.y)})`);
    for (const rising of [0, 6, -9]) {
      const caught = flyAt('grab', 1.3, rising);
      assert.ok(caught.stood === 0 && caught.hung >= 0 && caught.hung < 14 && p.state === 'hang' && p.ledgeOnVert,
        `flown at a lip within his reach, ${rising > 0 ? 'rising' : rising < 0 ? 'falling' : 'level'}: his hands take it (state ${p.state}/${p.ledgePhase}, ${caught.stood} steps stood on the face)`);
      assert.ok(Math.abs(p.pos.y - (caught.lipY - 1.25)) < 0.06 && p.pos.x < caught.lipX, '...and it is the ordinary hang');
    }
    const down = flyAt('far too high', 3.6);
    assert.ok(down.stood === 0 && down.hung < 0 && down.run?.outcome === 'miss', `flown at a face whose lip is out of reach: he goes down it (${down.stood} steps stood on it, ${down.run?.outcome})`);
    assert.deepEqual(down.beats, ['slide', 'tumble', 'rise'], 'by the come-up-short, from its slide on: there is no leap in it');
    assert.ok(p.state === 'ride' && p.grounded && p.pos.x < WALL_X - 0.5 && Math.abs(p.pos.y) < 0.06, `...and comes up on his feet on the flat (${f2(WALL_X - p.pos.x)} m out)`);
    // the same, with a board he has just thrown away: still nowhere to stand
    const low = flyAt('far too high', 4.6, -6);
    assert.ok(low.stood === 0 && (low.run?.outcome === 'miss' || (p.state === 'ride' && p.rideNormal.y > 0.3)), 'and met lower on the face, the same');
  }

  // ---- the dismount: off any ledge, a hop and a drop, facing the ledge all the way down ----
  const facing = () => Math.atan2(Math.sin(p.visualYaw), Math.cos(p.visualYaw));
  const turnedBy = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  const letGo = () => {
    // (hung, and settled: then the stick away from the ledge)
    for (let i = 0; i < 40; i++) step(idle());
    assert.ok(p.state === 'hang' && p.ledgePhase === 'grip', 'hung, to be let go of');
    const hung = { yaw: facing(), x: p.pos.x, y: p.pos.y };
    const away = () => { const input = makeInput(); input.moveX = -1; return input; };
    const log = { hung, left: -1, hop: 0, clip: false, turned: 0, drift: 0, landed: -1, run: null, beats: [], stood: 0, latchHeld: true,
      wound: 0, woundMoved: 0, jump: 0, lowest: Infinity };
    let x0 = 0, drawn = world(node('hips')).clone();
    for (let i = 0; i < 400; i++) {
      step(log.landed < 0 ? away() : idle());
      // (the drawn body, through all of it: how far his pelvis moves in a step, and how near the ground it is put)
      const hipsNow = world(node('hips')).clone();
      if (log.left < 0 || !p.vertRun) log.jump = Math.max(log.jump, hipsNow.distanceTo(drawn));
      drawn = hipsNow;
      if (log.landed >= 0 && !p.vertRun) log.lowest = Math.min(log.lowest, hipsNow.y - p.pos.y);
      if (p.state === 'hang' && p.ledgePhase === 'off') { log.wound++; log.woundMoved = Math.max(log.woundMoved, Math.hypot(p.pos.x - hung.x, p.pos.y - hung.y)); }
      if (log.left < 0 && p.state === 'air') { log.left = i; log.hop = p.vVel; x0 = p.pos.x; log.clip = p.hangExitW > 0 && p.hangClipName === 'drop' && p.ledgeOffClip >= 0; }
      if (log.left >= 0 && p.state === 'air') { log.turned = Math.max(log.turned, turnedBy(facing(), hung.yaw)); log.drift = Math.max(log.drift, Math.abs(p.pos.x - x0)); }
      if (p.vertRun) { log.run ??= p.vertRun.plan; if (log.beats.at(-1) !== p.vertRun.frame.beat) log.beats.push(p.vertRun.frame.beat); }
      if (p.state === 'ride' && p.grounded && p.rideNormal.y < 0.92 && !p.vertRun) log.stood++;
      if (log.left >= 0 && log.landed < 0 && p.state === 'ride' && p.grounded) log.landed = i;
      if (log.landed >= 0 && i > log.landed + 12) break;
    }
    return log;
  };
  {
    // a square block: not a vert
    place(BLOCK.lane, -5);
    p.pos.set(BLOCK.edgeX - 0.9, BLOCK.topY - 1.2, BLOCK.lane * LANE); p.prevPos.copy(p.pos);
    p.state = 'air'; p.grounded = false; p.vVel = 0; p.groundHit = null; p.walkVelocity.set(2.5, 0, 0);
    for (let i = 0; i < 30 && p.state !== 'hang'; i++) step(hold());
    assert.ok(p.state === 'hang' && !p.ledgeOnVert, 'a platform edge is caught as it always was');
    const drop = letGo();
    assert.ok(drop.left >= 0 && drop.left < 22, `the stick away lets go (${drop.left} steps)`);
    assert.ok(drop.wound >= 7 && drop.wound <= 11 && drop.woundMoved < 1e-6, `after a beat on the wall, still on the lip by his hands (${drop.wound} steps, moved ${f2(drop.woundMoved)} m)`);
    assert.ok(drop.hop > 1 && drop.hop < 4 && drop.clip, `with a small hop off it, in the ledge's own let-go (${f2(drop.hop)} m/s up)`);
    assert.ok(drop.turned < 0.06, `he falls still facing the ledge (turned ${f2(drop.turned)} rad at most)`);
    assert.ok(drop.drift > 0.2 && drop.drift < 0.36, `a forearm's push out from the wall and no more: the stick that asked for it does not carry him off (${f2(drop.drift)} m)`);
    // The drawn body. Let go, it used to be put 93 cm higher in a frame (a hang holds the controller point at his
    // chest, a fall under his feet), and landing in the middle of the push-off sat his pelvis on the floor.
    assert.ok(drop.jump < 0.3, `his pelvis is never moved more than a fall moves it (${f2(drop.jump)} m in a step at most)`);
    assert.ok(drop.lowest > 0.6, `and he lands on his feet, not on his seat (pelvis ${f2(drop.lowest)} m over the ground at its lowest)`);
    assert.ok(drop.landed > drop.left && !drop.run && Math.abs(p.pos.y) < 0.06 && p.pos.x < BLOCK.edgeX && p.pos.x > BLOCK.edgeX - 1.2, `and lands at the foot of it (x ${f2(BLOCK.edgeX - p.pos.x)} out)`);
    assert.ok(turnedBy(facing(), drop.hung.yaw) < 0.08 && p.state === 'ride', 'on his feet, facing it still');
    // ...and the stick, let go and pressed again on the way down, is his again
    place(BLOCK.lane, -5);
    p.pos.set(BLOCK.edgeX - 0.9, BLOCK.topY - 1.2, BLOCK.lane * LANE); p.prevPos.copy(p.pos);
    p.state = 'air'; p.grounded = false; p.vVel = 0; p.groundHit = null; p.walkVelocity.set(2.5, 0, 0);
    for (let i = 0; i < 30 && p.state !== 'hang'; i++) step(hold());
    for (let i = 0; i < 40; i++) step(idle());
    let k = 0; const from = p.pos.x;
    for (; k < 30 && p.state === 'hang'; k++) { const input = makeInput(); input.moveX = -1; step(input); }
    step(idle()); step(idle());
    for (let i = 0; i < 4 && p.state === 'air'; i++) { const input = makeInput(); input.moveX = -1; step(input); }
    assert.ok(p.pos.x < from - 0.4 || p.state !== 'air', `a fresh direction steers the fall (${f2(from - p.pos.x)} m)`);
  }
  {
    // over a vert: he drops onto its transition, and that takes him the way the come-up-short does
    const fall = fallAt('grab', 30);
    assert.ok(p.state === 'hang' && p.ledgeOnVert, 'hung from a vert');
    const drop = letGo();
    assert.ok(drop.left >= 0 && drop.wound >= 7 && drop.turned < 0.06 && drop.drift < 0.36, `let go of over a vert: the same beat, hop and drop, facing it (turned ${f2(drop.turned)}, drifted ${f2(drop.drift)})`);
    assert.ok(drop.jump < 0.3, `...and no jump in his pelvis there either (${f2(drop.jump)} m in a step)`);
    assert.ok(drop.run?.outcome === 'miss' && drop.stood === 0, `he comes down on the transition and is not left stood on it (${drop.stood} steps)`);
    assert.ok(drop.beats.join('>') === 'slide>tumble>rise' || drop.beats.join('>') === 'tumble>rise', `it rolls him back off it (${drop.beats.join('>')})`);
    assert.ok(p.state === 'ride' && p.grounded && p.pos.x < WALL_X - 0.3 && Math.abs(p.pos.y) < 0.06, `onto his feet on the flat (${f2(WALL_X - p.pos.x)} m out)`);
    void fall;
  }

  // ---- rolling off a deck into a vert on the board: by how fast the lip is reached ----
  // (`then` scripts the stick and Jump once he is stood on the coping: steps since he got there -> { x, jump })
  const rollUp = (name, speed, then = () => ({ x: -1 }), { limit = 520, pullBack = false, holdTo = 3.0 } = {}) => {
    const [, radius, lipRise] = FIXTURES[lane(name)], lipX = WALL_X + radius, lipY = radius + lipRise, z = lane(name) * LANE;
    level.reset?.(true); p.respawn(level, true, false, { position: new THREE.Vector3(lipX + 5.4, lipY + 0.15, z), heading: new THREE.Vector3(-1, 0, 0) });
    for (let i = 0; i < 20; i++) step(idle());
    const log = { lipX, lipY, rows: [], perch: 0, perchAt: null, still: 0, meter: false, setUp: null, seat: null, lowest: Infinity, bailed: false, out: false, flew: null, landed: null,
      scoreBefore: 0, scoreAfter: 0, spun: 0, backedOut: null, yawAtPerch: null, tipSteps: 0 };
    let placed = false, heldWas = false, since = -1;
    for (let k = 0; k < limit && !log.out; k++) {
      const input = makeInput();
      let x = -1, jump = k < 40;
      if (p.dropInPerch || since >= 0) { since++; const want = then(since, p); x = want.x ?? 0; jump = !!want.jump; }
      else if (pullBack && p.dropInSetup) x = 1;
      input.moveX = x; input.jumpHeld = jump; input.jumpPressed = jump && !heldWas; input.jumpReleased = !jump && heldWas; heldWas = jump;
      // once the mount's own ollie is down: 4.6 m from the lip at the asked speed, held at it until 3 m (the board picks up speed of its own accord after that)
      if (!placed && k > 40 && p.freeSkate && p.grounded && p.state === 'ride') { p.pos.x = lipX + 4.6; p.prevPos.copy(p.pos); p.speed = speed; placed = true; }
      if (placed && since < 0 && p.grounded && p.freeSkate && p.pos.x > lipX + holdTo && !p.groundHit?.halfpipe) p.speed = speed;
      const was = { perch: p.dropInPerch, setUp: p.dropInSetup, x: p.pos.x, grounded: p.grounded, pipe: !!p.groundHit?.halfpipe, tip: p.dropInTipT };
      if (!was.perch && log.perch === 0) log.scoreBefore = p.score ?? 0;
      step(input); p.stepDropInPresentation();
      if (!placed) continue;
      if (p.dropInSetup && !log.setUp) log.setUp = { perch: p.dropInSetup.perch, from: p.pos.x - lipX, v0: p.dropInSetup.v0, vEnd: p.dropInSetup.vEnd, steps: 0 };
      if (p.dropInSetup && log.setUp) log.setUp.steps++;
      if (p.dropInPerch) { log.perch++; log.perchAt ??= p.pos.clone(); log.yawAtPerch ??= p.visualYaw; log.meter ||= p.balanceMeter !== null; log.still = Math.max(log.still, Math.abs(p.speed)); if (p.dropInTipT >= 0) log.tipSteps++; }
      if (!was.pipe && p.groundHit?.halfpipe && p.grounded && !log.seat && !log.flew) { log.seat = { pos: p.pos.clone(), speed: p.speed, board: p.freeSkate, fromPerch: was.perch, lipSpeed: (was.x - p.pos.x) * 60 }; log.scoreAfter = p.score ?? 0; }
      if (was.grounded && !p.grounded && !log.seat && !log.flew && Math.abs(p.pos.x - lipX) < 0.5) log.flew = { x: p.pos.x - lipX, y: p.pos.y - lipY, speed: p.speed, state: p.state };
      if (log.flew && !log.landed && p.grounded) log.landed = { x: p.pos.x, y: p.pos.y, board: p.freeSkate, pipe: !!p.groundHit?.halfpipe };
      if (log.flew && !p.grounded) log.spun = Math.max(log.spun, Math.abs(p.grabSpinAngle));
      if (was.perch && !p.dropInPerch && !p.groundHit?.halfpipe) log.backedOut = { step: k, x: p.pos.x - lipX, speed: p.speed, board: p.freeSkate, yaw: p.visualYaw };
      if (log.seat) log.lowest = Math.min(log.lowest, p.pos.y);
      log.bailed ||= p.isBailing;
      // the picture: where his pelvis and his deck are drawn (the drop-in's own lead included), and the deck's pitch
      const off = p.dropInOffset, hips = world(node('hips')).add(off), nose = new THREE.Vector3(0, 0, 1).applyQuaternion(p.boardG.getWorldQuaternion(new THREE.Quaternion()));
      const wheels = world(p.boardG).add(off), chest = new THREE.Vector3(0, 0, 1).applyQuaternion(node('hips').getWorldQuaternion(new THREE.Quaternion()));
      const stance = world(node('ankleLeft')).distanceTo(world(node('ankleRight')));
      const look = new THREE.Vector3(0, 0, 1).applyQuaternion(node('head').getWorldQuaternion(new THREE.Quaternion()));
      log.rows.push({ k, x: p.pos.x - lipX, y: p.pos.y - lipY, speed: p.speed, hips, wheels, stance, look: Math.atan2(look.x, look.z), facing: Math.atan2(chest.x, chest.z), pitch: Math.atan2(nose.y, Math.hypot(nose.x, nose.z)) * 180 / Math.PI,
        phase: p.dropInPerch ? (p.dropInTipT >= 0 ? 'tip' : 'perch') : p.dropInSetup ? 'set' : p.dropInT >= 0 ? 'in' : log.backedOut ? 'back' : p.grounded ? (p.groundHit?.halfpipe ? 'wall' : 'deck') : 'air' });
      log.out = (!!log.seat && p.grounded && p.pos.x < WALL_X - 2) || (!!log.landed && p.pos.x < WALL_X - 6) || (!!log.backedOut && k > log.backedOut.step + 36);
    }
    return log;
  };
  /** The picture through a drop-in: the biggest change in the pelvis's step, and in the deck's pitch, from one frame to the next (down to the foot of the straight face). */
  const jolt = (log, phases, above = -1.2) => { let hips = 0, pitch = 0, sunk = 0, at = '', atHips = '';
    for (let i = 2; i < log.rows.length; i++) { const a = log.rows[i - 2], b = log.rows[i - 1], c = log.rows[i];
      if (!phases.includes(c.phase) || !phases.includes(b.phase) || !phases.includes(a.phase)) continue;
      // (the foot of a transition lays him level again in a step or two, as it does every rider: that is the pipe's, not the drop-in's)
      if (c.y < above) continue;
      const kick = c.hips.clone().sub(b.hips).sub(b.hips.clone().sub(a.hips)).length();
      if (kick > hips) { hips = kick; atHips = `${b.phase}>${c.phase} at ${c.x.toFixed(2)},${c.y.toFixed(2)}`; }
      const turn = Math.abs((c.pitch - b.pitch) - (b.pitch - a.pitch));
      if (turn > pitch) { pitch = turn; at = `${c.phase} at ${c.x.toFixed(2)},${c.y.toFixed(2)}`; }
      if (c.phase === 'set' || c.phase === 'perch' || c.phase === 'back') sunk = Math.max(sunk, -(c.wheels.y - log.lipY)); }
    return { hips, pitch, sunk, at, atHips }; };
  const LET_GO_THEN = (act) => (since) => since < 30 ? { x: -1 } : since < 40 ? { x: 0 } : act(since - 40);
  for (const name of ['plain quarter', 'grab']) {
    // SLOWLY: he sets his tail on the coping, and waits there to be told
    {
      const roll = rollUp(name, 5, LET_GO_THEN(n => ({ x: 0, jump: n === 60 })), { limit: 700 }), label = `${name}: rolled up to slowly`;
      assert.ok(roll.setUp?.perch && roll.setUp.from > 0.5 && roll.setUp.from < 2.3 && roll.setUp.vEnd < 1.2, `${label}: he is brought to the coping over the last of the deck (${f2(roll.setUp?.from ?? 0)} m of it)`);
      const set = roll.rows.filter(row => row.phase === 'set');
      assert.ok(set.every((row, i) => i === 0 || row.speed <= set[i - 1].speed + 1e-9) && set.every((row, i) => i === 0 || set[i - 1].speed - row.speed < 0.75),
        `${label}: slowing all the way and never checked (${f2(Math.max(...set.map((row, i) => i ? set[i - 1].speed - row.speed : 0)))} m/s in a step at most)`);
      assert.ok(Math.abs(roll.perchAt.x - roll.lipX) < 1e-6 && Math.abs(roll.perchAt.y - roll.lipY) < 1e-6 && roll.still === 0, `${label}: and stops there, at the lip, at rest`);
      assert.ok(roll.perch >= 100 + 8 && roll.perch <= 100 + 12 && roll.tipSteps >= 8 && roll.tipSteps <= 12,
        `${label}: he waits (stick held, stick let go, a hundred steps in all) until Jump, and then leans in for a beat (${roll.perch} steps on the coping, ${roll.tipSteps} of them the lean)`);
      assert.ok(!roll.meter && roll.scoreAfter === roll.scoreBefore, `${label}: it is a wait, not a stall: no needle, no points`);
      const stood = roll.rows.filter(row => row.phase === 'perch'), settled = stood[Math.min(stood.length - 1, 40)], rolling = roll.rows.find(row => row.phase === 'deck');
      assert.ok(settled.pitch > 18 && settled.pitch < 27, `${label}: his tail is down and the nose up over the drop (${f2(settled.pitch)} degrees)`);
      assert.ok(Math.abs(rolling.hips.y - settled.hips.y) < 0.3 && Math.abs(settled.hips.x - roll.lipX) < 0.45,
        `${label}: he stands easy there, his weight at the edge and not out over the drop (${f2(rolling.hips.y - settled.hips.y)} m lower than he rides, ${f2(roll.lipX - settled.hips.x)} m past the lip)`);
      // (the stance: his back foot on the tail and the other a stride up the deck, not out at the far bolts)
      assert.ok(settled.stance < rolling.stance * 1.45 && settled.stance < 1.15 && settled.stance > 0.5,
        `${label}: his feet are about as far apart as he rides (${f2(settled.stance)} m; riding, ${f2(rolling.stance)} m)`);
      const turned = Math.abs(Math.atan2(Math.sin(settled.look - rolling.look), Math.cos(settled.look - rolling.look)));
      assert.ok(turned > 0.3, `${label}: and he is looking down the drop (his head turned ${f2(turned)} rad from where it rides)`);
      assert.ok(roll.seat && roll.seat.fromPerch && roll.seat.board && roll.seat.pos.y < roll.lipY - 0.2 && roll.seat.pos.y > roll.lipY - 0.6 && Math.abs(roll.seat.speed - 4) < 0.01,
        `${label}: then he is on the wall just under it (${roll.seat ? f2(roll.lipY - roll.seat.pos.y) + ' m under, ' + f2(roll.seat.speed) + ' m/s' : 'never'})`);
      // (down a face that stands dead upright as much as down a curve: all of the travel is down the wall)
      assert.ok(roll.out && roll.lowest < 0.05 && !roll.bailed, `${label}: and rides the whole wall down and out along the flat (lowest ${f2(roll.lowest)})`);
      const picture = jolt(roll, ['set', 'perch', 'tip', 'in']);
      assert.ok(picture.hips < 0.13 && picture.pitch < 4 && picture.sunk < 0.02,
        `${label}: nothing in it jolts: his pelvis (${f2(picture.hips)} m, ${picture.atHips}), the deck's pitch (${f2(picture.pitch)} degrees, ${picture.at}) from one frame to the next, the wheels not sunk in the deck (${f2(picture.sunk)} m)`);
    }
    // ...or the stick pressed on into the pipe (pressed afresh: the roll that brought him there asks for nothing)
    {
      const roll = rollUp(name, 5, LET_GO_THEN(n => ({ x: n >= 20 ? -1 : 0 })), { limit: 700 }), label = `${name}: stood on the coping`;
      assert.ok(roll.perch >= 60 + 8 && roll.perch <= 60 + 13 && roll.seat?.fromPerch && !roll.bailed && roll.out, `${label}: the stick pressed on into the pipe drops him in (${roll.perch} steps there)`);
    }
    // ...and the stick pressed back takes him off it, onto the deck, the way he came
    {
      const roll = rollUp(name, 5, LET_GO_THEN(n => ({ x: n >= 20 ? 1 : 0 })), { limit: 700 }), label = `${name}: stood on the coping`;
      assert.ok(roll.backedOut && !roll.seat && !roll.bailed && roll.backedOut.board && roll.backedOut.x > 0 && roll.backedOut.x < 0.1 && roll.backedOut.speed > 1.5 && roll.backedOut.speed < 3.5,
        `${label}: the stick pressed back rolls him off the lip (${roll.backedOut ? f2(roll.backedOut.speed) + ' m/s' : 'never'})`);
      // (it is the stance that changes, so the body that is drawn does not: it is facing where it faced on the coping)
      const last = roll.rows[roll.rows.length - 1], stood = roll.rows.filter(row => row.phase === 'perch').pop();
      const face = Math.max(...roll.rows.filter(row => row.phase === 'back').map(row => Math.abs(Math.atan2(Math.sin(row.facing - stood.facing), Math.cos(row.facing - stood.facing)))));
      assert.ok(last.x > 1.2 && Math.abs(last.y) < 0.02 && face < 0.5, `${label}: back along the deck, tail first: nothing spins him (${f2(last.x)} m off the lip, turned ${f2(face)} at most)`);
      const picture = jolt(roll, ['perch', 'back']);
      assert.ok(picture.hips < 0.13 && picture.pitch < 4 && picture.sunk < 0.02, `${label}: and that is smooth too (${f2(picture.hips)} m, ${f2(picture.pitch)} degrees, ${f2(picture.sunk)} m)`);
    }
    // AT A ROLL: he drops in at once and for good
    for (const [speed, pullBack] of [[12, false], [12, true], [8.6, false], [16.4, false]]) {
      const roll = rollUp(name, speed, undefined, { pullBack }), label = `${name}: rolled into at ${speed} m/s${pullBack ? ', the stick pulled back at the last' : ''}`;
      assert.ok(roll.perch === 0 && !roll.flew && roll.seat && !roll.seat.fromPerch && roll.seat.board, `${label}: no wait: he is on the wall the step he crosses the lip`);
      assert.ok(roll.setUp && !roll.setUp.perch && roll.setUp.from > 1.1 && roll.setUp.from < 2.9 && Math.abs(roll.setUp.vEnd - roll.setUp.v0 * 0.55) < 1e-6,
        `${label}: slowed for it over the last of the deck (${f2(roll.setUp?.from ?? 0)} m, to ${f2(roll.setUp?.vEnd ?? 0)} m/s)`);
      const set = roll.rows.filter(row => row.phase === 'set');
      assert.ok(set.every((row, i) => i === 0 || row.speed <= set[i - 1].speed + 1e-9) && set.every((row, i) => i === 0 || set[i - 1].speed - row.speed < 1.4) && set[set.length - 1].speed > 4,
        `${label}: evenly, and never to a stop (${f2(set[set.length - 1].speed)} m/s at the lip)`);
      assert.ok(roll.seat.speed >= 4.5 - 1e-9 && roll.seat.speed <= 9.5 + 1e-9 && Math.abs(roll.seat.speed - Math.min(9.5, Math.max(4.5, roll.setUp.vEnd))) < 0.5,
        `${label}: and that is the speed he takes into the wall (${f2(roll.seat.speed)} m/s)`);
      assert.ok(roll.out && roll.lowest < 0.05 && !roll.bailed, `${label}: down it and out along the flat`);
      const picture = jolt(roll, ['deck', 'set', 'in']);
      assert.ok(picture.hips < 0.13 && picture.pitch < 4, `${label}: one movement, without a jolt in it (${f2(picture.hips)} m, ${f2(picture.pitch)} degrees)`);
    }
    // (an ollie popped in the last of that set-up is an ollie: the set-up and its stance are over the moment he is off the deck)
    {
      const [, radius, lipRise] = FIXTURES[lane(name)], lipX = WALL_X + radius, lipY = radius + lipRise;
      level.reset?.(true); p.respawn(level, true, false, { position: new THREE.Vector3(lipX + 5.4, lipY + 0.15, lane(name) * LANE), heading: new THREE.Vector3(-1, 0, 0) });
      for (let i = 0; i < 20; i++) step(idle());
      let placed = false, heldWas = false, tapped = -1, stale = 0, aired = 0, perched = false, seated = false;
      for (let k = 0; k < 260 && !(aired > 0 && p.grounded); k++) {
        const input = makeInput(); input.moveX = -1;
        let jump = k < 40;
        if (p.dropInSetup && tapped < 0) tapped = k;
        if (tapped >= 0 && k >= tapped + 2 && k < tapped + 5) jump = true; // a tap of Jump, two steps into the set-up
        input.jumpHeld = jump; input.jumpPressed = jump && !heldWas; input.jumpReleased = !jump && heldWas; heldWas = jump;
        if (!placed && k > 40 && p.freeSkate && p.grounded && p.state === 'ride') { p.pos.x = lipX + 4.6; p.prevPos.copy(p.pos); p.speed = 12; placed = true; }
        if (placed && tapped < 0 && p.grounded && p.pos.x > lipX + 3.0) p.speed = 12;
        step(input); p.stepDropInPresentation();
        // (the set-up itself is dropped at the top of his next step; nothing of it is drawn or owned even in this one)
        if (tapped >= 0 && !p.grounded && p.state === 'air') { aired++; if ((aired > 1 && p.dropInSetup) || p.dropInOwnsRide || p.dropInStancePose > 0 || p.dropInLeanPose > 0) stale++; }
        perched ||= p.dropInPerch; seated ||= p.dropInT >= 0;
      }
      assert.ok(tapped >= 0 && aired > 6 && stale === 0 && !perched && !seated, `${name}: Jump tapped in the set-up pops an ollie, and nothing of the drop-in follows him into the air (${aired} steps of air, ${stale} with it)`);
    }
    // FLAT OUT: he is not dropping in at all. Off the edge, into the air, and over the curve
    for (const speed of [17.4, 21]) {
      const roll = rollUp(name, speed), label = `${name}: rolled off at ${speed} m/s`;
      assert.ok(roll.perch === 0 && !roll.seat && !roll.setUp && roll.flew && roll.flew.state === 'air' && Math.abs(roll.flew.y) < 0.05 && roll.flew.x < 0 && Math.abs(roll.flew.speed - speed) < 0.5,
        `${label}: he leaves the lip in the air, level, with all of his speed (${roll.flew ? f2(roll.flew.speed) + ' m/s' : 'never'})`);
      assert.ok(roll.landed && roll.landed.board && !roll.landed.pipe && roll.landed.x < WALL_X - 0.5 && Math.abs(roll.landed.y) < 0.05 && !roll.bailed,
        `${label}: clears the curve and comes down on the flat beyond it, on his board (${roll.landed ? f2(WALL_X - roll.landed.x) + ' m past its foot' : 'never'})`);
      assert.ok(roll.spun < 1e-6, `${label}: the stick that was rolling him there spins nothing (${f2(roll.spun)})`);
    }
    // (a slow roll is one under 8 m/s as the set-up begins: this one perches, the 8.6 above did not)
    {
      const roll = rollUp(name, 7.4, () => ({ x: -1 }), { limit: 260, holdTo: 2.2 });
      assert.ok(roll.perch > 60 && !roll.seat && !roll.flew, `${name}: at 7.4 m/s he still stops on the coping, and the stick he arrived holding leaves him there (${roll.perch} steps)`);
    }
  }
  // (On foot the same lip is met the same way, at any pace: on the board at the coping, and waiting. Below,
  // under "ON FOOT, to a lip along its deck".)

  // ---- and on the board, a quarter is a pipe: up it, into its air, and out over its lip ----
  {
    const [, radius, lipRise] = FIXTURES[lane('plain quarter')], lipX = WALL_X + radius, lipY = radius + lipRise, z = lane('plain quarter') * LANE;
    level.reset?.(true); p.respawn(level, true, false, { position: new THREE.Vector3(-8, 0.15, z), heading: new THREE.Vector3(1, 0, 0) });
    for (let i = 0; i < 20; i++) step(idle());
    let hang = 0, heldWas = false, aired = false, popped = false;
    for (let k = 0; k < 600; k++) {
      const input = makeInput(); input.moveX = 1;
      let held = k < 40 || (p.freeSkate && p.grounded && !!p.groundHit?.halfpipe && p.lastTy > 0.05); // push off, then pump the wall
      hang = p.vertAir ? hang + 1 : 0;
      aired ||= p.vertAir && p.hangPipe !== null;
      if (hang >= 3 && hang < 7) { held = true; popped = true; } // the spine transfer's input: the stick out over the lip, and Jump
      input.jumpHeld = held; input.jumpPressed = held && !heldWas; input.jumpReleased = !held && heldWas; heldWas = held;
      step(input);
      if (popped && p.grounded && p.pos.x > lipX + 0.5) break;
    }
    assert.ok(aired, 'ridden at on the board, the quarter throws him into its own air over the coping');
    assert.ok(popped && p.grounded && p.pos.x > lipX + 0.5 && Math.abs(p.pos.y - lipY) < 0.1, `the stick over the lip and Jump carries that air out onto its deck (x ${f2(p.pos.x - lipX)} past the lip, y ${f2(p.pos.y)})`);
  }

  // ---- ON FOOT, to a lip along its deck: he gets on his board AT the coping, and waits -----------------
  // A runner used to be put straight on the wall, rolling, the moment he crossed the lip. Now the last of
  // the deck slows him to the pace a slow roll comes onto a coping at; there his board is under him with
  // its tail set on the coping, and he waits: Jump, or the stick pressed afresh, drops him in, and the
  // stick pressed back rolls him off the lip. The direction he ran up holding asks for nothing.
  const walkUp = (name, pace, then = () => ({ x: -1 }), { limit = 900, jumpAt = null, from = 5.4 } = {}) => {
    const [, radius, lipRise] = FIXTURES[lane(name)], lipX = WALL_X + radius, lipY = radius + lipRise, z = lane(name) * LANE;
    level.reset?.(true); p.respawn(level, true, false, { position: new THREE.Vector3(lipX + from, lipY + 0.15, z), heading: new THREE.Vector3(-1, 0, 0) });
    for (let i = 0; i < 20; i++) step(idle());
    const log = { lipX, lipY, rows: [], perch: 0, perchAt: null, still: 0, meter: false, seat: null, backedOut: null, out: false, bailed: false, tipSteps: 0, mountedAt: null,
      fastest: 0, hardest: 0, arrived: null, lowest: Infinity, airOverLip: false, footAfter: null, scoreBefore: p.score ?? 0, scoreAfter: 0 };
    let heldWas = false, since = -1, closingWas = 0;
    for (let k = 0; k < limit && !log.out; k++) {
      const input = makeInput();
      let x = -pace, jump = jumpAt !== null && p.grounded && !p.freeSkate && p.pos.x < lipX + jumpAt && p.pos.x > lipX + jumpAt - 0.5;
      if (p.dropInPerch || since >= 0) { since++; const want = then(since, p); x = want.x ?? 0; jump = !!want.jump; }
      input.moveX = x; input.jumpHeld = jump; input.jumpPressed = jump && !heldWas; input.jumpReleased = !jump && heldWas; heldWas = jump;
      const was = { perch: p.dropInPerch, x: p.pos.x, free: p.freeSkate, grounded: p.grounded, pipe: !!p.groundHit?.halfpipe };
      step(input); p.stepDropInPresentation();
      const closing = (was.x - p.pos.x) * 60;
      if (!was.free && !p.freeSkate && was.grounded && p.grounded) { log.fastest = Math.max(log.fastest, closing); log.hardest = Math.max(log.hardest, closingWas - closing); }
      closingWas = closing;
      if (!was.free && p.freeSkate && !log.mountedAt) { log.mountedAt = { x: p.pos.x - lipX, y: p.pos.y - lipY, perch: p.dropInPerch, pipe: !!p.groundHit?.halfpipe, closing: (was.x - lipX) > 0 ? closing : 0 }; log.arrived = closing; }
      if (p.dropInPerch) { log.perch++; log.perchAt ??= p.pos.clone(); log.meter ||= p.balanceMeter !== null; log.still = Math.max(log.still, Math.abs(p.speed)); if (p.dropInTipT >= 0) log.tipSteps++; }
      if (!was.pipe && p.groundHit?.halfpipe && p.grounded && !log.seat) { log.seat = { pos: p.pos.clone(), speed: p.speed, board: p.freeSkate, fromPerch: was.perch }; log.scoreAfter = p.score ?? 0; }
      if (was.perch && !p.dropInPerch && !p.groundHit?.halfpipe) log.backedOut = { step: k, x: p.pos.x - lipX, speed: p.speed, board: p.freeSkate };
      if (log.backedOut && !p.freeSkate && !log.footAfter) log.footAfter = { steps: k - log.backedOut.step, x: p.pos.x - lipX };
      if (!p.grounded && Math.abs(p.pos.x - lipX) < 0.4 && p.pos.y > lipY + 0.3) log.airOverLip = true;
      if (log.seat) log.lowest = Math.min(log.lowest, p.pos.y);
      log.bailed ||= p.isBailing;
      const off = p.dropInOffset, hips = world(node('hips')).add(off), nose = new THREE.Vector3(0, 0, 1).applyQuaternion(p.boardG.getWorldQuaternion(new THREE.Quaternion()));
      log.rows.push({ k, x: p.pos.x - lipX, y: p.pos.y - lipY, speed: p.speed, hips, wheels: world(p.boardG).add(off), pitch: Math.atan2(nose.y, Math.hypot(nose.x, nose.z)) * 180 / Math.PI,
        phase: p.dropInPerch ? (p.dropInTipT >= 0 ? 'tip' : 'perch') : p.dropInT >= 0 ? 'in' : !p.freeSkate ? (p.grounded ? 'foot' : 'air') : p.groundHit?.halfpipe ? 'wall' : 'deck' });
      log.out = (!!log.seat && p.grounded && p.pos.x < WALL_X - 2) || (!!log.backedOut && k > log.backedOut.step + 400) || (log.airOverLip && p.grounded && k > 200);
    }
    return log;
  };
  for (const name of ['plain quarter', 'grab']) {
    // AT A RUN, the stick held all the way and never let go: slowed, on the board at the coping, and waiting
    {
      const run = walkUp(name, 1, since => ({ x: since < 90 ? -1 : 0, jump: since >= 100 && since < 103 })), label = `${name}: run up to on foot`;
      assert.ok(run.fastest > 8.5, `reference: ${label}: he is at a full run along the deck (${f2(run.fastest)} m/s)`);
      assert.ok(run.mountedAt && run.mountedAt.perch && !run.mountedAt.pipe && Math.abs(run.mountedAt.x) < 1e-6 && Math.abs(run.mountedAt.y) < 1e-6,
        `${label}: he gets on his board at the coping, not on the wall under it (${run.mountedAt ? f2(run.mountedAt.x) + ', ' + f2(run.mountedAt.y) + (run.mountedAt.pipe ? ' on the wall' : '') : 'never mounted'})`);
      assert.ok(run.arrived !== null && run.arrived < 2.2 && run.hardest < 0.45,
        `${label}: and he arrives at it: slowed over the last of the deck (${f2(run.arrived)} m/s at the lip, never losing more than ${f2(run.hardest)} m/s in a step)`);
      assert.ok(run.still === 0 && !run.meter, `${label}: at rest there, with no needle`);
      assert.ok(run.perch >= 100 + 8 && run.perch <= 100 + 12 && run.tipSteps >= 8 && run.tipSteps <= 12,
        `${label}: the stick he ran up holding asks for nothing: he waits, a second and a half with it held and then let go, until Jump (${run.perch} steps on the coping, ${run.tipSteps} of them the lean)`);
      assert.ok(run.seat && run.seat.fromPerch && run.seat.board && Math.abs(run.seat.speed - 4) < 0.01 && !run.bailed && run.out && run.lowest < 0.05,
        `${label}: then he is on the wall just under it and rides it down and out (${run.seat ? f2(run.seat.speed) + ' m/s' : 'never'})`);
      assert.equal(run.scoreAfter, run.scoreBefore, `${label}: it is a wait, not a stall: no points`);
      // the picture: the run slows, the board comes under him and the tail goes down, in one movement
      const picture = jolt(run, ['foot', 'perch', 'tip', 'in']);
      assert.ok(picture.hips < 0.16 && picture.sunk < 0.02,
        `${label}: nothing in it jolts: his pelvis (${f2(picture.hips)} m, ${picture.atHips}) from one frame to the next, the wheels not sunk in the deck (${f2(picture.sunk)} m)`);
    }
    // ...the stick let go and pressed on again drops him in; pressed back, it rolls him off the lip, and left alone there he is on his feet again
    {
      const on = walkUp(name, 1, since => ({ x: since < 30 ? -1 : since < 40 ? 0 : -1 })), label = `${name}: run up to on foot`;
      assert.ok(on.perch >= 40 + 8 && on.perch <= 40 + 13 && on.seat?.fromPerch && !on.bailed && on.out, `${label}: the stick let go and pressed on again drops him in (${on.perch} steps there)`);
      // ...and pressed back, he steps back off the board onto his feet where he stood (he walked up: he is back as he was)
      const back = walkUp(name, 1, (since, rider) => ({ x: since < 30 ? -1 : since < 40 ? 0 : since < 44 ? 1 : 0 }));
      assert.ok(back.backedOut && !back.seat && !back.bailed, `${label}: the stick pressed back takes him off the coping`);
      assert.ok(back.footAfter && back.footAfter.steps <= 2 && back.footAfter.x > 0 && back.footAfter.x < 0.6,
        `${label}: and he is off the board, on his feet, at the edge he walked up to (${back.footAfter ? back.footAfter.steps + ' steps, ' + f2(back.footAfter.x) + ' m from the lip' : 'still on the board'})`);
      // (measured to a quarter of a second after he is off it: what he does next on his feet is his walk's own)
      const stepped = jolt({ ...back, rows: back.rows.filter(row => row.k <= back.backedOut.step + 15) }, ['foot', 'perch']);
      assert.ok(stepped.hips < 0.16, `${label}: stepping on and stepping off, his pelvis never jumps (${f2(stepped.hips)} m, ${stepped.atHips})`);
    }
    // AT A WALK the same thing, with hardly any slowing to do
    {
      const walk = walkUp(name, 0.4, since => ({ x: 0, jump: since >= 40 && since < 43 }), { from: 2.6 }), label = `${name}: walked up to`;
      assert.ok(walk.fastest > 2 && walk.fastest < 5 && walk.mountedAt?.perch && walk.seat?.fromPerch && !walk.bailed && walk.out, `${label}: he gets on at the coping, waits, and Jump drops him in (walking at ${f2(walk.fastest)} m/s)`);
    }
    // A JUMP thrown from the deck is not an arrival: over the lip in the air he is in the air, on foot
    {
      const leapt = walkUp(name, 1, () => ({ x: -1 }), { jumpAt: 2.6, limit: 260 }), label = `${name}: jumped off the deck`;
      assert.ok(leapt.airOverLip && leapt.perch === 0 && !leapt.mountedAt, `${label}: over the lip in the air he is not sat on it (perched ${leapt.perch} steps${leapt.mountedAt ? ', mounted' : ''})`);
    }
  }
  // ---- on the board, a hang comes back to the wall it left ------------------------------------
  // Up the wall and into its air, with nothing pressed but the stick. Off a curve the line he rises
  // and falls on runs into the wall under him, and he crosses it coming down. Off a face that stands
  // dead straight (a hang begins as far as 1.2 m under a lip: with more straight wall than that it
  // begins on the face) that line is the face's own plane, and the edge of the deck behind the lip
  // is on it. A ray down it found that edge. He came down on it and was stood on the deck for a step
  // (the deck drawn 58° round in that step and 0.93 m from where it had been against his hips), was
  // lifted onto it from just under the lip, or was stopped under it on the way up; and from the deck
  // he was off his board, and walked off the back of it.
  /** The drawn deck: where it is, the line it lies along and the way its grip faces, read off what is drawn
   *  (in the air the deck is squashed and stretched a little: a rotation taken out of that is not one). */
  const deckDrawn = () => { const at = world(p.boardG).add(p.dropInOffset), drawn = p.boardG.matrixWorld;
    return { at, nose: new THREE.Vector3(0, 0, 1).transformDirection(drawn), grip: new THREE.Vector3(0, 1, 0).transformDirection(drawn) }; };
  /** From one frame to the next: how far that deck turned (its nose and its tail are one line: he comes down
   *  a wall tail first, and it is his stance that changes, not the deck), and how far it moved against his hips. */
  const stepOf = (a, b) => { const line = a.nose.angleTo(b.nose);
    return { turn: Math.max(a.grip.angleTo(b.grip), Math.min(line, Math.PI - line)) * 180 / Math.PI, slip: b.at.clone().sub(b.hips).sub(a.at.clone().sub(a.hips)).length() }; };
  const hangAt = (name, speed, { pop = false, stickFree = false } = {}) => {
    const [, radius, lipRise] = FIXTURES[lane(name)], lipX = WALL_X + radius, lipY = radius + lipRise, z = lane(name) * LANE;
    level.reset?.(true); p.respawn(level, true, false, { position: new THREE.Vector3(-8, 0.15, z), heading: new THREE.Vector3(1, 0, 0) });
    for (let i = 0; i < 20; i++) step(idle());
    const log = { lipRise, rows: [], launch: null, apex: -Infinity, met: null, deckSteps: 0, board: true, bailed: false, down: false, popped: -1, landed: null };
    let placed = false, heldWas = false, hang = 0;
    for (let k = 0; k < 460; k++) {
      const input = makeInput();
      // (pushed off, the stick let go through the mount's own ollie, then held at the wall: up it, and out over its lip)
      input.moveX = !placed ? (k <= 40 ? 1 : 0) : stickFree && log.launch ? 0 : 1;
      let jump = k < 40;
      hang = p.vertAir ? hang + 1 : 0;
      if (pop && hang >= 3 && hang < 7) jump = true; // the pop-out's input: Jump in the hang, with the stick out over the lip
      input.jumpHeld = jump; input.jumpPressed = jump && !heldWas; input.jumpReleased = !jump && heldWas; heldWas = jump;
      if (!placed && k > 40 && p.freeSkate && p.grounded && p.state === 'ride') { p.pos.x = WALL_X - 3; p.prevPos.copy(p.pos); p.speed = speed; placed = true; }
      const was = { vert: p.vertAir, y: p.pos.y, vV: p.vVel };
      step(input); p.stepDropInPresentation();
      if (!placed) continue;
      const onDeck = p.grounded && !!p.groundHit?.mesh?.userData.pipeDeck, onWall = p.grounded && !!p.groundHit?.halfpipe, n = log.rows.length;
      if (!was.vert && p.vertAir && !log.launch) log.launch = { x: p.pos.x - lipX, y: p.pos.y - lipY, vV: p.vVel };
      if (p.vertAir) log.apex = Math.max(log.apex, p.pos.y - lipY);
      if (log.launch && !log.met && log.popped < 0 && was.vert && p.grounded)
        log.met = { step: n, wall: onWall, x: p.pos.x - lipX, y: p.pos.y - lipY, moved: p.pos.y - was.y, fall: was.vV, speed: p.speed, heading: p.axisF.x };
      if (log.launch && log.popped < 0 && was.vert && !p.vertAir && !p.grounded) log.popped = n;
      if (log.popped >= 0 && !log.landed && p.grounded) log.landed = { step: n, x: p.pos.x - lipX, y: p.pos.y - lipY, deck: onDeck, board: p.freeSkate };
      if (log.launch && log.popped < 0) { if (onDeck) log.deckSteps++; log.board &&= p.freeSkate; }
      log.bailed ||= p.isBailing;
      log.down ||= !!log.met && p.grounded && p.freeSkate && p.pos.x < WALL_X - 0.5 && Math.abs(p.pos.y) < 0.05;
      // (lying: how far over onto the wall the whole of him is laid, 1 along it and 0 on his wheels)
      log.rows.push({ y: p.pos.y - lipY, vV: p.vVel, vert: p.vertAir, wall: onWall, hips: world(node('hips')).add(p.dropInOffset), ...deckDrawn(), lying: p.alignPose });
      if (log.down || (log.landed && n > log.landed.step + 12)) break;
    }
    return log;
  };
  /** The hang's way back: from its top to the wall, and down as much of that wall as stands straight. */
  const wayBack = hang => { const top = hang.rows.findIndex(row => row.vert && row.vV <= 0);
    let end = hang.met.step + 1; while (end < hang.rows.length && hang.rows[end].wall && hang.rows[end].y >= -hang.lipRise) end++;
    let turn = 0, slip = 0;
    for (let i = Math.max(1, top); i < end; i++) { const moved = stepOf(hang.rows[i - 1], hang.rows[i]); turn = Math.max(turn, moved.turn); slip = Math.max(slip, moved.slip); }
    return { turn, slip, steps: end - top }; };
  const returns = [];
  for (const [name, speed, tops, stickFree] of [['extended', 14, 'well under the lip'], ['extended', 14.5, 'just under the lip'], ['extended', 15, 'just over the lip'],
    ['extended', 16, 'over the lip'], ['extended', 16, 'over the lip', true], ['extended', 18, 'over the lip'], ['grab', 18.5, 'over the lip']]) {
    const hang = hangAt(name, speed, { stickFree }), label = `${name} ridden at on the board at ${speed} m/s${stickFree ? ', the stick let go in the hang' : ''}`;
    assert.ok(hang.launch && Math.abs(hang.launch.x) < 1e-6 && hang.launch.y > -hang.lipRise && hang.launch.y < -0.9,
      `${label}: reference: he leaves its straight face in a hang, ${hang.launch ? f2(-hang.launch.y) + ' m under the lip' : 'never'}`);
    // (the three ways the deck's edge used to get him: from on top; from a hand under it; from a head's height under it)
    const reached = tops === 'well under the lip' ? hang.apex < -0.5 && hang.launch.vV < 6.5 : tops === 'just under the lip' ? hang.apex < 0 && hang.apex > -0.35
      : tops === 'just over the lip' ? hang.apex > 0 && hang.apex < 0.12 : hang.apex > 0.5;
    assert.ok(reached, `${label}: reference: that hang tops out ${tops} (${f2(hang.apex)} m over it, from ${f2(hang.launch.vV)} m/s up)`);
    assert.equal(hang.deckSteps, 0, `${label}: no step of it is spent on the deck`);
    assert.ok(hang.met?.wall && Math.abs(hang.met.x) < 1e-6 && hang.met.y <= 1e-9 && hang.met.y > -hang.lipRise,
      `${label}: the face he left meets him, under its lip (${hang.met ? f2(-hang.met.y) + ' m under' : 'never'})`);
    assert.ok(hang.met.y > Math.min(0, hang.apex) - 0.25, `${label}: as soon as he is coming down it (${f2(Math.min(0, hang.apex) - hang.met.y)} m on from where he was first level with it)`);
    assert.ok(hang.met.moved <= 1e-9 && hang.met.moved > -(Math.abs(hang.met.fall) + 1) / 60 - 0.005,
      `${label}: at his own height: he is not lifted and not dropped (${f2(hang.met.moved)} m in that step, falling at ${f2(hang.met.fall)} m/s)`);
    assert.ok(hang.met.heading < -0.99 && hang.met.speed > 0.5 && hang.met.speed > Math.abs(hang.met.fall) - 0.05 && hang.met.speed < Math.abs(hang.met.fall) + 1.2,
      `${label}: his fall is turned down the wall (${f2(hang.met.speed)} m/s down it, from ${f2(hang.met.fall)})`);
    assert.ok(hang.board && !hang.bailed && hang.down, `${label}: and he rides it down and out along the flat, on his board`);
    const picture = wayBack(hang);
    assert.ok(picture.steps > 2 && picture.turn < 4 && picture.slip < 0.15,
      `${label}: it is one movement: no frame of the way back turns the deck by more than ${f2(picture.turn)}° or moves it more than ${f2(picture.slip)} m against his hips (${picture.steps} frames)`);
    returns.push(`${speed}${stickFree ? ' let go' : ''}: ${f2(-hang.met.y)} m under, ${f2(picture.turn)}°, ${f2(picture.slip)} m`);
  }
  // (reference: off a curve the same hang comes back to the place it left, as it always did)
  { const hang = hangAt('plain quarter', 14), picture = wayBack(hang);
    assert.ok(hang.launch.x < -0.05 && hang.met?.wall && Math.abs(hang.met.y - hang.launch.y) < 0.05 && hang.deckSteps === 0 && hang.down,
      `plain quarter: reference: a hang off a curve crosses the curve where it left it (left ${f2(-hang.launch.y)} m under the lip, met ${f2(-hang.met.y)} m under)`);
    // (the deck has the last of the curve to lie over onto as it lands: a straight face asks for less)
    assert.ok(picture.turn < 7 && picture.slip < 0.15, `plain quarter: reference: and is drawn back onto it in one movement too (${f2(picture.turn)}°, ${f2(picture.slip)} m)`); }

  // ---- ...and popped out over the lip, that air begins as slowly as the hang ended ----------------
  // In the hang the whole of him lies along the wall; the air out over the lip is a level one that lands
  // on its wheels. He was two fifths of the way upright in the first frame of it (the deck 36° round, his
  // hips 1.03 m from where they had been against it). He comes up on a curve now: eased in, timed to the
  // air he has, and on his wheels by the time they are down.
  const pops = [];
  for (const [name, speed, air] of [['plain quarter', 14, 'long'], ['extended', 17, 'long'], ['extended', 15.3, 'short']]) {
    const out = hangAt(name, speed, { pop: true }), label = `${name} popped out of at ${speed} m/s`;
    assert.ok(out.popped > 1 && out.landed && out.landed.deck && out.landed.board && out.landed.x > 0.5 && Math.abs(out.landed.y) < 0.05 && !out.bailed,
      `${label}: reference: Jump in the hang with the stick over the lip carries him out onto the deck, on his board`);
    const flown = out.landed.step - out.popped;
    assert.ok(air === 'long' ? flown >= 20 : flown >= 8 && flown <= 14, `${label}: reference: a ${air} air (${flown} steps of it)`);
    assert.ok(out.rows[out.popped - 1].lying > 0.95, `${label}: reference: in the hang he lies along the wall (${f2(out.rows[out.popped - 1].lying)})`);
    const steps = []; for (let i = out.popped - 1; i < out.rows.length; i++) steps.push(stepOf(out.rows[i - 1], out.rows[i]));
    // (steps[0] is the last step of the hang; steps[1] the first of the air)
    const first = steps.slice(1, air === 'long' ? 4 : 2);
    assert.ok(first.every(moved => moved.turn < 4 && moved.slip < 0.15),
      `${label}: the first of that air turns the deck no more than ${f2(Math.max(...first.map(moved => moved.turn)))}° in a frame and moves it no more than ${f2(Math.max(...first.map(moved => moved.slip)))} m against his hips`);
    let jerk = 0, lurch = 0;
    for (let i = 1; i < steps.length; i++) { jerk = Math.max(jerk, Math.abs(steps[i].turn - steps[i - 1].turn)); lurch = Math.max(lurch, Math.abs(steps[i].slip - steps[i - 1].slip)); }
    const most = Math.max(...steps.map(moved => moved.turn));
    assert.ok(jerk < 5 && lurch < 0.1 && most < 11,
      `${label}: and from there to the deck no frame is unlike the one before it (the turn changes by ${f2(jerk)}° at most, the board against his hips by ${f2(lurch)} m; ${f2(most)}° is the most it turns in one)`);
    const up = out.rows.findIndex((row, i) => i >= out.popped && row.lying < 0.01) - out.popped + 1;
    assert.ok(up >= 10 && up <= 18 && (air === 'short' ? up <= 11 : up >= 17), `${label}: he comes up over ${f2(up / 60)} s: as long as it takes, in a ${air} air`);
    assert.ok(out.rows[out.landed.step].lying < 0.05, `${label}: and is on his wheels by the time they are down (${f2(out.rows[out.landed.step].lying)} of the way over, ${flown} steps after the pop)`);
    pops.push(`${speed}: ${f2(first[0].turn)}°, ${f2(first[0].slip)} m, up in ${f2(up / 60)} s of ${f2(flown / 60)}`);
  }
  console.log(`a hang back onto a straight face: ${returns.join('; ')}`);
  console.log(`a pop-out's first frame: ${pops.join('; ')}`);

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
