import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/** Sizes are metres; every packed model is fitted to a base-anchored unit box. */
export const JUNGLE_ASSETS = {
  jungleleaf: { file: "broadleaf", label: "jungle broadleaf", size: [4.2, 2.6, 4.2], wind: true },
  junglefern: { file: "fern", label: "jungle fern", size: [4.4, 1.8, 4], wind: true },
  junglepalmtree: { file: "palm", label: "jungle palm", size: [8.5, 11, 8.2], wind: true },
  templeplatform: { file: "platform", label: "carved temple platform", size: [4, 2, 4], wind: false },
  templewall: { file: "wall", label: "carved temple wall", size: [6, 5, 1.4], wind: false },
  roofedtemple: { file: "temple", label: "roofed sun temple", size: [12, 12, 10], wind: false },
  hangingarch: { file: "arch", label: "vine-hung arch", size: [18, 13, 2.8], wind: true },
  carvedlog: { file: "log", label: "carved jungle log", size: [8, 1.1, 1.3], wind: false },
  thornroots: { file: "thorns", label: "pit thorn roots", size: [4.8, 2, 4.8], wind: false },
} as const;
export type JungleAssetKind = keyof typeof JUNGLE_ASSETS;
export const JUNGLE_ASSET_KINDS = Object.keys(JUNGLE_ASSETS) as JungleAssetKind[];
export const JUNGLE_ASSET_LABELS = Object.fromEntries(JUNGLE_ASSET_KINDS.map(k => [k, JUNGLE_ASSETS[k].label])) as Record<JungleAssetKind, string>;
export function isJungleAsset(kind: string | undefined): kind is JungleAssetKind {
  return !!kind && Object.prototype.hasOwnProperty.call(JUNGLE_ASSETS, kind);
}
export interface JunglePlacement {
  dkind: JungleAssetKind;
  p: [number, number, number];
  s?: [number, number, number];
  w?: number;
  yaw?: number;
  amp?: number;
  color?: string;
}
export function jungleAssetMatrix(c: JunglePlacement): THREE.Matrix4 {
  const size = c.s ?? JUNGLE_ASSETS[c.dkind].size;
  return new THREE.Matrix4().compose(new THREE.Vector3(...c.p),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0,
      THREE.MathUtils.degToRad(c.yaw ?? 0), THREE.MathUtils.degToRad(c.amp ?? 0), "YXZ")),
    new THREE.Vector3(...size).multiplyScalar(c.w ?? 1));
}

const templates = new Map<JungleAssetKind, Promise<{ geometry: THREE.BufferGeometry; map: THREE.Texture }>>();
function loadTemplate(kind: JungleAssetKind): Promise<{ geometry: THREE.BufferGeometry; map: THREE.Texture }> {
  let pending = templates.get(kind);
  if (pending) return pending;
  pending = new GLTFLoader().loadAsync(import.meta.env.BASE_URL + `jungle-kit/${JUNGLE_ASSETS[kind].file}.glb`).then(gltf => {
    let source: THREE.Mesh | undefined;
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(o => { if ((o as THREE.Mesh).isMesh) source = o as THREE.Mesh; });
    if (!source) throw new Error(`Jungle asset ${kind} has no geometry`);
    const mesh: THREE.Mesh = source;
    const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox!;
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    geometry.translate(-center.x, -bounds.min.y, -center.z);
    geometry.scale(1 / size.x, 1 / size.y, 1 / size.z);
    const positions = geometry.getAttribute("position");
    const flex = new Float32Array(positions.count);
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      const radial = Math.hypot(positions.getX(i), positions.getZ(i));
      flex[i] = kind === "hangingarch"
        ? (1 - THREE.MathUtils.smoothstep(Math.abs(positions.getX(i)), 0.27, 0.35))
          * (1 - THREE.MathUtils.smoothstep(y, 0.48, 0.64)) * 0.35
        : kind === "junglepalmtree"
        ? Math.pow(THREE.MathUtils.smoothstep(y, 0.48, 1), 1.2) * 0.6 + y * y * 0.08
        : Math.min(1, Math.pow(radial * 1.6 + y * 0.45, 1.5)) * THREE.MathUtils.smoothstep(y, 0, 0.12);
    }
    geometry.setAttribute("aJungleFlex", new THREE.BufferAttribute(flex, 1));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    // The wind reaches outside the static leaf bounds, including in shadow passes.
    geometry.boundingBox!.expandByScalar(0.065);
    geometry.boundingSphere!.radius += 0.065;
    geometry.userData.shared = true;
    const sourceMaterial = mesh.material as THREE.MeshStandardMaterial;
    const map = sourceMaterial.map!;
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    map.userData.shared = true;
    // Only the geometry and base colour are kept by the shared template.
    gltf.scene.traverse(o => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry.dispose();
      for (const material of Array.isArray(m.material) ? m.material : [m.material]) material.dispose();
    });
    return { geometry, map };
  });
  templates.set(kind, pending);
  return pending;
}

const WIND = /* glsl */ `
vec4 jungleOrigin = vec4(0.0, 0.0, 0.0, 1.0);
#ifdef USE_INSTANCING
  jungleOrigin = instanceMatrix * jungleOrigin;
#endif
jungleOrigin = modelMatrix * jungleOrigin;
float junglePhase = uJungleTime * 1.15 + jungleOrigin.x * 0.37 + jungleOrigin.z * 0.19;
float jungleGust = sin(junglePhase) * 0.026 + sin(junglePhase * 0.43 + 1.8) * 0.012;
transformed.x += jungleGust * aJungleFlex;
transformed.z += cos(junglePhase * 0.73 + position.x * 3.0) * 0.02 * aJungleFlex;
transformed.y += sin(junglePhase * 1.42 + position.z * 5.0) * 0.012 * aJungleFlex;
`;
const WORLD = /* glsl */ `
vec4 jungleWorld = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  jungleWorld = instanceMatrix * jungleWorld;
#endif
vJungleWorld = (modelMatrix * jungleWorld).xyz;
`;

/** Moving canopy shade costs a few ALU operations, with no extra render pass. */
export function addJungleDapple(material: THREE.Material, time: { value: number }, wind = false): void {
  const previous = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    shader.uniforms.uJungleTime = time;
    shader.vertexShader = `uniform float uJungleTime;\n${wind ? 'attribute float aJungleFlex;' : ''}\nvarying vec3 vJungleWorld;\n` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>\n${wind ? WIND : ''}\n${WORLD}`);
    shader.fragmentShader = 'uniform float uJungleTime;\nvarying vec3 vJungleWorld;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
      float shadeWave = sin(vJungleWorld.x * 0.48 + vJungleWorld.z * 0.33 + sin(uJungleTime * 0.21) * 0.15)
        * sin(vJungleWorld.z * 0.68 - vJungleWorld.x * 0.23);
      float lightPool = smoothstep(-0.34, 0.6, shadeWave);
      diffuseColor.rgb *= mix(vec3(0.60, 0.75, 0.70), vec3(1.06, 1.02, 0.90), lightPool);
    `);
  };
  material.customProgramCacheKey = () => `jungle-dapple-v1-${wind}`;
}

interface Bucket { kind: JungleAssetKind; transforms: THREE.Matrix4[]; colors: THREE.Color[]; }
export class JungleAssetKit {
  readonly root = new THREE.Group();
  readonly time = { value: 0 };
  readonly errors: string[] = [];
  private buckets = new Map<string, Bucket>();
  private jobs: Promise<void>[] = [];
  private materials = new Map<JungleAssetKind, THREE.MeshStandardMaterial>();
  private depths = new Map<JungleAssetKind, THREE.MeshDepthMaterial>();
  private loose = new Set<THREE.Group>();
  private disposed = false;
  private count = 0;
  private readyCount = 0;

  constructor(private batched: boolean, private lite: boolean) { this.root.name = "Jungle Ruins asset kit"; }

  private material(kind: JungleAssetKind, map: THREE.Texture): THREE.MeshStandardMaterial {
    let m = this.materials.get(kind);
    if (m) return m;
    m = new THREE.MeshStandardMaterial({ map, roughness: 0.96, metalness: 0,
      side: kind.startsWith("jungle") ? THREE.DoubleSide : THREE.FrontSide });
    m.name = JUNGLE_ASSETS[kind].label;
    m.userData.jungleAsset = true;
    addJungleDapple(m, this.time, JUNGLE_ASSETS[kind].wind);
    this.materials.set(kind, m);
    return m;
  }

  private configure(mesh: THREE.Mesh, kind: JungleAssetKind): void {
    mesh.name = JUNGLE_ASSETS[kind].label;
    mesh.userData.jungleAsset = kind;
    mesh.castShadow = !this.lite;
    mesh.receiveShadow = !this.lite;
    if (!JUNGLE_ASSETS[kind].wind) return;
    let depth = this.depths.get(kind);
    if (!depth) {
      depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
      depth.onBeforeCompile = shader => {
        shader.uniforms.uJungleTime = this.time;
        shader.vertexShader = 'uniform float uJungleTime;\nattribute float aJungleFlex;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + WIND);
      };
      depth.customProgramCacheKey = () => 'jungle-wind-depth-v1';
      this.depths.set(kind, depth);
    }
    mesh.customDepthMaterial = depth;
  }

  add(c: JunglePlacement): THREE.Group | null {
    if (this.disposed) throw new Error('Jungle asset kit is disposed');
    const kind = c.dkind;
    this.count++;
    // Lite smoke retains architecture; foliage comes back in the full pass.
    if (this.lite && kind.startsWith("jungle")) return null;
    const matrix = jungleAssetMatrix(c);
    if (this.batched) {
      const key = `${kind}:${Math.floor(c.p[0] / 32)}:${Math.floor(c.p[2] / 32)}`;
      let bucket = this.buckets.get(key);
      if (!bucket) {
        bucket = { kind, transforms: [], colors: [] };
        this.buckets.set(key, bucket);
      }
      bucket.transforms.push(matrix);
      bucket.colors.push(new THREE.Color(c.color ?? '#ffffff'));
      return null;
    }
    const holder = new THREE.Group();
    holder.name = JUNGLE_ASSETS[kind].label;
    matrix.decompose(holder.position, holder.quaternion, holder.scale);
    this.root.add(holder);
    this.loose.add(holder);
    this.jobs.push(loadTemplate(kind).then(({ geometry, map }) => {
      if (this.disposed) return;
      const mesh = new THREE.Mesh(geometry, this.material(kind, map));
      this.configure(mesh, kind);
      mesh.userData.editorIdx = holder.userData.editorIdx;
      holder.add(mesh);
      holder.userData.assetReady = true;
      this.readyCount++;
    }).catch(error => this.failed(kind, error)));
    return holder;
  }

  /** Instances are partitioned into 32m cells so camera and shadow culling agree. */
  flush(): void {
    for (const bucket of this.buckets.values()) {
      this.jobs.push(loadTemplate(bucket.kind).then(({ geometry, map }) => {
        if (this.disposed) return;
        const mesh = new THREE.InstancedMesh(geometry, this.material(bucket.kind, map), bucket.transforms.length);
        bucket.transforms.forEach((matrix, i) => {
          mesh.setMatrixAt(i, matrix);
          mesh.setColorAt(i, bucket.colors[i]);
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.computeBoundingBox();
        mesh.computeBoundingSphere();
        this.configure(mesh, bucket.kind);
        this.root.add(mesh);
        this.readyCount += bucket.transforms.length;
      }).catch(error => this.failed(bucket.kind, error)));
    }
    this.buckets.clear();
  }

  private failed(kind: JungleAssetKind, error: unknown): void {
    if (this.disposed || this.errors.includes(kind)) return;
    this.errors.push(kind);
    const url = (error as { response?: { url?: string } }).response?.url;
    if (url !== "") console.error(`Jungle asset failed: ${kind}`, error);
  }
  async ready(): Promise<void> { await Promise.all(this.jobs); }
  update(dt: number): void { if (!this.disposed) this.time.value += Math.max(0, Math.min(dt, 0.1)); }
  get diagnostics() {
    let draws = 0, triangles = 0;
    this.root.traverse(o => {
      const mesh = o as THREE.InstancedMesh;
      if (!mesh.isMesh) return;
      draws++;
      triangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3 * (mesh.isInstancedMesh ? mesh.count : 1);
    });
    return { placements: this.count, ready: this.readyCount, draws, triangles, errors: [...this.errors], windTime: this.time.value };
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.traverse(o => { if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose(); });
    this.root.removeFromParent();
    this.root.clear();
    for (const holder of this.loose) { holder.removeFromParent(); holder.clear(); }
    this.loose.clear();
    for (const m of this.materials.values()) m.dispose();
    for (const m of this.depths.values()) m.dispose();
    this.materials.clear(); this.depths.clear(); this.buckets.clear();
  }
}
