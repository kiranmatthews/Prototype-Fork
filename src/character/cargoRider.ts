import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { wipeoutSurface } from './cargoRiderWipeout';
import { RooBlinkClock } from './rooBlinkTiming';

import { performanceControls, type CargoExpression } from './cargoRiderPerformance';
export type { CargoExpression } from './cargoRiderPerformance';
type StretchLink = { joint: THREE.Object3D; tip: THREE.Object3D; palette: THREE.Bone; length: number };

/** The player lengthens individual shafts by translating their endpoints. Skin each shaft
 * along that same span, including the interpolated render pose, without writing to the rig. */
class RiderSkinSkeleton extends THREE.Skeleton {
  readonly spans: StretchLink[] = [];
  private readonly stretch = new THREE.Vector3(1, 1, 1);
  private readonly chestSpace = new THREE.Matrix4();
  private readonly direction = new THREE.Vector3();
  private readonly shoulder = new THREE.Vector3();
  readonly shoulderFolds: { joint: THREE.Object3D; elbow: THREE.Object3D; write: (weight: number) => void }[] = [];
  chest?: THREE.Object3D;
  override update(): void {
    for (const { joint, tip, palette, length } of this.spans) {
      this.stretch.y = THREE.MathUtils.clamp(tip.position.length() / length, .2, 3.5);
      palette.matrixWorld.copy(joint.matrixWorld).scale(this.stretch);
    }
    if (this.chest && this.shoulderFolds.length) {
      this.chestSpace.copy(this.chest.matrixWorld).invert();
      for (const fold of this.shoulderFolds) {
        this.shoulder.setFromMatrixPosition(fold.joint.matrixWorld).applyMatrix4(this.chestSpace);
        this.direction.setFromMatrixPosition(fold.elbow.matrixWorld).applyMatrix4(this.chestSpace).sub(this.shoulder).normalize();
        const close = THREE.MathUtils.clamp((.64 - Math.abs(this.direction.x)) / .35, 0, 1);
        const lowered = THREE.MathUtils.clamp((-this.direction.y - .60) / .27, 0, 1);
        fold.write(close * lowered);
      }
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
  private readonly headTurnBone: THREE.Object3D;
  private readonly lastHeadRotation = new THREE.Quaternion();
  private readonly headRotation = new THREE.Quaternion();
  private readonly turnDelta = new THREE.Quaternion();
  private hasHeadRotation = false;
  private hairLag = 0;
  private time = 0;
  private lastExpression?: CargoExpression;
  private startle = 0;
  expression: CargoExpression = 'live';

  static async load(rider: THREE.Object3D): Promise<CargoRider> {
    return new CargoRider(await loadSurface(), rider);
  }

  constructor(template: THREE.Object3D, rider: THREE.Object3D) {
    this.headTurnBone = rider.getObjectByName('head-presentation') ?? rider;
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
        bound.chest = rider.getObjectByName('chest');
        for (const side of ['left', 'right']) {
          const joint = rider.getObjectByName('shoulder-' + side), elbow = rider.getObjectByName('elbow-' + side);
          const channel = side === 'left' ? 'ShoulderRelax.L' : 'ShoulderRelax.R';
          if (joint && elbow) bound.shoulderFolds.push({ joint, elbow, write: weight => this.setChannel(channel, weight) });
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
      this.hasHeadRotation = false;
      this.hairLag = 0;
      this.lastExpression = undefined;
      this.startle = 0;
    }
  }

  headBounds(): THREE.Box3 {
    const bounds = new THREE.Box3();
    this.root.updateWorldMatrix(true, true);
    for (const mesh of this.meshes) {
      if (!['Face', 'Eyes', 'Ears and hair', 'Dentition'].includes(mesh.userData.cargoSection)) continue;
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
    if (this.expression !== this.lastExpression) {
      for (const name of this.channels.keys()) this.setChannel(name, 0);
      const pose = performanceControls(this.expression);
      if (pose) {
        // The complete target has normals evaluated on the combined sculpture.
        this.setChannel('Pose.' + this.expression, 1);
      }
      this.lastExpression = this.expression;
    }
    const elapsed = Math.min(.1, Math.max(0, dt));
    if (elapsed > 0) {
      this.headTurnBone.getWorldQuaternion(this.headRotation);
      let targetLag = 0;
      if (this.hasHeadRotation && dt <= .1) {
        this.turnDelta.copy(this.lastHeadRotation).invert().multiply(this.headRotation);
        const sign = this.turnDelta.w < 0 ? -1 : 1;
        const turn = 2 * Math.atan2(sign * this.turnDelta.y, Math.max(.001, sign * this.turnDelta.w));
        targetLag = THREE.MathUtils.clamp(turn / (6 * elapsed), -.76, .76);
      }
      this.lastHeadRotation.copy(this.headRotation);
      this.hasHeadRotation = true;
      this.hairLag = THREE.MathUtils.damp(this.hairLag, targetLag, 8.5, elapsed);
      if (Math.abs(this.hairLag) < .0002) this.hairLag = 0;
    }
    this.setChannel('HairSweep.L', Math.max(0, this.hairLag));
    this.setChannel('HairSweep.R', Math.max(0, -this.hairLag));
    if (performanceControls(this.expression)) return;
    const blink = this.blink.step(dt, this.expression === 'live');
    const live = this.expression === 'live';
    const wink = this.expression === 'wink';
    const grin = this.expression === 'smile';
    this.startle = THREE.MathUtils.damp(this.startle, live && startled ? 1 : 0, startled ? 23 : 7, dt);
    const alert = this.expression === 'surprise' ? 1 : live ? this.startle : 0;
    this.setChannel('IrisPin', .42 * alert);
    this.setChannel('FaceStretch', .24 * alert);
    this.setChannel('Funnel', .30 * alert);
    const activity = THREE.MathUtils.clamp(Math.abs(speed) / 15, 0, 1);
    const poise = live ? (1 - alert) * (1 - .3 * activity) : 0;
    const gaze = live ? Math.sin(.91 * this.time) * .28 - .17 * poise : wink ? .65 : 0;
    this.setChannel('LookLeft', Math.max(0, gaze));
    this.setChannel('LookRight', Math.max(0, -gaze));
    this.setChannel('LookUp', .30 * alert);
    this.setChannel('LookDown', .07 * poise);
    this.setChannel('JawOpen', Math.max(.67 * alert, grin ? .47 : live ? .018 * poise + activity * .13 : 0));
    this.setChannel('Smile', grin ? .92 : wink ? .5 : .06 * poise);
    for (const suffix of ['.L', '.R']) {
      const left = suffix === '.L';
      this.setChannel(`Blink${suffix}`, live ? blink : wink && left ? 1 : 0);
      this.setChannel(`EyeWide${suffix}`, .82 * alert);
      this.setChannel(`EarPerk${suffix}`, .56 * alert);
      this.setChannel(`EarStretch${suffix}`, .20 * alert);
      this.setChannel(`EarFold${suffix}`, (left ? .07 : .14) * poise);
      this.setChannel(`Smile${suffix}`, (left ? .04 : .14) * poise);
      this.setChannel(`Squint${suffix}`, grin ? .38 : left ? .12 * poise : 0);
      this.setChannel(`BrowUp${suffix}`, Math.max(alert * .82, wink && !left ? .8 : grin ? .28 : !left ? .13 * poise : 0));
      this.setChannel(`BrowDown${suffix}`, wink && left ? .23 : left ? .055 * poise : 0);
      this.setChannel(`PonySwing${suffix}`, live ? activity * (.38 + .32 * Math.sin(this.time * 8 + (left ? .44 : 0))) : 0);
    }
  }
}
