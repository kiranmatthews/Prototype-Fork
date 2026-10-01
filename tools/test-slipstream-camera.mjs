import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInThisContext } from 'node:vm';
import { createServer } from 'vite';
import * as THREE from 'three';
import { makeInput } from './jungle-cup-harness.mjs';

const harness = await readFile(new URL('./validate-editor-roundtrip.mjs', import.meta.url), 'utf8');
runInThisContext(harness.slice(harness.indexOf('function installHeadlessDom()'), harness.indexOf('\nfunction round(')) + '\ninstallHeadlessDom();');
const server = await createServer({ logLevel: 'silent', server: { middlewareMode: true }, appType: 'custom' });
const levels = [];
const warn = console.warn, error = console.error;
console.warn = (...a) => { if (!/failed|GLB|procedural skateboard/i.test(String(a[0]))) warn(...a); };
console.error = (...a) => { if (!/failed|GLB/i.test(String(a[0]))) error(...a); };
const clone = value => JSON.parse(JSON.stringify(value));
const cameras = data => data.components.filter(c => c.t === 'camnode');
const withoutCameras = data => data.components.filter(c => c.t !== 'camnode');
const angle = (a, b) => Math.abs(Math.atan2(a.x * b.z - a.z * b.x, a.x * b.x + a.z * b.z)) * 180 / Math.PI;
try {
  const { Level, newLaneCursor, migrateCustomLevel, normalizeCustomLevelData, setUserLevels, findLevel } = await server.ssrLoadModule('/src/level.ts');
  const { Player } = await server.ssrLoadModule('/src/player.ts');
  const { LEGACY_SLIPSTREAM_CAMERA, SLIPSTREAM_CAMERA, migrateSlipstreamCamera } = await server.ssrLoadModule('/src/levels/slipstream-camera.ts');
  const pack = JSON.parse(await readFile(new URL('../public/levels.json', import.meta.url), 'utf8'));
  const published = pack.levels.find(entry => entry.id === 'slip');
  assert.deepEqual(cameras(published.data).map(c => c.p), SLIPSTREAM_CAMERA, 'fresh download needs the repaired lane');
  const old = { ...clone(published.data), components: [
    ...clone(withoutCameras(published.data)), ...LEGACY_SLIPSTREAM_CAMERA.map(p => ({ t: 'camnode', p: [...p] })),
  ] };
  // An unrelated saved rope/geometry edit survives the narrowly fingerprinted repair.
  old.components.find(c => c.t === 'ropeswing').speed = 1.27;
  old.components.find(c => c.t === 'platform').color = '#123456';
  const before = clone(withoutCameras(old));
  const migrated = migrateCustomLevel(clone(old));
  assert.deepEqual(cameras(migrated).map(c => c.p), SLIPSTREAM_CAMERA);
  assert.deepEqual(withoutCameras(migrated), before, 'migration rewrote geometry or the saved rope');
  assert.deepEqual(migrateCustomLevel(clone(migrated)), migrated, 'migration is not idempotent');
  assert.deepEqual(cameras(normalizeCustomLevelData(old)).map(c => c.p), SLIPSTREAM_CAMERA, 'import validation skipped the repair');
  setUserLevels([{ id: 'slip', name: 'My saved Slipstream', data: old }]);
  assert.deepEqual(cameras(findLevel('slip').data).map(c => c.p), SLIPSTREAM_CAMERA, 'saved override masks the source fix');
  assert.deepEqual(withoutCameras(findLevel('slip').data), before);
  setUserLevels([]);
  for (const edit of [
    d => { cameras(d)[30].p[0] += .001; },
    d => { cameras(d)[30].radius = 2; },
    d => { cameras(d)[30].grp = 1; },
    d => { d.components.push({ t: 'camnode', p: [0, 0, -890] }); },
    d => { const nodes = cameras(d); [nodes[20].p, nodes[21].p] = [nodes[21].p, nodes[20].p]; },
  ]) {
    const custom = clone(old); edit(custom); const saved = clone(custom);
    migrateSlipstreamCamera(custom);
    assert.deepEqual(custom, saved, 'a hand-edited camera path was replaced');
  }

  const native = new Level(new THREE.Scene(), { id: 'slip', name: 'Native Slipstream' }); levels.push(native);
  const current = new Level(new THREE.Scene(), published); levels.push(current);
  assert.equal(current.cameraViews.length, 0, 'a volume changed the course input model');
  assert.equal(current.zones.length, 0);
  assert.equal(current.lanePts.length, native.lanePts.length, 'a centreline sample was dropped');
  for (let i = 0; i < native.lanePts.length; i++) {
    const a = native.lanePts[i], b = current.lanePts[i];
    assert.ok(Math.hypot(a.x-b.x, a.y-b.y, a.z-b.z) < .000001, 'camera node no longer follows the native deck');
  }
  let samples = 0, maximumError = 0, maximumArcStep = 0, tailError = 0;
  // Continuous cursors must stay on the same deck through the self-crossing
  // corkscrew, including off-centre grinding and airborne camera positions.
  for (const side of [-5, 0, 5]) for (const height of [0, 8, 20]) {
    const reference = newLaneCursor(), cursor = newLaneCursor();
    for (let i = 0; i < native.lanePts.length - 1; i++) {
      const a = native.lanePts[i], b = native.lanePts[i+1];
      const dx=b.x-a.x, dz=b.z-a.z, length=Math.hypot(dx,b.y-a.y,dz), flat=Math.hypot(dx,dz);
      for (let step = 0; step <= Math.ceil(length); step++) {
        const t=step/Math.ceil(length), x=a.x+dx*t-dz/flat*side, y=a.y+(b.y-a.y)*t+height, z=a.z+dz*t+dx/flat*side;
        const prior=cursor.s;
        const expected=native.cameraDirAt(x,y,z,reference), actual=current.cameraDirAt(x,y,z,cursor);
        maximumError=Math.max(maximumError,angle(expected,actual));
        if(prior>=0)maximumArcStep=Math.max(maximumArcStep,Math.abs(cursor.s-prior));
        if(z < -610) tailError=Math.max(tailError,angle(native.cameraDirAt(x,y,z),current.cameraDirAt(x,y,z)));
        samples++;
      }
    }
  }
  assert.ok(maximumError < .001, `course camera differs from native by ${maximumError} degrees`);
  assert.ok(tailError < .001, `finale ground/air/edge direction differs by ${tailError} degrees`);
  assert.ok(maximumArcStep < 40, `camera jumped ${maximumArcStep} metres to another course branch`);
  const landing = current.cameraDirAt(7, .8, -756);
  assert.ok(landing.x > 0 && landing.x < .03 && landing.z < -.999, 'water-gap view still turns west away from the landing');
  assert.deepEqual(published.data.components.find(c => c.t === 'ropeswing'),
    { t:'ropeswing',p:[4,19,-747],len:9.5,amp:.8,speed:1.08,phase:0,yaw:90 }, 'published rope edit changed');

  // Real forward-only controller run through the final acceleration lane.
  // Stop at the kicker: this regression owns camera/course alignment, while
  // jump release timing remains the player's manoeuvre.
  current.root.updateMatrixWorld(true);
  const p = new Player(current.scene); p.enterLevel('slip');
  const start = native.lanePts.find(point => point.z < -670);
  p.respawn(current, true, false, { position:new THREE.Vector3(start.x,start.y+.04,start.z) });
  let frames=0, worstCentreOffset=0;
  for (; frames<600 && p.pos.z>-736; frames++) {
    p.step(1/60, makeInput({moveY:1}), current); current.update(1/60);
    assert.ok(!['dead','gameover'].includes(p.state) && !p.isBailing, 'forward approach left the final ribbon');
    const nearest=native.lanePts.reduce((best,point)=>Math.abs(point.z-p.pos.z)<Math.abs(best.z-p.pos.z)?point:best);
    worstCentreOffset=Math.max(worstCentreOffset,Math.abs(nearest.x-p.pos.x));
  }
  assert.ok(p.pos.z<=-736, 'forward input did not reach the final kicker');
  assert.ok(worstCentreOffset<2, `camera steered the finale ${worstCentreOffset} m off its centre`);
  p.group.removeFromParent();
  console.log(JSON.stringify({samples,maximumError,tailError,maximumArcStep,approachFrames:frames,worstCentreOffset}));
  console.log('PASS Slipstream native centreline, self-crossing continuity, finale ground/air/edge headings, exact saved migration/custom preservation and forward-only acceleration');
} finally {
  for (const level of levels) level.dispose();
  await server.close(); console.warn=warn; console.error=error;
}
