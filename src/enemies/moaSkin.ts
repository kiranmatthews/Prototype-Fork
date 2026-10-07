import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { AssetCache, disposeTextures } from '../assetLifetime';
import { sceneryLoads } from '../assetLoadQueue';
import { Emitter, puffs } from '../puffs';
import { enemyElasticPulse } from './elasticity';
import type { EnemyAnimationFrame, EnemyVisualDiagnostics } from './types';

const assets=new AssetCache<string,THREE.Group>(async(url,_dependency,wanted)=>{
  const gltf=await sceneryLoads.run(()=>new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url),wanted);
  gltf.scene.traverse(o=>{const m=o as THREE.Mesh;if(!m.isMesh)return;m.geometry.userData.shared=true;
    for(const material of Array.isArray(m.material)?m.material:[m.material]){
      material.userData.shared=true;(material as THREE.MeshStandardMaterial).fog=false;
      for(const value of Object.values(material))if(value?.isTexture){
        value.userData.shared=true;
        if(!/moa-roast-chicken\.glb(?:[?#]|$)/.test(url)){value.anisotropy=8;value.magFilter=THREE.LinearFilter;value.minFilter=THREE.LinearMipmapLinearFilter;}
      }
    }});
  return gltf.scene;
},root=>{
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>(),skeletons=new Set<THREE.Skeleton>();
  root.traverse(o=>{const m=o as THREE.SkinnedMesh;if(!m.isMesh)return;geometries.add(m.geometry);if(m.isSkinnedMesh)skeletons.add(m.skeleton);
    for(const material of Array.isArray(m.material)?m.material:[m.material])materials.add(material);});
  for(const m of materials){for(const value of Object.values(m))if(value?.isTexture)textures.add(value);m.dispose();}
  for(const g of geometries)g.dispose();for(const s of skeletons)s.dispose();disposeTextures(textures);
});

/** Meshy supplies the surfaces; the original control rig owns every live pose. */
export function mountMoaSkin(body:THREE.Group,poses:()=>Record<string,THREE.Matrix4>,diagnostic:EnemyVisualDiagnostics,sourceUrl?:string){
  const live=new THREE.Group(),roast=new THREE.Group();live.name='Moa_MeshySkin';roast.name='Moa_RoastChicken';body.add(live,roast);roast.visible=false;
  const url=sourceUrl??`${import.meta.env.BASE_URL}enemies/moa-clean.glb`,chickenUrl=url.slice(0,url.lastIndexOf('/')+1)+'moa-roast-chicken.glb';
  const birdLease=assets.acquire(url),chickenLease=assets.acquire(chickenUrl),bones=new Map<string,THREE.Bone>(),skeletons=new Set<THREE.Skeleton>();
  const steam=new Emitter(puffs,'steam',{shape:'disc',size:new THREE.Vector3(.3,.02,.3),rate:[6,8],seed:body.id});
  let disposed=false,last:EnemyAnimationFrame|null=null;
  diagnostic.status='loading';diagnostic.url=url;diagnostic.meshes=0;diagnostic.skinnedMeshes=0;
  function update(dt:number,frame:EnemyAnimationFrame){
    if(disposed)return;last=frame;
    const cooking=frame.state==='roast';live.visible=!cooking&&frame.state!=='removed';roast.visible=cooking;
    if(live.visible){
      const controls=poses();for(const [name,bone]of bones){bone.matrix.copy(controls[name]);bone.matrixWorldNeedsUpdate=true;}
      live.updateMatrixWorld(true);for(const s of skeletons)s.update();
    }
    if(cooking){
      const pulse=enemyElasticPulse(frame.stateTime,.5);
      roast.position.y=Math.sin(Math.PI*Math.min(1,frame.stateTime/.42))*.18;
      roast.scale.set(1-pulse*.07,1+pulse*.14,1-pulse*.07);roast.updateWorldMatrix(true,true);
      roast.getWorldPosition(steam.pos);steam.pos.y+=.72;steam.update(dt);
      diagnostic.activeClip='Steaming roast';
    }
  }
  const ready=Promise.all([birdLease.promise,chickenLease.promise]).then(([bird,chicken])=>{
    if(disposed)return;
    const model=cloneSkeleton(bird) as THREE.Group;live.add(model);roast.add(chicken.clone(true));
    model.traverse(o=>{
      if((o as THREE.Bone).isBone&&o.name.startsWith('moa_')){o.matrixAutoUpdate=false;bones.set(o.name.slice(4),o as THREE.Bone);}
      const m=o as THREE.SkinnedMesh;if(m.isMesh){m.castShadow=m.receiveShadow=true;m.frustumCulled=false;diagnostic.meshes++;if(m.isSkinnedMesh){skeletons.add(m.skeleton);diagnostic.skinnedMeshes++;}}
    });
    roast.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh){m.castShadow=m.receiveShadow=true;}});
    const controls=poses();for(const name of bones.keys())if(!controls[name])throw Error(`Unmapped moa control: ${name}`);
    if(!bones.has('head')||!bones.has('jaw')||!bones.has('footLeft')||!bones.has('neck7'))throw Error('Incomplete moa surface rig');
    diagnostic.status='ready';body.updateWorldMatrix(true,true);if(last)update(0,last);
  }).catch(error=>{if(!disposed){diagnostic.status='error';diagnostic.error=String(error);}});
  return {ready,update,dispose(){if(disposed)return;disposed=true;live.removeFromParent();roast.removeFromParent();live.clear();roast.clear();for(const s of skeletons)s.dispose();birdLease.release();chickenLease.release();}};
}
