import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import ts from "typescript";
import * as THREE from "three";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = await readFile(path.join(root, "src/unityOcean.ts"), "utf8");
const executable = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText
  .replace('from "three"', `from "${pathToFileURL(path.join(root, "node_modules/three/build/three.module.js"))}"`)
  .replaceAll("import.meta.env.BASE_URL", '"/"');
const { UnityOcean } = await import(`data:text/javascript;base64,${Buffer.from(executable).toString("base64")}`);
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
console.log(`PASS ${cases} actual ocean sampler ownership, quality-switch, late-load and idempotent disposal cases`);
