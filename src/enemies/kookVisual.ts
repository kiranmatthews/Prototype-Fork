import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {clone as cloneSkeleton} from 'three/examples/jsm/utils/SkeletonUtils.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {AssetCache,disposeTextures} from '../assetLifetime';
import {sceneryLoads} from '../assetLoadQueue';
import type {EnemyAnimationFrame,EnemyKind,EnemyVisual,EnemyVisualDiagnostics} from './types';
import type {KookRole} from './kookBehavior';
import {KookArticulation} from './kookArticulation';
import {KookSquawk} from './kookSquawk';
export {KOOK_ELASTICITY} from './kookArticulation';
const base=import.meta.env.BASE_URL+'rooftop-kook/';
const textures=(m:THREE.Material)=>Object.values(m).filter((v):v is THREE.Texture=>!!v?.isTexture);
const weaponCache=new AssetCache<string,THREE.Group>(async(name,_dependency,wanted)=>{
 const gltf=await sceneryLoads.run(()=>new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(base+name+'.glb'),wanted);
 gltf.scene.traverse(o=>{const m=o as THREE.Mesh;if(!m.isMesh)return;m.geometry.userData.shared=true;
  for(const mat of Array.isArray(m.material)?m.material:[m.material]){mat.userData.shared=true;for(const t of textures(mat)){t.userData.shared=true;t.anisotropy=8;}}
 });return gltf.scene;
},scene=>{
 const geos=new Set<THREE.BufferGeometry>(),mats=new Set<THREE.Material>(),maps=new Set<THREE.Texture>(),skeletons=new Set<THREE.Skeleton>();
 scene.traverse(o=>{const m=o as THREE.SkinnedMesh;if(!m.isMesh)return;geos.add(m.geometry);if(m.isSkinnedMesh)skeletons.add(m.skeleton);for(const mat of Array.isArray(m.material)?m.material:[m.material])mats.add(mat);});
 for(const mat of mats){for(const t of textures(mat))maps.add(t);mat.dispose();}for(const geo of geos)geo.dispose();for(const s of skeletons)s.dispose();disposeTextures(maps);
});

/** Native Meshy prop. These invisible sockets fit its measured stock, fore-end
 * and muzzle; they do not replace or approximate the generated surface. */
function makeGun(){
 const group=new THREE.Group(),muzzle=new THREE.Object3D(),right=new THREE.Object3D(),left=new THREE.Object3D();
 const lease=weaponCache.acquire('heirloom-shotgun');let disposed=false;
 const ready=lease.promise.then(asset=>{
  if(disposed)return;const model=asset.clone(true);model.rotation.y=Math.PI/2;model.scale.setScalar(1.4/1.903805971);model.position.set(0,-.09,.37);
  model.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh)m.castShadow=m.receiveShadow=true;});group.add(model);group.userData.nativeWeapon='heirloom-shotgun';
 });
 muzzle.position.set(0,.04,1.07);right.position.set(-.055,-.12,.23);left.position.set(.10,-.08,.58);group.add(muzzle,right,left);
 const flash=new THREE.Mesh(new THREE.SphereGeometry(.18,16,12),new THREE.MeshBasicMaterial({color:0xffe9ac,toneMapped:false}));
 flash.position.set(0,.05,1.08);flash.scale.set(.6,.6,2);flash.visible=false;group.add(flash);
 return {group,muzzle,right,left,flash,ready,dispose(){disposed=true;flash.geometry.dispose();flash.material.dispose();lease.release();group.removeFromParent();}};
}

/** Meshy component surfaces on a semantic bone-man rig. Each actor clones only
 * its pose, sharing complete native geometry and atlases across the level. */
export function createKookVisual(kind:EnemyKind,role:KookRole,height=role==='lookout'?2.35:2.5):EnemyVisual {
 const assetName=role==='lookout'?'pig-matron':'pig-guard',baseHeight=role==='lookout'?2.35:2.5;
 const group=new THREE.Group(),body=new THREE.Group();group.add(body);body.scale.setScalar(height/baseHeight);
 group.name=role==='lookout'?'Pig matron':'Boar estate guard';group.userData.kookRole=role;group.userData.kookHeight=height;
 const diagnostic:EnemyVisualDiagnostics={kind,status:'loading',url:base+assetName+'.glb',clips:['stroll','inhale','squawk','aim','recoil','recover'],activeClip:null,mappedNodes:{torso:'spine',head:'head',jaw:'jaw'},skinnedMeshes:0,meshes:0,animationTime:0,gaitPhase:0,state:'patrol'};
 const lease=weaponCache.acquire(assetName),gun=role==='gunner'?makeGun():null;
 const beam=role==='lookout'?new KookSquawk():null;if(beam){group.add(beam);group.userData.kookSquawk=beam;}
 if(gun){body.add(gun.group);gun.group.visible=false;}
 let disposed=false,model:THREE.Group|null=null,rig:KookArticulation|null=null,skeleton:THREE.Skeleton|null=null,gunAim=0;
 let last:EnemyAnimationFrame={state:'patrol',stateTime:0,time:0,speed:0,verticalVelocity:0,grounded:true,alive:true,flung:false};
 const mouth=new THREE.Vector3(),forward=new THREE.Vector3(),grip=new THREE.Vector3(),orientation=new THREE.Quaternion();
 const ready=Promise.all([lease.promise,gun?.ready]).then(([asset])=>{
  if(disposed)return;
  model=cloneSkeleton(asset) as THREE.Group;model.name=assetName+' · Meshy components';
  const surplus=new Set<THREE.Skeleton>();
  model.traverse(o=>{const mesh=o as THREE.SkinnedMesh;if(!mesh.isMesh)return;diagnostic.meshes++;
   mesh.castShadow=mesh.receiveShadow=true;
   if(mesh.isSkinnedMesh){diagnostic.skinnedMeshes++;if(!skeleton)skeleton=mesh.skeleton;else{surplus.add(mesh.skeleton);mesh.skeleton=skeleton;}
    // Conservative, pose-independent bounds avoid walking every native vertex
    // on the CPU and retain normal frustum culling without any LOD substitute.
    mesh.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,baseHeight*.5,0),baseHeight*1.05);
    mesh.boundingBox=new THREE.Box3(new THREE.Vector3(-baseHeight,-.3,-baseHeight),new THREE.Vector3(baseHeight,baseHeight*1.3,baseHeight));
   }
  });
  for(const s of surplus)if(s!==skeleton)s.dispose();
  body.add(model);rig=new KookArticulation(model,role,baseHeight);group.userData.rigContract='bone-man semantic humanoid';
  group.userData.meshyComponents=diagnostic.skinnedMeshes;group.userData.assetReady=true;diagnostic.status='ready';
  if(gun)gun.group.visible=true;update(0,last);
 }).catch(error=>{if(!disposed){diagnostic.status='error';diagnostic.error=String(error);}});
 function update(dt:number,frame:EnemyAnimationFrame):void {
  last=frame;diagnostic.state=frame.state;if(!rig||!model)return;
  group.updateWorldMatrix(true,true);rig.pose(dt,frame,kind,body.scale.y);
  diagnostic.activeClip=!frame.alive?'defeat':frame.speed>.03?'stroll':frame.state;
  diagnostic.animationTime=frame.time;diagnostic.gaitPhase=rig.phase;diagnostic.plantedFeet={...rig.planted};
  if(gun){
   const aimed=['aim','fire','reload'].includes(frame.state);
   gunAim=THREE.MathUtils.damp(gunAim,aimed?1:0,12,dt);
   const recoil=frame.state==='fire'?Math.sin(Math.min(1,frame.stateTime/.18)*Math.PI)*.10:0;
   gun.group.position.set(-.10,1.52+gunAim*.12,.50-recoil);
   const desired=new THREE.Quaternion().setFromEuler(new THREE.Euler(.35*(1-gunAim),0,0));
   if(aimed&&frame.attackTarget){const aim=body.worldToLocal(frame.attackTarget.clone()).sub(gun.group.position).normalize();
    aim.y=THREE.MathUtils.clamp(aim.y,-.5,.4);aim.normalize();desired.setFromUnitVectors(new THREE.Vector3(0,0,1),aim);}
   gun.group.quaternion.slerp(desired,dt>0?1-Math.exp(-dt*14):1);gun.flash.visible=frame.alive&&frame.state==='fire'&&frame.stateTime<.075;
   group.updateWorldMatrix(true,true);const errors=[];
   for(const [side,socket,sign]of [['right',gun.right,-1],['left',gun.left,1]] as const){
    // Right hoof wraps the stock; left palm faces upward under the fore-end.
    const handPose=side==='left'?new THREE.Euler(-1.25,.1,-.1):new THREE.Euler(.5,1.1,.12);
    orientation.copy(gun.group.getWorldQuaternion(new THREE.Quaternion())).multiply(new THREE.Quaternion().setFromEuler(handPose));
    const palm=new THREE.Vector3(sign*.035,-.20,.05),contact=socket.getWorldPosition(grip).clone();
    const wrist=contact.clone().sub(palm.clone().multiplyScalar(body.scale.y).applyQuaternion(orientation));
    rig.grip(side,wrist,orientation);group.updateWorldMatrix(true,true);
    errors.push(rig.bones.get('wrist-'+side)!.localToWorld(palm).distanceTo(contact));
   }
   rig.handErrors=errors;group.userData.kookHandErrors=errors;
  }
  group.updateWorldMatrix(true,true);
  group.userData.kookFootErrors=rig.footErrors;group.userData.kookElasticity={torso:rig.torsoRatio,neck:rig.neckRatio};
  if(beam){rig.mouth(mouth);forward.copy(mouth).add(new THREE.Vector3(0,0,18).applyQuaternion(body.getWorldQuaternion(new THREE.Quaternion())));
   beam.pose(mouth,frame.attackTarget??forward,frame.state,frame.stateTime,frame.alive);}
 }
 return {group,body,ready,diagnostics:diagnostic,update,
  getMuzzlePosition(target){if(!gun||diagnostic.status!=='ready')return false;gun.muzzle.getWorldPosition(target);return true;},
  getMouthPosition(target){if(!rig)return false;rig.mouth(target);return true;},
  reset(){gunAim=0;rig?.reset();if(beam){beam.active=false;beam.visible=false;}},
  dispose(){if(disposed)return;disposed=true;diagnostic.status='disposed';model?.removeFromParent();skeleton?.dispose();gun?.dispose();beam?.dispose();lease.release();group.removeFromParent();},
 };
}
