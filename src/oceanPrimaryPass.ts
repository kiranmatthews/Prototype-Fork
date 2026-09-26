import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

type Phase = 0 | 1 | 2; // opaque, transparent opaque-texture backdrop, remaining

/** Reuse the primary opaque surface without changing transparent draw ordering.
 * Only public renderer/pass APIs are used; source and destination never alias. */
export class OceanPrimaryPass {
  private readonly objects: THREE.Object3D[] = [];
  private readonly masks: number[] = [];
  private readonly phases: Phase[] = [];
  private readonly lights: THREE.Light[] = [];
  private count = 0;
  private compatible = true;
  private backdropCount = 0;
  private cameraMask = 1;
  private oceanRoot: THREE.Object3D | null = null;
  private readonly copyMaterial = new THREE.RawShaderMaterial({
    name: 'Ocean primary opaque color and depth copy',
    glslVersion: THREE.GLSL3,
    uniforms: { tColor: { value: null }, tDepth: { value: null } },
    vertexShader: `precision highp float;
      in vec3 position;
      void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `precision highp float;
      precision highp sampler2D;
      uniform sampler2D tColor;
      uniform sampler2D tDepth;
      out vec4 outColor;
      void main() {
        ivec2 pixel = ivec2(gl_FragCoord.xy);
        outColor = texelFetch(tColor, pixel, 0);
        gl_FragDepth = texelFetch(tDepth, pixel, 0).r;
      }`,
    depthTest: true,
    depthWrite: true,
    depthFunc: THREE.AlwaysDepth,
    blending: THREE.NoBlending,
    toneMapped: false,
  });
  private readonly copyQuad = new FullScreenQuad(this.copyMaterial);
  private readonly shadowScene = new THREE.Scene();
  private readonly shadowCamera = new THREE.Camera();
  private readonly shadowGeometry = new THREE.BufferGeometry();
  private readonly shadowMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  private readonly shadowTrigger: THREE.Mesh;
  private shadowSourceScene: THREE.Scene | null = null;
  private shadowSourceCamera: THREE.Camera | null = null;
  private readonly renderShadows = (renderer: THREE.WebGLRenderer): void => {
    if (this.shadowSourceScene && this.shadowSourceCamera)
      renderer.shadowMap.render(this.lights, this.shadowSourceScene, this.shadowSourceCamera);
  };
  private readonly viewport = new THREE.Vector4();
  private readonly scissor = new THREE.Vector4();
  private readonly clearColor = new THREE.Color();

  constructor() {
    // WebGLShadowMap.render is public, but needs a live Three render-state
    // scope. A zero-vertex trigger provides that scope without a color draw,
    // and keeps every original caster visible while refreshing the shadows.
    this.shadowGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
    this.shadowGeometry.setDrawRange(0, 0);
    this.shadowTrigger = new THREE.Mesh(this.shadowGeometry, this.shadowMaterial);
    this.shadowTrigger.frustumCulled = false;
    this.shadowTrigger.onBeforeRender = this.renderShadows;
    this.shadowScene.add(this.shadowTrigger);
  }

  /** Read-only membership audit, including the old prepass's parent pruning. */
  prepare(scene: THREE.Scene, camera: THREE.Camera, oceanRoot: THREE.Object3D): boolean {
    this.count = 0;
    this.compatible = true;
    this.backdropCount = 0;
    this.cameraMask = camera.layers.mask;
    this.oceanRoot = oceanRoot;
    this.lights.length = 0;
    this.collect(scene, false);
    this.objects.length = this.masks.length = this.phases.length = this.count;
    return this.compatible;
  }

  private collect(object: THREE.Object3D, excludedParent: boolean): void {
    if (!object.visible) return;
    const onCamera = (object.layers.mask & this.cameraMask) !== 0;
    const light = object as THREE.Light;
    if (onCamera && light.isLight && light.castShadow) this.lights.push(light);
    const renderable = object as THREE.Object3D & { material?: THREE.Material | THREE.Material[] };
    const material = renderable.material;
    let excluded = excludedParent || object === this.oceanRoot;
    if (material) {
      const array = Array.isArray(material);
      const length = array ? material.length : 1;
      let transparent = false, hasOpaque = false, hasTransmission = false;
      for (let i = 0; i < length; i++) {
        const entry = array ? material[i] : material;
        if (entry.transparent || entry.opacity < 1) transparent = true;
        if (entry.visible && !entry.transparent) hasOpaque = true;
        if ((entry as THREE.MeshPhysicalMaterial).transmission > 0) hasTransmission = true;
      }
      const backdrop = object.userData.oceanOpaqueBackdrop === true;
      if (!backdrop && transparent) excluded = true;
      const phase: Phase = excluded ? 2 : transparent ? 1 : 0;
      if (onCamera) {
        // Leaving any opaque group for the final pass would reorder opaque
        // depth ties. Transmission also owns an independent opaque capture.
        if ((phase === 2 && hasOpaque) || hasTransmission) {
          this.compatible = false;
        }
        if (phase === 1) this.backdropCount++;
      }
      const index = this.count++;
      this.objects[index] = object;
      this.masks[index] = object.layers.mask;
      this.phases[index] = phase;
    }
    for (let i = 0; i < object.children.length; i++) this.collect(object.children[i], excluded);
  }

  /** Draw primary opaque once, export it for water, then draw the complement. */
  render(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    primary: THREE.WebGLRenderTarget,
    opaque: THREE.WebGLRenderTarget,
  ): void {
    const oldTarget = renderer.getRenderTarget();
    const oldFace = renderer.getActiveCubeFace();
    const oldMip = renderer.getActiveMipmapLevel();
    renderer.getViewport(this.viewport);
    renderer.getScissor(this.scissor);
    const oldScissorTest = renderer.getScissorTest();
    const oldAutoClear = renderer.autoClear;
    const oldXr = renderer.xr.enabled;
    const oldBackground = scene.background;
    const oldShadowAuto = renderer.shadowMap.autoUpdate;
    const oldShadowNeeds = renderer.shadowMap.needsUpdate;
    renderer.getClearColor(this.clearColor);
    const oldClearAlpha = renderer.getClearAlpha();
    let shadowsRendered = false;
    try {
      renderer.xr.enabled = false;
      renderer.autoClear = false;
      renderer.setScissorTest(false);
      if (scene.matrixWorldAutoUpdate) scene.updateMatrixWorld();
      if (camera.parent === null && camera.matrixWorldAutoUpdate) camera.updateMatrixWorld();
      this.shadowSourceScene = scene;
      this.shadowSourceCamera = camera;
      renderer.render(this.shadowScene, this.shadowCamera);
      shadowsRendered = true;
      renderer.shadowMap.autoUpdate = false;
      renderer.shadowMap.needsUpdate = false;
      // The primary target needs a readable depth texture for the copy. Its
      // color format remains unchanged. This storage is owned by this helper.
      this.attachPrimaryDepth(primary);
      this.select(0);
      renderer.setRenderTarget(primary);
      renderer.clear(true, true, true);
      renderer.render(scene, camera);

      renderer.setRenderTarget(opaque);
      this.copyMaterial.uniforms.tColor.value = primary.texture;
      this.copyMaterial.uniforms.tDepth.value = primary.depthTexture;
      this.copyQuad.render(renderer);

      scene.background = null;
      if (this.backdropCount > 0) {
        // Painted sky must appear in the refraction source, but must still
        // blend in its original sorted position against the main horizon.
        this.select(1);
        renderer.setRenderTarget(opaque);
        renderer.render(scene, camera);
      }
      this.select(2, true);
      renderer.setRenderTarget(primary);
      renderer.render(scene, camera);
    } finally {
      this.restoreMasks();
      this.shadowSourceScene = null;
      this.shadowSourceCamera = null;
      this.copyMaterial.uniforms.tColor.value = null;
      this.copyMaterial.uniforms.tDepth.value = null;
      scene.background = oldBackground;
      renderer.shadowMap.autoUpdate = oldShadowAuto;
      // A completed refresh consumes the pending update; do not request the
      // same map again merely because an auxiliary pass restores its state.
      renderer.shadowMap.needsUpdate = shadowsRendered ? false : oldShadowNeeds;
      renderer.xr.enabled = oldXr;
      renderer.autoClear = oldAutoClear;
      renderer.setClearColor(this.clearColor, oldClearAlpha);
      renderer.setRenderTarget(oldTarget, oldFace, oldMip);
      renderer.setViewport(this.viewport);
      renderer.setScissor(this.scissor);
      renderer.setScissorTest(oldScissorTest);
    }
  }

  private select(phase: Phase, includeBackdrops = false): void {
    for (let i = 0; i < this.count; i++) {
      const selected = this.phases[i] === phase || (includeBackdrops && this.phases[i] === 1);
      // Layers filter this renderable without pruning its descendants.
      this.objects[i].layers.mask = selected ? this.masks[i] : 0;
    }
  }

  private restoreMasks(): void {
    for (let i = 0; i < this.count; i++) this.objects[i].layers.mask = this.masks[i];
  }

  private attachPrimaryDepth(target: THREE.WebGLRenderTarget): void {
    if (target.depthTexture) return;
    // EffectComposer alternates two targets. Each target owns its readable
    // depth attachment and releases it through RenderTarget.dispose().
    target.dispose();
    target.depthTexture = new THREE.DepthTexture(target.width, target.height, THREE.UnsignedIntType);
    target.depthTexture.name = 'Ocean reusable primary depth';
    target.depthTexture.minFilter = target.depthTexture.magFilter = THREE.NearestFilter;
  }

  dispose(): void {
    this.objects.length = this.masks.length = this.phases.length = this.lights.length = 0;
    this.count = 0;
    this.copyQuad.dispose();
    this.copyMaterial.dispose();
    this.shadowGeometry.dispose();
    this.shadowMaterial.dispose();
    this.shadowScene.clear();
  }
}
