import * as THREE from 'three';
import {acceleratedRaycast} from 'three-mesh-bvh';
import type {CustomComponent} from './level';
import {jungleSolidRole} from './jungleAssets';
import {WorldSolids,type SolidSurface} from './worldSolids';

/** Legacy mesh artists used solid:false for both masonry and painted decals.
 * A zero-thickness horizontal mark has no structural body; explicit policy
 * remains available for thin physical shelves and deliberately soft props. */
export function meshScenerySolid(c:CustomComponent):boolean {
  if(c.scenerySolid!==undefined)return c.scenerySolid;
  if(c.tex==='treehouse-canvas'||c.materialStyle==='water'||c.materialStyle==='jungle-stream'||(c.opacity??1)<.98||c.nm==='Palm frond')return false;
  if(c.solid===false&&c.vertices?.length){
    const y=c.vertices[1];let horizontal=true;
    for(let i=4;i<c.vertices.length;i+=3)if(Math.abs(c.vertices[i]-y)>1e-5){horizontal=false;break;}
    if(horizontal)return false;
  }
  return true;
}

type Role='mesh'|'trunk'|'none';
interface SceneSources {
  ground:()=>THREE.Mesh[];
  active?:(mesh:THREE.Mesh)=>boolean;
  walls:()=>THREE.Box3[];
  wallPath?:(box:THREE.Box3)=>unknown;
  wallSource?:(box:THREE.Box3)=>CustomComponent|THREE.Mesh|undefined;
  component:(object:THREE.Object3D)=>CustomComponent|undefined;
}
interface BoundMesh {surfaces:SolidSurface[];proxies:THREE.Mesh[];native:boolean;keys:unknown[];}
const ACTORS=new Set(['crate','metal','enemy','stone','crusher','pendulum','checkpoint','gate','clock','wumpa','crystal','comboorb','bonusplatform','worldmap','pit','tumblezone','trickgate','returnportal','orb']);
const HARD_DECOR=new Set(['meshycourtyard','coastalhouse','block','ruinblock','idol','ghostarch','ghostcart','ghostwallbay','ghostbanquettable','ghostchandelier','ghosttrestle','ghostmonsterportal','ghostflagstone','ghostbathwall','ghostbatharch','ghostjunk','ghostboiler','ghostclockwork']);
export function decorScenerySolid(kind:string):boolean {return HARD_DECOR.has(kind)||['mossrock','jungletree','pine','palm','planter','log','tree','boulder','rocks','trunk','slab'].includes(kind);}
const CHANGING=new Set(['mover','crumble','spinbridge','phasepad']);

/** Binds actual scene geometry once, including asynchronous asset arrivals.
 * Camera visibility and render LOD do not revoke contact. Soft foliage,
 * projected backdrops and water never enter the physical surface index. */
export class WorldSurfaceBinding {
  private pending=new Set<THREE.Object3D>();
  private watched=new Set<THREE.Object3D>();
  private bound=new Map<THREE.Mesh,BoundMesh>();
  private owners=new Map<unknown,number>();
  private proxyMeshes=new Set<THREE.Mesh>();
  private proxySources=new Map<THREE.Mesh,SolidSurface>();
  private surfaceProxies=new Map<SolidSurface,THREE.Mesh>();
  private nativeGround:THREE.Mesh[]=[];
  private trunks=new Map<THREE.BufferGeometry,THREE.BufferGeometry>();
  private trunkReleases=new Map<THREE.BufferGeometry,()=>void>();
  private wallBoxes=new Map<THREE.Box3,{mesh:THREE.Mesh;surface:SolidSurface;previous:THREE.Box3}>();
  private groundSet=new Set<THREE.Mesh>();
  private wallSet=new Set<THREE.Box3>();
  private boxGeometry=new THREE.BoxGeometry(1,1,1);
  private material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
  private disposed=false;
  private prepared=false;
  private rayValid=false;
  private rayNear=0;
  private rayFar=0;
  private ray=new THREE.Ray();
  private raySurfaces=new Set<SolidSurface>();
  private prepareRay(ray:THREE.Raycaster):void{
    if(this.rayValid&&this.rayNear===ray.near&&this.rayFar===ray.far&&this.ray.equals(ray.ray))return;
    this.rayValid=true;this.rayNear=ray.near;this.rayFar=ray.far;this.ray.copy(ray.ray);
    this.solids.collectRaySurfaces(ray,this.raySurfaces);
  }
  private added=(event:{child:THREE.Object3D})=>{this.watch(event.child);this.pending.add(event.child);};
  private removed=(event:{child:THREE.Object3D})=>this.unwatch(event.child);
  constructor(private root:THREE.Object3D,readonly solids:WorldSolids,private sources:SceneSources){
    this.material.visible=false;this.material.userData.shared=true;this.watch(root);this.pending.add(root);
  }
  private watch(object:THREE.Object3D):void{
    if(this.watched.has(object))return;this.watched.add(object);
    object.addEventListener('childadded',this.added);object.addEventListener('childremoved',this.removed);
    for(const child of object.children)this.watch(child);
  }
  private unwatch(object:THREE.Object3D):void{
    this.pending.delete(object);this.watched.delete(object);
    object.removeEventListener('childadded',this.added);object.removeEventListener('childremoved',this.removed);
    for(const child of object.children)this.unwatch(child);
    const mesh=object as THREE.Mesh,record=this.bound.get(mesh);if(!record)return;
    for(const surface of record.surfaces){this.solids.remove(surface);this.surfaceProxies.delete(surface);}
    for(const proxy of record.proxies){this.proxyMeshes.delete(proxy);this.proxySources.delete(proxy);const list=this.sources.ground(),i=list.indexOf(proxy);if(i>=0)list.splice(i,1);}
    for(const key of record.keys){const count=this.owners.get(key)!-1;if(count)this.owners.set(key,count);else this.owners.delete(key);}
    this.bound.delete(mesh);
  }
  private role(mesh:THREE.Mesh,c:CustomComponent|undefined,native:boolean):Role{
    if(mesh.userData.metalCrate||c&&['crate','metal','enemy','stone','crusher'].includes(c.t))return'none';
    if(native)return'mesh';
    if(mesh.userData.editorGhost||c?.invisible)return'none';
    if(c?.scenerySolid===false||mesh.userData.solidSurface==='none'||mesh.userData.sceneryLod===1)return'none';
    if(c&&ACTORS.has(c.t))return'none';
    if(c?.scenerySolid===true)return'mesh';
    if(mesh.userData.solidSurface)return mesh.userData.solidSurface as Role;
    if(mesh.userData.jungleAsset)return jungleSolidRole(mesh.userData.jungleAsset);
    if(mesh.userData.cityAsset)return'mesh';
    const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    if(materials.some(m=>m.userData.treehouseMatte||m.userData.jungleStream||m.userData.waterSurface))return'none';
    if(c?.materialStyle==='water'||c?.materialStyle==='jungle-stream')return'none';
    if(c?.containment)return'none';
    if(c&&['wall','wallpath','platform','ramp','rock','terrain','vertramp','woodpath','spinbridge'].includes(c.t))return'mesh';
    if(c?.invisible)return'none';
    if(c?.t==='mesh')return meshScenerySolid(c)?'mesh':'none';
    if(mesh.userData.wallPathComp||mesh.userData.wallSpec)return'mesh';
    if(c?.t==='decor'&&HARD_DECOR.has(c.dkind??'')&&materials.every(m=>!m.transparent||m.opacity>=.98))return'mesh';
    return'none';
  }
  private trunk(geometry:THREE.BufferGeometry):THREE.BufferGeometry{
    const prior=this.trunks.get(geometry);if(prior)return prior;
    const p=geometry.getAttribute('position'),flex=geometry.getAttribute('aJungleFlex'),index=geometry.index,vertices:number[]=[];
    // Clip crossing triangles at the rooted part of the authored wind mask.
    // A long trunk triangle must not disappear merely because its top sways.
    for(let i=0;i<(index?.count??p.count);i+=3){
      let polygon=Array.from({length:3},(_,j)=>{const id=index?index.getX(i+j):i+j;return{p:new THREE.Vector3().fromBufferAttribute(p,id),f:flex?.getX(id)??Math.max(0,p.getY(id)-.38)};});
      const clipped:typeof polygon=[];
      for(let j=0;j<polygon.length;j++){const a=polygon[j],b=polygon[(j+1)%polygon.length],inside=a.f<=.055,next=b.f<=.055;if(inside)clipped.push(a);if(inside!==next){const t=(.055-a.f)/(b.f-a.f);clipped.push({p:a.p.clone().lerp(b.p,t),f:.055});}}
      polygon=clipped;for(let j=1;j<polygon.length-1;j++)for(const v of [polygon[0],polygon[j],polygon[j+1]])vertices.push(...v.p.toArray());
    }
    const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));result.computeVertexNormals();result.computeBoundingBox();result.computeBoundingSphere();this.trunks.set(geometry,result);
    const release=()=>{this.trunks.delete(geometry);this.trunkReleases.delete(geometry);result.dispose();};geometry.addEventListener('dispose',release);this.trunkReleases.set(geometry,release);return result;
  }
  private bind(mesh:THREE.Mesh):void{
    if(this.bound.has(mesh)||mesh.userData.worldSolidProxy||!mesh.geometry?.getAttribute('position'))return;
    const c=this.sources.component(mesh),native=this.groundSet.has(mesh)||mesh.userData.outlinedSurface===true||c?.t==='phasepad'||c?.t==='crumble'||c?.t==='spinbridge',role=this.role(mesh,c,native);
    if(role==='none')return;
    const geometry=role==='trunk'?this.trunk(mesh.geometry):mesh.geometry;if(geometry.getAttribute('position').count<3)return;
    const dynamic=mesh.userData.solidDynamic===true||!!c&&CHANGING.has(c.t)||mesh.userData.moverId!==undefined||mesh.userData.crumbleId!==undefined||mesh.userData.phasePadId!==undefined;
    const active=()=>this.sources.active?.(mesh)!==false&&(native&&c?.t!=='spinbridge'?this.groundSet.has(mesh):this.watched.has(mesh));
    const keys=[mesh,...(c?[c]:[]),...(mesh.userData.cityAsset?[mesh.userData.cityAsset]:[])];
    const record:BoundMesh={surfaces:[],proxies:[],native,keys};this.bound.set(mesh,record);
    for(const key of keys)this.owners.set(key,(this.owners.get(key)??0)+1);
    const instances=(mesh as THREE.InstancedMesh).isInstancedMesh?(mesh as THREE.InstancedMesh).count:1;
    for(let instance=0;instance<instances;instance++){
      const surface=this.solids.add(mesh,{geometry,instance:(mesh as THREE.InstancedMesh).isInstancedMesh?instance:undefined,dynamic,active,name:c?.nm??mesh.name,owner:c});record.surfaces.push(surface);
      if(!native&&!c?.invisible&&!mesh.userData.editorGhost){
        const proxy=new THREE.Mesh(geometry,this.material);proxy.name=c?.nm??mesh.name;proxy.matrixAutoUpdate=false;proxy.matrixWorldAutoUpdate=false;proxy.matrix.copy(surface.matrix);proxy.matrixWorld.copy(surface.matrix);
        proxy.userData={worldSolidProxy:true,decorComponent:true,edgeGrinding:false,vert:false,...(c?.slip?{slippy:true,iceGrip:c.iceGrip}:{} )};
        // Dense scenery shares the same local BVH for contact and standing.
        const raycast=geometry.boundsTree?acceleratedRaycast:THREE.Mesh.prototype.raycast;
        proxy.raycast=(ray,hits)=>{if(!this.solids.enabled||!active())return;this.prepareRay(ray);if(this.raySurfaces.has(surface))raycast.call(proxy,ray,hits);};
        this.proxyMeshes.add(proxy);this.proxySources.set(proxy,surface);this.surfaceProxies.set(surface,proxy);record.proxies.push(proxy);this.sources.ground().push(proxy);
      }
    }
  }
  prepare():void{
    if(this.disposed)return;
    this.rayValid=false;
    this.groundSet.clear();for(const mesh of this.sources.ground())this.groundSet.add(mesh);
    this.wallSet.clear();for(const wall of this.sources.walls())this.wallSet.add(wall);
    for(const object of this.pending)object.traverse(child=>{if((child as THREE.Mesh).isMesh)this.bind(child as THREE.Mesh);});this.pending.clear();
    // Some native support proxies are deliberately outside the render tree.
    for(const mesh of this.sources.ground())if(!mesh.userData.worldSolidProxy&&!this.bound.has(mesh))this.bind(mesh);
    for(const [proxy,surface]of this.proxySources)if(surface.dynamic){surface.mesh.updateWorldMatrix(true,false);proxy.matrixWorld.copy(surface.mesh.matrixWorld);if(surface.instance!==undefined){(surface.mesh as THREE.InstancedMesh).getMatrixAt(surface.instance,proxy.matrix);proxy.matrixWorld.multiply(proxy.matrix);}proxy.matrix.copy(proxy.matrixWorld);surface.bounds.copy(surface.geometry.boundingBox!).applyMatrix4(proxy.matrixWorld);}
    // Existing authored barriers retain their exact Box3 support contract;
    // continuous queries add protection when a tick crosses the whole slab.
    const hasGeometry=(box:THREE.Box3)=>{
      const owner=this.sources.wallSource?.(box);
      return this.sources.wallPath?.(box)||owner&&(this.owners.has(owner)||'dkind' in owner&&this.owners.has(owner.dkind));
    };
    for(const box of this.sources.walls())if(!hasGeometry(box)&&!this.wallBoxes.has(box)){
      const mesh=new THREE.Mesh(this.boxGeometry,this.material);box.getCenter(mesh.position);box.getSize(mesh.scale);mesh.updateMatrixWorld();
      const surface=this.solids.add(mesh,{active:()=>this.wallSet.has(box),name:'Authored solid wall',owner:box});this.wallBoxes.set(box,{mesh,surface,previous:box.clone()});
    }
    for(const [box,record]of this.wallBoxes){
      if(!this.wallSet.has(box)||hasGeometry(box)){this.solids.remove(record.surface);this.wallBoxes.delete(box);continue;}
      if(!record.previous.equals(box)){this.solids.makeDynamic(record.surface);box.getCenter(record.mesh.position);box.getSize(record.mesh.scale);record.mesh.updateMatrixWorld();record.previous.copy(box);}
    }
    this.prepared=true;
  }
  raycastGround(ray:THREE.Raycaster):THREE.Intersection[]{
    // Native supports remain a mutable public contract (phase changes and
    // ledge receivers can change between two queries in the same tick).
    this.nativeGround.length=0;for(const mesh of this.sources.ground())if(!mesh.userData.worldSolidProxy)this.nativeGround.push(mesh);
    const hits=ray.intersectObjects(this.nativeGround,false);
    if(!this.solids.enabled)return hits;
    this.prepareRay(ray);
    for(const surface of this.raySurfaces){const proxy=this.surfaceProxies.get(surface);if(proxy&&proxy.layers.test(ray.layers))proxy.raycast(ray,hits);}
    return hits.sort((a,b)=>a.distance-b.distance);
  }
  beginStep():void{this.prepare();this.solids.beginStep();}
  get diagnostics(){return{boundMeshes:this.bound.size,sceneryFloors:this.proxyMeshes.size,wallBoxes:this.wallBoxes.size,prepared:this.prepared,...this.solids.diagnostics};}
  dispose():void{
    if(this.disposed)return;this.disposed=true;this.unwatch(this.root);for(const mesh of [...this.bound.keys()])this.unwatch(mesh);
    for(const {surface}of this.wallBoxes.values()){this.solids.remove(surface);}this.wallBoxes.clear();this.boxGeometry.dispose();
    for(const [original,geometry]of this.trunks){const release=this.trunkReleases.get(original);if(release)original.removeEventListener('dispose',release);geometry.dispose();}this.trunks.clear();this.trunkReleases.clear();this.raySurfaces.clear();this.surfaceProxies.clear();this.nativeGround.length=0;this.material.dispose();this.solids.dispose();
  }
}
