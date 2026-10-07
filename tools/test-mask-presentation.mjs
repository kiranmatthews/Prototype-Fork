import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createServer } from 'vite';

const noop = () => {};
const storage = new Map();
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
const context = new Proxy({
  createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
  getImageData: (_x, _y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
  createLinearGradient: () => ({ addColorStop: noop }),
  createRadialGradient: () => ({ addColorStop: noop }),
  createPattern: () => ({}), measureText: text => ({ width: String(text).length * 8 }),
}, { get: (target, key) => key in target ? target[key] : noop });
const element = () => ({
  style: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
  addEventListener: noop, removeEventListener: noop, setAttribute: noop,
  append: noop, appendChild: child => child, remove: noop, getContext: () => context,
});
globalThis.document = { body: element(), fonts: null, createElement: element, createElementNS: element };
globalThis.window = { location: { search: '?lite', href: 'http://headless.invalid/?lite' }, addEventListener: noop, removeEventListener: noop, devicePixelRatio: 1 };
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { getGamepads: () => [] } });
globalThis.Image = class {
  addEventListener(type, callback) { if (type === 'error') queueMicrotask(callback); }
  removeEventListener() {}
  set src(_value) { queueMicrotask(() => this.onerror?.(new Error('headless image'))); }
};
const NativeRequest = globalThis.Request;
globalThis.Request = class extends NativeRequest {
  constructor(input, init) { super(typeof input === 'string' && input.startsWith('/') ? `http://headless.invalid${input}` : input, init); }
};
globalThis.fetch = async () => new Response('', { status: 404 });
const originalWarn = console.warn, originalError = console.error;
const assetLog = value => /GLB|mask failed|crossbones failed|skateboard trucks|spin model failed/.test(String(value ?? ''));
console.warn = (...args) => { if (!assetLog(args[0])) originalWarn(...args); };
console.error = (...args) => { if (!assetLog(args[0])) originalError(...args); };

const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });


const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-6, `${message}: ${actual} != ${expected}`);
// An independent eight-corner projection checks surface separation, including
// the player's real profile transforms, against the rendered mask geometry.
function range(mesh, axis) {
  mesh.updateWorldMatrix(true, false);
  mesh.geometry.computeBoundingBox();
  const b = mesh.geometry.boundingBox, values = [];
  for (const x of [b.min.x,b.max.x]) for (const y of [b.min.y,b.max.y]) for (const z of [b.min.z,b.max.z])
    values.push(new THREE.Vector3(x,y,z).applyMatrix4(mesh.matrixWorld).dot(axis));
  return [Math.min(...values),Math.max(...values)];
}
try {
  const { Player } = await server.ssrLoadModule('/src/player.ts');
  const { Level } = await server.ssrLoadModule('/src/level.ts');
  const scene = new THREE.Scene();
  const level = new Level(scene, {id:'mask-fixture',name:'Mask fixture',data:{v:1,name:'Mask fixture',spawn:[0,.1,0],killY:-20,
    components:[{t:'platform',p:[0,-.5,0],s:[50,1,50]},{t:'gate',p:[0,0,-20]}]}});
  const player = new Player(scene);
  player.respawn(level,true,true);
  player.cam = new THREE.PerspectiveCamera(60,1,.1,100);
  player.maskBones = new THREE.Group();player.maskMesh.add(player.maskBones);
  // Match the actual flat skull envelope. The browser test also uses its GLB.
  player.maskMesh.geometry = new THREE.BoxGeometry(.707,.9,.183);
  const snapshot = () => JSON.stringify([player.pos.toArray(),player.camDir.toArray(),player.simSeed,player.masks,player.uberTimer,player.lives]);
  let cases=0;
  for (const time of [0,.31,.91]) for (const tilt of [0,.8,Math.PI]) for (const yaw of [0,.8,1.6,2.7,-2.8,-1.7]) {
    player.headM.rotation.set(tilt,yaw,.3);
    player.masks=2;player.uberTimer=2;player.runTime=time;
    const before=snapshot();player.prepareMaskPresentation();assert.equal(snapshot(),before);
    const headForward=player.headLookSocket.getWorldDirection(new THREE.Vector3());
    const maskForward=player.maskMesh.getWorldDirection(new THREE.Vector3());
    assert.ok(maskForward.dot(headForward)>.995,`worn mask facing ${maskForward.dot(headForward)} at ${time}/${tilt}/${yaw}`);
    near(player.maskMesh.quaternion.length(),1,'worn orientation must be a unit quaternion');
    const h=range(player.meshyHead.mesh,maskForward),m=range(player.maskMesh,maskForward);
    assert.ok(m[0]-h[1]>.03,'worn mask clips into the head');
    assert.equal(player.maskBones.visible,false);
    for(const count of [2,1]) for(const cameraYaw of [-2.6,0,1.8]) {
      player.masks=count;player.uberTimer=0;
      player.cam.position.set(Math.sin(cameraYaw)*6,4,Math.cos(cameraYaw)*6);player.cam.lookAt(0,1.5,0);
      // Deliberately disagree with the visible camera, like authored/peek views.
      player.camDir.set(1,0,0);
      player.prepareMaskPresentation();
      const up=new THREE.Vector3(0,1,0).applyQuaternion(player.maskMesh.quaternion);
      near(up.y,1,'held mask inherited the worn tilt');
      const forward=player.maskMesh.getWorldDirection(new THREE.Vector3());
      assert.ok(forward.dot(new THREE.Vector3(Math.sin(cameraYaw),0,Math.cos(cameraYaw)))>.94,'held mask faces the control frame instead of the camera');
      const right=new THREE.Vector3(Math.cos(cameraYaw),0,-Math.sin(cameraYaw));
      assert.ok(range(player.maskMesh,right)[0]-range(player.meshyHead.mesh,right)[1]>.14,'held mask overlaps the head');
      assert.equal(player.maskBones.visible,count===2);
      // The old yaw-only setter also failed when the renderer restored a
      // quaternion to the equivalent Euler angles near +/- pi.
      player.maskMesh.quaternion.copy(player.maskMesh.quaternion.clone());
      player.prepareMaskPresentation();near(new THREE.Vector3(0,1,0).applyQuaternion(player.maskMesh.quaternion).y,1,'quaternion restore tilted the next held pose');
      cases++;
    }
  }
  // A render between fixed poses must follow the interpolated socket, while
  // returning the player's authoritative pose and simulation state unchanged.
  player.masks=2;player.uberTimer=3;
  player.headM.rotation.set(.3,-1,.2);player.commitRenderStep(level);
  player.headM.rotation.set(-.8,1.8,-.5);player.commitRenderStep(level);
  const authoritative=player.headM.quaternion.clone(),simBefore=snapshot();
  for(const alpha of [.1,.5,.9]) {
    player.applyRenderInterpolation(alpha);player.prepareMaskPresentation();
    const head=player.headLookSocket.getWorldDirection(new THREE.Vector3());
    assert.ok(player.maskMesh.getWorldDirection(new THREE.Vector3()).dot(head)>.998,'rendered mask detached from the interpolated head');
    player.restoreRenderPose();near(Math.abs(player.headM.quaternion.dot(authoritative)),1,'mask changed the fixed pose');
    assert.equal(snapshot(),simBefore,'presentation changed simulation state');
  }
  const state=player.captureRunState();
  player.resumeSuspendedLevel(level,new THREE.Vector3(3,.1,-4),state);
  player.prepareMaskPresentation();assert.equal(player.uberTimer,3);assert.equal(player.masks,2);
  player.uberTimer=0;player.prepareMaskPresentation();near(player.maskMesh.rotation.x,0,'bonus return pitch');near(player.maskMesh.rotation.z,0,'bonus return roll');
  player.masks=0;player.prepareMaskPresentation();assert.equal(player.maskMesh.visible,false);assert.equal(player.maskBones.visible,false);
  player.masks=2;player.state='dead';player.prepareMaskPresentation();assert.equal(player.maskMesh.visible,false);
  level.dispose();
  console.log(`PASS mask presentation: ${cases} held transitions, worn facing/clearance, camera turns, quaternion restores and bonus resume`);
} finally { await server.close();console.warn=originalWarn;console.error=originalError; }
