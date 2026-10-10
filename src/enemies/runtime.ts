import * as THREE from 'three';
import { createMoaVisual } from './moa';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { AssetCache, disposeTextures } from '../assetLifetime';
import { sceneryLoads } from '../assetLoadQueue';
import { sampleEnemyElasticity, enemyElasticPulse, NIGHTWORKS_GOBLIN_ELASTICITY_PROFILE } from './elasticity';
import {ENEMY_MOTION,enemyWalkRate,enemyGlance,ease,createEnemyPoseBlend} from './motion';
import { ENEMY_LEGS, type EnemyAnimationFrame, type EnemyKind, type EnemyLeg,
  type EnemyNodeBinding, type EnemyNodeMap, type EnemyNodeRole, type EnemyVisual,
  type EnemyVisualDiagnostics, type EnemyVisualOptions } from './types';
export type { EnemyKind, EnemyVisual, EnemyAnimationFrame, EnemyVisualOptions } from './types';

const DEFAULT_NAMES:Record<EnemyNodeRole,readonly string[]> = {
  torso:['torso','chest','body','Spine','Spine1','Chest'],
  head:['head','Head'],jaw:['jaw','Jaw'],tail:['tail','Tail','Tail1'],
  pincerUpperLeft:['pincerUpperLeft'],pincerUpperRight:['pincerUpperRight'],
  pincerLowerLeft:['pincerLowerLeft'],pincerLowerRight:['pincerLowerRight'],
  pincerLeft:['pincerLeft'],pincerRight:['pincerRight'],
  base:['base','Base'],rotor:['rotor','Rotor'],charge:['charge','eye','Eye'],
  barrel:['barrel','Barrel'],blade0:['blade0','blade_0'],blade1:['blade1','blade_1'],
  blade2:['blade2','blade_2'],blade3:['blade3','blade_3'],
  frontUpperLeft:['frontUpperLeft','FrontUpperLeft','LeftFrontUpperLeg','LFUpper'],
  frontUpperRight:['frontUpperRight','FrontUpperRight','RightFrontUpperLeg','RFUpper'],
  frontLowerLeft:['frontLowerLeft','FrontLowerLeft','LeftFrontLowerLeg','LFLower'],
  frontLowerRight:['frontLowerRight','FrontLowerRight','RightFrontLowerLeg','RFLower'],
  frontFootLeft:['frontFootLeft','FrontFootLeft','LeftFrontFoot','LFFoot'],
  frontFootRight:['frontFootRight','FrontFootRight','RightFrontFoot','RFFoot'],
  hindUpperLeft:['hindUpperLeft','HindUpperLeft','LeftHindUpperLeg','LHUpper'],
  hindUpperRight:['hindUpperRight','HindUpperRight','RightHindUpperLeg','RHUpper'],
  hindLowerLeft:['hindLowerLeft','HindLowerLeft','LeftHindLowerLeg','LHLower'],
  hindLowerRight:['hindLowerRight','HindLowerRight','RightHindLowerLeg','RHLower'],
  hindFootLeft:['hindFootLeft','HindFootLeft','LeftHindFoot','LHFoot'],
  hindFootRight:['hindFootRight','HindFootRight','RightHindFoot','RHFoot'],
  motionRoot:['motionRoot','enemyRoot','Root','root','RootNode','Armature'],
};
const AXES={x:new THREE.Vector3(1,0,0),y:new THREE.Vector3(0,1,0),z:new THREE.Vector3(0,0,1)};
type NodePose={node:THREE.Object3D;position:THREE.Vector3;quaternion:THREE.Quaternion;scale:THREE.Vector3;matrix:THREE.Matrix4;matrixAutoUpdate:boolean};
type BoundNode={node:THREE.Object3D;lengthAxis:'x'|'y'|'z';rotationAxis:'x'|'y'|'z';rotationSign:number};
type BoundNodes=Partial<Record<EnemyNodeRole,BoundNode>>;
type EnemyAsset={scene:THREE.Group;animations:THREE.AnimationClip[]};
type AssetMetadata=EnemyVisualOptions;

function assetMetadata(model:THREE.Object3D):AssetMetadata {
  let result:AssetMetadata={};
  model.traverse(node=>{
    const value=node.userData.enemyRig as AssetMetadata|undefined;
    if(value&&typeof value==='object')result={...result,...value,mapping:{...result.mapping,...value.mapping}};
  });
  return result;
}

function textures(material:THREE.Material):THREE.Texture[] {
  return Object.values(material).filter((value):value is THREE.Texture=>!!value?.isTexture);
}
function markShared(scene:THREE.Object3D):void {
  scene.traverse(object=>{
    const mesh=object as THREE.Mesh;if(!mesh.isMesh)return;
    mesh.geometry.userData.shared=true;
    for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
      material.userData.shared=true;
      // Async imports arrive after Level.stripFog() and must apply it here.
      (material as THREE.Material & {fog?:boolean}).fog=false;
      for(const texture of textures(material)){texture.userData.shared=true;texture.anisotropy=4;}
    }
  });
}
function disposeAsset(asset:EnemyAsset):void {
  const geometry=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
  const images=new Set<THREE.Texture>(),skeletons=new Set<THREE.Skeleton>();
  asset.scene.traverse(object=>{
    const mesh=object as THREE.SkinnedMesh;if(!mesh.isMesh)return;
    geometry.add(mesh.geometry);
    if(mesh.isSkinnedMesh)skeletons.add(mesh.skeleton);
    for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])materials.add(material);
  });
  for(const material of materials){for(const texture of textures(material))images.add(texture);material.dispose();}
  for(const value of geometry)value.dispose();
  for(const skeleton of skeletons)skeleton.dispose();
  disposeTextures(images);
}
const assets=new AssetCache<string,EnemyAsset>(async (url,_dependency,wanted)=>{
  const gltf:GLTF=await sceneryLoads.run(()=>new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url),wanted);
  markShared(gltf.scene);
  return {scene:gltf.scene,animations:gltf.animations};
},disposeAsset);

function resolveNodes(model:THREE.Object3D,mapping:EnemyNodeMap):BoundNodes {
  const result:BoundNodes={};
  for(const role of Object.keys(DEFAULT_NAMES) as EnemyNodeRole[]){
    const override=mapping[role];
    const binding:EnemyNodeBinding=typeof override==='string'?{name:override}:override??{name:DEFAULT_NAMES[role]};
    const names=typeof binding.name==='string'?[binding.name]:binding.name;
    const node=names.map(name=>model.getObjectByName(name)).find(Boolean);
    if(node)result[role]={node,lengthAxis:binding.lengthAxis??'y',
      rotationAxis:binding.rotationAxis??'x',rotationSign:binding.rotationSign??1};
  }
  return result;
}
function capturePose(root:THREE.Object3D):NodePose[] {
  const result:NodePose[]=[];
  root.traverse(node=>result.push({node,position:node.position.clone(),quaternion:node.quaternion.clone(),scale:node.scale.clone(),
    matrix:node.matrix.clone(),matrixAutoUpdate:node.matrixAutoUpdate}));
  return result;
}
/** Measure the exported barrel in its own coordinates, independently of the
 * actor's current world yaw. Models are authored with the muzzle toward +Z. */
function barrelTip(barrel:THREE.Object3D):THREE.Vector3|null {
  barrel.updateWorldMatrix(true,true);
  const inverse=new THREE.Matrix4().copy(barrel.matrixWorld).invert(),matrix=new THREE.Matrix4();
  const box=new THREE.Box3(),point=new THREE.Vector3();
  barrel.traverse(object=>{
    const mesh=object as THREE.SkinnedMesh;if(!mesh.isMesh)return;
    if(mesh.isSkinnedMesh)mesh.skeleton.update();
    matrix.multiplyMatrices(inverse,mesh.matrixWorld);
    for(let i=0;i<mesh.geometry.attributes.position.count;i++){
      mesh.getVertexPosition(i,point).applyMatrix4(matrix);box.expandByPoint(point);
    }
  });
  if(box.isEmpty())return null;
  const tip=box.getCenter(new THREE.Vector3());tip.z=box.max.z;return tip;
}
function restorePose(poses:readonly NodePose[]):void {
  for(const pose of poses){pose.node.position.copy(pose.position);pose.node.quaternion.copy(pose.quaternion);pose.node.scale.copy(pose.scale);
    pose.node.matrixAutoUpdate=pose.matrixAutoUpdate;pose.node.matrix.copy(pose.matrix);pose.node.matrixWorldNeedsUpdate=true;}
}
function rememberPose(poses:readonly NodePose[]):void {
  for(const pose of poses){pose.position.copy(pose.node.position);pose.quaternion.copy(pose.node.quaternion);pose.scale.copy(pose.node.scale);
    pose.matrix.copy(pose.node.matrix);pose.matrixAutoUpdate=pose.node.matrixAutoUpdate;}
}
function legRoles(leg:EnemyLeg):[EnemyNodeRole,EnemyNodeRole,EnemyNodeRole] {
  const front=leg.startsWith('front')?'front':'hind',side=leg.endsWith('Left')?'Left':'Right';
  return [`${front}Upper${side}`,`${front}Lower${side}`,`${front}Foot${side}`] as [EnemyNodeRole,EnemyNodeRole,EnemyNodeRole];
}
function rotate(part:BoundNode|undefined,angle:number,axis?:'x'|'y'|'z'):void {
  if(part)part.node.rotateOnAxis(AXES[axis??part.rotationAxis],angle*part.rotationSign);
}
/** Stretch one segment and cancel its inherited scale at each child joint.
 * Child translations retain the changed segment length; descendant segments
 * keep their own dimensions and can receive their independent ratio below. */
function segment(part:BoundNode|undefined,ratio:number):void {
  if(!part||Math.abs(ratio-1)<1e-7)return;
  const stretch=THREE.MathUtils.clamp(ratio,.6,1.5),cross=1/Math.sqrt(stretch);
  const scale=new THREE.Vector3(cross,cross,cross);scale[part.lengthAxis]=stretch;
  part.node.scale.multiply(scale);
  for(const child of part.node.children)child.scale.divide(scale);
}
/** Preserve the fitted model root and remove horizontal travel from imported
 * motion roots. Vertical gait motion and all articulated joint keys survive. */
function inPlaceClip(clip:THREE.AnimationClip,model:THREE.Object3D,nodes:BoundNodes):THREE.AnimationClip {
  const rootNames=new Set([model.name,model.uuid]);
  const motion=nodes.motionRoot?.node;
  if(motion){rootNames.add(motion.name);rootNames.add(motion.uuid);}
  const tracks:THREE.KeyframeTrack[]=[];
  for(const source of clip.tracks){
    const parsed=THREE.PropertyBinding.parseTrackName(source.name);
    if(!rootNames.has(parsed.nodeName??'')){tracks.push(source);continue;}
    if(parsed.propertyName==='scale'||parsed.propertyName==='quaternion')continue;
    if(parsed.propertyName==='position'&&source.getValueSize()===3){
      const track=source.clone();
      for(let i=0;i<track.values.length;i+=3){track.values[i]=track.values[0];track.values[i+2]=track.values[2];}
      tracks.push(track);
    }else tracks.push(source);
  }
  return new THREE.AnimationClip(clip.name,clip.duration,tracks,clip.blendMode);
}

/** Imported models retain observable loading failures. The original moa has
 * its own explicit code-authored model and animation adapter. */
export function createEnemyVisual(kind:EnemyKind,options:EnemyVisualOptions={}):EnemyVisual {
  if(kind==='moa')return createMoaVisual(options.url);
  const motionKind=kind;
  const startState=kind==='hopper'?'crouch':kind==='floater'?'hover':kind==='sentry'?'track':kind==='spinner'?'out':'patrol';
  const group=new THREE.Group();group.name=`Enemy_${kind}`;
  // Static artwork sizing stays outside animation bindings and gameplay resets.
  const artwork=new THREE.Group();artwork.name=`Enemy_${kind}_Artwork`;artwork.scale.setScalar(2);group.add(artwork);
  const body=new THREE.Group();body.name=`Enemy_${kind}_Aim`;artwork.add(body);
  const modelMount=new THREE.Group();modelMount.name=`Enemy_${kind}_ModelMount`;body.add(modelMount);
  const url=options.url??`${import.meta.env.BASE_URL}enemies/${options.appearance==='nightworks'?'nightworks-snot-goblin':kind}.glb`;
  const diagnostic:EnemyVisualDiagnostics={kind,status:'loading',url,appearance:options.appearance,clips:[],activeClip:null,
    mappedNodes:{},skinnedMeshes:0,meshes:0,animationTime:0,gaitPhase:0,state:startState};
  group.userData.enemyVisual=diagnostic;
  let disposed=false,model:THREE.Group|null=null,mixer:THREE.AnimationMixer|null=null;
  let muzzle:THREE.Vector3|null=null;
  let nodes:BoundNodes={},poses:NodePose[]=[],animationPoses:NodePose[]=[],walk:THREE.AnimationAction|null=null;
  let idle:THREE.AnimationAction|null=null,currentAction:THREE.AnimationAction|null=null;
  const fadingActions=new Map<THREE.AnimationAction,number>();
  let walkContacts=options.walkContacts;
  let walkSpeed=options.walkSpeed??2.4,phase=0,deathTime=0,wasAlive=true,rotorAngle=0,bladeAngle=0;
  let rotorSpeed=0,alert=0;
  let poseBlend:ReturnType<typeof createEnemyPoseBlend>|undefined;
  let lastFrame:EnemyAnimationFrame={state:startState,stateTime:0,time:0,speed:0,verticalVelocity:0,grounded:kind!=='floater',alive:true,flung:false};
  const instanceMaterials=new Set<THREE.Material>(),instanceSkeletons=new Set<THREE.Skeleton>();
  const materialRest=new Map<THREE.Material,{emissive:THREE.Color;intensity:number}>();
  const footTargets=new Map<EnemyLeg,{position:THREE.Vector3;matrix:THREE.Matrix4}>();
  const delta=new THREE.Vector3(),position=new THREE.Vector3(),rotation=new THREE.Quaternion();
  const inverse=new THREE.Matrix4();
  const lease=assets.acquire(url);

  function install(asset:EnemyAsset):void {
    if(disposed)return;
    model=cloneSkeleton(asset.scene) as THREE.Group;
    // The drone straddles its origin: grow upward from its original lower edge
    // so the larger ring retains ground clearance at the bottom of a swoop.
    if(kind==='floater')artwork.position.y=-new THREE.Box3().setFromObject(model,true).min.y;
    const metadata=assetMetadata(model);
    walkSpeed=options.walkSpeed??metadata.walkSpeed??2.4;
    walkContacts=options.walkContacts??metadata.walkContacts;
    nodes=resolveNodes(model,{...metadata.mapping,...options.mapping});
    poseBlend=createEnemyPoseBlend(Object.values(nodes).map(part=>part.node));
    // A fixed sentry base must not follow the gameplay-owned aiming pivot.
    const base=kind==='sentry'?nodes.base?.node:null;
    if(base){model.updateMatrixWorld(true);base.matrixWorld.decompose(position,rotation,delta);
      base.removeFromParent();base.position.copy(position);base.quaternion.copy(rotation);base.scale.copy(delta);artwork.add(base);}
    if(kind==='sentry'){
      // Generated housings need not be centred at X/Z zero. Turn around the
      // authored bearing while the inverse mount preserves the exact rest pose.
      // Keep that correction outside the imported model's animation bindings.
      model.updateMatrixWorld(true);
      const bearing=nodes.torso?.node??nodes.head?.node;
      if(bearing){bearing.getWorldPosition(position);body.position.set(position.x,0,position.z);
        modelMount.position.set(-position.x,0,-position.z);}
    }
    modelMount.add(model);
    muzzle=nodes.barrel?barrelTip(nodes.barrel.node):null;
    const materialCopies=new Map<THREE.Material,THREE.Material>();
    group.traverse(object=>{
      const mesh=object as THREE.SkinnedMesh;if(!mesh.isMesh)return;
      diagnostic.meshes++;mesh.castShadow=true;mesh.receiveShadow=true;
      // Rest-pose bounds of imported skins otherwise cull raised feet/head.
      if(mesh.isSkinnedMesh){diagnostic.skinnedMeshes++;instanceSkeletons.add(mesh.skeleton);mesh.frustumCulled=false;}
      const copy=(source:THREE.Material):THREE.Material=>{
        let result=materialCopies.get(source);if(result)return result;
        result=source.clone();result.userData.shared=false;(result as THREE.Material & {fog?:boolean}).fog=false;
        materialCopies.set(source,result);instanceMaterials.add(result);
        const emissive=result as THREE.MeshStandardMaterial;
        if(emissive.emissive)materialRest.set(result,{emissive:emissive.emissive.clone(),intensity:emissive.emissiveIntensity??1});
        return result;
      };
      mesh.material=Array.isArray(mesh.material)?mesh.material.map(copy):copy(mesh.material);
    });
    poses=[...capturePose(model),...(base?capturePose(base):[])];
    animationPoses=[...capturePose(model),...(base?capturePose(base):[])];
    diagnostic.mappedNodes=Object.fromEntries(Object.entries(nodes).map(([role,binding])=>[role,binding.node.name]));
    const clips=asset.animations.map(clip=>inPlaceClip(clip,model!,nodes));
    diagnostic.clips=clips.map(clip=>clip.name);
    if(clips.length){
      mixer=new THREE.AnimationMixer(model);
      const wanted=options.walkClip??metadata.walkClip;
      const walkClip=(wanted?clips.find(clip=>clip.name===wanted):undefined)??
        clips.find(clip=>/walk|trot|run/i.test(clip.name))??(clips.length===1?clips[0]:undefined);
      const idleClip=clips.find(clip=>/idle|breath/i.test(clip.name)&&clip!==walkClip);
      if(walkClip)walk=mixer.clipAction(walkClip);
      if(idleClip)idle=mixer.clipAction(idleClip);
    }
    diagnostic.status='ready';group.userData.assetReady=true;
    update(0,lastFrame);
  }
  function contacts(frame:EnemyAnimationFrame):Partial<Record<EnemyLeg,boolean>> {
    const result:Partial<Record<EnemyLeg,boolean>>={};
    for(const leg of ENEMY_LEGS){
      // Goblins are bipedal: arm bindings receive deformation, never foot pins.
      if(options.appearance==='nightworks'&&leg.startsWith('front')){result[leg]=false;continue;}
      const diagonal=leg==='frontLeft'||leg==='hindRight';
      const intervals=currentAction===walk&&walk?walkContacts?.[leg]:undefined;
      const contact=intervals?intervals.some(([start,end])=>start<=end
        ?phase>=start&&phase<=end:phase>=start||phase<=end)
        :Math.sin(Math.PI*2*(phase+(diagonal?0:.5)))>=0;
      result[leg]=frame.plantedFeet?.[leg]??(frame.grounded&&frame.alive&&
        (frame.speed<.05||contact));
    }
    return result;
  }
  function rememberFeet(planted:Partial<Record<EnemyLeg,boolean>>):void {
    footTargets.clear();group.updateMatrixWorld(true);
    for(const leg of ENEMY_LEGS){
      const [upper,,foot]=legRoles(leg),node=nodes[foot]?.node;
      if(planted[leg]&&node&&nodes[upper])footTargets.set(leg,{
        position:node.getWorldPosition(new THREE.Vector3()),matrix:node.matrixWorld.clone(),
      });
    }
  }
  function plantFeet():void {
    // Correct only the articulated shoulder/hip origin, never the gameplay root.
    for(const [leg,target] of footTargets){
      const [upper,,foot]=legRoles(leg),origin=nodes[upper]!.node,end=nodes[foot]!.node;
      if(!origin.parent)continue;
      group.updateMatrixWorld(true);end.getWorldPosition(position);
      inverse.copy(origin.parent.matrixWorld).invert();
      delta.copy(target.position).applyMatrix4(inverse).sub(position.applyMatrix4(inverse));
      origin.position.add(delta);
      // A nonuniformly stretched parent can shear a rotated ankle. Quaternion
      // compensation alone cannot hold the sole flat. Preserve the complete
      // authored contact matrix for this frame; restorePose returns the joint
      // to its normal animation-owned TRS before the next sample.
      if(end.parent){
        end.parent.updateWorldMatrix(true,false);
        end.matrix.copy(end.parent.matrixWorld).invert().multiply(target.matrix);
        end.matrix.decompose(end.position,end.quaternion,end.scale);
        end.matrixAutoUpdate=false;end.matrixWorldNeedsUpdate=true;
      }
    }
  }
  function customGait(frame:EnemyAnimationFrame):void {
    if(walk||frame.speed<=.05||!frame.grounded||!frame.alive)return;
    for(const leg of ENEMY_LEGS){
      const [upper,lower]=legRoles(leg),diagonal=leg==='frontLeft'||leg==='hindRight';
      const theta=Math.PI*2*(phase+(diagonal?0:.5));
      rotate(nodes[upper],-Math.cos(theta)*.38);
      rotate(nodes[lower],Math.max(0,-Math.sin(theta))*.65);
    }
  }
  function glow(amount:number):void {
    const target=nodes.charge?.node;if(!target)return;
    target.traverse(object=>{
      const mesh=object as THREE.Mesh;if(!mesh.isMesh)return;
      for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
        const rest=materialRest.get(material),emissive=material as THREE.MeshStandardMaterial;
        if(rest){emissive.emissive.copy(rest.emissive).lerp(new THREE.Color(0xffa23a),amount*.6);emissive.emissiveIntensity=rest.intensity+amount*1.8;}
      }
    });
  }
  function customPose(frame:EnemyAnimationFrame,dt:number):void {
    const t=frame.stateTime;
    if(!frame.alive){
      const pulse=enemyElasticPulse(deathTime,frame.flung?.45:.12);
      rotate(nodes.head,-pulse*.22);rotate(nodes.jaw,-pulse*.12);
      for(const leg of ENEMY_LEGS){const [upper,lower]=legRoles(leg);rotate(nodes[upper],pulse*.25);rotate(nodes[lower],-pulse*.4);}
      return;
    }
    const profile=ENEMY_MOTION[motionKind],moving=frame.speed>.05&&frame.grounded;
    const breath=Math.sin(frame.time*profile.breathHz*Math.PI*2),gait=Math.sin(phase*Math.PI*2);
    const organic=kind!=='sentry'&&kind!=='spinner'&&kind!=='floater';
    if(organic){
      rotate(nodes.head,breath*.018*(moving?.4:1),'z');
      rotate(nodes.head,enemyGlance(frame.time)*profile.head*(moving?.35:1),'y');
      rotate(nodes.tail,(Math.sin(frame.time*1.45)*.55+gait*(moving?.45:0))*profile.tail,'y');
    }
    if(options.appearance==='nightworks'){
      // The same patrol/crouch states use a bipedal rig: keep arms loose and
      // let the shoulders lead the heavier footfalls.
      rotate(nodes.head,breath*.025);
      for(const side of ['Left','Right'] as const){const sign=side==='Left'?1:-1;
        rotate(nodes[`frontUpper${side}`],-sign*.035*(moving?gait:breath),'z');
        rotate(nodes[`frontLower${side}`],-.045*(1+breath));
      }
    }
    if(kind==='grunt'){
      rotate(nodes.torso,(moving?gait*.018:0),'z');
      for(const side of ['Left','Right'] as const){const sign=side==='Left'?1:-1;
        const gesture=Math.sin(frame.time*1.35+sign*.85)*.5+.5;
        rotate(nodes[`pincerUpper${side}`],-.12*gesture-alert*.22);
        rotate(nodes[`pincerUpper${side}`],sign*(.025+alert*.10),'z');
        rotate(nodes[`pincerLower${side}`],.09*gesture+alert*.18);
        rotate(nodes[`pincer${side}`],sign*(.055*gesture+alert*.09),'y');
      }
    }else if(kind==='spiker'){
      rotate(nodes.head,alert*.10+breath*.018);
      rotate(nodes.torso,alert*.035);
      rotate(nodes.tail,alert*Math.sin(frame.time*5)*.05,'z');
    }else if(kind==='turtle'){
      if(nodes.head)nodes.head.node.position.z+=breath*.012-alert*.065;
      rotate(nodes.head,-breath*.025+alert*.08);
      rotate(nodes.torso,moving?gait*.016:0,'z');
    }else if(kind==='charger'){
      if(frame.state==='telegraph'){
        const gather=ease(t/.48);
        rotate(nodes.torso,-.14*gather);rotate(nodes.head,-.28*gather);
        rotate(nodes.jaw,(.035+Math.sin(t*11)*.02)*gather);
        rotate(nodes.tail,-.14*gather,'z');
        for(const leg of ['frontLeft','frontRight'] as const){const [upper,lower]=legRoles(leg);rotate(nodes[upper],-.18*gather);rotate(nodes[lower],.22*gather);}
      }else if(frame.state==='dash'){
        rotate(nodes.head,.26);rotate(nodes.torso,.08);rotate(nodes.tail,-.15,'x');
      }
      else if(frame.state==='recover'){
        const settle=1-ease(t/1.1);rotate(nodes.head,Math.sin(t*11)*.24*settle,'z');
        rotate(nodes.head,.16*settle);rotate(nodes.jaw,.07*settle);
        rotate(nodes.torso,Math.sin(t*9)*.045*settle,'z');
      }
    }else if(kind==='hopper'){
      const crouching=frame.state==='crouch';
      const leaping=frame.state==='leap';
      const gather=crouching?ease(t/.45):0;
      const extension=leaping?Math.sin(Math.PI*Math.min(1,t/.30)):0;
      const tuck=leaping?ease((t-.13)/.16)*(1-ease((t-.41)/.24)):0;
      const reach=leaping?ease((t-.44)/.14)*(1-ease((t-.60)/.10)):0;
      for(const leg of ENEMY_LEGS){const [upper,lower]=legRoles(leg),hind=leg.startsWith('hind');
        rotate(nodes[upper],(hind?.34:.13)*gather-(hind?.30:.12)*extension+(hind?.22:.08)*tuck-.05*reach);
        rotate(nodes[lower],(hind?-.65:-.2)*gather+(hind?.4:.12)*extension-(hind?.38:.12)*tuck+.07*reach);
      }
      rotate(nodes.head,crouching?-.08*gather:THREE.MathUtils.clamp(-frame.verticalVelocity*.014,-.13,.18));
    }else if(kind==='floater'){
      rotorSpeed+=((frame.state==='swoop'?14:8)-rotorSpeed)*(1-Math.exp(-dt*8));
      rotorAngle=(rotorAngle+dt*rotorSpeed)%(Math.PI*2);
      rotate(nodes.rotor,rotorAngle,'y');
      rotate(nodes.torso,Math.sin(frame.time*1.6)*.045,'z');
      if(frame.state==='swoop'){
        const dive=Math.sin(Math.PI*Math.min(1,t/.8));
        rotate(nodes.torso,dive*.10);rotate(nodes.head,dive*.18);
      }else rotate(nodes.head,enemyGlance(frame.time)*.08,'y');
    }else if(kind==='sentry'){
      const charge=frame.state==='charge'?ease(t/.55):0;
      glow(charge);
      if(nodes.charge)nodes.charge.node.scale.multiplyScalar(1+charge*.10);
      if(nodes.barrel){
        const recoil=frame.state==='fire'?(t<.025?ease(t/.025):1-.72*ease((t-.025)/.125))
          :frame.state==='cooldown'?.28*(1-ease(t/.22)):0;
        // The first fire pose shares the fully charged muzzle position: the
        // projectile is emitted before this tick's recoil starts.
        const extension=frame.state==='fire'?1-ease(t/.025):charge;
        nodes.barrel.node.position.z+=extension*.018-recoil*.12;
        rotate(nodes.head,-recoil*.055);
        rotate(nodes.barrel,charge*(1-charge)*Math.sin(t*38)*.006);
      }
    }else if(kind==='spinner'){
      const active=frame.state==='out';
      rotorSpeed=active?3+6*ease(t/.28):9*(1-ease(t/.24));
      bladeAngle=(bladeAngle+dt*rotorSpeed)%(Math.PI*2);
      const extension=active?.2+.8*ease(t/.24):1-.8*ease(t/.22);
      rotate(nodes.rotor??nodes.torso,bladeAngle,'y');
      for(const role of ['blade0','blade1','blade2','blade3'] as const){
        const blade=nodes[role];if(!blade)continue;
        const rotor=(nodes.rotor??nodes.torso)?.node;
        let inheritsRotor=false;
        for(let parent=blade.node.parent;parent;parent=parent.parent)if(parent===rotor)inheritsRotor=true;
        if(!inheritsRotor){blade.node.position.applyAxisAngle(AXES.y,bladeAngle);rotate(blade,bladeAngle,'y');}
        blade.node.scale.x*=extension;
        blade.node.scale.z*=.35+.65*(extension-.2)/.8;
      }
    }
  }
  function update(dt:number,frame:EnemyAnimationFrame):void {
    lastFrame={...frame};if(disposed)return;
    const step=Number.isFinite(dt)?Math.max(0,dt):0;
    if(frame.alive){deathTime=0;}else{deathTime=wasAlive?0:deathTime+step;}wasAlive=frame.alive;
    diagnostic.state=frame.state;
    if(!model)return;
    // PropertyMixer deliberately skips unchanged key values. Restore its last
    // clean authored sample, not bind TRS, before updating; otherwise a dt=0
    // sample or constant track gets erased underneath an otherwise valid fade.
    restorePose(mixer&&frame.alive?animationPoses:poses);
    for(const [material,rest] of materialRest){const value=material as THREE.MeshStandardMaterial;value.emissive.copy(rest.emissive);value.emissiveIntensity=rest.intensity;}
    const walking=frame.alive&&frame.grounded&&frame.speed>.05&&kind!=='hopper'&&kind!=='sentry'&&kind!=='spinner'&&kind!=='floater';
    const next=frame.alive?(walking?walk:idle):null;
    if(!frame.alive){
      // Defeat owns a finite pose from this tick. Neither an active clip nor
      // an outgoing locomotion blend may keep moving the defeated skeleton.
      mixer?.stopAllAction();currentAction=null;fadingActions.clear();
    }else if(next!==currentAction){
      const previous=currentAction;currentAction=next;
      if(next){
        // A quick restart can reuse an action that was fading out. Its old
        // deadline must not stop the newly active walk a few frames later.
        fadingActions.delete(next);next.reset().setEffectiveWeight(1).play();
        if(previous)next.crossFadeFrom(previous,.12,false);
      }else previous?.fadeOut(.12);
      if(previous&&mixer)fadingActions.set(previous,mixer.time+.12);
    }
    // walkSpeed is measured in the GLB's metres, before the artwork is doubled.
    // Use final display size and a species cadence ceiling, including dash.
    if(walk)walk.timeScale=enemyWalkRate(motionKind,frame.speed,walkSpeed,walk.getClip().duration,
      artwork.scale.x,frame.state,options.appearance==='nightworks');
    mixer?.update(step);
    for(const [action,until] of fadingActions)if(mixer&&mixer.time>=until-1e-9){
      action.stop();fadingActions.delete(action);
    }
    if(mixer)rememberPose(animationPoses);
    const gaitHz=walking?(walk?walk.timeScale/Math.max(.001,walk.getClip().duration)
      :Math.min(ENEMY_MOTION[motionKind].walkHz,Math.abs(frame.speed)/1.2)):0;
    phase=frame.gaitPhase??(walking&&walk?walk.time/Math.max(.001,walk.getClip().duration):phase+step*gaitHz);
    phase=((phase%1)+1)%1;
    customGait(frame);
    const planted=contacts(frame);rememberFeet(planted);
    alert+=(THREE.MathUtils.clamp(frame.alert??0,0,1)-alert)*(1-Math.exp(-step*5));
    poseBlend?.begin(step,{...frame,kind});
    customPose(frame,step);
    poseBlend?.end();
    const elastic=sampleEnemyElasticity(kind,frame,phase,planted,deathTime,
      options.appearance==='nightworks'?NIGHTWORKS_GOBLIN_ELASTICITY_PROFILE:undefined);
    if(kind!=='sentry'&&kind!=='spinner')segment(nodes.torso,elastic.torso);
    for(const leg of ENEMY_LEGS){const [upper,lower]=legRoles(leg);segment(nodes[upper],elastic.legs[leg].upper);segment(nodes[lower],elastic.legs[leg].lower);}
    plantFeet();group.updateMatrixWorld(true);
    for(const skeleton of instanceSkeletons)skeleton.update();
    const visibleAction=currentAction??fadingActions.keys().next().value;
    diagnostic.activeClip=visibleAction?.getClip().name??null;
    diagnostic.animationTime=visibleAction?.time??0;diagnostic.gaitPhase=phase;
    diagnostic.gaitHz=gaitHz;diagnostic.playbackRate=walking&&walk?walk.timeScale:0;diagnostic.plantedFeet=planted;
  }
  const ready=lease.promise.then(install).catch(error=>{
    if(disposed)return;
    diagnostic.status='error';diagnostic.error=error instanceof Error?error.message:String(error);
    group.userData.assetError=true;
    // Runtime failures stay visible; the node validator's empty-URL 404 is expected.
    const responseUrl=(error as {response?:{url?:string}})?.response?.url;
    if(responseUrl!==''&&typeof window!=='undefined')console.warn(`Enemy ${kind} asset failed to load`,error);
  });
  return {group,body,ready,diagnostics:diagnostic,update,
    getMuzzlePosition(target){
      if(disposed||!muzzle||!nodes.barrel)return false;
      nodes.barrel.node.updateWorldMatrix(true,false);target.copy(muzzle).applyMatrix4(nodes.barrel.node.matrixWorld);return true;
    },
    reset(){
      if(disposed)return;
      mixer?.stopAllAction();currentAction=null;fadingActions.clear();restorePose(poses);rememberPose(animationPoses);
      for(const [material,rest] of materialRest){const value=material as THREE.MeshStandardMaterial;value.emissive.copy(rest.emissive);value.emissiveIntensity=rest.intensity;}
      body.rotation.set(0,0,0);phase=deathTime=rotorAngle=bladeAngle=rotorSpeed=alert=0;wasAlive=true;poseBlend?.reset();
      diagnostic.activeClip=null;diagnostic.animationTime=diagnostic.gaitPhase=0;
      diagnostic.gaitHz=diagnostic.playbackRate=0;diagnostic.plantedFeet=undefined;
      lastFrame={...lastFrame,state:startState,stateTime:0,time:0,speed:0,verticalVelocity:0,grounded:kind!=='floater',alive:true,flung:false};
      diagnostic.state=startState;
    },
    dispose(){
      if(disposed)return;disposed=true;diagnostic.status='disposed';
      mixer?.stopAllAction();fadingActions.clear();if(model)mixer?.uncacheRoot(model);mixer=null;
      // Remove borrowed geometry and textures before Level's generic traversal.
      group.clear();group.removeFromParent();
      for(const skeleton of instanceSkeletons)skeleton.dispose();instanceSkeletons.clear();
      for(const material of instanceMaterials)material.dispose();instanceMaterials.clear();materialRest.clear();
      model=null;nodes={};poses=[];animationPoses=[];footTargets.clear();lease.release();
    },
  };
}
