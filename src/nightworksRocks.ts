import * as THREE from "three";
import { Octree } from "three/examples/jsm/math/Octree.js";
import { Capsule } from "three/examples/jsm/math/Capsule.js";
import { loadJungleAssetTemplate } from "./jungleAssets";
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
const capsule=new Capsule(),sample=new THREE.Vector3(),step=new THREE.Vector3(),local=new THREE.Vector3();
const sweep=new THREE.Box3(),origin=new THREE.Vector3(),contact=new THREE.Vector3();

/** Physics remains synchronous: these are the same fitted vertices as the GLB. */
export class NightworksRocks {
  readonly solids: NightworksSolid[]=[];
  readonly errors:string[]=[];
  private disposed=false;
  private materials=new Map<NightworksKind,THREE.MeshLambertMaterial>();
  private jobs:Promise<void>[]=[];
  private pending=0;
  private readyCount=0;
  addSolid(mesh:THREE.Mesh,delta:THREE.Vector3,active=()=>true):void {
    // Translation is owned by the mover. Bake dimensions/yaw into the local geometry.
    const proxy=new THREE.Mesh(mesh.geometry);
    proxy.updateMatrixWorld(true);
    this.solids.push({mesh,octree:new Octree().fromGraphNode(proxy),bounds:mesh.geometry.boundingBox!.clone(),delta,active});
    (proxy.material as THREE.Material).dispose();
  }
  attach(parent:THREE.Object3D,kind:NightworksKind,size:readonly number[],offset:THREE.Vector3,yaw=0,proxy?:THREE.Mesh):THREE.Group {
    const fallback=proxy?.material as THREE.Material|undefined;
    const holder=new THREE.Group();holder.name=NIGHTWORKS_MODULES[kind].label;
    holder.position.copy(offset);holder.rotation.y=THREE.MathUtils.degToRad(yaw);holder.scale.set(size[0],size[1],size[2]);
    parent.add(holder);this.pending++;
    this.jobs.push(loadJungleAssetTemplate(kind).then(template=>{
      if(this.disposed)return;
      let material=this.materials.get(kind);
      if(!material){material=new THREE.MeshLambertMaterial({map:template.map,emissive:0x293c60,emissiveIntensity:.24});
        material.name=`Nightworks ${kind}`;this.materials.set(kind,material);}
      const lod=new THREE.LOD();
      const near=new THREE.Mesh(template.geometry,material);near.receiveShadow=true;near.castShadow=true;lod.addLevel(near,0);
      if(template.lodGeometry){const far=new THREE.Mesh(template.lodGeometry,material);far.receiveShadow=true;lod.addLevel(far,42,.15);}
      // LOD distances live in world units despite the fitted parent's nonuniform scale.
      holder.add(lod);holder.userData.assetReady=true;this.readyCount++;
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
      const bounds=solid.bounds.clone().translate(origin);
      bounds.union(solid.bounds.clone().translate(origin.clone().sub(solid.delta)));
      if(!sweep.intersectsBox(bounds))continue;
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
  get diagnostics(){return {models:this.pending,ready:this.readyCount,solids:this.solids.length,errors:[...this.errors]};}
  dispose():void {this.disposed=true;for(const m of this.materials.values())m.dispose();this.materials.clear();this.solids.length=0;}
}
