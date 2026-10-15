import * as THREE from 'three';
import {warehouseTextureLoader} from './warehouseTextureLoader';

export type WarehouseSurface='concrete'|'brick'|'rust'|'plywood'|'steel';
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
   roughness:kind==='plywood'?.83:1,metalness:kind==='rust'||kind==='steel'?.8:0,aoMapIntensity:.65,
   normalScale:new THREE.Vector2(kind==='brick'?.45:.24,kind==='brick'?.45:.24)});
  this.bind(material,'map',path+'-diff.webp',true);this.bind(material,'normalMap',path+'-nor_gl.webp');
  for(const slot of['roughnessMap','metalnessMap','aoMap'] as const)this.bind(material,slot,path+'-arm.webp');
  if(bias){material.polygonOffset=true;material.polygonOffsetFactor=material.polygonOffsetUnits=bias;}
  material.name='Warehouse / sourced '+kind;material.userData.warehouseSurface=kind;
  if(semantic!==undefined)material.userData.texKind=semantic;
  this.surfaces.set(key,material);this.materials.add(material);return material;
 }
 own<T extends THREE.Material>(material:T):T {this.materials.add(material);return material;}
 async ready():Promise<void>{await Promise.all(this.pending);}
 dispose():void {this.disposed=true;for(const m of this.materials)m.dispose();for(const t of this.textures)t.dispose();this.materials.clear();this.textures.clear();this.maps.clear();this.surfaces.clear();}
}

/** Per-vertex metre UVs preserve the actual surface and every collider. */
export function warehouseSurfaceUV(mesh:THREE.Mesh,tile:number,halfpipe=false):THREE.BufferGeometry {
 const g=mesh.geometry.clone();
 if(g.index){const expanded=g.toNonIndexed();g.setIndex(null);for(const[name,attribute]of Object.entries(expanded.attributes))g.setAttribute(name,attribute);expanded.dispose();}
 const position=g.getAttribute('position');
 const uv=new Float32Array(position.count*2),p=new THREE.Vector3(),n=new THREE.Vector3(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
 for(let i=0;i<position.count;i++){
  // A ribbon shares vertices across its top and vertical skirts. Choosing a
  // projection from smoothed vertex normals collapses skirt UVs and can
  // produce invalid normal-map derivatives. Each real triangle owns its UV plane.
  if(i%3===0){a.fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld);b.fromBufferAttribute(position,i+1).applyMatrix4(mesh.matrixWorld);c.fromBufferAttribute(position,i+2).applyMatrix4(mesh.matrixWorld);n.crossVectors(b.sub(a),c.sub(a)).normalize();}
  p.fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld);
  if(halfpipe&&Math.abs(n.z)<.8){const x=p.x+46,a=Math.abs(x),profile=a<=5?a:5+4.5*Math.asin(THREE.MathUtils.clamp((a-5)/4.5,0,1))+Math.max(0,a-9.5)+Math.max(0,p.y-4.5);
   uv[i*2]=p.z/2.4;uv[i*2+1]=Math.sign(x)*profile/1.2;
  }else if(Math.abs(n.y)>=Math.max(Math.abs(n.x),Math.abs(n.z))){uv[i*2]=p.x/tile;uv[i*2+1]=p.z/tile;}
  else if(Math.abs(n.x)>Math.abs(n.z)){uv[i*2]=p.z/tile;uv[i*2+1]=p.y/tile;}
  else {uv[i*2]=p.x/tile;uv[i*2+1]=p.y/tile;}
 }
 g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.setAttribute('uv1',new THREE.BufferAttribute(uv.slice(),2));return g;
}
