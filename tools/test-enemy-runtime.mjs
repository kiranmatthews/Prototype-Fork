import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { setImmediate as settleLoads } from 'node:timers/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createServer } from 'vite';

// In-memory loader results exercise the runtime without fetching or publishing
// placeholder enemies. These checks do not certify a generated model's rig.
function fixture() {
  const disposed = { geometry: 0, material: 0, texture: 0, bitmap: 0 };
  const scene = new THREE.Group();
  scene.name = 'FixtureScene';
  const rig = new THREE.Group();
  rig.name = 'enemyRoot';
  rig.userData.enemyRig = {
    mapping: { torso: { name: 'chestBone', lengthAxis: 'y' }, head: 'headBone' },
    walkClip: 'Travel', walkSpeed: 2,
  };
  scene.add(rig);
  const torso = new THREE.Bone();
  torso.name = 'chestBone';
  torso.position.y = .6;
  rig.add(torso);
  const head = new THREE.Bone();
  head.name = 'headBone';
  head.position.set(0, .25, .2);
  torso.add(head);
  const bones = [torso, head];
  for (const front of ['front', 'hind']) for (const side of ['Left', 'Right']) {
    const upper = new THREE.Bone();
    upper.name = `${front}Upper${side}`;
    upper.position.set(side === 'Left' ? -.25 : .25, 0, front === 'front' ? .3 : -.3);
    torso.add(upper);
    const lower = new THREE.Bone();
    lower.name = `${front}Lower${side}`;
    lower.position.y = -.3;
    upper.add(lower);
    const foot = new THREE.Bone();
    foot.name = `${front}Foot${side}`;
    foot.position.y = -.3;
    lower.add(foot);
    bones.push(upper, lower, foot);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-.2, .6, 0, .2, .6, 0, 0, 1, .3], 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
  const texture = new THREE.Texture({ width: 2, height: 2, close: () => disposed.bitmap++ });
  const material = new THREE.MeshStandardMaterial({ map: texture });
  geometry.addEventListener('dispose', () => disposed.geometry++);
  material.addEventListener('dispose', () => disposed.material++);
  texture.addEventListener('dispose', () => disposed.texture++);
  const mesh = new THREE.SkinnedMesh(geometry, material);
  rig.add(mesh);
  scene.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));
  const quarterTurn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  const animations = [new THREE.AnimationClip('Travel', 1, [
    new THREE.VectorKeyframeTrack('enemyRoot.position', [0, .5, 1], [0, 0, 0, 1, .04, 1, 2, 0, 2]),
    new THREE.VectorKeyframeTrack('enemyRoot.scale', [0, 1], [1, 1, 1, 2, 2, 2]),
    new THREE.QuaternionKeyframeTrack('enemyRoot.quaternion', [0, 1], [0, 0, 0, 1, ...quarterTurn.toArray()]),
    new THREE.NumberKeyframeTrack('headBone.rotation[x]', [0, .5, 1], [0, .3, 0]),
  ])];
  return { gltf: { scene, animations }, disposed };
}

const near = (actual, expected, message, tolerance = 1e-6) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${message}: ${actual} versus ${expected}`);
const skin = visual => {
  let result;
  visual.group.traverse(node => { if (node.isSkinnedMesh) result = node; });
  assert.ok(result, 'fixture skin was not installed');
  return result;
};
const worldPosition = (visual, name) => visual.group.getObjectByName(name).getWorldPosition(new THREE.Vector3());
const allPlanted = { frontLeft: true, frontRight: true, hindLeft: true, hindRight: true };
const frame = { state: 'patrol', stateTime: 0, time: .2, speed: 2,
  verticalVelocity: 0, grounded: true, alive: true, flung: false, plantedFeet: allPlanted };
const requests = new Map();
const previousLoad = GLTFLoader.prototype.loadAsync;
GLTFLoader.prototype.loadAsync = function (url) {
  return new Promise(resolve => {
    const list = requests.get(url) ?? [];
    list.push(resolve); requests.set(url, list);
  });
};
const visuals = [];
const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
try {
  const { createEnemyVisual } = await server.ssrLoadModule('/src/enemies/runtime.ts');
  const { ENEMY_KINDS, ENEMY_LEGS } = await server.ssrLoadModule('/src/enemies/types.ts');
  const { sampleEnemyElasticity, enemyElasticPulse } = await server.ssrLoadModule('/src/enemies/elasticity.ts');
  const create = (url, kind = 'grunt') => { const visual = createEnemyVisual(kind, { url }); visuals.push(visual); return visual; };

  const a = create('fixture://shared'), b = create('fixture://shared');
  await settleLoads();
  assert.equal(requests.get('fixture://shared').length, 1, 'same asset loaded twice');
  const shared = fixture();
  requests.get('fixture://shared')[0](shared.gltf);
  await Promise.all([a.ready, b.ready]);
  assert.equal(a.diagnostics.status, 'ready');
  assert.equal(a.diagnostics.mappedNodes.torso, 'chestBone', 'nested enemyRig mapping was ignored');
  const aSkin = skin(a), bSkin = skin(b);
  assert.notEqual(aSkin.skeleton, bSkin.skeleton, 'instances share a skeleton');
  assert.notEqual(aSkin.skeleton.bones[0], bSkin.skeleton.bones[0], 'instances share pose bones');
  assert.equal(aSkin.geometry, bSkin.geometry, 'geometry should be leased, not copied');
  assert.notEqual(aSkin.material, bSkin.material, 'state glow would change another enemy');
  assert.equal(aSkin.material.map, bSkin.material.map, 'atlas should be shared');
  const bPose = b.group.getObjectByName('headBone').quaternion.clone();
  const bVertex = bSkin.getVertexPosition(2, new THREE.Vector3()).clone();

  // Retain source vertical gait while stripping translation, yaw and scale
  // that could move the model outside the gameplay-owned root/collider.
  a.group.position.set(4, .2, -2);
  a.group.rotation.y = .6;
  a.group.updateMatrixWorld(true);
  const planted = new Map(ENEMY_LEGS.map(leg => {
    const front = leg.startsWith('front') ? 'front' : 'hind', side = leg.endsWith('Left') ? 'Left' : 'Right';
    const name = `${front}Foot${side}`;
    return [name, worldPosition(a, name)];
  }));
  a.update(.2, frame);
  assert.equal(a.diagnostics.activeClip, 'Travel', 'configured clip was not selected');
  near(a.diagnostics.animationTime, .2, 'walk did not advance at source speed');
  const motionRoot = a.group.getObjectByName('enemyRoot');
  near(motionRoot.position.x, 0, 'imported X root motion leaked');
  near(motionRoot.position.z, 0, 'imported Z root motion leaked');
  near(motionRoot.position.y, .016, 'authored vertical gait was discarded');
  assert.deepEqual(motionRoot.scale.toArray(), [1, 1, 1]);
  assert.deepEqual(motionRoot.quaternion.toArray(), [0, 0, 0, 1]);
  assert.deepEqual(a.group.position.toArray(), [4, .2, -2]);
  near(a.group.rotation.y, .6, 'animation changed gameplay facing');
  assert.deepEqual(a.group.scale.toArray(), [1, 1, 1]);
  assert.ok(Math.abs(a.group.getObjectByName('chestBone').scale.y - 1) > .01,
    'contact test did not exercise torso deformation');
  for (const [name, target] of planted) {
    target.y += .032; // Source vertical gait is presented at twice its authored size.
    near(worldPosition(a, name).distanceTo(target), 0, `elasticity moved planted ${name}`);
  }
  assert.ok(a.group.getObjectByName('headBone').quaternion.angleTo(bPose) > .05, 'head animation did not run');
  assert.ok(b.group.getObjectByName('headBone').quaternion.equals(bPose), 'one instance animated its peer');
  assert.ok(bSkin.getVertexPosition(2, new THREE.Vector3()).equals(bVertex), 'peer skin deformed');

  // Source contact intervals supersede the old diagonal fallback: this
  // four-beat phase plants front-right while front-left is in swing.
  const contactVisual = create('fixture://contacts');
  await settleLoads();
  const contactSource = fixture();
  contactSource.gltf.scene.getObjectByName('enemyRoot').userData.enemyRig.walkContacts = {
    frontLeft: [[.4, .6]], frontRight: [[.8, .3]], hindLeft: [[0, 1]], hindRight: [],
  };
  requests.get('fixture://contacts')[0](contactSource.gltf); await contactVisual.ready;
  contactVisual.update(.2, { ...frame, plantedFeet: undefined });
  const contactTorso = contactVisual.group.getObjectByName('chestBone');
  const segmentLength = side => contactVisual.group.getObjectByName(`frontUpper${side}`).scale.y * contactTorso.scale.y;
  assert.ok(Math.abs(segmentLength('Left') - 1) > .01, 'source swing foot incorrectly planted by diagonal fallback');
  near(segmentLength('Right'), 1, 'wrapping source contact interval ignored');
  contactVisual.dispose();

  // A real walk-only rig has no idle action to crossfade into. Returning to
  // stand/telegraph must blend its animated pose back to rest over .12s.
  const fadeVisual = create('fixture://walk-fade', 'charger');
  await settleLoads();
  const fadeSource = fixture();
  fadeSource.gltf.animations[0].tracks.push(
    new THREE.NumberKeyframeTrack('frontLowerLeft.rotation[x]', [0, .5, 1], [0, -.4, 0]));
  requests.get('fixture://walk-fade')[0](fadeSource.gltf); await fadeVisual.ready;
  const movingFrame = { ...frame, state: 'patrol', stateTime: 0, time: 0 };
  const poseAngles = () => ['headBone', 'frontLowerLeft'].map(name => fadeVisual.group.getObjectByName(name).rotation.x);
  for (const state of ['patrol', 'telegraph']) {
    fadeVisual.reset(); fadeVisual.update(.3, movingFrame);
    const animated = poseAngles(), stopped = { ...movingFrame, state, speed: 0 };
    assert.ok(animated.every(value => Math.abs(value) > .1), 'fade fixture must exercise meaningful source motion');
    fadeVisual.update(0, stopped);
    poseAngles().forEach((value, index) => near(value, animated[index], `${state}: snapped on fade start`));
    fadeVisual.update(.06, stopped);
    poseAngles().forEach((value, index) => {
      const ratio = value / animated[index];
      assert.ok(ratio > .25 && ratio < .75, `${state}: expected intermediate head/leg blend, got ratio ${ratio}`);
    });
    assert.equal(fadeVisual.diagnostics.activeClip, 'Travel', 'outgoing clip must remain visible during fade');
    fadeVisual.update(.06, stopped);
    poseAngles().forEach(value => near(value, 0, `${state}: pose did not reach rest in .12s`));
    assert.equal(fadeVisual.diagnostics.activeClip, null, 'completed fade remained active');
    fadeVisual.update(.5, stopped);
    poseAngles().forEach(value => near(value, 0, `${state}: outgoing animation resumed after settle`));
  }
  const stopped = { ...movingFrame, speed: 0 };
  fadeVisual.reset(); fadeVisual.update(.3, movingFrame); fadeVisual.update(.03, stopped);
  fadeVisual.update(.01, movingFrame); fadeVisual.update(.2, movingFrame);
  assert.equal(fadeVisual.diagnostics.activeClip, 'Travel', 'expired fade stopped a resumed walk');
  assert.ok(poseAngles().every(value => Math.abs(value) > .1));
  fadeVisual.update(.03, stopped); fadeVisual.reset(); fadeVisual.update(.25, stopped);
  poseAngles().forEach(value => near(value, 0, 'reset retained an outgoing animation'));
  assert.equal(fadeVisual.diagnostics.activeClip, null);
  // Defeat must cut even a partially faded source action immediately, so its
  // finite compression starts cleanly and cannot inherit locomotion keys.
  fadeVisual.update(.3, movingFrame); fadeVisual.update(.03, stopped);
  fadeVisual.update(0, { ...stopped, alive: false, flung: true });
  poseAngles().forEach(value => near(value, 0, 'defeat retained a fading source pose'));
  assert.equal(fadeVisual.diagnostics.activeClip, null);
  fadeVisual.update(1, { ...stopped, alive: false, flung: true });
  poseAngles().forEach(value => near(value, 0, 'defeat did not settle after cancelling fade'));
  fadeVisual.dispose();

  // Both defeat modes must deform, stop their mixer and settle completely.
  for (const flung of [false, true]) {
    a.reset(); a.update(.1, frame);
    const dead = { ...frame, alive: false, flung, time: 2 };
    a.update(0, dead);
    a.update(flung ? .1 : .03, dead);
    assert.equal(a.diagnostics.activeClip, null);
    assert.ok(Math.abs(a.group.getObjectByName('chestBone').scale.y - 1) > .01, 'defeat had no compression');
    a.update(1, { ...dead, time: 3 });
    assert.deepEqual(a.group.getObjectByName('headBone').quaternion.toArray(), [0, 0, 0, 1]);
    assert.deepEqual(a.group.getObjectByName('chestBone').scale.toArray(), [1, 1, 1]);
    for (const kind of ENEMY_KINDS) {
      const settled = sampleEnemyElasticity(kind, dead, .7, {}, 1);
      assert.equal(settled.torso, 1, `${kind} torso never settled`);
      for (const lengths of Object.values(settled.legs)) assert.deepEqual(lengths, { upper: 1, lower: 1 });
    }
  }
  assert.equal(enemyElasticPulse(1, .12), 0);
  a.reset();
  assert.equal(a.diagnostics.state, 'patrol');
  assert.equal(a.diagnostics.animationTime, 0);
  assert.deepEqual(a.group.getObjectByName('enemyRoot').position.toArray(), [0, 0, 0]);

  let aMaterialDisposed = 0, aSkeletonTextureDisposed = 0;
  aSkin.material.addEventListener('dispose', () => aMaterialDisposed++);
  aSkin.skeleton.computeBoneTexture();
  aSkin.skeleton.boneTexture.addEventListener('dispose', () => aSkeletonTextureDisposed++);
  a.dispose(); a.dispose();
  assert.equal(aMaterialDisposed, 1, 'instance material ownership is not idempotent');
  assert.equal(aSkeletonTextureDisposed, 1, 'instance skeleton GPU texture was not released');
  assert.equal(a.group.children.length, 0, 'borrowed resources remain under disposed level root');
  assert.deepEqual(shared.disposed, { geometry: 0, material: 0, texture: 0, bitmap: 0 }, 'peer still owns shared asset');
  b.dispose();
  assert.deepEqual(shared.disposed, { geometry: 1, material: 1, texture: 1, bitmap: 1 }, 'final owner did not free asset exactly once');

  // An old request finishes after its level was retired and a replacement
  // already acquired the same URL. It must neither attach nor evict the new one.
  const retired = create('fixture://race');
  await settleLoads(); retired.dispose();
  const successor = create('fixture://race');
  await settleLoads();
  assert.equal(requests.get('fixture://race').length, 2);
  const replacement = fixture(), late = fixture();
  requests.get('fixture://race')[1](replacement.gltf); await successor.ready;
  requests.get('fixture://race')[0](late.gltf); await retired.ready;
  assert.equal(retired.diagnostics.status, 'disposed');
  assert.equal(retired.group.children.length, 0, 'late asset attached to retired enemy');
  assert.deepEqual(late.disposed, { geometry: 1, material: 1, texture: 1, bitmap: 1 }, 'unclaimed late asset leaked');
  const overlapping = create('fixture://race'); await overlapping.ready;
  assert.equal(requests.get('fixture://race').length, 2, 'late completion evicted current cache entry');
  successor.dispose();
  assert.deepEqual(replacement.disposed, { geometry: 0, material: 0, texture: 0, bitmap: 0 });
  overlapping.dispose();
  assert.deepEqual(replacement.disposed, { geometry: 1, material: 1, texture: 1, bitmap: 1 });

  // A model's bearing can be offset from its gameplay root. The fixed base
  // and housing centre must stay together throughout the complete aim turn.
  const turret = create('fixture://sentry', 'sentry'), muzzle = new THREE.Vector3(9, 9, 9);
  assert.equal(turret.getMuzzlePosition(muzzle), false);
  assert.deepEqual(muzzle.toArray(), [9, 9, 9]);
  await settleLoads();
  const turretSource = fixture(), rig = turretSource.gltf.scene.getObjectByName('enemyRoot');
  const chest = rig.getObjectByName('chestBone'), head = rig.getObjectByName('headBone');
  chest.position.x = .13; chest.position.z = -.17;
  const base = new THREE.Group(); base.name = 'base'; base.position.set(.13, .2, -.17); rig.add(base);
  const barrel = new THREE.Group(); barrel.name = 'barrel'; barrel.position.set(0, -.1, .2); head.add(barrel);
  const barrelGeometry = new THREE.BoxGeometry(.2, .2, .4); barrelGeometry.translate(0, 0, .2);
  barrel.add(new THREE.Mesh(barrelGeometry, new THREE.MeshStandardMaterial()));
  turretSource.gltf.scene.updateMatrixWorld(true);
  turretSource.gltf.scene.traverse(node => { if (node.isSkinnedMesh) node.bind(node.skeleton); });
  requests.get('fixture://sentry')[0](turretSource.gltf); await turret.ready;
  turret.update(0, { ...frame, state: 'track', stateTime: 0, time: 0, speed: 0 });
  const bearing = worldPosition(turret, 'chestBone'), basePosition = worldPosition(turret, 'base');
  near(bearing.x, .26, 'housing did not receive doubled presentation scale');
  near(bearing.z, -.34, 'offset aim bearing did not scale with housing');
  near(basePosition.y, .4, 'detached sentry base did not receive doubled presentation scale');
  const tip = turret.group.getObjectByName('barrel').localToWorld(new THREE.Vector3(0, 0, .4));
  assert.equal(turret.getMuzzlePosition(muzzle), true);
  near(muzzle.distanceTo(tip), 0, 'socket is not at positive-Z barrel tip');
  for (let index = 0; index <= 24; index++) {
    turret.body.rotation.y = index / 24 * Math.PI * 2;
    turret.update(0, { ...frame, state: 'track', stateTime: 0, time: 0, speed: 0 });
    near(worldPosition(turret, 'chestBone').distanceTo(bearing), 0, 'housing orbited its offset bearing');
    near(worldPosition(turret, 'base').distanceTo(basePosition), 0, 'fixed base followed head yaw');
  }
  turret.body.rotation.y = Math.PI / 2;
  turret.update(0, { ...frame, state: 'track', stateTime: 0, time: 0, speed: 0 });
  turret.getMuzzlePosition(muzzle); const aimedTip = muzzle.clone();
  turret.update(.075, { ...frame, state: 'fire', stateTime: .075, time: 0, speed: 0 });
  turret.getMuzzlePosition(muzzle);
  assert.ok(muzzle.x < aimedTip.x - .07, 'muzzle socket did not follow barrel recoil');
  turret.dispose(); assert.equal(turret.getMuzzlePosition(muzzle), false);

  if (process.argv.includes('--assets')) {
    // Parse the actual source GLBs without image decoding. Meshes, skins,
    // weights, bind matrices and node transforms are the original file data.
    GLTFLoader.prototype.loadAsync = async function (url) {
      const bytes = await readFile(url);
      return new GLTFLoader().register(() => ({ name: 'RuntimeAuditWithoutPixels', loadTexture: () => Promise.resolve(null) }))
        .parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    };
    const point = new THREE.Vector3();
    const measure = root => {
      root.updateMatrixWorld(true); const bounds = new THREE.Box3(); let vertices = 0;
      root.traverse(node => {
        if (!node.isMesh) return;
        if (node.isSkinnedMesh) node.skeleton.update();
        for (let i = 0; i < node.geometry.attributes.position.count; i++) {
          node.getVertexPosition(i, point).applyMatrix4(node.matrixWorld);
          assert.ok(point.toArray().every(Number.isFinite), 'non-finite deformed source vertex');
          bounds.expandByPoint(point); vertices++;
        }
      });
      assert.ok(vertices > 500, 'actual surface did not load'); return bounds;
    };
    const report = {};
    for (const kind of ['hopper', 'floater', 'sentry', 'spinner']) {
      const visual = create(fileURLToPath(new URL(`../public/enemies/${kind}.glb`, import.meta.url)), kind);
      await visual.ready; assert.equal(visual.diagnostics.status, 'ready', visual.diagnostics.error);
      visual.reset(); const rest = measure(visual.group), max = new THREE.Vector3(), low = { value: Infinity };
      const assetFrame = (state, t, patch = {}) => ({ ...frame, plantedFeet: undefined, state, stateTime: t, time: t, speed: 0, ...patch });
      const sample = (state, t, patch = {}, rootY = 0) => {
        visual.group.position.y = rootY; visual.update(1 / 60, assetFrame(state, t, patch));
        const bounds = measure(visual.group), size = bounds.getSize(new THREE.Vector3());
        max.max(size); low.value = Math.min(low.value, bounds.min.y); return bounds;
      };
      if (kind === 'hopper') {
        const contacts = ENEMY_LEGS.map(leg => {
          const name = `${leg.startsWith('front') ? 'front' : 'hind'}Foot${leg.endsWith('Left') ? 'Left' : 'Right'}`;
          const foot = visual.group.getObjectByName(name); assert.ok(foot, `missing actual ${name}`);
          return { foot, position: foot.getWorldPosition(new THREE.Vector3()), quaternion: foot.getWorldQuaternion(new THREE.Quaternion()) };
        });
        for (let i = 0; i <= 27; i++) {
          const bounds = sample('crouch', i / 60);
          assert.ok(bounds.min.y >= -.002, 'grounded frog toes enter deck');
          for (const contact of contacts) {
            near(contact.foot.getWorldPosition(new THREE.Vector3()).distanceTo(contact.position), 0, 'actual planted foot translated');
            near(contact.foot.getWorldQuaternion(new THREE.Quaternion()).angleTo(contact.quaternion), 0, 'actual planted sole tipped');
          }
        }
        let height = 0, vy = 8.6;
        for (let i = 1; i < 80; i++) {
          vy -= 24 / 60; height += vy / 60;
          if (height <= 0 && vy < 0) { sample('crouch', 0); break; }
          sample('leap', i / 60, { grounded: false, speed: 3.4, verticalVelocity: vy }, height);
        }
        assert.ok(max.x < 2.72 && max.y < 2.5 && max.z < 2.68, 'frog animation exceeds doubled surface envelope');
        assert.ok(low.value >= -.002, 'hop/landing drove visible geometry into the deck');
      } else if (kind === 'floater') {
        const rotor = visual.group.getObjectByName('rotor'); assert.ok(rotor);
        const centre = rotor.position.clone();
        for (const [state, length] of [['hover', 156], ['swoop', 48]]) for (let i = 0; i <= length; i++) {
          const t = i / 60, rootY = state === 'hover' ? 1.65 + Math.sin(t * 3) * .18 : 1.65 - Math.sin(Math.min(1, t / .8) * Math.PI) * 1.3;
          sample(state, t, { grounded: false, speed: 3.2 }, rootY);
          near(rotor.position.distanceTo(centre), 0, 'rotor pivot drifted from measured centre');
        }
        assert.ok(max.x < 2.6 && max.z < 2.6, 'rotor sweeps outside the doubled enemy envelope');
        assert.ok(low.value >= -.002, `drone ring enters deck at bottom of swoop: ${low.value.toFixed(4)}m`);
      } else if (kind === 'sentry') {
        const origin = worldPosition(visual, 'torso'), stationary = worldPosition(visual, 'base');
        for (let i = 0; i <= 72; i++) {
          visual.body.rotation.y = i / 72 * Math.PI * 2; sample('track', 0);
          near(worldPosition(visual, 'torso').distanceTo(origin), 0, 'source housing has aim-bearing drift');
          near(worldPosition(visual, 'base').distanceTo(stationary), 0, 'source base rotates with head');
          assert.equal(visual.getMuzzlePosition(muzzle), true);
        }
        visual.body.rotation.y = 0;
        for (const [state, length] of [['charge', 33], ['fire', 9], ['cooldown', 42]])
          for (let i = 0; i <= length; i++) sample(state, i / 60);
      } else {
        for (const [state, length] of [['out', 132], ['in', 81]]) for (let i = 0; i <= length; i++) {
          const bounds = sample(state, i / 60), size = bounds.getSize(new THREE.Vector3());
          if (state === 'in' && i >= 15) assert.ok(size.x < 1.6 && size.z < 1.6, 'retracted source blades exceed doubled presentation envelope');
        }
        assert.ok(max.x < 4.24 && max.z < 4.24, 'extended blade sweep exceeds doubled enemy size');
      }
      for (const flung of [false, true]) {
        visual.reset(); visual.group.position.y = 0;
        visual.update(0, assetFrame('defeat', 0, { alive: false, flung }));
        visual.update(1, assetFrame('defeat', 1, { alive: false, flung }));
        const settled = measure(visual.group);
        near(settled.min.distanceTo(rest.min), 0, `${kind} defeated minimum never settled`);
        near(settled.max.distanceTo(rest.max), 0, `${kind} defeated maximum never settled`);
      }
      report[kind] = { maxSize: max.toArray().map(v => Number(v.toFixed(4))), minimumWorldY: Number(low.value.toFixed(4)) };
      visual.dispose();
    }
    console.log('PASS actual custom enemy surface animation:', JSON.stringify(report));
  }

  console.log('PASS enemy runtime: independent skins, in-place walk, planted deformation, finite walk fade/death/reset, shared asset lifetime, late-load retirement and sentry bearing/muzzle.');
} finally {
  for (const visual of visuals) visual.dispose();
  GLTFLoader.prototype.loadAsync = previousLoad;
  await server.close();
}
