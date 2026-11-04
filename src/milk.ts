import * as THREE from 'three';
import { buildFruitGeometry, FRUIT_VARIANTS, FruitMaterial } from './fruitAssets';

// Preserve the established pickup, pool and editor contract.
export const MILK_SIZE = 0.7;
export const MILK_VARIANTS = FRUIT_VARIANTS.map(v => v.name);
export class MilkMaterial extends FruitMaterial {}

export function buildMilkGeometry(variant = 0): THREE.BufferGeometry {
  const geometry=buildFruitGeometry(variant);
  addLiquidMorphs(geometry);
  // Conservative full-motion culling. No camera-distance geometry swaps.
  geometry.boundingSphere!.set(new THREE.Vector3(), 1.25);
  return geometry;
}

/** Relative shape/normal targets share GPU storage; weights belong to each orb. */
function addLiquidMorphs(geometry: THREE.BufferGeometry): void {
  const base = geometry.getAttribute('position'), normals = geometry.getAttribute('normal');
  const positions: THREE.BufferAttribute[] = [], normalTargets: THREE.BufferAttribute[] = [];
  for (let mode = 0; mode < 6; mode++) {
    const deformed = geometry.clone(), p = deformed.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const x = base.getX(i), y = base.getY(i), z = base.getZ(i);
      const tail = (y + .5) * (y + .5) - .25;
      const wave = .055 * (mode === 4 ? Math.sin(y * 12) : Math.cos(y * 12));
      if (mode === 0) p.setXYZ(i, x * .88, y * 1.32, z * .88);
      else if (mode === 1) p.setXYZ(i, x * 1.16, y * .78, z * 1.16);
      else if (mode === 2) p.setXYZ(i, x + .20 * tail, y, z);
      else if (mode === 3) p.setXYZ(i, x, y, z + .20 * tail);
      else p.setXYZ(i, x * (1 + wave), y, z * (1 + wave));
    }
    deformed.computeVertexNormals();
    const n = deformed.getAttribute('normal');
    const dp = new Float32Array(p.count * 3), dn = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      dp.set([p.getX(i)-base.getX(i),p.getY(i)-base.getY(i),p.getZ(i)-base.getZ(i)],i*3);
      dn.set([n.getX(i)-normals.getX(i),n.getY(i)-normals.getY(i),n.getZ(i)-normals.getZ(i)],i*3);
    }
    positions.push(new THREE.Float32BufferAttribute(dp,3));
    normalTargets.push(new THREE.Float32BufferAttribute(dn,3)); deformed.dispose();
  }
  geometry.morphTargetsRelative = true;
  geometry.morphAttributes.position = positions;
  geometry.morphAttributes.normal = normalTargets;
}

const shapes = MILK_VARIANTS.map((_, i) => buildMilkGeometry(i));
const material = new MilkMaterial(); material.userData.shared = true;
const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
depth.userData.shared = true;
let nextVariant = 0;

/** Shared sculpt/material resources; each owner retains independent motion. */
export function setMilkVariant(root:THREE.Object3D,variant:number):void {
  const id=((Math.trunc(variant)%MILK_VARIANTS.length)+MILK_VARIANTS.length)%MILK_VARIANTS.length;
  const mesh=milkMesh(root);
  if(mesh){
    if(mesh.geometry!==shapes[id]){
      mesh.geometry=shapes[id];mesh.updateMorphTargets();
    }
    motions.get(mesh)?.setPhase(id);
  }
  root.userData.milkVariant=id;
}

/** One shared-geometry blob; spin/bob the group using the existing pickup motion. */
export function milkBlob(size = 1, variant = nextVariant++): THREE.Group {
  const group = new THREE.Group(), mesh = new THREE.Mesh(shapes[0], material);
  mesh.userData.milkBlob = true;
  mesh.castShadow = true; mesh.receiveShadow = false;
  mesh.customDepthMaterial = depth;
  group.add(mesh); group.scale.setScalar(size);
  motions.set(mesh, new LiquidMotion(mesh));
  meshCache.set(group, mesh);
  setMilkVariant(group, variant);
  group.name = 'hovering Wumpa fruit';
  mesh.userData.noWaterShore = true;
  return group;
}


const up = new THREE.Vector3(0,1,0);
const motions = new WeakMap<THREE.Mesh,LiquidMotion>();
const meshCache = new WeakMap<THREE.Object3D,THREE.Mesh>();
function milkMesh(root:THREE.Object3D):THREE.Mesh|undefined {
  let mesh=meshCache.get(root);
  if(!mesh){root.traverse(o=>{if(o instanceof THREE.Mesh&&o.userData.milkBlob)mesh=o;});if(mesh)meshCache.set(root,mesh);}
  return mesh;
}
class LiquidMotion {
  stretch=0; speed=0; energy=0; time=0; phase=0; tempo=1;
  readonly previous=new THREE.Vector3();
  private readonly local=new THREE.Vector3();
  private readonly acceleration=new THREE.Vector3();
  private readonly inverse=new THREE.Quaternion();
  private readonly target=new THREE.Quaternion();
  constructor(readonly mesh:THREE.Mesh){}
  setPhase(id:number):void {this.phase=id*1.713;this.tempo=1+(id-2.5)*.025;this.apply(0);}
  copyFrom(other:LiquidMotion):void {
    this.stretch=other.stretch;this.speed=other.speed;this.energy=other.energy;
    this.time=other.time;this.phase=other.phase;this.tempo=other.tempo;
    this.previous.copy(other.previous);this.mesh.quaternion.copy(other.mesh.quaternion);
    this.mesh.morphTargetInfluences?.splice(0,6,...(other.mesh.morphTargetInfluences??[]));
  }
  reset():void {
    this.stretch=this.speed=this.energy=this.time=0;this.previous.set(0,0,0);
    this.mesh.quaternion.identity();this.mesh.morphTargetInfluences?.fill(0);
  }
  kick(strength:number):void {
    this.energy=Math.max(this.energy,strength);
    this.stretch=-.42*strength;this.speed=5*strength;
    this.apply(0);
  }
  step(velocity:THREE.Vector3,dt:number,upright=false):void {
    if(dt<=0)return;
    const speed=velocity.length(),drive=Math.min(1,speed/16);
    this.acceleration.copy(velocity).sub(this.previous).multiplyScalar(1/dt);
    this.previous.copy(velocity);
    this.energy=Math.max(this.energy,Math.min(.7,this.acceleration.length()/180));
    if(!upright&&speed>.05){
      this.mesh.parent?.getWorldQuaternion(this.inverse);this.inverse.invert();
      this.local.copy(velocity).applyQuaternion(this.inverse);
      this.target.setFromUnitVectors(up,this.local.normalize().negate());
    }else this.target.identity();
    this.mesh.quaternion.slerp(this.target,1-Math.exp(-10*dt));
    const steps=Math.max(1,Math.ceil(dt*120)),h=dt/steps;
    for(let i=0;i<steps;i++){
      this.speed+=(drive*.85-this.stretch)*100*h-this.speed*13*h;
      this.stretch+=this.speed*h;this.time+=h;this.energy*=Math.exp(-3.8*h);
    }
    this.stretch=THREE.MathUtils.clamp(this.stretch,-.65,1);
    this.apply(drive);
  }
  private apply(drive:number):void {
    const w=this.mesh.morphTargetInfluences;if(!w)return;
    const phase=this.time*17*this.tempo+this.phase;
    const ripple=this.energy*.65+drive*.25;
    const stretch=this.stretch+.07*Math.sin(this.time*2.8*this.tempo+this.phase);
    w[0]=Math.max(0,stretch);w[1]=Math.max(0,-stretch);
    w[2]=Math.sin(phase*.71)*ripple*.5;w[3]=Math.cos(phase*.83)*ripple*.35;
    w[4]=Math.sin(phase)*(ripple+.09);w[5]=Math.cos(phase)*(ripple+.09);
  }
}
/** Velocity is in the owning scene's coordinates (world or HUD overlay). */
export function updateMilkMotion(root:THREE.Object3D,velocity:THREE.Vector3,dt:number,upright=false):void {
  const mesh=milkMesh(root);if(mesh)motions.get(mesh)?.step(velocity,Math.min(dt,.1),upright);
}
export function kickMilkMotion(root:THREE.Object3D,strength=1):void {
  const mesh=milkMesh(root);if(mesh)motions.get(mesh)?.kick(THREE.MathUtils.clamp(strength,0,1));
}
export function resetMilkMotion(root:THREE.Object3D):void {
  const mesh=milkMesh(root);if(mesh)motions.get(mesh)?.reset();
}

export function copyMilkMotion(source:THREE.Object3D,target:THREE.Object3D):void {
  const from=milkMesh(source),to=milkMesh(target);
  const state=from&&motions.get(from),destination=to&&motions.get(to);
  if(state&&destination)destination.copyFrom(state);
}
