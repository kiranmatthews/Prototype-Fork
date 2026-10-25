import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {clone as cloneSkeleton} from 'three/examples/jsm/utils/SkeletonUtils.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {AssetCache,disposeTextures} from '../assetLifetime';
import {sceneryLoads} from '../assetLoadQueue';
import {sampleEnemyElasticity,enemyElasticPulse,type EnemyElasticityProfile} from './elasticity';
import type {EnemyAnimationFrame,EnemyKind,EnemyVisual,EnemyVisualDiagnostics} from './types';
import type {KookRole} from './kookBehavior';

export const KOOK_ELASTICITY:EnemyElasticityProfile={idle:.65,walk:1,anticipation:1.5,rebound:1.3,landing:1,defeat:1.4};
type Asset={scene:THREE.Group;clips:THREE.AnimationClip[]};
const base=import.meta.env.BASE_URL+'rooftop-kook/';
const textures=(m:THREE.Material)=>Object.values(m).filter((v):v is THREE.Texture=>!!v?.isTexture);
const cache=new AssetCache<string,Asset>(async(name,_dependency,wanted)=>{
 const [gltf,json]=await Promise.all([
  sceneryLoads.run(()=>new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(base+name+'.glb'),wanted),
  fetch(base+name+'-clips.json').then(r=>{if(!r.ok)throw Error('Kook animation load '+r.status);return r.json();}),
 ]);
 gltf.scene.traverse(o=>{const m=o as THREE.Mesh;if(!m.isMesh)return;m.geometry.userData.shared=true;
  for(const mat of Array.isArray(m.material)?m.material:[m.material]){mat.userData.shared=true;for(const t of textures(mat)){t.userData.shared=true;t.anisotropy=8;}}
 });
 return {scene:gltf.scene,clips:json.map((c:Parameters<typeof THREE.AnimationClip.parse>[0])=>THREE.AnimationClip.parse(c))};
},asset=>{
 const geos=new Set<THREE.BufferGeometry>(),mats=new Set<THREE.Material>(),maps=new Set<THREE.Texture>(),skeletons=new Set<THREE.Skeleton>();
 asset.scene.traverse(o=>{const m=o as THREE.SkinnedMesh;if(!m.isMesh)return;geos.add(m.geometry);if(m.isSkinnedMesh)skeletons.add(m.skeleton);for(const mat of Array.isArray(m.material)?m.material:[m.material])mats.add(mat);});
 for(const m of mats){for(const t of textures(m))maps.add(t);m.dispose();}for(const g of geos)g.dispose();for(const s of skeletons)s.dispose();disposeTextures(maps);
});

/** Scale an individual spine segment, cancelling before each rotated child.
 * Feet are below these joints and remain planted; head/arms keep their size. */
function stretch(node:THREE.Object3D,ratio:number):void {
 const cross=1/Math.sqrt(ratio),scale=new THREE.Vector3(cross,ratio,cross);
 node.updateMatrix();node.matrix.scale(scale);node.matrixAutoUpdate=false;
 const inverse=new THREE.Matrix4().makeScale(1/cross,1/ratio,1/cross);
 for(const child of node.children){child.updateMatrix();child.matrix.premultiply(inverse).setPosition(child.position);child.matrixAutoUpdate=false;}
}
const Y=new THREE.Vector3(0,1,0);
/** Two-bone arm fit in world space. The stock and fore-end are fixed contacts. */
function arm(upper:THREE.Object3D,lower:THREE.Object3D,hand:THREE.Object3D,target:THREE.Vector3,pole:THREE.Vector3):number {
 upper.updateWorldMatrix(true,true);
 const a=upper.getWorldPosition(new THREE.Vector3()),b=lower.getWorldPosition(new THREE.Vector3()),c=hand.getWorldPosition(new THREE.Vector3());
 const l1=a.distanceTo(b),l2=b.distanceTo(c),axis=target.clone().sub(a),distance=THREE.MathUtils.clamp(axis.length(),Math.abs(l1-l2)+.0001,l1+l2-.0001);axis.normalize();
 const bend=pole.clone().sub(a).addScaledVector(axis,-pole.clone().sub(a).dot(axis)).normalize();
 const along=(l1*l1-l2*l2+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,l1*l1-along*along));
 const elbow=a.clone().addScaledVector(axis,along).addScaledVector(bend,height);
 const aim=(node:THREE.Object3D,from:THREE.Vector3,to:THREE.Vector3)=>{
  const current=node.getWorldQuaternion(new THREE.Quaternion());
  const q=new THREE.Quaternion().setFromUnitVectors(Y.clone().applyQuaternion(current),to.clone().sub(from).normalize()).multiply(current);
  const parent=node.parent!.getWorldQuaternion(new THREE.Quaternion()).invert();node.quaternion.copy(parent.multiply(q));node.updateWorldMatrix(false,true);
 };
 aim(upper,a,elbow);aim(lower,lower.getWorldPosition(new THREE.Vector3()),target);
 return hand.getWorldPosition(new THREE.Vector3()).distanceTo(target);
}

function makeGun(){
 const group=new THREE.Group(),muzzle=new THREE.Object3D(),right=new THREE.Object3D(),left=new THREE.Object3D(),meshes:THREE.Mesh[]=[];
 const metal=new THREE.MeshStandardMaterial({color:0x304247,metalness:.8,roughness:.24});
 const walnut=new THREE.MeshStandardMaterial({color:0x683b26,roughness:.43});
 const brass=new THREE.MeshStandardMaterial({color:0xcbb27b,metalness:.72,roughness:.32});
 const part=(geometry:THREE.BufferGeometry,material:THREE.Material,p:number[],rotation?:number[])=>{const m=new THREE.Mesh(geometry,material);m.position.fromArray(p);if(rotation)m.rotation.set(rotation[0],rotation[1],rotation[2]);m.castShadow=true;group.add(m);meshes.push(m);return m;};
 part(new THREE.CapsuleGeometry(.07,.52,8,16),walnut,[0,-.025,-.24],[Math.PI/2,0,0]);
 part(new THREE.BoxGeometry(.14,.18,.31),metal,[0,0,.16]);
 part(new THREE.CapsuleGeometry(.065,.28,8,16),walnut,[0,-.03,.42],[Math.PI/2,0,0]);
 for(const x of [-.047,.047]){part(new THREE.CylinderGeometry(.037,.041,.76,24),metal,[x,.05,.66],[Math.PI/2,0,0]);part(new THREE.TorusGeometry(.038,.012,8,24),brass,[x,.05,1.04]);}
 part(new THREE.TorusGeometry(.075,.014,8,24,Math.PI*1.65),brass,[0,-.105,.12],[0,Math.PI/2,.2]);
 muzzle.position.set(0,.05,1.07);right.position.set(0,.09,.05);left.position.set(.1,-.04,.36);group.add(muzzle,right,left);
 const flash=part(new THREE.SphereGeometry(.18,16,12),new THREE.MeshBasicMaterial({color:0xffe9ac,toneMapped:false}),[0,.05,1.08]);flash.scale.set(.6,.6,2);flash.visible=false;
 return {group,muzzle,right,left,flash,dispose(){for(const m of meshes)m.geometry.dispose();for(const m of new Set(meshes.map(m=>m.material as THREE.Material)))m.dispose();}};
}

export function createKookVisual(kind:EnemyKind,role:KookRole):EnemyVisual {
 const name=role==='lookout'?'karen':'kook',group=new THREE.Group(),body=new THREE.Group(),artwork=new THREE.Group();
 group.name=role==='lookout'?'Kook courtyard lookout':'Sleeping Kook gunner';group.userData.kookRole=role;group.add(body);body.add(artwork);
 const diagnostic:EnemyVisualDiagnostics={kind,status:'loading',url:base+name+'.glb',clips:[],activeClip:null,mappedNodes:{},skinnedMeshes:0,meshes:0,animationTime:0,gaitPhase:0,state:'idle'};
 const lease=cache.acquire(name),gun=role==='gunner'?makeGun():null;if(gun){body.add(gun.group);gun.group.visible=false;}
 let model:THREE.Group|null=null,mixer:THREE.AnimationMixer|null=null,disposed=false,defeatTime=0,gunAim=0,last:EnemyAnimationFrame={state:'watch',stateTime:0,time:0,speed:0,verticalVelocity:0,grounded:true,alive:true,flung:false};
 let actions=new Map<string,THREE.AnimationAction>();
 const samples=new Map<string,{node:THREE.Object3D;property:string;interpolant:THREE.Interpolant}[]>();
 const bones=new Map<string,THREE.Object3D>(),previous=new Map<string,{p:THREE.Vector3;q:THREE.Quaternion;s:THREE.Vector3}>(),skeletons=new Set<THREE.Skeleton>();
 const feet=new Map<string,{p:THREE.Vector3;q:THREE.Quaternion}>(),rest=new Map<string,THREE.Quaternion>();
 const ready=lease.promise.then(asset=>{
  if(disposed)return;model=cloneSkeleton(asset.scene) as THREE.Group;
  model.traverse(o=>{if((o as THREE.Bone).isBone){bones.set(o.name,o);rest.set(o.name,o.quaternion.clone());previous.set(o.name,{p:o.position.clone(),q:o.quaternion.clone(),s:o.scale.clone()});}
   const mesh=o as THREE.SkinnedMesh;if(!mesh.isMesh)return;diagnostic.meshes++;mesh.castShadow=mesh.receiveShadow=true;mesh.frustumCulled=false;if(mesh.isSkinnedMesh){diagnostic.skinnedMeshes++;skeletons.add(mesh.skeleton);}
  });
  // Measure the detached model in the actor's local frame. Asset loading can
  // finish after the actor is placed on a high, rotated roof; world bounds
  // here would subtract the entire roof height from the character artwork.
  model.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(model,true);artwork.position.y=-bounds.min.y;artwork.add(model);
  group.updateMatrixWorld(true);for(const side of ['Left','Right']){const foot=bones.get(side+'Foot');if(foot)feet.set(side,{p:body.worldToLocal(foot.getWorldPosition(new THREE.Vector3())),q:body.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(foot.getWorldQuaternion(new THREE.Quaternion()))});}
  mixer=new THREE.AnimationMixer(model);
  actions=new Map(asset.clips.map(c=>[c.name,mixer!.clipAction(c).play()]));diagnostic.clips=asset.clips.map(c=>c.name);diagnostic.mappedNodes={torso:'Spine01',head:'Head'};
  for(const c of asset.clips)samples.set(c.name,c.tracks.flatMap(track=>{
   const [name,property]=track.name.split('.'),node=bones.get(name);if(!node)return [];
   return [{node,property,interpolant:property==='quaternion'?new THREE.QuaternionLinearInterpolant(track.times,track.values,4):new THREE.LinearInterpolant(track.times,track.values,track.getValueSize())}];
  }));
  diagnostic.status='ready';group.userData.assetReady=true;if(gun)gun.group.visible=true;update(0,last);
 }).catch(error=>{if(!disposed){diagnostic.status='error';diagnostic.error=String(error);}});
 function update(dt:number,frame:EnemyAnimationFrame){
  last=frame;diagnostic.state=frame.state;if(!model||!mixer)return;
  defeatTime=frame.alive?0:defeatTime+dt;
  for(const b of bones.values()){b.matrixAutoUpdate=true;b.scale.set(1,1,1);}
  let clip='idle',t=frame.time;
  if(role==='lookout'){
   if(frame.state==='windup'){clip='shout';t=frame.stateTime*1.3;}
   if(frame.state==='shriek'){clip='shout';t=1+frame.stateTime*1.6;}
   if(frame.state==='recover'){clip='angry';t=frame.stateTime;}
  }
  const selected=actions.get(clip)!;for(const [n,a]of actions){a.enabled=true;a.setEffectiveWeight(n===clip?1:0);}
  selected.time=t%selected.getClip().duration;
  for(const sample of samples.get(clip)??[]){const value=sample.interpolant.evaluate(selected.time);
   if(sample.property==='quaternion')sample.node.quaternion.fromArray(value);else if(sample.property==='position')sample.node.position.fromArray(value);else sample.node.scale.fromArray(value);}
  diagnostic.activeClip=clip;diagnostic.animationTime=selected.time;
  if(role==='gunner'&&['aim','fire','reload','track'].includes(frame.state))for(const name of ['Hips','Spine','Spine01','Spine02','neck','Head'])bones.get(name)?.quaternion.copy(rest.get(name)!);
  // Imported gestures retain their authored deformation. Blend joint poses
  // across FSM boundaries, without scaling the character's gameplay root.
  const blend=dt>0?1-Math.exp(-dt*14):1;
  for(const [n,b]of bones){const old=previous.get(n)!,desired=b.quaternion.clone();b.position.lerpVectors(old.p,b.position,blend);b.quaternion.copy(old.q).slerp(desired,blend);old.p.copy(b.position);old.q.copy(b.quaternion);old.s.copy(b.scale);}
  const elastic=sampleEnemyElasticity(kind,frame,0,{hindLeft:true,hindRight:true},defeatTime,KOOK_ELASTICITY);
  const anticipation=frame.state==='windup'?-Math.min(1,frame.stateTime/.76)*.035:frame.state==='shriek'?enemyElasticPulse(frame.stateTime,1.35)*.06:0;
  const spine=bones.get('Spine01');if(spine)stretch(spine,elastic.torso+anticipation);
  group.updateMatrixWorld(true);const footErrors=[];
  for(const [side,plant]of feet){const upper=bones.get(side+'UpLeg'),lower=bones.get(side+'Leg'),foot=bones.get(side+'Foot');if(!upper||!lower||!foot)continue;
   footErrors.push(arm(upper,lower,foot,body.localToWorld(plant.p.clone()),body.localToWorld(new THREE.Vector3(side==='Left'?.3:-.3,.6,.85))));
   const world=body.getWorldQuaternion(new THREE.Quaternion()).multiply(plant.q);foot.quaternion.copy(foot.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world));
  }
  group.userData.kookFootErrors=footErrors;
  if(gun){
   const aimed=['aim','fire','reload','track'].includes(frame.state),recoil=frame.state==='fire'?Math.sin(Math.min(1,frame.stateTime/.18)*Math.PI)*.12:0;
   gunAim=THREE.MathUtils.damp(gunAim,aimed?1:0,10,dt);
   gun.group.position.set(-.08-.10*gunAim,1.52+.14*gunAim,-.1+.15*gunAim);gun.group.rotation.set(.25*(1-gunAim),0,0);gun.group.position.z-=recoil;gun.flash.visible=frame.state==='fire'&&frame.stateTime<.07;
   const head=bones.get('Head');if(head&&frame.state==='doze')head.rotateX(.13+.055*Math.sin(frame.time*1.9));
   group.updateMatrixWorld(true);const errors=[];
   for(const [side,contact,x]of [['Right',gun.right,-1],['Left',gun.left,1]] as const){
    const upper=bones.get(side+'Arm'),lower=bones.get(side+'ForeArm'),hand=bones.get(side+'Hand');
    if(upper&&lower&&hand){errors.push(arm(upper,lower,hand,contact.getWorldPosition(new THREE.Vector3()),body.localToWorld(new THREE.Vector3(x*.9,1.1,.15))));
     const grip=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0,0,side==='Right'?1:-1),new THREE.Vector3(side==='Right'?0:-1,side==='Right'?-1:0,0),new THREE.Vector3(side==='Right'?1:0,side==='Right'?0:1,0)));
     const world=gun.group.getWorldQuaternion(new THREE.Quaternion()).multiply(grip);hand.quaternion.copy(hand.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world));
    }
   }
   group.userData.kookHandErrors=errors;
  }
  group.updateMatrixWorld(true);diagnostic.plantedFeet={hindLeft:true,hindRight:true};
 }
 return {group,body,ready,diagnostics:diagnostic,update,
  getMuzzlePosition(target){if(!gun||diagnostic.status!=='ready')return false;gun.muzzle.getWorldPosition(target);return true;},
  getMouthPosition(target){const head=bones.get('Head');if(!head)return false;head.getWorldPosition(target);return true;},
  reset(){defeatTime=gunAim=0;for(const a of actions.values())a.reset().play();},
  dispose(){if(disposed)return;disposed=true;diagnostic.status='disposed';mixer?.stopAllAction();if(model)mixer?.uncacheRoot(model);model?.removeFromParent();for(const s of skeletons)s.dispose();gun?.dispose();lease.release();group.removeFromParent();},
 };
}
