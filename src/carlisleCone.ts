import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { AssetCache, disposeTextures } from './assetLifetime';
import { sceneryLoads } from './assetLoadQueue';
import { characterElasticityAmplitudes } from './animation/elasticity';
import { enemyElasticPulse } from './enemies/elasticity';
import type { CustomComponent, CustomLevelData } from './level';
import { rigLiteralCone } from './carlisleConeRig';

export type ConeClip = 'idle' | 'walk' | 'jump' | 'slash';
export const CONE_ELASTICITY = { idle: 1.25, walk: 1, jump: .65, slash: .8, arms: .9 };
const CLIPS: ConeClip[] = ['idle', 'walk', 'jump', 'slash'];
export const isCarlisleConeRow = (c: CustomComponent) => c.t === 'mesh' && c.solid === false &&
  / · red teeth \d+\.\d+$/.test(c.nm ?? '') && c.vertices?.length === 45;
const assetUrl = () => `${import.meta.env.BASE_URL}props/carlisle-cone/cone-body.glb`;
const cache = new AssetCache<string, GLTF>(async (url, _dependency, wanted) => {
  const asset = rigLiteralCone(await sceneryLoads.run(() => new GLTFLoader().loadAsync(url), wanted));
  asset.scene.traverse(node => {
    const mesh = node as THREE.Mesh; if (!mesh.isMesh) return;
    mesh.geometry.userData.shared = true;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      material.userData.shared = true;
      const pbr = material as THREE.MeshStandardMaterial;
      if (typeof pbr.roughness === 'number') pbr.roughness = Math.max(.68, pbr.roughness);
      for (const value of Object.values(material)) if (value?.isTexture) value.userData.shared = true;
    }
  });
  return asset;
}, asset => {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>(), skeletons = new Set<THREE.Skeleton>();
  asset.scene.traverse(node => {
    const mesh = node as THREE.SkinnedMesh; if (!mesh.isMesh) return;
    geometries.add(mesh.geometry); if (mesh.isSkinnedMesh) skeletons.add(mesh.skeleton);
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material);
  });
  for (const material of materials) {
    for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    material.dispose();
  }
  for (const geometry of geometries) geometry.dispose();
  for (const skeleton of skeletons) skeleton.dispose();
  disposeTextures(textures);
});
export function acquireConeAsset() { return cache.acquire(assetUrl()); }

/** Local animation only. No root scale animation, actor travel, or collision ownership. */
export class ConeActor {
  readonly group = new THREE.Group();
  readonly model: THREE.Group;
  readonly mixer: THREE.AnimationMixer;
  readonly clips = new Map<ConeClip, THREE.AnimationClip>();
  readonly height: number;
  active: ConeClip = 'idle';
  time = 0;
  private action?: THREE.AnimationAction;
  private poses: {node: THREE.Object3D; p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3}[] = [];
  private segments: {node: THREE.Bone; part: number; axis: 'x'|'y'|'z'}[] = [];
  private skeletons = new Set<THREE.Skeleton>();
  constructor(asset: GLTF, height = 2.6) {
    this.height = height;
    this.group.name = 'Angry cone';
    this.model = cloneSkeleton(asset.scene) as THREE.Group;
    const mount = new THREE.Group(); mount.add(this.model); this.group.add(mount);
    this.model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.model, true), size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    mount.scale.setScalar(height / size.y);
    mount.position.set(-centre.x * mount.scale.x, -box.min.y * mount.scale.y, -centre.z * mount.scale.z);
    this.model.traverse(node => {
      this.poses.push({node, p: node.position.clone(), q: node.quaternion.clone(), s: node.scale.clone()});
      const mesh = node as THREE.SkinnedMesh;
      if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; }
      if (mesh.isSkinnedMesh) { this.skeletons.add(mesh.skeleton); mesh.frustumCulled = false; }
      if (!(node as THREE.Bone).isBone) return;
      if (node.userData.literalConeRig) return; // Segment elasticity is baked into this tailored rig.
      const name = node.name.replace(/^mixamorig[:_]?/i, '').toLowerCase();
      const part = name === 'spine' ? 0 : /^(left|right)arm$/.test(name) ? 1 : /^(left|right)forearm$/.test(name) ? 2 : -1;
      if (part < 0) return;
      const child = node.children.find(n => (n as THREE.Bone).isBone);
      const direction = child?.position ?? new THREE.Vector3(0, 1, 0);
      const axis = (['x', 'y', 'z'] as const).reduce((a,b) => Math.abs(direction[a]) > Math.abs(direction[b]) ? a : b);
      this.segments.push({node: node as THREE.Bone, part, axis});
    });
    for (const clip of asset.animations) {
      const key = CLIPS.find(name => clip.name.toLowerCase().includes(name));
      if (key) this.clips.set(key, clip);
    }
    this.mixer = new THREE.AnimationMixer(this.model);
    this.play('idle');
  }
  get duration() { return this.clips.get(this.active)?.duration ?? 1; }
  play(name: ConeClip, time = 0) {
    const clip = this.clips.get(name); if (!clip) return;
    this.mixer.stopAllAction(); this.active = name; this.time = time;
    this.action = this.mixer.clipAction(clip); this.action.reset().play();
    this.sample(time);
  }
  sample(time: number) {
    this.time = Math.max(0, time);
    // Undo only last frame's independent deformation before sampling the source clip.
    for (const {node,p,q,s} of this.poses) {
      node.position.copy(p); node.quaternion.copy(q); node.scale.copy(s); node.matrixAutoUpdate = true;
    }
    this.mixer.setTime(this.time);
    const phase = (this.time % this.duration) / this.duration;
    const finite = this.active === 'jump' || this.active === 'slash';
    const shared = characterElasticityAmplitudes(this.active === 'slash' ? 'jump' : this.active);
    const pulse = finite ? enemyElasticPulse(phase, 1) : -Math.sin(phase * Math.PI * (this.active === 'walk' ? 4 : 2));
    for (const {node,part,axis} of this.segments) {
      const ratio = 1 + shared[part] * CONE_ELASTICITY[this.active] * pulse * (part ? CONE_ELASTICITY.arms : 1);
      const cross = 1 / Math.sqrt(ratio), scale = new THREE.Vector3(cross, cross, cross); scale[axis] = ratio;
      if (node.matrixAutoUpdate) node.updateMatrix();
      node.matrix.scale(scale); node.matrixAutoUpdate = false; node.matrixWorldNeedsUpdate = true;
      const cancel = new THREE.Matrix4().makeScale(1 / scale.x, 1 / scale.y, 1 / scale.z);
      // Cancel inherited scale before each rotated child. Head, gloves and all
      // descendant limbs retain their own dimensions; grounded legs stay untouched.
      for (const child of node.children) {
        if (child.matrixAutoUpdate) child.updateMatrix();
        child.matrix.premultiply(cancel).setPosition(child.position);
        child.matrixAutoUpdate = false; child.matrixWorldNeedsUpdate = true;
      }
    }
    this.group.updateMatrixWorld(true);
    for (const skeleton of this.skeletons) skeleton.update();
  }
  update(dt: number) { this.sample(this.time + Math.max(0, dt)); }
  dispose() {
    this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.model);
    for (const skeleton of this.skeletons) skeleton.dispose();
    this.group.removeFromParent();
  }
}

/** Dress only Carlisle's authored triple-cone rows. Original death volumes stay authoritative. */
export function createCarlisleCones(root: THREE.Group, data: CustomLevelData) {
  const sites = data.name === 'Carlisle Coast' ? data.components.flatMap((c, index) =>
    isCarlisleConeRow(c) ? [{c,index}] : []) : [];
  if (!sites.length) return null;
  const source = new Map(root.children.map(object => [object.userData.editorIdx, object]));
  const lease = acquireConeAsset(); let disposed = false;
  const actors: {actor: ConeActor; phase: number; cooldown: number}[] = [];
  const hidden: {object: THREE.Object3D; visible: boolean}[] = [];
  const diagnostics = {status: 'loading', actors: 0, sites: sites.length, clips: [] as string[], error: ''};
  const ready = lease.promise.then(asset => {
    if (disposed) return;
    for (const {c,index} of sites) {
      const original = source.get(index); if (!original) continue;
      const v = c.vertices!, point = (i: number) => new THREE.Vector3(...v.slice(i*3,i*3+3) as [number,number,number]);
      const x = point(1).sub(point(0)).normalize(), z = point(0).sub(point(3)).normalize();
      const y = new THREE.Vector3().crossVectors(z,x).normalize();
      const orientation = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z));
      for (let i = 0; i < 3; i++) {
        const actor = new ConeActor(asset);
        const foot = point(i*5).add(point(i*5+1)).add(point(i*5+2)).add(point(i*5+3)).multiplyScalar(.25);
        actor.group.position.copy(foot).add(new THREE.Vector3(...c.p));
        actor.group.quaternion.copy(orientation); actor.group.userData.editorIdx = index;
        const phase = (index*.618033 + i*.37) % 1;
        actor.play('idle', phase * actor.duration); root.add(actor.group);
        actors.push({actor, phase, cooldown: phase * 3});
      }
      hidden.push({object: original, visible: original.visible}); original.visible = false;
    }
    diagnostics.status = 'ready'; diagnostics.actors = actors.length; diagnostics.clips = asset.animations.map(c => c.name);
  }).catch(error => { diagnostics.status = 'error'; diagnostics.error = String(error); });
  return {ready, diagnostics,
    update(dt: number, player: THREE.Vector3) {
      for (const entry of actors) {
        const {actor} = entry, distance = actor.group.position.distanceToSquared(player);
        actor.group.visible = distance < 680*680;
        if (!actor.group.visible) continue;
        entry.cooldown -= dt;
        if (actor.active === 'slash' && actor.time + dt >= actor.duration) {
          actor.play('idle', entry.phase * (actor.clips.get('idle')?.duration ?? 1));
          entry.cooldown = 3.5 + entry.phase * 3;
        } else if (distance < 12*12 && actor.active === 'idle' && entry.cooldown <= 0) actor.play('slash');
        actor.update(dt);
      }
    },
    dispose() {
      disposed = true;
      for (const {actor} of actors) actor.dispose();
      for (const {object,visible} of hidden) object.visible = visible;
      actors.length = 0; hidden.length = 0; lease.release();
    },
  };
}
