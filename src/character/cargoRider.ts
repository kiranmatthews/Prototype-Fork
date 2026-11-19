import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { wipeoutSurface } from './cargoRiderWipeout';
import { RooBlinkClock } from './rooBlinkTiming';

export type CargoExpression = 'live' | 'wink' | 'smile' | 'surprise';
type StretchLink = { joint: THREE.Object3D; tip: THREE.Object3D; palette: THREE.Bone; length: number };

/** The player lengthens individual shafts by translating their endpoints. Skin each shaft
 * along that same span, including the interpolated render pose, without writing to the rig. */
class RiderSkinSkeleton extends THREE.Skeleton {
  readonly spans: StretchLink[] = [];
  private readonly stretch = new THREE.Vector3(1, 1, 1);
  override update(): void {
    for (const { joint, tip, palette, length } of this.spans) {
      this.stretch.y = THREE.MathUtils.clamp(tip.position.length() / length, .2, 3.5);
      palette.matrixWorld.copy(joint.matrixWorld).scale(this.stretch);
    }
    super.update();
  }
}

const segmentTips = new Map<string, string>();
for (const side of ['left', 'right']) {
  for (const [from, to] of [['shoulder', 'elbow'], ['elbow', 'wrist'], ['hip', 'knee'], ['knee', 'ankle']]) {
    segmentTips.set(`${from}-${side}`, `${to}-${side}`);
  }
}

let pending: Promise<THREE.Group> | undefined;
function loadSurface(): Promise<THREE.Group> {
  return pending ??= new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}characters/cargo-rider/cargo-roo.glb`)
    .then(asset => asset.scene).catch(error => { pending = undefined; throw error; });
}

export class CargoRider {
  readonly root = new THREE.Group();
  readonly meshes: THREE.SkinnedMesh[] = [];
  private readonly surfaces: { mesh: THREE.SkinnedMesh; source: THREE.SkinnedMesh }[] = [];
  private detached = false;
  private readonly nativeLayers = new Map<THREE.Mesh, number>();
  private readonly channels = new Map<string, { weights: number[]; index: number }[]>();
  private readonly blink = new RooBlinkClock();
  private time = 0;
  expression: CargoExpression = 'live';

  static async load(rider: THREE.Object3D): Promise<CargoRider> {
    return new CargoRider(await loadSurface(), rider);
  }

  constructor(template: THREE.Object3D, rider: THREE.Object3D) {
    this.root.name = 'cargo-roo-surface';
    this.root.visible = false;
    this.root.userData.characterRenderProxy = true;
    const palettes = new Map<THREE.Skeleton, THREE.Skeleton>();
    template.traverse(source => {
      if (!(source instanceof THREE.SkinnedMesh)) return;
      let skeleton = palettes.get(source.skeleton);
      if (!skeleton) {
        const rest = new Map<string, THREE.Matrix4>();
        const spans: StretchLink[] = [];
        const bones = source.skeleton.bones.map(bone => {
          const joint = rider.getObjectByName(bone.name);
          const matrix = bone.userData.boneManRest;
          if (!joint || !Array.isArray(matrix) || matrix.length !== 16) throw new Error(`Missing Bone Man binding for ${bone.name}`);
          rest.set(bone.name, new THREE.Matrix4().fromArray(matrix));
          const tipName = segmentTips.get(bone.name);
          if (!tipName) return joint as THREE.Bone;
          const tip = joint.getObjectByName(tipName);
          if (!tip) throw new Error(`Missing Bone Man endpoint ${tipName}`);
          const palette = new THREE.Bone();
          palette.name = bone.name;
          spans.push({ joint, tip, palette, length: 0 });
          return palette;
        });
        const inverseBind = source.skeleton.bones.map(bone => rest.get(bone.name)!.clone().invert());
        const bound = new RiderSkinSkeleton(bones, inverseBind);
        for (const span of spans) {
          const relative = rest.get(span.joint.name)!.clone().invert().multiply(rest.get(span.tip.name)!);
          span.length = new THREE.Vector3().setFromMatrixPosition(relative).length();
          bound.spans.push(span);
        }
        skeleton = bound;
        palettes.set(source.skeleton, bound);
      }
      const mesh = new THREE.SkinnedMesh(source.geometry, source.material);
      mesh.name = source.name;
      mesh.userData.characterRenderProxy = true;
      this.surfaces.push({mesh, source});
      mesh.userData.cargoSection = source.userData.cargoSection;
      mesh.morphTargetDictionary = { ...source.morphTargetDictionary };
      mesh.bind(skeleton, new THREE.Matrix4());
      mesh.castShadow = mesh.receiveShadow = true;
      // The current animation can move well outside an imported rest-pose sphere.
      mesh.frustumCulled = false;
      this.root.add(mesh);
      this.meshes.push(mesh);
      for (const [channel, index] of Object.entries(source.morphTargetDictionary ?? {})) {
        const bindings = this.channels.get(channel) ?? [];
        bindings.push({ weights: mesh.morphTargetInfluences!, index });
        this.channels.set(channel, bindings);
      }
    });
    if (!this.meshes.length || !this.channels.has('JawOpen')) throw new Error('Incomplete Cargo Roo skin');
  }

  setVisible(active: boolean, rider: THREE.Object3D, batchRoot?: THREE.Object3D): void {
    if (this.root.visible === active) return;
    this.root.visible = active;
    if (active) {
      const hide = (node: THREE.Object3D) => {
        if (node instanceof THREE.Mesh) { this.nativeLayers.set(node, node.layers.mask); node.layers.mask = 0; }
      };
      rider.traverse(hide);
      batchRoot?.traverse(hide);
    } else {
      for (const [mesh, layers] of this.nativeLayers) mesh.layers.mask = layers;
      this.nativeLayers.clear();
      this.blink.reset();
    }
  }

  headBounds(): THREE.Box3 {
    const bounds = new THREE.Box3();
    this.root.updateWorldMatrix(true, true);
    for (const mesh of this.meshes) {
      if (!['Face', 'Eyes', 'Ears and hair'].includes(mesh.userData.cargoSection)) continue;
      mesh.skeleton.update();
      mesh.computeBoundingBox();
      if (mesh.boundingBox) bounds.union(mesh.boundingBox.clone().applyMatrix4(mesh.matrixWorld));
    }
    return bounds;
  }

  setDetached(active: boolean): void {
    if (this.detached === active) return;
    this.detached = active;
    for (const { mesh, source } of this.surfaces) mesh.geometry = active ? wipeoutSurface(source) : source.geometry;
  }

  setChannel(name: string, value: number): void {
    const amount = THREE.MathUtils.clamp(value, 0, 1);
    for (const binding of this.channels.get(name) ?? []) binding.weights[binding.index] = amount;
  }

  step(dt: number, speed: number, startled: boolean): void {
    if (!this.root.visible) return;
    this.time += Math.min(.1, Math.max(0, dt));
    const blink = this.blink.step(dt, this.expression === 'live');
    const live = this.expression === 'live';
    const wink = this.expression === 'wink';
    const grin = this.expression === 'smile';
    const alert = this.expression === 'surprise' || (live && startled);
    const activity = THREE.MathUtils.clamp(Math.abs(speed) / 15, 0, 1);
    const gaze = live ? Math.sin(.91 * this.time) * .28 : wink ? .65 : 0;
    this.setChannel('LookLeft', Math.max(0, gaze));
    this.setChannel('LookRight', Math.max(0, -gaze));
    this.setChannel('LookUp', alert ? .30 : 0);
    this.setChannel('JawOpen', alert ? .76 : grin ? .6 : live ? activity * .17 : 0);
    this.setChannel('Smile', grin ? .92 : wink ? .5 : live ? .12 : 0);
    for (const suffix of ['.L', '.R']) {
      const left = suffix === '.L';
      this.setChannel(`Blink${suffix}`, live ? blink : wink && left ? 1 : 0);
      this.setChannel(`EyeWide${suffix}`, alert ? .82 : 0);
      this.setChannel(`Squint${suffix}`, grin ? .38 : 0);
      this.setChannel(`BrowUp${suffix}`, alert ? .82 : wink && !left ? .8 : grin ? .28 : 0);
      this.setChannel(`BrowDown${suffix}`, wink && left ? .23 : 0);
      this.setChannel(`PonySwing${suffix}`, live ? activity * (.38 + .32 * Math.sin(this.time * 8 + (left ? .44 : 0))) : 0);
    }
  }
}
