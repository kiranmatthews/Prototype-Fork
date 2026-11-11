import * as THREE from 'three';
import {solveTwoBoneIk} from './ik';
import {JAK_IDLE_STANCE,JAK_IDLE_STANCE_SOURCE} from './jakIdleStance.generated';
import type {AnimationClip,AnimationTrack,RigDefinition,QuaternionTuple,Vec3Tuple} from './types';

/** D's idle: the source idle's quick breathing and bob, standing the way the
 * skate study's skater stands when he steps off his board.
 *
 * The source idle is a wide, staggered, elbows-out stance. Every joint in it
 * swings a little about its own average, and that swing is all of its life:
 * the breath in the chest, the shoulders and elbows riding it, the pelvis
 * bobbing and swaying over the feet. Here each joint keeps its swing exactly,
 * about a different average: most of the way to the study's stand, which is
 * upright with the feet parallel under the hips and the arms hanging.
 *
 * The legs are not swung. The pelvis moves over the feet as it did, and each
 * key the legs are solved from it down to soles that stay where the new
 * stance puts them. The same bob over straighter legs is a knee that gives,
 * and no foot drifts over the floor. */
export const JAK_IDLE={
  /** How far the stance is taken from the source idle's toward the study's stand. */
  stance:.85,
  /** The pelvis's bob and sway over the feet, as a share of the source idle's. */
  bob:1,
  /** Rig units the pelvis rests below the study's stand, so the knees are soft
   * enough to give through the whole bob without ever locking straight. */
  sink:.006,
  /** The study's skater stands with his right arm turned in, its hand across
   * the front of his thigh. Here that arm hangs at his side: each of its
   * joints is taken this far from the study's toward a mirror of the left's. */
  open:{shoulderRight:['shoulderLeft',.7],elbowRight:['elbowLeft',.7],wristRight:['wristLeft',.7]} as Readonly<Record<string,readonly [string,number]>>,
} as const;

const LEGS=[['hipLeft','kneeLeft','ankleLeft','toeLeft'],['hipRight','kneeRight','ankleRight','toeRight']] as const;
const quat=(value:readonly number[])=>new THREE.Quaternion().fromArray(value as number[]);
const tuple=(q:THREE.Quaternion):QuaternionTuple=>[q.x,q.y,q.z,q.w];
type RotationKeys=readonly {value:QuaternionTuple}[];

/** The average of a track's rotations: what the joint swings about. */
function average(keys:RotationKeys):THREE.Quaternion {
  const first=quat(keys[0].value),sum=new THREE.Vector4(0,0,0,0);
  for(const key of keys){const q=quat(key.value);if(q.dot(first)<0)q.set(-q.x,-q.y,-q.z,-q.w);sum.add(new THREE.Vector4(q.x,q.y,q.z,q.w));}
  return new THREE.Quaternion(sum.x,sum.y,sum.z,sum.w).normalize();
}

export function createJakIdleClip(original:AnimationClip,rig:RigDefinition):AnimationClip {
  const rotations=new Map(original.tracks.filter(track=>track.kind==='quaternion').map(track=>[track.target,track.keys as RotationKeys]));
  const rootTrack=original.tracks.find(track=>track.kind==='position'&&track.target===rig.rootJointId);
  if(!rootTrack||!rotations.has('hips')||LEGS.flat().some(id=>!rotations.has(id)))throw new Error('D idle: the source idle has no pelvis or leg keys.');
  const rootKeys=rootTrack.keys as readonly {value:Vec3Tuple}[],count=rootKeys.length,weight=JAK_IDLE.stance;
  if([...rotations.values()].some(keys=>keys.length!==count))throw new Error('D idle: the source idle\'s tracks are not keyed together.');

  // Each joint's own average, and the one it gets.
  const means=new Map<string,{from:THREE.Quaternion;to:THREE.Quaternion}>();
  // (A joint on one side mirrored is the same turn about x, undone about y and z.)
  const stance=(target:string):THREE.Quaternion|null=>{
    const wanted=JAK_IDLE_STANCE[target],open=JAK_IDLE.open[target],other=open&&JAK_IDLE_STANCE[open[0]];
    if(!wanted)return null;
    return other?quat(wanted).slerp(new THREE.Quaternion(other[0],-other[1],-other[2],other[3]),open[1]):quat(wanted);
  };
  for(const [target,keys] of rotations){
    const from=average(keys),wanted=stance(target);
    means.set(target,{from,to:wanted?from.clone().slerp(wanted,weight):from});
  }
  // A key's swing about the old average, carried over to the new one. It is
  // kept in the parent's frame: a shoulder that rode the breath up and
  // forward still does, wherever the arm now hangs.
  const swung=(target:string,index:number):THREE.Quaternion=>{
    const mean=means.get(target)!;
    return quat(rotations.get(target)![index].value).multiply(mean.from.clone().invert()).multiply(mean.to).normalize();
  };

  // A bare skeleton of the pelvis and legs to measure and solve on.
  const byId=new Map(rig.joints.map(joint=>[joint.id,joint])),nodes=new Map<string,THREE.Object3D>();
  const used=new Set<string>();
  for(const id of ['hips',...LEGS.flat()])for(let at:string|null=id;at;at=byId.get(at)?.parentId??null)used.add(at);
  for(const id of used){const node=new THREE.Object3D();node.name=id;nodes.set(id,node);}
  for(const id of used){const parent=byId.get(id)!.parentId;if(parent)nodes.get(parent)!.add(nodes.get(id)!);}
  const top=nodes.get(rig.rootJointId)!,none=new THREE.Quaternion(),origin=new THREE.Vector3();
  const set=(id:string,turn:THREE.Quaternion,move=origin)=>{
    const node=nodes.get(id)!,rest=byId.get(id)!.rest;
    node.position.fromArray(rest.position).add(move);node.quaternion.fromArray(rest.quaternion).multiply(turn);node.scale.fromArray(rest.scale);
  };
  const local=(id:string):QuaternionTuple=>tuple(quat(byId.get(id)!.rest.quaternion).invert().multiply(nodes.get(id)!.quaternion).normalize());
  const at=(id:string)=>{top.updateMatrixWorld(true);return nodes.get(id)!.getWorldPosition(new THREE.Vector3());};
  const facing=(id:string)=>{top.updateMatrixWorld(true);return nodes.get(id)!.getWorldQuaternion(new THREE.Quaternion());};
  for(const id of used)set(id,none);

  // How the pelvis moves over the feet in the source idle. Its root keys also
  // carry the feet with them; what shows is the pelvis against the soles.
  const pelvis:THREE.Vector3[]=[];
  for(let index=0;index<count;index++){
    set(rig.rootJointId,none,new THREE.Vector3().fromArray(rootKeys[index].value));
    for(const id of ['hips',...LEGS.flat()])set(id,quat(rotations.get(id)![index].value));
    pelvis.push(at('hips').sub(at('ankleLeft').add(at('ankleRight')).multiplyScalar(.5)));
  }
  const centre=pelvis.reduce((sum,value)=>sum.add(value),new THREE.Vector3()).multiplyScalar(1/count);
  const rootCentre=rootKeys.reduce((sum,key)=>sum.add(new THREE.Vector3().fromArray(key.value)),new THREE.Vector3()).multiplyScalar(1/count);

  // The two stances, each read off the skeleton: where its ankles are under
  // the root, how its soles are turned, and which way its knees point.
  const stand=(root:THREE.Vector3,turn:(id:string)=>THREE.Quaternion)=>{
    set(rig.rootJointId,none,root);
    for(const id of ['hips',...LEGS.flat()])set(id,turn(id));
    return LEGS.map(([hip,knee,ankle])=>{
      const out=at(knee).sub(at(hip).add(at(ankle)).multiplyScalar(.5));
      return {at:at(ankle),turn:facing(ankle),out:out.lengthSq()<1e-8?out.set(0,0,1):out.normalize()};
    });
  };
  const source=stand(rootCentre,id=>means.get(id)!.from);
  // The study's stand is centred under the root.
  const settled=new THREE.Vector3(rootCentre.x*(1-weight),rootCentre.y,rootCentre.z*(1-weight));
  const study=stand(new THREE.Vector3(0,rootCentre.y,0),id=>JAK_IDLE_STANCE[id]?quat(JAK_IDLE_STANCE[id]):means.get(id)!.from);
  const floor=Math.min(...study.map(mark=>mark.at.y));
  const marks=LEGS.map((_,side)=>({
    at:source[side].at.clone().lerp(study[side].at,weight).setY(floor),
    turn:source[side].turn.clone().slerp(study[side].turn,weight),
    out:source[side].out.clone().lerp(study[side].out,weight).normalize(),
  }));

  const rest=settled.clone().setY(settled.y-JAK_IDLE.sink);
  const rootAt=(index:number)=>pelvis[index].clone().sub(centre).multiplyScalar(JAK_IDLE.bob).add(rest);
  const legKeys=new Map<string,QuaternionTuple[]>(LEGS.flat().map(id=>[id,[]]));
  let straightest=Infinity;
  for(let index=0;index<count;index++){
    set(rig.rootJointId,none,rootAt(index));
    set('hips',swung('hips',index));
    for(const [side,leg] of LEGS.entries()){
      const [hip,knee,ankle,toe]=leg,mark=marks[side];
      for(const id of leg)set(id,means.get(id)!.to);
      const result=solveTwoBoneIk({root:nodes.get(hip)!,mid:nodes.get(knee)!,end:nodes.get(ankle)!,target:mark.at,
        pole:mark.at.clone().add(at(hip)).multiplyScalar(.5).addScaledVector(mark.out,.6),weight:1,tolerance:1e-5});
      if(result.status==='invalid'||result.status==='degenerate')throw new Error(`D idle: ${hip} could not be solved (${result.message??result.status}).`);
      // The sole keeps the turn it stands in, whatever the shin does over it.
      nodes.get(ankle)!.quaternion.copy(facing(knee).invert().multiply(mark.turn)).normalize();
      const thigh=at(knee).sub(at(hip)),shin=at(ankle).sub(at(knee));
      straightest=Math.min(straightest,thigh.angleTo(shin));
      for(const id of [hip,knee,ankle,toe])legKeys.get(id)!.push(local(id));
    }
  }
  if(straightest<THREE.MathUtils.degToRad(4))throw new Error('D idle: a knee locks straight at the top of the bob; rest the pelvis lower.');

  const tracks:AnimationTrack[]=original.tracks.map(track=>{
    if(track===rootTrack)return {...track,keys:track.keys.map((key,index)=>({...key,value:rootAt(index).toArray() as Vec3Tuple}))} as AnimationTrack;
    if(track.kind!=='quaternion')return track;
    const solved=legKeys.get(track.target);
    return {...track,keys:track.keys.map((key,index)=>({...key,value:solved?solved[index]:tuple(swung(track.target,index))}))} as AnimationTrack;
  });
  return {...original,name:'D · Idle · the source idle\'s breath and bob in the skate study\'s stand',tracks,
    tags:[...(original.tags??[]).filter(tag=>tag!=='imported-keyframes'),'hybrid-stance'],
    metadata:{...original.metadata,jakIdle:true,
      // The stance carries its own shoulders; the editable neutral-arm layer is the source idle's.
      ownsIdleArms:true,
      stanceSource:JAK_IDLE_STANCE_SOURCE,stanceWeight:weight,straightestKneeDegrees:+THREE.MathUtils.radToDeg(straightest).toFixed(2),
      stancePrinciple:'each joint keeps its own swing about a new average; soles solved in place under the source bob'},
  };
}
