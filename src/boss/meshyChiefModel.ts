import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { characterElasticityAmplitudes } from '../animation/elasticity';
import { enemyElasticPulse } from '../enemies/elasticity';
import { chiefAssets, bossAssetUrl } from './meshyAssets';
import { REEF } from '../levels/crab-chief';
import type { ChiefPose } from './crabChiefModel';

type RigMetadata={joints:Record<string,number[]>;segments:Record<string,[number[],number[]]>};
const UP=new THREE.Vector3(0,1,0), ease=(t:number)=>{const u=THREE.MathUtils.clamp(t,0,1);return u*u*(3-2*u);};
const point=(a:readonly number[])=>new THREE.Vector3(a[0],a[1],a[2]);

/** The actual Meshy surface, with model-specific skin/secondary joints.
 * Every shaft deforms independently; the enclosing actor remains unscaled. */
export class MeshyChiefModel {
  readonly root=new THREE.Group();
  readonly ready:Promise<void>;
  readonly pearl=new THREE.Vector3(...REEF.pearl);
  readonly cameraTop=new THREE.Vector3(0,8.2,REEF.chiefZ);
  readonly arms=[{side:-1,wrist:new THREE.Vector3(-3,2.7,0)},{side:1,wrist:new THREE.Vector3(3,2.7,0)}];
  private readonly lease=chiefAssets.acquire(bossAssetUrl('crab-chief.glb'));
  private metadata:RigMetadata|null=null;
  private bones=new Map<string,THREE.Bone>();
  private skeletons=new Set<THREE.Skeleton>();
  private model:THREE.Object3D|null=null;
  private disposed=false;
  private lastState='';
  private startRoot=new THREE.Vector3(0,0,REEF.chiefZ);
  private startWrists=this.arms.map(arm=>arm.wrist.clone());
  private latest:ChiefPose={time:0,stateTime:0,phase:1,state:'waiting',target:new THREE.Vector3(0,0,-14),left:true,exposed:false,defeated:false};
  constructor() {
    this.root.name='Meshy Tidebreak chief · fitted deformation rig';this.root.position.z=REEF.chiefZ;
    this.ready=this.lease.promise.then(asset=>{
      if(this.disposed)return;
      this.model=cloneSkeleton(asset.scene);this.root.add(this.model);
      this.model.traverse(node=>{
        if(node.userData.chiefRig)this.metadata=node.userData.chiefRig as RigMetadata;
        if((node as THREE.Bone).isBone)this.bones.set(node.name,node as THREE.Bone);
        const mesh=node as THREE.SkinnedMesh;
        if(mesh.isMesh){mesh.castShadow=true;mesh.receiveShadow=true;}
        if(mesh.isSkinnedMesh){mesh.frustumCulled=false;this.skeletons.add(mesh.skeleton);}
      });
      if(!this.metadata||!this.bones.size)throw new Error('Meshy chief fitted rig is missing');
      this.pose(this.latest);
    });
    // Asset preparation reports failures; a disposed scene may never await it.
    void this.ready.catch(() => {});
  }
  private joint(name:string, position:THREE.Vector3, orientation=new THREE.Quaternion(), scale=new THREE.Vector3(1,1,1)):void {
    const bone=this.bones.get(name);if(!bone)return;
    bone.position.copy(position);bone.quaternion.copy(orientation);bone.scale.copy(scale);bone.matrixAutoUpdate=true;
  }
  private segment(name:string,a:THREE.Vector3,b:THREE.Vector3):void {
    if(!this.metadata)return;
    const bind=this.metadata.segments[name], length=point(bind[0]).distanceTo(point(bind[1]));
    const delta=b.clone().sub(a), q=new THREE.Quaternion().setFromUnitVectors(UP,delta.clone().normalize());
    this.joint(name,a,q,new THREE.Vector3(1,Math.max(.15,delta.length()/length),1));
  }
  pose(frame:ChiefPose):void {
    this.latest=frame;
    const {state,stateTime:t,time}=frame;
    if(state!==this.lastState){this.startRoot.copy(this.root.position);this.startWrists=this.arms.map(arm=>arm.wrist.clone());this.lastState=state;}
    let desired=new THREE.Vector3(0,0,REEF.chiefZ);
    const sign=frame.left?-1:1, tellDuration=frame.phase===3?.95:1.3;
    if(state==='slam-tell'||state==='slam')desired.set(frame.target.x-sign*2.2,0,frame.target.z-3.4);
    else if(state==='recover'||state==='hurt'||state.startsWith('tongue')||state.startsWith('ramp'))desired.set(0,0,-24);
    else if(frame.phase>1)desired.z=-24;
    const travel=ease(t/(state==='slam-tell'?tellDuration:state==='recover'?.6:.4));
    this.root.position.copy(this.startRoot).lerp(desired,travel);
    if(state==='slam-tell')this.root.position.y+=Math.sin(Math.PI*Math.min(1,t/tellDuration))*1.6;
    if(state==='recover')this.root.position.y+=Math.sin(Math.PI*Math.min(1,t/.6))*.65;
    if(!this.metadata)return;
    const m=this.metadata, idle=characterElasticityAmplitudes('idle'), load=characterElasticityAmplitudes('jump');
    const anticipation=state.endsWith('tell')?ease(t/(state==='slam-tell'?tellDuration:1.2)):0;
    const hit=state==='hurt'?enemyElasticPulse(t,.9):state==='slam'?enemyElasticPulse(t,.55):0;
    const opening=frame.phase===1?(state==='recover'?ease((t-.3)/.6):state==='hurt'?1-ease(t/.7):0):0;
    const kneel=frame.defeated?ease(t/2.5):opening*.65;
    const breath=frame.defeated?0:Math.sin(time*2.3)*idle[0];
    const hip=point(m.joints.torso);hip.y-=kneel*1.6+anticipation*.28-hit*.25;
    const tilt=frame.defeated?.45:opening*.75-hit*.12;
    const bodyQ=new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt,0,frame.defeated?0:Math.sin(time*1.4)*.025));
    const bodyScale=new THREE.Vector3(1,1+breath-anticipation*load[0]+hit*load[0],1);
    this.joint('torso',hip,bodyQ,bodyScale);
    const transform=(rest:number[])=>point(rest).sub(point(m.joints.torso)).multiply(bodyScale).applyQuaternion(bodyQ).add(hip);
    const head=transform(m.joints.head), headQ=bodyQ.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(
      frame.defeated?.2:state==='phase'?-.18*Math.sin(Math.PI*Math.min(1,t/3)):0,
      Math.atan2(frame.target.x-this.root.position.x,Math.max(5,frame.target.z-this.root.position.z))*.18,0)));
    this.joint('head',head,headQ);
    const crown=point(m.joints.crown).sub(point(m.joints.head)).applyQuaternion(headQ).add(head);
    this.joint('crown',crown,headQ);
    this.cameraTop.copy(crown).add(new THREE.Vector3(0,1.15,0)).add(this.root.position);
    for(const name of ['skirtFront','skirtBack','skirtLeft','skirtRight']){
      const p=point(m.joints[name]);p.y-=kneel*.35;
      const sway=frame.defeated?0:Math.sin(time*2.5+name.length)*.07+hit*.09;
      this.joint(name,p,new THREE.Quaternion().setFromEuler(new THREE.Euler(sway,0,0)));
    }
    for(const arm of this.arms){
      const side=arm.side, label=side<0?'Left':'Right', active=side===sign;
      const shoulder=transform(m.joints['upperArm'+label]), wrist=point(m.joints['claw'+label]);
      if(state==='slam-tell'&&active){wrist.set(side*2.2,4.7+anticipation*.8,.5+anticipation*.4);}
      else if(state==='slam'&&active){wrist.copy(frame.target).sub(this.root.position);wrist.y=2.95+(1-ease(t/.17))*2.6;}
      else if(state==='recover'||state==='hurt'){wrist.lerp(new THREE.Vector3(side*3.1,2.95,2.1),opening);}
      else if(state==='volley-tell'||state==='volley'){wrist.set(side*2.8,3.9,2.4);}
      else if(state==='sweep-tell'||state==='sweep'){
        const sweep=state==='sweep'?-1.1+ease(t/1.8)*2.2:-1.1;
        wrist.set(side*2.1+Math.sin(sweep)*2.1,2.95,2.7+Math.cos(sweep)*.7);
      }else if(state==='phase')wrist.y+=Math.sin(Math.PI*Math.min(1,t/3))*1.6;
      if(frame.defeated)wrist.lerp(new THREE.Vector3(side*2.5,2.95,1.9),ease(t/2.5));
      wrist.lerp(this.startWrists[side<0?0:1],1-ease(t/(state==='slam'?.12:.35)));
      wrist.y=Math.max(2.95,wrist.y);
      const elbow=transform(m.joints['forearm'+label]);
      elbow.add(wrist.clone().sub(point(m.joints['claw'+label])).multiplyScalar(.48));
      this.segment('upperArm'+label,shoulder,elbow);this.segment('forearm'+label,elbow,wrist);
      const clawQ=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,side*-.12,side*.04));
      this.joint('claw'+label,wrist,clawQ);
      const pincer=point(m.joints['pincer'+label]).sub(point(m.joints['claw'+label])).applyQuaternion(clawQ).add(wrist);
      this.joint('pincer'+label,pincer,clawQ.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0,side*(.08+anticipation*.16),0))));
      arm.wrist.copy(wrist);
      const foot=point(m.joints['foot'+label]), upper=point(m.joints['upperLeg'+label]);upper.y-=kneel*1.6+anticipation*.28-hit*.25;
      const knee=point(m.joints['lowerLeg'+label]);knee.z+=kneel*.9;knee.y-=kneel*.4;
      this.segment('upperLeg'+label,upper,knee);this.segment('lowerLeg'+label,knee,foot);this.joint('foot'+label,foot);
    }
    this.pearl.copy(transform([0,4.95,1.25])).add(this.root.position);
    this.root.updateMatrixWorld(true);for(const skeleton of this.skeletons)skeleton.update();
  }
  get diagnostics(){
    let triangles=0,meshes=0;this.root.traverse(node=>{const mesh=node as THREE.Mesh;if(mesh.isMesh){meshes++;triangles+=(mesh.geometry.index?.count??mesh.geometry.getAttribute('position').count)/3;}});
    return {provider:'Meshy',triangles,meshes,rootScale:this.root.scale.toArray(),ready:!!this.metadata,
      joints:this.bones.size,toes:['Left','Right'].map(s=>this.metadata?.joints['foot'+s]??[]),
      wrists:this.arms.map(arm=>arm.wrist.clone().add(this.root.position).toArray()),pearl:this.pearl.toArray()};
  }
  dispose():void {this.disposed=true;this.root.clear();this.root.removeFromParent();for(const skeleton of this.skeletons)skeleton.dispose();this.lease.release();}
}
