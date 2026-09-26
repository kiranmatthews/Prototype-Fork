import assert from "node:assert/strict";
import { createServer } from "vite";
import * as THREE from "three";

// Load the actual local dependency graph, including the primary-scene helper.
const server = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true } });
let UnityOcean;
try {
  ({ UnityOcean } = await server.ssrLoadModule("/src/unityOcean.ts"));
} finally {
  await server.close();
}
const originalLoad = THREE.TextureLoader.prototype.load;
let pending = [];
THREE.TextureLoader.prototype.load = function (_url, ready) {
  const texture = new THREE.Texture();
  pending.push(() => ready?.(texture));
  return texture;
};
let cases = 0;
try {
  {
    const ocean = new UnityOcean({ seaLevel: -1, shoreDirX: 1, shoreDirZ: 0,
      shore: [{ x: 0, z: 20 }, { x: 0, z: -20 }], quality: 'full' });
    pending.forEach(ready => ready());
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 4, 10);
    const solid = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    const glass = new THREE.Mesh(solid.geometry, new THREE.MeshBasicMaterial({ transparent: true }));
    const faded = new THREE.Mesh(solid.geometry, new THREE.MeshBasicMaterial({ opacity: .5 }));
    const mixed = new THREE.Mesh(solid.geometry, [solid.material, glass.material]);
    const backdrop = new THREE.Mesh(solid.geometry, glass.material);
    backdrop.userData.oceanOpaqueBackdrop = true;
    const hidden = new THREE.Group(); hidden.visible = false;
    const unvisited = new THREE.Object3D();
    Object.defineProperty(unvisited, 'material', { get() { throw new Error('invisible branch was visited'); } });
    hidden.add(unvisited);
    const transparentChild = new THREE.Object3D();
    Object.defineProperty(transparentChild, 'material', { get() { throw new Error('transparent branch was visited'); } });
    glass.add(transparentChild);
    scene.add(ocean.group, solid, glass, faded, mixed, backdrop, hidden);
    scene.fog = new THREE.Fog(0xffffff, 1, 100);
    const originalTarget = {}, originalFog = scene.fog;
    let activeTarget = originalTarget, clears = 0, shadowDraws = 0, shouldThrow = false;
    const renderer = {
      xr: { enabled: true }, autoClear: true,
      shadowMap: { enabled: true, autoUpdate: true, needsUpdate: true },
      getDrawingBufferSize: size => size.set(320, 180), getPixelRatio: () => 1,
      getRenderTarget: () => activeTarget, setRenderTarget: target => { activeTarget = target; },
      clear: () => clears++,
      render() {
        if (this.autoClear) clears++;
        if (this.shadowMap.enabled && (this.shadowMap.autoUpdate || this.shadowMap.needsUpdate)) {
          shadowDraws++; this.shadowMap.needsUpdate = false;
        }
        assert.equal(ocean.group.visible, false);
        if (activeTarget === ocean.prepassTarget) {
          assert.equal(solid.visible, true); assert.equal(backdrop.visible, true);
          assert.equal(glass.visible, false); assert.equal(faded.visible, false); assert.equal(mixed.visible, false);
          assert.equal(hidden.visible, false); assert.equal(transparentChild.visible, true);
        }
        if (shouldThrow) throw new Error('synthetic render failure');
      },
    };
    const assertRestored = () => {
      assert.equal(activeTarget, originalTarget); assert.equal(renderer.xr.enabled, true);
      assert.equal(renderer.autoClear, true); assert.equal(renderer.shadowMap.enabled, true);
      assert.equal(renderer.shadowMap.autoUpdate, true); assert.equal(renderer.shadowMap.needsUpdate, true);
      assert.equal(scene.fog, originalFog); assert.equal(ocean.group.visible, true);
      for (const object of [solid, glass, faded, mixed, backdrop, transparentChild]) assert.equal(object.visible, true);
      assert.equal(hidden.visible, false); assert.equal(ocean.prepassHidden.length, 0);
    };
    for (const failure of [false, true]) {
      shouldThrow = failure;
      for (const method of ['renderPrepass', 'renderReflection']) {
        const before = clears;
        if (failure) assert.throws(() => ocean[method](renderer, scene, camera), /synthetic render failure/);
        else ocean[method](renderer, scene, camera);
        assert.equal(clears, before + 1, 'each auxiliary pass clears exactly once');
        assertRestored();
      }
    }
    assert.equal(shadowDraws, 0, 'auxiliary views must preserve a pending primary shadow refresh');
    shouldThrow = false;
    // Material replacement and editor opacity changes apply on the next frame.
    const replacement = new THREE.MeshBasicMaterial(); glass.remove(transparentChild); glass.material = replacement;
    faded.material.opacity = 1; mixed.material = replacement;
    renderer.render = () => {
      assert.equal(glass.visible, true); assert.equal(faded.visible, true); assert.equal(mixed.visible, true);
    };
    ocean.renderPrepass(renderer, scene, camera); assertRestored();
    for (const material of new Set([solid.material, backdrop.material, faded.material, replacement])) material.dispose();
    solid.geometry.dispose(); ocean.dispose(); cases++;
  }
  {
    const ocean=new UnityOcean({seaLevel:-1,shoreDirX:1,shoreDirZ:0,shore:[{x:0,z:20},{x:0,z:-20}],quality:'full'});
    let visible=false,deleted=0,passes=0,valid=true;
    const gl={ANY_SAMPLES_PASSED_CONSERVATIVE:1,QUERY_RESULT_AVAILABLE:2,QUERY_RESULT:3,
      isContextLost:()=>false,createQuery:()=>({}),beginQuery(){},endQuery(){},isQuery:()=>valid,
      getQueryParameter:(_q,key)=>key===2?true:visible,deleteQuery:()=>deleted++};
    const renderer={getContext:()=>gl},camera=new THREE.PerspectiveCamera();
    ocean.update=()=>{};ocean.renderReflection=()=>passes++;ocean.renderPrepass=()=>passes++;
    const draw=()=>{ocean.ribbon.onBeforeRender(renderer);ocean.ribbon.onAfterRender();};
    ocean.renderPasses(renderer,new THREE.Scene(),camera);assert.equal(passes,2);
    draw();ocean.renderPasses(renderer,new THREE.Scene(),camera);assert.equal(passes,2,'fully occluded water must not redraw the world twice');
    draw();visible=true;ocean.renderPasses(renderer,new THREE.Scene(),camera);assert.equal(passes,4,'newly visible water resumes full-quality passes');
    draw();visible=false;camera.position.x=10;ocean.renderPasses(renderer,new THREE.Scene(),camera);assert.equal(passes,6,'teleports need fresh buffers immediately');
    draw();valid=false;ocean.renderPasses(renderer,new THREE.Scene(),camera);assert.equal(passes,8,'context reset must discard stale occlusion');
    assert.equal(deleted,3);ocean.dispose();
  }
  for (const quality of ["lite", "full"]) for (const lateLoad of [false, true]) {
    pending = [];
    const ocean = new UnityOcean({ seaLevel: -1, shoreDirX: 1, shoreDirZ: 0,
      shore: [{ x: 0, z: 20 }, { x: 0, z: -20 }], quality });
    const uniforms = ocean.oceanMaterial.uniforms;
    const samplers = Object.values(uniforms).map(uniform => uniform.value).filter(value => value?.isTexture);
    const disposed = new Map();
    for (const texture of new Set(samplers)) {
      disposed.set(texture, 0);
      texture.addEventListener("dispose", () => disposed.set(texture, disposed.get(texture) + 1));
    }
    assert.equal(disposed.size, 7, "Five image maps and two fallbacks must be owned");
    if (!lateLoad) pending.forEach(ready => ready());
    const other = new UnityOcean({ seaLevel: -1, shoreDirX: 1, shoreDirZ: 0,
      shore: [{ x: 0, z: 10 }, { x: 0, z: -10 }], quality });
    assert.notEqual(uniforms.fogColor.value, other.oceanMaterial.uniforms.fogColor.value,
      "Default fog uniforms must stay instance-local");
    other.dispose();
    ocean.setQuality("full"); ocean.resize(320, 180);
    assert.notEqual(uniforms.uSceneColor.value, ocean.fallbackColor, "Full passes bind the actual render target");
    const targets = [ocean.reflectionRenderTarget, ocean.prepassRenderTarget];
    let targetsDisposed = 0;
    targets.forEach(target => target.addEventListener("dispose", () => targetsDisposed++));
    ocean.setQuality("lite");
    assert.equal(targetsDisposed, 2, "Quality change disposes both targets");
    assert.equal(uniforms.uSceneColor.value, ocean.fallbackColor);
    assert.equal(uniforms.uSceneDepth.value, ocean.fallbackDepth);
    assert.equal(uniforms.uReflection.value, ocean.fallbackColor);
    ocean.dispose(); ocean.dispose();
    if (lateLoad) pending.forEach(ready => ready());
    assert.equal(ocean.group.children.length, 0, "Late image completion cannot reattach disposed ocean geometry");
    for (const [texture, count] of disposed)
      assert.equal(count, 1, `Rendered ${texture.constructor.name} sampler must dispose exactly once`);
    cases++;
  }
} finally { THREE.TextureLoader.prototype.load = originalLoad; }
console.log(`PASS ${cases} ocean pass visibility, shadow isolation, clear count, failure recovery, sampler ownership and disposal cases`);
