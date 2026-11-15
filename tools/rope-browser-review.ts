// Local-only review of the swing-rope suite. No saved suite, level, tuning or campaign writes.
//
// /rope-review.html?playtest&level=codex-lab&nocrt [&len=7&amp=.85&yaw=90&anchor=10]
//
// The page builds one rope over a floor and runs the real player step against it, so the catch, the hang, the climb,
// both releases and the landing are the game's own. It plays with the game's own controls; the panel (or `play()`)
// runs each move for you, at any speed; and `window.__ropeReview` drives it from a script, one fixed step at a time,
// with the swing frozen at any angle and the camera anywhere.
import * as THREE from 'three';
import { Level } from '../src/level';
import * as ropeGeometry from '../src/ropeGeometry';
import { createPlayerStarterAnimationSuite, RigBinding } from '../src/animation';

const g: any = await new Promise(resolve => { const poll = () => {
  const game = (window as any).__game; if (game) resolve(game); else requestAnimationFrame(poll);
}; poll(); });
const p = g.player, runtime = g.characterAnimationRuntime;
runtime.setDocument(createPlayerStarterAnimationSuite(RigBinding.fromSculptRuntime(p.animationRig.root).definition));

const query = new URLSearchParams(location.search), num = (key: string, fallback: number) => query.has(key) ? Number(query.get(key)) : fallback;
const LEN = num('len', 7), AMP = num('amp', .85), YAW = num('yaw', 90), ANCHOR_Y = num('anchor', 8.8), ROPE_Z = -10;
const fixture = new Level(g.scene, { id: 'rope-review', name: 'Rope review', data: {
  v: 1, name: 'Rope review', spawn: [0, .2, 4], killY: -80, components: [
    { t: 'platform', p: [0, -.5, -10], s: [30, 1, 70], tex: 'stone', color: '#8e98a8' },
    { t: 'ropeswing', p: [0, ANCHOR_Y, ROPE_Z], len: LEN, amp: AMP, speed: 0, phase: 0, yaw: YAW },
    { t: 'gate', p: [0, 0, -44] },
  ],
} });
// The game's own level stays loaded but out of the picture.
try { const own = g.getLevel?.(); if (own?.root) own.root.visible = false; } catch { /* review only */ }
const rope = fixture.ropeSwings[0];
// The rope as it is drawn (a body passing through it pushes it aside); on a build without that, the rope's own curve.
const drawnLocal: (rs: any, d: number, out: THREE.Vector3) => THREE.Vector3 = (ropeGeometry as any).drawnRopeLocalPoint ?? ropeGeometry.ropeLocalPoint;
const drawn: (rs: any, d: number, out: THREE.Vector3) => THREE.Vector3 = (ropeGeometry as any).drawnRopePoint ?? ropeGeometry.flexibleRopePoint;

type Over = Record<string, number | boolean>;
const makeInput = (over: Over = {}) => ({ moveX: 0, moveY: 0, jumpHeld: false, jumpPressed: false, jumpReleased: false,
  grindHeld: false, grindPressed: false, spinHeld: false, spinPressed: false, grabHeld: false, grabPressed: false,
  transferHeld: false, transferPressed: false, restartPressed: false, consumeEdges() {}, ...over });

let manual = false, frozen: number | null = null, climb = 0, hold = false, wasHeld = false, frames = 0, speed = 1, forward = 0;
const view = { mode: 'follow' as 'follow' | 'body' | 'world' | 'game', yaw: 90, dist: 6.5, height: 1.2, eye: new THREE.Vector3(9, 5, ROPE_Z), target: new THREE.Vector3(0, 4.5, ROPE_Z) };
const realStep = p.step.bind(p);

/** Hold the pendulum at one angle (radians), flex and sway at rest; null lets it swing. */
function applyFreeze(): void {
  if (frozen === null) return;
  rope.theta = frozen; rope.thetaV = 0; rope.bend = 0; rope.bendV = 0; rope.sway = 0; rope.swayV = 0;
  rope.visual.update((d: number, out: THREE.Vector3) => drawnLocal(rope, d, out));
}
/** One fixed step of the real game against the fixture. Jump edges follow `hold` unless given. */
function tick(dt = 1 / 60, over: Over = {}): void {
  const held = 'jumpHeld' in over ? !!over.jumpHeld : hold;
  fixture.update(dt); applyFreeze();
  realStep(dt, makeInput({ moveY: climb, jumpHeld: held, jumpPressed: held && !wasHeld, jumpReleased: !held && wasHeld, ...over }), fixture);
  wasHeld = held; frames++;
}
/** The same step with the game's own controls, the panel's held keys laid over them, at the review's speed. */
function live(dt: number, input: any): void {
  const held = hold || !!input?.jumpHeld, over: Over = { jumpHeld: held, jumpPressed: held && !wasHeld, jumpReleased: !held && wasHeld };
  if (climb !== 0 || forward !== 0) over.moveY = climb !== 0 ? climb : forward;
  fixture.update(dt * speed); applyFreeze();
  realStep(dt * speed, input ? new Proxy(input, { get: (target, key) => key in over ? over[key as string] : Reflect.get(target, key) }) : makeInput(over), fixture);
  wasHeld = held; frames++;
}
p.step = (dt: number, input: any) => { if (!manual) live(dt, input); };

/** Start the swing from the bottom of its arc, moving the way `sign` says, at the fixture's present time. */
function swingFromBottom(sign = 1): void { frozen = null; rope.phase = (sign > 0 ? 0 : Math.PI) - fixture.time * rope.speed; }
/** Stand the player on the floor, facing the rope. */
function stand(z = 4): void {
  p.respawn(fixture, true, false, { position: new THREE.Vector3(0, .14, z), heading: new THREE.Vector3(0, 0, -1) });
  runtime.restart(); wasHeld = false; hold = false; climb = 0;
}
/** Put the player on the rope `d` metres below the anchor, as a catch from a jump along -Z. */
function catchRope(d = LEN - 2.2): void {
  stand(); fixture.update(0); applyFreeze();
  fixture.ropePointAt(rope, d, p.pos); p.pos.y -= 1; p.prevPos.copy(p.pos);
  p.state = 'air'; p.grounded = false; p.axisF.set(0, 0, -1); p.axisL.set(1, 0, 0); p.lastVelX = 0; p.lastVelZ = -9; p.speed = 0; p.vVel = -1;
  p.ropeCoolT = 0; p.tryRopeGrab(fixture); runtime.restart();
}
/**
 * Run at the rope, ready to jump into it: the real approach, with the real air pose before the catch. The run and
 * the jump are flown once with the rope out of reach to find where the jump goes; then the swing is phased so the
 * rope crosses the chest `lead` frames before the top of the jump, travelling the way `sign` says, and the run is
 * made again up to the frame before take-off. Carry on with `jumpFrame(n)`.
 */
const JUMP_HOLD = 16;
function prepareJump(sign = -1, runFrames = 30, from = 9.5, lead = 6, run = true): { meet: number; theta: number; d: number } {
  const approach = () => { stand(ROPE_Z + from); for (let i = 0; i < 20; i++) tick(1 / 60); for (let i = 0; i < runFrames; i++) tick(1 / 60, { moveY: 1 }); };
  frozen = null; approach(); p.ropeCoolT = 99;
  const path: THREE.Vector3[] = [];
  for (let n = 0; n < 90; n++) { tick(1 / 60, { moveY: 1, jumpHeld: n < JUMP_HOLD }); p.ropeCoolT = 99; path.push(p.pos.clone()); if (n > JUMP_HOLD + 8 && p.grounded) break; }
  let top = 0; for (let n = 1; n < path.length; n++) if (path[n].y > path[top].y) top = n;
  const meet = Math.max(2, top - lead), chest = path[meet].clone(); chest.y += 1;
  // The rope point that should be at the chest then, as a distance down the rope and a swing angle (swing plane along Z).
  const dy = rope.anchor.y - chest.y, dz = chest.z - rope.anchor.z, d = Math.min(LEN - .5, Math.hypot(dy, dz));
  const theta = THREE.MathUtils.clamp(Math.atan2(-dz, dy), -AMP * .97, AMP * .97), a = Math.asin(theta / AMP);
  const when = fixture.time + (20 + runFrames + meet + 1) / 60;
  stand(ROPE_Z + from); p.ropeCoolT = 0;
  rope.phase = (sign > 0 ? a : Math.PI - a) - when * rope.speed;
  // (With `run` off the run-up is left to the caller, to be played out a frame at a time: 20 standing, then running.)
  if (run) { for (let i = 0; i < 20; i++) tick(1 / 60); for (let i = 0; i < runFrames; i++) tick(1 / 60, { moveY: 1 }); }
  return { meet, theta: +theta.toFixed(3), d: +d.toFixed(2) };
}
/** Frame `n` of the jump begun by `prepareJump`: forward held until the hands are on the rope. */
function jumpFrame(n: number, dt = 1 / 60): ReturnType<typeof info> { tick(dt, { moveY: p.state === 'rope' ? 0 : 1, jumpHeld: n < JUMP_HOLD && p.state !== 'rope' }); return info(); }

// ---- Measurements ------------------------------------------------------------------------------------------------
const ROPE_RADIUS = .105;
const CLIP_PARTS: [RegExp, string][] = [[/head/, 'head'], [/torso/, 'torso'], [/shorts/, 'shorts'], [/hand/, 'hand'],
  [/upper-arm/, 'upperArm'], [/lower-arm/, 'forearm'], [/lower-leg/, 'shin'], [/shoe|sole|sock/, 'foot']];
const clipV = new THREE.Vector3(), clipA = new THREE.Vector3(), clipB = new THREE.Vector3(), clipC = new THREE.Vector3();
/**
 * Where the rope is inside the character. For each body part: how many of its surface points lie inside the rope's
 * own thickness, and the deepest of them (metres past the rope's surface; the rope's radius is the most there can be).
 * Hands and feet are meant to hold the rope; everything else should read zero.
 */
function clip(): Record<string, { n: number; deep: number }> {
  p.group.updateMatrixWorld(true); // (the skinned surfaces refresh their bind space here, not in updateWorldMatrix)
  const out: Record<string, { n: number; deep: number }> = {};
  for (const [, part] of CLIP_PARTS) out[part] = { n: 0, deep: 0 };
  // The rope near the body, as a run of short straight pieces.
  p.bodyGroup.getWorldPosition(clipC); clipC.y += .9;
  const pts: THREE.Vector3[] = [];
  for (let d = 0; d <= LEN + 1e-6; d += .12) { const q = new THREE.Vector3(); drawn(rope, Math.min(LEN, d), q); if (q.distanceTo(clipC) < 2.2) pts.push(q); }
  if (pts.length < 2) return out;
  p.group.traverse((o: any) => {
    if (!o.isMesh || o.name.startsWith('character-rigid-palette')) return;
    for (let q = o; q; q = q.parent) if (!q.visible) return;
    const part = CLIP_PARTS.find(([re]) => re.test(o.name))?.[1]; if (!part) return;
    const position = o.geometry.attributes.position, stride = position.count > 4000 ? 2 : 1, tally = out[part];
    for (let i = 0; i < position.count; i += stride) {
      if (o.isSkinnedMesh) o.getVertexPosition(i, clipV); else clipV.fromBufferAttribute(position, i);
      clipV.applyMatrix4(o.matrixWorld);
      let best = Infinity;
      for (let k = 0; k + 1 < pts.length; k++) {
        clipA.subVectors(pts[k + 1], pts[k]); clipB.subVectors(clipV, pts[k]);
        const t = Math.min(1, Math.max(0, clipB.dot(clipA) / clipA.lengthSq()));
        const dist = clipB.addScaledVector(clipA, -t).lengthSq(); if (dist < best) best = dist;
      }
      const depth = ROPE_RADIUS - Math.sqrt(best);
      if (depth > 0) { tally.n++; if (depth > tally.deep) tally.deep = depth; }
    }
  });
  for (const part of Object.keys(out)) out[part].deep = +out[part].deep.toFixed(3);
  return out;
}
/** World positions of the points the eye follows, for measuring snaps between frames. */
const TRACKED: [string, () => THREE.Object3D | null][] = [['head', () => p.headM], ['handL', () => p.wristL], ['handR', () => p.wristR],
  ['footL', () => p.ankleL], ['footR', () => p.ankleR], ['elbowL', () => p.elbowL], ['kneeL', () => p.kneeL], ['shoulderL', () => p.armL]];
function joints(): Record<string, number[]> {
  p.group.updateWorldMatrix(true, true);
  const out: Record<string, number[]> = {};
  if (p.legL && p.legR) out.hips = p.legL.getWorldPosition(clipV).add(p.legR.getWorldPosition(clipA)).multiplyScalar(.5).toArray().map((v: number) => +v.toFixed(4));
  for (const [name, get] of TRACKED) { const o = get(); if (o) out[name] = o.getWorldPosition(clipV).toArray().map(v => +v.toFixed(4)); }
  return out;
}

// ---- Moves played out for a watcher ------------------------------------------------------------------------------
/** A move as a list of steps, one a picture, each a step of the game at the review's speed. A step that answers
 * `false` is taken again on the next picture. */
let playing: (() => boolean | void)[] = [];
function play(name: string): void {
  const steps: (() => boolean | void)[] = [];
  const each = (frames: number, over: Over = {}) => { for (let i = 0, n = Math.round(frames / speed); i < n; i++) steps.push(() => { tick(speed / 60, over); }); };
  const onRope = () => { if (p.state !== 'rope') { steps.push(() => { catchRope(4.8); }); each(40); } };
  if (name === 'jumpon') {
    steps.push(() => { prepareJump(-1, 30, 9.5, 6, false); });
    each(20); each(30, { moveY: 1 });
    for (let i = 0, n = Math.round(70 / speed); i < n; i++) steps.push(() => { if (p.state !== 'rope') jumpFrame(Math.floor(i * speed), speed / 60); else tick(speed / 60); });
    each(50);
  } else if (name === 'hang') steps.push(() => { catchRope(4.8); });
  else if (name === 'hangend') steps.push(() => { catchRope(LEN - .1); });
  else if (name === 'climb') { onRope(); each(70, { moveY: 1 }); each(20); }
  else if (name === 'descend') { onRope(); each(70, { moveY: -1 }); each(20); }
  else if (name === 'leap' || name === 'charged') {
    onRope();
    // Wait for the rope to be swinging forward through the bottom of its arc, then let go and steer on forward.
    let waited = 0;
    steps.push(() => { tick(speed / 60); return (rope.theta > -.15 && rope.theta < .3 && rope.thetaV > 0) || ++waited > 600 / speed; });
    each(name === 'charged' ? 30 : 3, { jumpHeld: true });
    each(100, { moveY: 1 });
  } else if (name === 'start') steps.push(() => { stand(4); });
  manual = true; playing = steps;
}
function advance(): void {
  if (!playing.length) return;
  if (playing[0]() !== false) playing.shift();
  if (!playing.length) { manual = false; wasHeld = false; }
}

const render = g.renderer.render.bind(g.renderer);
g.renderer.render = (...args: any[]) => { if (args[1] === g.camera && view.mode !== 'game') {
  if (view.mode === 'follow' || view.mode === 'body') {
    p.bodyGroup.updateWorldMatrix(true, true);
    // 'follow' keeps to the rider's own position; 'body' to the hips as they are drawn (a catch moves the one at
    // once and brings the other round to it).
    const a = THREE.MathUtils.degToRad(view.yaw), at = view.mode === 'body' && p.legL && p.legR
      ? p.legL.getWorldPosition(clipA).add(p.legR.getWorldPosition(clipB)).multiplyScalar(.5).setY(clipA.y - .95) : p.group.position;
    view.target.set(at.x, at.y + view.height, at.z);
    view.eye.set(at.x + Math.sin(a) * view.dist, at.y + view.height + view.dist * .12, at.z + Math.cos(a) * view.dist);
  }
  g.camera.position.copy(view.eye); g.camera.up.set(0, 1, 0); g.camera.lookAt(view.target);
} return render(...args); };

const panel = document.createElement('div');
panel.style.cssText = 'position:fixed;top:60px;left:8px;z-index:999999;background:#15212def;color:white;padding:12px;width:270px;font:13px monospace';
const buttons = document.createElement('div'), status = document.createElement('pre'); status.style.whiteSpace = 'pre-wrap';
panel.append(buttons, status); if (!query.has('nopanel')) document.body.append(panel);
const button = (label: string, fn: () => void) => { const b = document.createElement('button'); b.textContent = label; b.onclick = fn; b.style.cssText = 'padding:7px;margin:2px'; buttons.append(b); };
button('Run and jump on', () => play('jumpon'));
button('Hang', () => play('hang'));
button('Hang from the end', () => play('hangend'));
button('Climb', () => play('climb'));
button('Descend', () => play('descend'));
button('Leap', () => play('leap'));
button('Charged leap', () => play('charged'));
button('Swing', () => { frozen = null; swingFromBottom(1); });
for (const [label, value] of [['Full speed', 1], ['Half', .5], ['Quarter', .25], ['Tenth', .1]] as const) button(label, () => { speed = value; });
for (const degrees of [-45, -20, 0, 20, 45]) button(`Hold ${degrees}°`, () => { frozen = THREE.MathUtils.degToRad(degrees); });
for (const degrees of [0, 40, 90, 180, 270]) button(`View ${degrees}°`, () => { view.mode = 'follow'; view.yaw = degrees; });
button('Pause', () => { manual = true; }); button('Play', () => { manual = false; });

const info = () => ({ frames, state: p.state, clip: runtime.activeClipId, grounded: p.grounded,
  pos: p.pos.toArray().map((v: number) => +v.toFixed(3)), theta: +rope.theta.toFixed(3), ropeD: +(p.ropeD ?? 0).toFixed(3), ...p.ropeAnimationDiagnostics });
(function report() { advance(); status.textContent = JSON.stringify(info(), null, 1); requestAnimationFrame(report); })();

(window as any).__ropeReview = {
  ready: true, fixture, rope, player: p, runtime, view, THREE,
  tick(dt = 1 / 60, n = 1, over: Over = {}) { for (let i = 0; i < n; i++) tick(dt, over); return info(); },
  setManual(v: boolean) { manual = v; }, setClimb(v: number) { climb = v; }, setHold(v: boolean) { hold = v; },
  setFreeze(theta: number | null) { frozen = theta; applyFreeze(); }, swingFromBottom, stand, catchRope, prepareJump, jumpFrame, info, clip, joints,
  play, setSpeed(v: number) { speed = Math.min(1, Math.max(.05, v)); }, get busy() { return playing.length > 0; },
  setView(o: { mode?: 'follow' | 'body' | 'world' | 'game'; yaw?: number; dist?: number; height?: number; eye?: number[]; target?: number[] }) {
    if (o.mode) view.mode = o.mode; if (o.yaw !== undefined) view.yaw = o.yaw; if (o.dist !== undefined) view.dist = o.dist; if (o.height !== undefined) view.height = o.height;
    if (o.eye) view.eye.fromArray(o.eye); if (o.target) view.target.fromArray(o.target);
  },
};
catchRope();
