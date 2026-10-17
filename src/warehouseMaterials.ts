import * as THREE from 'three';
import {toCreasedNormals} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {CustomComponent} from './level';
import {warehouseTextureLoader} from './warehouseTextureLoader';

export type WarehouseSurface='concrete'|'rust'|'plywood'|'steel';
/** These are licensed Poly Haven maps, not generated surface tiles. */
export class WarehouseMaterials {
 readonly pending:Promise<void>[]=[];
 readonly errors:string[]=[];
 readonly materials=new Set<THREE.Material>();
 readonly textures=new Set<THREE.Texture>();
 private surfaces=new Map<string,THREE.MeshStandardMaterial>();
 private maps=new Map<string,Promise<THREE.Texture|null>>();
 private disposed=false;
 private texture(file:string,color=false,clamp=false):Promise<THREE.Texture|null> {
  const key=file+color+clamp,old=this.maps.get(key);if(old)return old;
  const promise=new Promise<THREE.Texture|null>(resolve=>{
   const success=(source:THREE.Texture)=>{const texture=source.clone();if(this.disposed){texture.dispose();resolve(null);return;}
    texture.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;texture.anisotropy=8;
    texture.wrapS=texture.wrapT=clamp?THREE.ClampToEdgeWrapping:THREE.RepeatWrapping;this.textures.add(texture);resolve(texture);};
   const failure=()=>{if(!this.disposed)this.errors.push(file);resolve(null);},ktx=warehouseTextureLoader();
   if(ktx)ktx.load(import.meta.env.BASE_URL+file.replace(/\.webp$/,'.ktx2'),success,undefined,failure);
   else new THREE.TextureLoader().load(import.meta.env.BASE_URL+file,success,undefined,failure);
  });this.maps.set(key,promise);this.pending.push(promise.then(()=>{}));return promise;
 }
 bind(material:THREE.MeshStandardMaterial,slot:'map'|'normalMap'|'roughnessMap'|'metalnessMap'|'aoMap',file:string,color=false,clamp=false):void {
  this.texture(file,color,clamp).then(texture=>{if(this.disposed||!texture)return;material[slot]=texture;material.needsUpdate=true;});
 }
 surface(kind:WarehouseSurface,tint='#ffffff',side:THREE.Side=THREE.FrontSide,semantic?:string,bias=0):THREE.MeshStandardMaterial {
  const key=kind+tint+side+(semantic??'')+bias,old=this.surfaces.get(key);if(old)return old;
  const path='warehouse/materials/'+kind;
  const material=new THREE.MeshStandardMaterial({color:tint,side,
   roughness:kind==='plywood'?.88:kind==='concrete'?.94:1,metalness:kind==='rust'||kind==='steel'?.8:0,aoMapIntensity:.65,
   normalScale:new THREE.Vector2(.4,.4)});
  this.bind(material,'map',path+'-diff.webp',true);this.bind(material,'normalMap',path+'-nor_gl.webp');
  for(const slot of['roughnessMap','metalnessMap','aoMap'] as const)this.bind(material,slot,path+'-arm.webp');
  if(bias){material.polygonOffset=true;material.polygonOffsetFactor=material.polygonOffsetUnits=bias;}
  material.name='Warehouse / sourced '+kind;material.userData.warehouseSurface=kind;
  if(semantic!==undefined)material.userData.texKind=semantic;
  this.surfaces.set(key,material);this.materials.add(material);return material;
 }
 finish(tint:string,side:THREE.Side,metalness=0,roughness=.8):THREE.MeshStandardMaterial {
  const key='finish'+tint+side+metalness+roughness,old=this.surfaces.get(key);if(old)return old;
  const material=this.own(new THREE.MeshStandardMaterial({color:tint,side,metalness,roughness,envMapIntensity:.8}));
  material.name='Warehouse / '+(metalness?'worn metal edge':'construction joint');
  this.surfaces.set(key,material);return material;
 }
 own<T extends THREE.Material>(material:T):T {this.materials.add(material);return material;}
 async ready():Promise<void>{await Promise.all(this.pending);}
 dispose():void {this.disposed=true;for(const m of this.materials)m.dispose();for(const t of this.textures)t.dispose();this.materials.clear();this.textures.clear();this.maps.clear();this.surfaces.clear();}
}

/** Distances around the same cross-section authored by buildVertRampGeometry. */
function vertProfileDistances(c:CustomComponent):number[] {
 const radius=Math.max(.5,c.rise??6),flatHalf=Math.max(0,c.w??3),steps=c.arcSteps??24;
 const arc=THREE.MathUtils.degToRad(THREE.MathUtils.clamp(c.arc??90,5,90)),deck=Math.max(0,c.deck??0);
 const lipRise=THREE.MathUtils.clamp(c.lipRise??0,0,8),outerBank=THREE.MathUtils.clamp(c.outerBank??0,0,40);
 const lipX=flatHalf+radius*Math.sin(arc),lipY=radius*(1-Math.cos(arc))+lipRise;
 const half=Array.from({length:steps+1},(_,i)=>{const angle=arc*i/steps;return new THREE.Vector2(flatHalf+radius*Math.sin(angle),radius*(1-Math.cos(angle)));});
 if(lipRise>0)half.push(new THREE.Vector2(lipX,lipY));
 if(outerBank>0){if(deck>0)half.push(new THREE.Vector2(lipX+deck,lipY));half.push(new THREE.Vector2(lipX+deck+outerBank,0));}
 else if(deck>0)half.push(new THREE.Vector2(lipX+deck,lipY),new THREE.Vector2(lipX+deck+.1,lipY),new THREE.Vector2(lipX+deck+.1,0));
 const profile=c.vkind==='half'?[...half.map(p=>new THREE.Vector2(-p.x,p.y)).reverse(),...half]:[new THREE.Vector2(),...half];
 const distances=[0];for(let i=1;i<profile.length;i++)distances.push(distances[i-1]+profile[i].distanceTo(profile[i-1]));return distances;
}

/** Per-vertex metre UVs preserve the actual surface and every collider. */
export function warehouseSurfaceUV(mesh:THREE.Mesh,tile:number,vert?:CustomComponent,crease=false):THREE.BufferGeometry {
 const g=mesh.geometry.clone();
 if(g.index){
  const index=g.index,expanded=g.toNonIndexed();
  const top=g.userData.grindIndices as number[]|undefined;
  if(top){
   // The authored top cap refers to vertex IDs, not triangle offsets. UV
   // seams duplicate vertices; its grind topology must follow that remap.
   const remap=new Map<number,number>();for(let i=0;i<index.count;i++)remap.set(index.getX(i),i);
   g.userData={...g.userData,grindIndices:top.map(i=>{
    const vertex=remap.get(i);if(vertex===undefined)throw new Error('Warehouse top cap references an unused vertex');return vertex;
   })};
  }
  g.setIndex(null);for(const[name,attribute]of Object.entries(expanded.attributes))g.setAttribute(name,attribute);expanded.dispose();
 }
 if(crease)toCreasedNormals(g,THREE.MathUtils.degToRad(5));
 const position=g.getAttribute('position');
 // Swept verts already carry distance along their spine. Rebuild only the
 // cross-profile coordinate from the component, including its vertical lip
 // and outside bank. No world origin, orientation or old bowl size is baked in.
 if(vert&&mesh.userData.vertRampMesh){
  const distances=vertProfileDistances(vert),source=g.getAttribute('uv'),segments=distances.length-1;
  if(position.count%(segments*6)!==0)throw new Error('Warehouse vert UV profile does not match its authored geometry');
  const uv=new Float32Array(position.count*2),corners=[0,1,1,0,0,1];
  const sourceTile=vert.tex==='coast-bedrock'||vert.tex==='custard-sandstone'?3.1:6;
  // Those two source styles already encode metre distances with U along
  // the spine; the default vert mapping uses V for the spine instead.
  const metricSource=sourceTile===3.1;
  for(let i=0;i<position.count;i++){
   uv[i*2]=(metricSource?source.getX(i):source.getY(i))*sourceTile/tile;
   uv[i*2+1]=distances[Math.floor(i/6)%segments+corners[i%6]]/tile;
  }
  g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.setAttribute('uv1',new THREE.BufferAttribute(uv.slice(),2));return g;
 }
 const uv=new Float32Array(position.count*2),p=new THREE.Vector3(),n=new THREE.Vector3(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
 const normals=g.getAttribute('normal'),localUp=new THREE.Vector3(0,1,0).transformDirection(mesh.matrixWorld.clone().invert());
 for(let i=0;i<position.count;i++){
  // A ribbon shares vertices across its top and vertical skirts. Choosing a
  // projection from smoothed vertex normals collapses skirt UVs and can
  // produce invalid normal-map derivatives. Each real triangle owns its UV plane.
  if(i%3===0){a.fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld);b.fromBufferAttribute(position,i+1).applyMatrix4(mesh.matrixWorld);c.fromBufferAttribute(position,i+2).applyMatrix4(mesh.matrixWorld);n.crossVectors(b.sub(a),c.sub(a)).normalize();}
  p.fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld);
  // UV seams already split the render vertices. Keep horizontal concrete
  // caps truly flat instead of averaging their normals with the bank below;
  // native triangle positions and grind boundaries remain untouched.
  if(n.y>.9999&&normals)normals.setXYZ(i,localUp.x,localUp.y,localUp.z);
  if(Math.abs(n.y)>=Math.max(Math.abs(n.x),Math.abs(n.z))){uv[i*2]=p.x/tile;uv[i*2+1]=p.z/tile;}
  else if(Math.abs(n.x)>Math.abs(n.z)){uv[i*2]=p.z/tile;uv[i*2+1]=p.y/tile;}
  else {uv[i*2]=p.x/tile;uv[i*2+1]=p.y/tile;}
 }
 g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.setAttribute('uv1',new THREE.BufferAttribute(uv.slice(),2));return g;
}
