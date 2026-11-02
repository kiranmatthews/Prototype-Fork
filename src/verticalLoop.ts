import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** One physical cell, with an empty seam above/below all rideable surfaces. */
export interface VerticalLoopData { minY:number; height:number; }

export function verticalLoopShift(y:number,loop:VerticalLoopData):number {
  return -Math.floor((y-loop.minY)/loop.height)*loop.height;
}

export function validVerticalLoop(value:unknown):value is VerticalLoopData {
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const v=value as VerticalLoopData;
  return Object.keys(v).every(k=>k==='minY'||k==='height')&&
    Number.isFinite(v.minY)&&Math.abs(v.minY)<=10000&&Number.isFinite(v.height)&&v.height>=32&&v.height<=2048;
}

function staticMaterialKey(material:THREE.Material):string {
  // Custom shader closures can own nonserialized uniforms; keep those apart.
  if(material.onBeforeCompile!==THREE.Material.prototype.onBeforeCompile)return material.uuid;
  const properties:Record<string,unknown>={};
  for(const [key,value] of Object.entries(material)){
    if(['id','uuid','name','version','userData'].includes(key))continue;
    if(value instanceof THREE.Texture){
      properties[key]=[value.source.uuid,value.wrapS,value.wrapT,value.repeat.toArray(),value.offset.toArray(),value.rotation,value.colorSpace,value.channel];
    }else if(value instanceof THREE.Color)properties[key]=value.getHex();
    else if(value===null||['number','string','boolean'].includes(typeof value))properties[key]=value;
  }
  return JSON.stringify(properties);
}

/** Partition complete triangles, never simplify or regenerate the surface.
 * Long rails must not make a whole corridor-sized ghost batch visible. */
export function partitionPeriodicGeometry(geometry:THREE.BufferGeometry):Map<string,THREE.BufferGeometry> {
  if(geometry.index)throw new Error('Periodic partition requires nonindexed geometry');
  const position=geometry.getAttribute('position'),buckets=new Map<string,number[]>();
  for(let i=0;i<position.count;i+=3){
    const y=(position.getY(i)+position.getY(i+1)+position.getY(i+2))/3;
    const z=(position.getZ(i)+position.getZ(i+1)+position.getZ(i+2))/3;
    const key=Math.floor(y/48)+':'+Math.floor(z/96),triangles=buckets.get(key)??[];
    triangles.push(i);buckets.set(key,triangles);
  }
  if(buckets.size===1)return new Map([[buckets.keys().next().value!,geometry]]);
  const parts=new Map<string,THREE.BufferGeometry>();
  for(const [key,triangles] of buckets){
    const part=new THREE.BufferGeometry();
    for(const [name,attribute] of Object.entries(geometry.attributes)){
      const array=new (attribute.array.constructor as Float32ArrayConstructor)(triangles.length*3*attribute.itemSize);
      let out=0;
      for(const triangle of triangles)for(let vertex=triangle;vertex<triangle+3;vertex++)for(let k=0;k<attribute.itemSize;k++){
        const offset=attribute instanceof THREE.InterleavedBufferAttribute?vertex*attribute.data.stride+attribute.offset+k:vertex*attribute.itemSize+k;
        array[out++]=attribute.array[offset];
      }
      part.setAttribute(name,new THREE.BufferAttribute(array,attribute.itemSize,attribute.normalized));
    }
    parts.set(key,part);
  }
  return parts;
}

/** Render neighbours borrow the exact live geometry/materials. They never
 * enter collision, pickups, AI or save state. A bounded ring covers the fog
 * frustum, including wide views; each source mesh keeps native frustum culling.
 * Transform/visibility mirrors also keep broken boxes broken in every cell. */
export class VerticalLoopView {
  readonly root=new THREE.Group();
  private copies:{source:THREE.Mesh;mesh:THREE.Mesh;offset:number}[]=[];
  private known=new WeakSet<THREE.Object3D>();
  private inverse=new THREE.Matrix4();
  private owned:THREE.BufferGeometry[]=[];
  private batches=0;
  private scanAt=0;
  private cells:number[];
  constructor(private source:THREE.Group,readonly loop:VerticalLoopData,private staticComponent:(index:number)=>boolean=()=>false,viewDistance=300) {
    const rings=Math.ceil(viewDistance/loop.height)+1;
    this.cells=Array.from({length:rings*2+1},(_,i)=>i-rings).filter(i=>i!==0);
    this.root.name='Vertical loop / shared geometry neighbours';
    this.root.userData.verticalLoopView=true;
    source.add(this.root);
  }
  update(_camera:THREE.Camera,far:number):void {
    // Late asset arrivals are picked up without cloning resources or keeping
    // a separate simulation. Geometry is never simplified with distance.
    if(this.scanAt++%60===0)this.scan();
    this.source.updateWorldMatrix(true,true);
    this.inverse.copy(this.source.matrixWorld).invert();
    for(const {source,mesh,offset} of this.copies){
      let visible=true,ancestor:THREE.Object3D|null=source;
      for(;ancestor&&ancestor!==this.source;ancestor=ancestor.parent)if(!ancestor.visible){visible=false;break;}
      if(!ancestor)visible=false;
      mesh.visible=visible;
      mesh.geometry=source.geometry;mesh.material=source.material;
      mesh.matrix.multiplyMatrices(this.inverse,source.matrixWorld);
      mesh.matrix.elements[13]+=offset;
      mesh.matrixWorldNeedsUpdate=true;
      // Skinned proxies share the live bone palette and exact source shape.
      if(source instanceof THREE.SkinnedMesh&&mesh instanceof THREE.SkinnedMesh){
        mesh.bindMode='detached';
        mesh.skeleton=source.skeleton;mesh.bindMatrix.copy(source.bindMatrix);mesh.bindMatrixInverse.copy(source.bindMatrixInverse);
      }
      if(source instanceof THREE.InstancedMesh&&mesh instanceof THREE.InstancedMesh){
        mesh.instanceMatrix=source.instanceMatrix;mesh.instanceColor=source.instanceColor;mesh.count=source.count;
      }
      if(source.morphTargetInfluences)mesh.morphTargetInfluences=source.morphTargetInfluences;
    }
    this.root.visible=far>0;
  }
  private scan():void {
    const sources:THREE.Mesh[]=[];
    const visit=(o:THREE.Object3D)=>{
      if(o===this.root||o.userData.editorGhost)return;
      if(o instanceof THREE.Mesh&&!this.known.has(o))sources.push(o);
      for(const child of o.children)visit(child);
    };
    visit(this.source);
    this.source.updateWorldMatrix(true,true);
    this.inverse.copy(this.source.matrixWorld).invert();
    const batches=new Map<string,{material:THREE.Material;geometries:THREE.BufferGeometry[]}>();
    for(const source of sources){
      this.known.add(source);
      let index:number|undefined,visible=true;
      for(let at:THREE.Object3D|null=source;at&&at!==this.source;at=at.parent){
        if(!at.visible)visible=false;
        if(Number.isInteger(at.userData.editorIdx))index=at.userData.editorIdx;
      }
      if(visible&&index!==undefined&&this.staticComponent(index)&&
          !(source instanceof THREE.SkinnedMesh)&&!(source instanceof THREE.InstancedMesh)&&
          !Array.isArray(source.material)&&!source.morphTargetInfluences){
        // Chunked exact-geometry batches: fewer draw calls, still independently
        // culled along the corridor. Collision keeps its original native mesh.
        const matrix=new THREE.Matrix4().multiplyMatrices(this.inverse,source.matrixWorld);
        let geometry=source.geometry.clone().applyMatrix4(matrix);
        if(geometry.index){const indexed=geometry;geometry=indexed.toNonIndexed();indexed.dispose();}
        const layout=Object.entries(geometry.attributes).map(([key,a])=>key+':'+a.itemSize+':'+a.normalized).sort().join(',');
        const materialKey=staticMaterialKey(source.material),parts=partitionPeriodicGeometry(geometry);
        for(const [chunk,part] of parts){
          const key=materialKey+':'+chunk+':'+layout;
          const batch=batches.get(key)??{material:source.material,geometries:[]};
          batch.geometries.push(part);batches.set(key,batch);
        }
        if(parts.size!==1)geometry.dispose();
        continue;
      }
      for(const cell of this.cells){
        // Object3D.clone JSON-copies userData, whose collision owners may be
        // circular. Only render state belongs to a periodic neighbour.
        const mesh=source instanceof THREE.SkinnedMesh?new THREE.SkinnedMesh(source.geometry,source.material):
          source instanceof THREE.InstancedMesh?new THREE.InstancedMesh(source.geometry,source.material,source.count):
          new THREE.Mesh(source.geometry,source.material);
        mesh.name='Periodic / '+source.name;
        mesh.matrixAutoUpdate=false;mesh.castShadow=false;mesh.receiveShadow=source.receiveShadow;mesh.renderOrder=source.renderOrder;
        // Raycasts on the level root (editor/inspection) must not pick ghosts.
        mesh.raycast=()=>{};
        this.root.add(mesh);this.copies.push({source,mesh,offset:cell*this.loop.height});
      }
    }
    for(const {material,geometries} of batches.values()){
      const geometry=mergeGeometries(geometries,false);
      if(!geometry)throw new Error('Incompatible periodic geometry batch');
      for(const part of geometries)part.dispose();
      geometry.computeBoundingSphere();this.owned.push(geometry);this.batches++;
      for(const cell of this.cells){
        const mesh=new THREE.Mesh(geometry,material);
        mesh.name='Periodic / native static batch';mesh.position.y=cell*this.loop.height;
        mesh.matrixAutoUpdate=false;mesh.updateMatrix();mesh.raycast=()=>{};
        this.root.add(mesh);
      }
    }
  }
  get diagnostics(){return {copies:this.root.children.length,liveCopies:this.copies.length,staticBatches:this.batches,cells:this.cells.length+1,sharedGeometry:true};}
  dispose():void {this.root.removeFromParent();this.root.clear();this.copies.length=0;for(const geometry of this.owned)geometry.dispose();this.owned.length=0;}
}
