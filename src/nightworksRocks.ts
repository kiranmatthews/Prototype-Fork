import * as THREE from "three";
import { Octree } from "three/examples/jsm/math/Octree.js";
import { Capsule } from "three/examples/jsm/math/Capsule.js";
import { createJungleAssetScope, type Template } from "./jungleAssets";
import { NIGHTWORKS_MODULES, type NightworksKind } from "./nightworksModules";
import shapes from "./nightworksShapes.json";

export function isNightworksSurface(kind: string | undefined): kind is NightworksKind {
  return !!kind && Object.prototype.hasOwnProperty.call(shapes, kind);
}
export function nightworksGeometry(kind: NightworksKind, size: readonly number[], yaw = 0): THREE.BufferGeometry {
  const data = shapes[kind as keyof typeof shapes];
  if (!data) throw new Error(`No playable rock geometry: ${kind}`);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.Float32BufferAttribute(data.positions,3));
  geometry.setIndex(data.indices);
  geometry.translate(0,-.5,0).scale(size[0],size[1],size[2]).rotateY(THREE.MathUtils.degToRad(yaw));
  geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  return geometry;
}

export interface NightworksSolid {
  mesh: THREE.Mesh;
  octree: Octree;
  bounds: THREE.Box3;
  delta: THREE.Vector3;
  active: () => boolean;
}
export interface NightworksAppearance {
  color?: string;
  emissive?: string;
  /** Resolved by Level from its existing texture allowlist; undefined keeps the kit map. */
  map?: THREE.Texture | null;
  tex?: string;
}
const capsule=new Capsule(),sample=new THREE.Vector3(),step=new THREE.Vector3(),local=new THREE.Vector3();
const sweep=new THREE.Box3(),origin=new THREE.Vector3(),contact=new THREE.Vector3();
const currentBounds=new THREE.Box3(),previousBounds=new THREE.Box3();

interface LocalCollisionTree {
  positions: Uint8Array;
  indices: Uint8Array | null;
  tree: Octree;
}
const bytesEqual=(a:Uint8Array,b:Uint8Array):boolean=>{
  if(a.length!==b.length)return false;
  for(let i=0;i<a.length;i++)if(a[i]!==b[i])return false;
  return true;
};

/** Physics remains synchronous: these are the same fitted vertices as the GLB. */
export class NightworksRocks {
  readonly solids: NightworksSolid[]=[];
  readonly errors:string[]=[];
  private disposed=false;
  private materials=new Map<string,THREE.MeshLambertMaterial>();
  private jobs:Promise<void>[]=[];
  private pending=0;
  private readyCount=0;
  private assets=createJungleAssetScope();
  // Repeated islands differ in world position/motion, not local triangles.
  // Keep exact input snapshots: editing a source buffer must never alias an
  // older collision tree. The cache lives only as long as this level.
  private collisionTrees=new Map<string,LocalCollisionTree[]>();
  constructor(private loadTemplate:(kind:NightworksKind)=>Promise<Template>=kind=>this.assets.load(kind)) {}
  private collisionTree(geometry:THREE.BufferGeometry):Octree {
    const position=geometry.getAttribute('position'),index=geometry.getIndex();
    const build=()=>{
      const proxy=new THREE.Mesh(geometry);
      try{return new Octree().fromGraphNode(proxy);}
      finally{(proxy.material as THREE.Material).dispose();}
    };
    // Exotic/imported attributes keep Three's original construction path.
    if(!(position instanceof THREE.BufferAttribute)||position.itemSize!==3||position.normalized||
      (index&&(index.itemSize!==1||index.normalized)))return build();
    const positions=new Uint8Array(position.array.buffer,position.array.byteOffset,position.array.byteLength);
    const indices=index?new Uint8Array(index.array.buffer,index.array.byteOffset,index.array.byteLength):null;
    const key=`${position.array.constructor.name}:${positions.length}:${index?.array.constructor.name}:${indices?.length}`;
    const bucket=this.collisionTrees.get(key)??[];
    for(const cached of bucket)if(bytesEqual(positions,cached.positions)&&
      (indices?cached.indices!==null&&bytesEqual(indices,cached.indices):cached.indices===null))return cached.tree;
    const tree=build();
    bucket.push({positions:positions.slice(),indices:indices?.slice()??null,tree});
    this.collisionTrees.set(key,bucket);
    return tree;
  }
  addSolid(mesh:THREE.Mesh,delta:THREE.Vector3,active=()=>true):void {
    // Translation is owned by the mover. Bake dimensions/yaw into the local geometry.
    this.solids.push({mesh,octree:this.collisionTree(mesh.geometry),bounds:mesh.geometry.boundingBox!.clone(),delta,active});
  }
  attach(parent:THREE.Object3D,kind:NightworksKind,size:readonly number[],offset:THREE.Vector3,yaw=0,proxy?:THREE.Mesh,appearance:NightworksAppearance={}):THREE.Group {
    const fallback=proxy?.material as THREE.MeshLambertMaterial|undefined;
    const requested={...appearance};
    const holder=new THREE.Group();holder.name=NIGHTWORKS_MODULES[kind].label;
    holder.position.copy(offset);holder.rotation.y=THREE.MathUtils.degToRad(yaw);holder.scale.set(size[0],size[1],size[2]);
    parent.add(holder);this.pending++;
    this.jobs.push(this.loadTemplate(kind).then(template=>{
      if(this.disposed)return;
      // Level/editor fog policy may resolve after attach() started loading.
      // Read the live proxy when the material becomes visible, not its stale
      // construction-time flag. Include it in the shared appearance identity.
      const fog=fallback?.fog??true,map=requested.map===undefined?template.map:requested.map;
      const key=JSON.stringify([kind,requested.color,requested.emissive,map?.uuid,fog]);
      let material=this.materials.get(key);
      if(!material){material=new THREE.MeshLambertMaterial({color:requested.color??0xffffff,map,
        emissive:requested.emissive??0x293c60,emissiveIntensity:requested.emissive===undefined?.24:1,fog});
        material.name=`Nightworks ${kind}`;
        if(requested.tex!==undefined)material.userData.texKind=requested.tex;
        this.materials.set(key,material);}
      const mesh=new THREE.Mesh(template.geometry,material);mesh.receiveShadow=true;mesh.castShadow=true;
      holder.add(mesh);holder.userData.assetReady=true;this.readyCount++;
      holder.traverse(object=>{object.userData.editorIdx=parent.userData.editorIdx;});
      if(proxy&&fallback){fallback.visible=false;proxy.userData.rockLoaded=true;}
    }).catch(error=>{if(!this.disposed){
      this.errors.push(kind);
      const url=(error as {response?:{url?:string}}).response?.url;
      if(url!=="")console.error(`Nightworks model failed: ${kind}`,error);
    }}));
    return holder;
  }
  /** Sweep in relative platform space; short substeps prevent side/underside tunnelling. */
  resolve(previous:THREE.Vector3,position:THREE.Vector3,half:{x:number;y:number;z:number},normal:THREE.Vector3):boolean {
    normal.set(0,0,0);let collided=false;
    const radius=Math.max(half.x,half.z)*.94;
    sweep.makeEmpty().expandByPoint(previous).expandByPoint(position).expandByScalar(radius+1);
    for(const solid of this.solids){
      if(!solid.active())continue;
      origin.copy(solid.mesh.position);
      const top=solid.bounds.max.y+origin.y;
      // Walkable top/landing are the existing ground raycast's responsibility.
      if(position.y>=top-.18)continue;
      currentBounds.copy(solid.bounds).translate(origin);
      currentBounds.union(previousBounds.copy(solid.bounds).translate(local.copy(origin).sub(solid.delta)));
      if(!sweep.intersectsBox(currentBounds))continue;
      sample.copy(previous).sub(origin).add(solid.delta);
      local.copy(position).sub(origin);
      step.copy(local).sub(sample);
      const count=Math.min(96,Math.max(1,Math.ceil(step.length()/.22)));step.divideScalar(count);
      let solidHit=false;
      for(let i=0;i<count;i++){
        sample.add(step);
        capsule.start.set(sample.x,sample.y+radius,sample.z);
        capsule.end.set(sample.x,sample.y+Math.max(radius,half.y*2-radius),sample.z);
        capsule.radius=radius;
        const hit=solid.octree.capsuleIntersect(capsule);
        if(!hit||hit.depth<1e-6)continue;
        contact.copy(hit.normal).multiplyScalar(hit.depth+.002);sample.add(contact);
        const into=step.dot(hit.normal);if(into<0)step.addScaledVector(hit.normal,-into);
        normal.add(hit.normal);collided=true;solidHit=true;
      }
      if(solidHit)position.copy(sample).add(origin);
    }
    if(collided)normal.normalize();return collided;
  }
  async ready():Promise<void>{await Promise.all(this.jobs);}
  get diagnostics(){return {models:this.pending,ready:this.readyCount,solids:this.solids.length,collisionTrees:[...this.collisionTrees.values()].reduce((count,trees)=>count+trees.length,0),errors:[...this.errors]};}
  dispose():void {this.disposed=true;for(const m of this.materials.values())m.dispose();this.materials.clear();this.solids.length=0;this.collisionTrees.clear();this.assets.dispose();this.jobs.length=0;}
}
