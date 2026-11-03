import * as THREE from 'three';
import {GLTFLoader,type GLTF} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {AssetCache,disposeTextures} from './assetLifetime';
import {sceneryLoads} from './assetLoadQueue';
import {CarlisleMarineNet,marineFrameHeight} from './carlisleMarineNet';
import {trampolineSurfacePresentations} from './trampolineSurface';
import type {CustomComponent,CustomLevelData} from './level';

export const isTribalTrampoline=(c:CustomComponent)=>c.t==='trampoline'&&c.tex==='tribal-weave';
const corners=new AssetCache<'rope-corner',GLTF>(async(_key,_dependency,wanted)=>{
 const gltf=await sceneryLoads.run(()=>new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}props/sunset-waterfalls/rope-corner.glb`),wanted);
 gltf.scene.updateMatrixWorld(true);
 gltf.scene.traverse(n=>{const m=n as THREE.Mesh;if(!m.isMesh)return;m.geometry.userData.shared=true;
  for(const mat of Array.isArray(m.material)?m.material:[m.material]){
   mat.userData.shared=true;
   for(const t of Object.values(mat))if(t?.isTexture){t.userData.shared=true;t.anisotropy=8;}
   const pbr=mat as THREE.MeshStandardMaterial;if(pbr.isMeshStandardMaterial){pbr.roughness=.9;pbr.metalness=0;}
  }
 });return gltf;
},gltf=>{
 const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
 gltf.scene.traverse(n=>{const m=n as THREE.Mesh;if(!m.isMesh)return;geometries.add(m.geometry);for(const mat of Array.isArray(m.material)?m.material:[m.material])materials.add(mat);});
 materials.forEach(m=>{for(const t of Object.values(m))if(t?.isTexture)textures.add(t);m.dispose();});
 geometries.forEach(g=>g.dispose());disposeTextures(textures);
});

/** Only art changes: the native deck, air controls and LaunchCamera are the
 * same as Carlisle. Ropes keep the same weight/impact deformation and bounds. */
class TribalTrampolines {
 readonly ready:Promise<void>;
 readonly diagnostics={nets:0,corners:0,trianglesPerCorner:5082,status:'loading',errors:[] as string[]};
 private readonly assets=corners.scope();
 private readonly hidden=new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:false});
 private readonly entries:{mesh:THREE.Mesh;material:THREE.Material|THREE.Material[];mount:THREE.Group;net:CarlisleMarineNet;impact:number}[]=[];
 private fog:THREE.Fog|null=null;
 private baseFog:{near:number;far:number}|null=null;
 private disposed=false;
 constructor(data:CustomLevelData,ground:THREE.Object3D[]){
  for(const mesh of ground){
   if(!(mesh as THREE.Mesh).isMesh)continue;
   const c=data.components[mesh.userData.editorIdx];if(!c||!isTribalTrampoline(c))continue;
   const pad=mesh as THREE.Mesh,[w,h,d]=c.s??[20,.7,28],mount=new THREE.Group();mount.name='Tribal timber trampoline';pad.add(mount);
   const net=new CarlisleMarineNet(w,d,marineFrameHeight(w,d),'tribal');net.group.position.y=h/2+.03;mount.add(net.group);
   this.entries.push({mesh:pad,material:pad.material,mount,net,impact:0});pad.material=this.hidden;
   trampolineSurfacePresentations.set(pad,net);pad.userData.tribalNet=net.diagnostics;this.diagnostics.nets++;
  }
  this.ready=this.assets.load('rope-corner').then(gltf=>{
   if(this.disposed)return;
   const box=new THREE.Box3().setFromObject(gltf.scene),centre=box.getCenter(new THREE.Vector3());
   const scale=3.6/(box.max.x-box.min.x),normalise=new THREE.Matrix4().makeTranslation(-centre.x,-box.min.y,-centre.z);
   for(const {mesh,mount}of this.entries){
    const c=data.components[mesh.userData.editorIdx],[w,h,d]=c.s!;
    gltf.scene.traverse(n=>{
     const source=n as THREE.Mesh;if(!source.isMesh)return;
     const instances=new THREE.InstancedMesh(source.geometry,source.material,4);instances.name='Smart Mesh 5082-triangle rope-lashed timber corners';
     let i=0;for(const x of [-1,1])for(const z of [-1,1]){
      const turn=Math.atan2(x,z)-Math.PI/4;
      const matrix=new THREE.Matrix4().compose(new THREE.Vector3(x*w*.4225,h/2-1.1,z*d*.451786),
       new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),turn),new THREE.Vector3(scale,scale,scale));
      matrix.multiply(normalise).multiply(source.matrixWorld);instances.setMatrixAt(i++,matrix);this.diagnostics.corners++;
     }
     instances.instanceMatrix.needsUpdate=true;instances.castShadow=true;instances.receiveShadow=true;instances.computeBoundingBox();instances.computeBoundingSphere();mount.add(instances);
    });
   }
   this.diagnostics.status='ready';
  }).catch(error=>{if(this.disposed)return;this.diagnostics.status='error';this.diagnostics.errors.push(String(error));console.error('Tribal trampoline corner failed',error);});
 }
 update(dt:number){for(const entry of this.entries){
  const impact=entry.mesh.userData.trampolineVisualImpact;
  if(impact&&impact.id!==entry.impact){entry.impact=impact.id;entry.net.impact(impact.x,impact.z,impact.speed);}
  entry.net.update(dt);
 }}
 /** The long launch view needs to reveal its landing below. Restore the
  * original valley haze outside the waterfall corridor and on disposal. */
 view(camera:THREE.Camera,scene:THREE.Scene){
  if(this.disposed||!(scene.fog instanceof THREE.Fog))return;
  if(scene.fog!==this.fog){this.fog=scene.fog;this.baseFog={near:scene.fog.near,far:scene.fog.far};}
  const distance=Math.min(...this.entries.map(e=>Math.hypot(camera.position.x-e.mesh.position.x,camera.position.z-e.mesh.position.z)));
  const blend=1-THREE.MathUtils.smoothstep(distance,55,105);
  this.fog.near=THREE.MathUtils.lerp(this.baseFog!.near,120,blend);
  this.fog.far=THREE.MathUtils.lerp(this.baseFog!.far,225,blend);
 }
 dispose(){
  this.disposed=true;
  if(this.fog&&this.baseFog){this.fog.near=this.baseFog.near;this.fog.far=this.baseFog.far;}
  for(const {mesh,material,mount,net}of this.entries){
   trampolineSurfacePresentations.delete(mesh);delete mesh.userData.tribalNet;net.dispose();mesh.material=material;
   mount.traverse(n=>{if((n as THREE.InstancedMesh).isInstancedMesh)(n as THREE.InstancedMesh).dispose();});mount.removeFromParent();
  }
  this.entries.length=0;this.hidden.dispose();this.assets.dispose();
 }
}
export function createTribalTrampolines(data:CustomLevelData,ground:THREE.Object3D[]){
 return data.components.some(isTribalTrampoline)?new TribalTrampolines(data,ground):null;
}
