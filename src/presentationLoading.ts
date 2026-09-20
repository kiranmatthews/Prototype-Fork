import * as THREE from "three";

/** Two RAF boundaries allow the browser to paint before synchronous scene work. */
export const afterPresentationPaint = (): Promise<void> => new Promise((resolve) => {
  requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
});

/** RAF is not a GPU completion signal, especially on a tile-based phone GPU. */
export async function waitForPresentationGpu(renderer:THREE.WebGLRenderer,paint=afterPresentationPaint):Promise<void> {
  const gl=renderer.getContext() as WebGL2RenderingContext;
  if(gl.isContextLost())return;
  const fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);
  if(!fence)return;
  gl.flush();
  try{
    while(!gl.isContextLost()){
      const status=gl.clientWaitSync(fence,0,0);
      if(status===gl.ALREADY_SIGNALED||status===gl.CONDITION_SATISFIED||status===gl.WAIT_FAILED)return;
      await paint();
    }
  }finally{gl.deleteSync(fence);}
}

/** Spread first-use texture uploads across paints while the destination is covered. */
export async function warmPresentationTextures(renderer:THREE.WebGLRenderer,root:THREE.Object3D):Promise<void> {
  const textures=new Set<THREE.Texture>();
  root.traverseVisible(object=>{
    const material=(object as THREE.Mesh).material;
    for(const m of material?(Array.isArray(material)?material:[material]):[]){
      for(const value of Object.values(m))if(value instanceof THREE.Texture&&!value.isRenderTargetTexture)textures.add(value);
      for(const uniform of Object.values((m as THREE.ShaderMaterial).uniforms??{})){
        const value=uniform.value;if(value instanceof THREE.Texture&&!value.isRenderTargetTexture)textures.add(value);
      }
    }
  });
  let started=performance.now();
  for(const texture of textures){
    if(renderer.getContext().isContextLost())return;
    if(!texture.image)continue;
    renderer.initTexture(texture);
    if(performance.now()-started>=4){await afterPresentationPaint();started=performance.now();}
  }
  await waitForPresentationGpu(renderer);
}

/** Exercise real surface AND shadow programs/buffers in small covered batches.
 * compile() alone misses depth variants and first-use vertex uploads. */
export async function warmPresentationScene(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.Camera):Promise<void> {
  const meshes:THREE.Object3D[]=[],lights:THREE.Light[]=[];
  scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
  scene.traverseVisible(object=>{
    if((object as THREE.Light).isLight&&object.layers.test(camera.layers))lights.push(object as THREE.Light);
  });
  const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  const shadows=lights.flatMap(light=>{
    const shadow=(light as THREE.DirectionalLight).shadow;
    if(!light.castShadow||!shadow)return [];
    shadow.updateMatrices(light);return [shadow.getFrustum()];
  });
  scene.traverseVisible(object=>{
    if(!object.layers.test(camera.layers))return;
    const mesh=object as THREE.Mesh;
    if(mesh.isMesh||(object as THREE.Sprite).isSprite||(object as THREE.Line).isLine){
      const intersects=(f:THREE.Frustum)=>(object as THREE.Sprite).isSprite?f.intersectsSprite(object as THREE.Sprite):f.intersectsObject(object);
      if(!object.frustumCulled||intersects(frustum)||(object.castShadow&&shadows.some(intersects)))meshes.push(object);
    }
  });
  const target=new THREE.WebGLRenderTarget(8,8);
  const layer=1<<31,cameraMask=camera.layers.mask;
  const masks=meshes.map(o=>o.layers.mask),culled=meshes.map(o=>o.frustumCulled),lightMasks=lights.map(o=>o.layers.mask);
  const viewport=new THREE.Vector4(),scissor=new THREE.Vector4();
  try{
    for(let start=0;start<meshes.length;start+=24){
      if(renderer.getContext().isContextLost())return;
      const previous=renderer.getRenderTarget(),autoClear=renderer.autoClear,scissorTest=renderer.getScissorTest();
      renderer.getViewport(viewport);renderer.getScissor(scissor);
      try{
        camera.layers.mask=layer;
        lights.forEach(light=>light.layers.mask|=layer);
        meshes.forEach(object=>object.layers.mask&=~layer);
        for(let i=start;i<Math.min(start+24,meshes.length);i++){meshes[i].layers.mask=layer;meshes[i].frustumCulled=false;}
        renderer.autoClear=true;renderer.setRenderTarget(target);renderer.setScissorTest(false);
        renderer.render(scene,camera);
      }finally{
        camera.layers.mask=cameraMask;
        lights.forEach((light,i)=>light.layers.mask=lightMasks[i]);
        meshes.forEach((object,i)=>{object.layers.mask=masks[i];object.frustumCulled=culled[i];});
        renderer.setRenderTarget(previous);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);renderer.autoClear=autoClear;
      }
      await waitForPresentationGpu(renderer);
      await afterPresentationPaint();
    }
  }finally{target.dispose();renderer.shadowMap.needsUpdate=true;}
}

/** Track nested GLTF/image/texture requests, not just the manager's first URL. */
export class PresentationAssetReadiness {
  private pending = new Map<string, number>();
  private failures = new Set<string>();
  private revision = 0;

  constructor(manager: THREE.LoadingManager) {
    const start = manager.itemStart.bind(manager);
    const end = manager.itemEnd.bind(manager);
    const error = manager.itemError.bind(manager);
    manager.itemStart = (url) => {
      this.pending.set(url, (this.pending.get(url) ?? 0) + 1);
      this.revision++;
      start(url);
    };
    manager.itemEnd = (url) => {
      const count = this.pending.get(url) ?? 0;
      if (count <= 1) this.pending.delete(url);
      else this.pending.set(url, count - 1);
      this.revision++;
      end(url);
    };
    manager.itemError = (url) => { this.failures.add(url); error(url); };
  }

  get diagnostics(): { pending: string[]; failed: string[]; revision: number } {
    return { pending: [...this.pending.keys()], failed: [...this.failures], revision: this.revision };
  }

  async waitUntilSettled(paint = afterPresentationPaint): Promise<void> {
    // An onLoad callback can start child textures or attach a decoded GLTF in
    // a microtask. Require a quiet painted interval after the final completion.
    for (;;) {
      const revision = this.revision;
      await paint();
      if (this.pending.size === 0 && revision === this.revision) return;
    }
  }
}

// Imported before construction of the first Level/Player. Individual asset
// owners keep their existing error/fallback behavior; a failed request settles
// normally instead of holding the user behind an endless loading screen.
export const presentationAssets = new PresentationAssetReadiness(THREE.DefaultLoadingManager);

/** Include canvas-backed portrait/sticker images in the same readiness gate. */
export function trackPresentationImage(image: HTMLImageElement, url: string): void {
  const manager = THREE.DefaultLoadingManager;
  manager.itemStart(url);
  let settled = false;
  const finish = (failed: boolean): void => {
    if (settled) return;
    settled = true;
    if (failed) manager.itemError(url);
    manager.itemEnd(url);
  };
  image.addEventListener("load", () => finish(false), { once: true });
  image.addEventListener("error", () => finish(true), { once: true });
}

export type LoadingTransitionPhase = "cover" | "prepare-vortex" | "vortex" | "cover-destination" | "prepare-destination" | "reveal";
export const MINIMUM_VORTEX_MS = 2000;

export interface LoadingTransitionHooks {
  phase: (phase: LoadingTransitionPhase) => void;
  prepareVortex: () => Promise<void>;
  load: () => void | Promise<void>;
  waitForAssets: () => Promise<void>;
  prepareDestination: () => Promise<void>;
  now?: () => number;
  wait?: (milliseconds: number) => Promise<void>;
  paint?: () => Promise<void>;
}

/** Readiness-driven sequence; the input lock is held by GameFlowUI throughout. */
export async function runLoadingTransition(hooks: LoadingTransitionHooks, reducedMotion: boolean, vortex = true): Promise<void> {
  const wait = hooks.wait ?? ((ms) => new Promise<void>((resolve) => window.setTimeout(resolve, ms)));
  const now = hooks.now ?? (() => performance.now());
  const paint = hooks.paint ?? afterPresentationPaint;
  const fade = reducedMotion ? 20 : 360;
  hooks.phase("cover");
  await wait(fade);
  await paint();
  let loading:Promise<void>|undefined;
  if (vortex) {
    hooks.phase("prepare-vortex");
    await hooks.prepareVortex();
    // The synchronous level/collision build belongs under opaque black. Start
    // it before revealing the animated loader; its asynchronous asset work
    // continues while the vortex is visible.
    loading=Promise.resolve(hooks.load());
    void loading.catch(()=>{}); // handled by the awaited load below, after reveal
    await paint();
    hooks.phase("vortex");
    await wait(fade);
    await paint();
  }
  const visibleAt = now();
  await (loading??hooks.load());
  await hooks.waitForAssets();
  if (vortex) {
    await wait(Math.max(0, MINIMUM_VORTEX_MS - (now() - visibleAt)));
    hooks.phase("cover-destination");
    await wait(fade);
    await paint();
  }
  hooks.phase("prepare-destination");
  await hooks.prepareDestination();
  await paint();
  hooks.phase("reveal");
  await wait(reducedMotion ? 20 : 520);
  await paint();
}
