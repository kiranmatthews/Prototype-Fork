import * as THREE from 'three';
import type { Player } from '../player';
import { characterElasticityAmplitudes, ELASTIC_LENGTH_CONTROLS } from '../animation/elasticity';
import { solveTwoBoneIk } from '../animation/ik';
import {
  RigBinding, createPlayerStarterClips, clipTimeAt, sampleComposedClip,
  createProceduralMotionContext, blendPoses, type AnimationClip, type PoseBuffer,
} from '../animation';
import type { GolfCartModel } from './model';
import { CharacterInteractionBounds } from '../character/interactionBounds';
import { ROLL_LANDING_CLIP_ID,ROLL_LANDING_DURATION,ROLL_RUN_BLEND_START } from '../animation/rollLanding';
import type { CartBailMotion } from './bailMotion';

export const CART_INTERACTION_TIMING={exit:.95,enter:1.0,steal:1.85,pull:.88};
export const CART_INTERACTION_ELASTICITY={step:characterElasticityAmplitudes('climb'),pull:characterElasticityAmplitudes('rope-release'),settle:characterElasticityAmplitudes('land')};
export type CartMotion='exit'|'enter'|'pull'|'yanked'|'run';
const ease=(a:number,b:number,t:number)=>{const u=THREE.MathUtils.clamp((t-a)/(b-a),0,1);return u*u*(3-2*u);};
const UP=new THREE.Vector3(0,1,0);

/** Temporarily borrows the actual full-size racer. Feet and palms are solved
 * after independent segment deformation; the complete skeleton is never scaled. */
export class CartInteractionActor {
  readonly root=new THREE.Group();
  readonly groundPosition=new THREE.Vector3();
  readonly contacts={hands:[0,0],feet:[0,0]};
  private readonly rig;
  private readonly binding:RigBinding;
  private locomotionClips:AnimationClip[]|null=null;
  private bailStart:PoseBuffer|null=null;private bailOrientation=new THREE.Quaternion();
  private readonly bailSurface=new CharacterInteractionBounds();
  private readonly bailFoot=new THREE.Vector3();private bailFootPlanted=false;
  readonly locomotion={clipId:'player.run',seconds:0,weight:0};
  private readonly limbPose=Array.from({length:6},()=>new THREE.Quaternion());
  private readonly parent:THREE.Object3D;
  private readonly savedPosition:THREE.Vector3;private readonly savedRotation:THREE.Quaternion;
  private readonly board:THREE.Object3D|undefined;private readonly boardVisible:boolean;
  private readonly height:number;private readonly standingHeight:number;
  private readonly footOffsets:THREE.Vector3[]=[];
  private readonly seat=new THREE.Vector3();private readonly stance=new THREE.Vector3();private readonly point=new THREE.Vector3();
  private readonly target=new THREE.Vector3();private readonly pole=new THREE.Vector3();private readonly free=new THREE.Vector3();
  private readonly orientation=new THREE.Quaternion();private readonly seatOrientation=new THREE.Quaternion();private readonly ankleOrientation=new THREE.Quaternion();
  private disposed=false;
  constructor(readonly player:Player,scene:THREE.Object3D){
    player.restoreRenderPose();this.rig=player.animationRig;
    this.binding=RigBinding.fromSculptRuntime(this.rig.root);
    const body=player.vehicleVisualRoot;this.parent=body.parent!;this.savedPosition=body.position.clone();this.savedRotation=body.quaternion.clone();
    player.presentVehicleDriver(()=>this.reset());body.updateWorldMatrix(true,true);
    const hip=body.worldToLocal(this.rig.jointsById.get('hips')!.node.getWorldPosition(new THREE.Vector3()));
    this.height=hip.y*body.scale.y;
    this.footOffsets=['Left','Right'].map(side=>body.worldToLocal(this.rig.jointsById.get(`ankle${side}`)!.node.getWorldPosition(new THREE.Vector3())).sub(hip).multiply(body.scale));
    this.standingHeight=-(this.footOffsets[0].y+this.footOffsets[1].y)/2+.12;
    this.board=body.getObjectByName('skateboard-scale-compensation');this.boardVisible=this.board?.visible??false;if(this.board)this.board.visible=false;
    this.root.name='Animated kart interaction';scene.add(this.root);this.root.add(body);player.resetRenderInterpolation();
  }
  private reset(){for(const joint of this.rig.joints){joint.node.position.fromArray(joint.rest.position);joint.node.quaternion.fromArray(joint.rest.quaternion);joint.node.scale.fromArray(joint.rest.scale);}}
  private sample(id:string,seconds:number,grounded=true){
    const clip=this.player.authoredClip(id)??(this.locomotionClips??=createPlayerStarterClips(this.binding.definition)).find(c=>c.id===id)!;
    return sampleComposedClip(clip,clipTimeAt(clip,seconds),createProceduralMotionContext({normalizedSpeed:1,grounded,inputs:{locomotionWalkBlend:0}}));
  }
  beginBail(){this.bailStart=this.binding.capturePose();this.bailOrientation.copy(this.root.quaternion);}
  presentBail(b:CartBailMotion){
    if(this.disposed)return;
    const progress=b.progress,seconds=progress*ROLL_LANDING_DURATION;
    const recover=ease(ROLL_RUN_BLEND_START,.96,progress);
    // The complete board-abandon shoulder-roll clip owns root rotation,
    // tuck, shoulder contact, foot plant and rebound. Start its catch in air
    // so the head leads the leap, then continue the same clip on contact.
    let pose=this.sample(ROLL_LANDING_CLIP_ID,seconds,b.grounded);
    const runSeconds=Math.max(0,progress-ROLL_RUN_BLEND_START)*ROLL_LANDING_DURATION;
    if(recover)pose=blendPoses(pose,this.sample('player.run',runSeconds),recover);
    if(this.bailStart)pose=blendPoses(this.bailStart,pose,ease(0,.075,b.age));
    const body=this.player.vehicleVisualRoot;
    this.player.presentVehicleDriver(({applyDeformations})=>{
      this.reset();body.position.set(0,-this.height,0);body.rotation.set(0,0,0);this.binding.applyPose(pose,{resetUnspecified:false});
      applyDeformations(Object.fromEntries(ELASTIC_LENGTH_CONTROLS.map(([key])=>[key,pose.scalars[key]??1])));
    });
    this.root.position.copy(b.position);this.root.position.y+=this.standingHeight;
    const yaw=Math.atan2(b.velocity.x,b.velocity.z);
    this.orientation.setFromAxisAngle(UP,yaw);this.root.quaternion.copy(this.bailOrientation).slerp(this.orientation,ease(0,.12,b.age));
    this.groundPosition.copy(b.position);Object.assign(this.locomotion,{clipId:recover?'player.run':ROLL_LANDING_CLIP_ID,seconds:recover?runSeconds:seconds,weight:recover});
    this.contacts.hands.fill(0);this.contacts.feet.fill(0);this.root.updateWorldMatrix(true,true);
    const rider=this.rig.jointsById.get('root')!.node;
    const support=()=>{this.root.updateMatrixWorld(true);return this.bailSurface.sampledPlaneDistance(rider,UP,b.position);};
    const clearance=support();
    if(Number.isFinite(clearance))this.root.position.y+=(.025-clearance)*(1-recover)*ease(0,.10,b.age);
    this.root.updateWorldMatrix(true,true);
    // Keep the source roll's trailing-foot contact fixed while its body
    // travels over it, after independent segment elasticity has been applied.
    if(b.grounded&&progress>=.62&&progress<=.76){
      const leg=this.rig.jointsById.get('hipRight')!.node,knee=this.rig.jointsById.get('kneeRight')!.node,ankle=this.rig.jointsById.get('ankleRight')!.node;
      const sole=ankle.getObjectByName('socket-foot-right')??ankle;
      if(!this.bailFootPlanted){sole.getWorldPosition(this.bailFoot);this.bailFoot.y=b.position.y+.025;this.bailFootPlanted=true;}
      leg.getWorldPosition(this.pole);this.pole.add(this.point.set(.4,.1,.2).applyAxisAngle(UP,yaw));
      solveTwoBoneIk({root:leg,mid:knee,end:ankle,effector:sole,target:this.bailFoot,pole:this.pole,weight:ease(.62,.645,progress)*(1-ease(.735,.76,progress)),accountForParentScale:true,tolerance:.002});
      this.contacts.feet[1]=sole.getWorldPosition(this.point).distanceTo(this.bailFoot);
      this.root.updateWorldMatrix(true,true);const gap=support();if(Number.isFinite(gap)&&gap<.006)this.root.position.y+=.006-gap;
    }
    body.updateWorldMatrix(true,true);
  }
  present(mode:CartMotion,t:number,cart:GolfCartModel,foot:THREE.Vector3,side:number,from=foot,victim?:CartInteractionActor,seconds?:number){
    if(this.disposed)return;t=THREE.MathUtils.clamp(t,0,1);
    const body=this.player.vehicleVisualRoot,yaw=cart.root.rotation.y,running=mode==='run',runYaw=Math.atan2(foot.x-from.x,foot.z-from.z),exit=mode==='exit'||mode==='enter',u=mode==='enter'?1-t:t;
    const travel=exit?ease(.16,.85,u):mode==='yanked'?ease(.25,.94,t):1;
    const turn=exit?(mode==='enter'?side*Math.PI*.5*travel:-side*Math.PI*.5*Math.sin(Math.PI*travel)):mode==='pull'?side*Math.PI*.5:side*.85*Math.sin(Math.PI*travel);
    const grip=mode==='pull'?ease(.08,.30,t)*(1-ease(.84,1,t)):0;
    const load=Math.sin(Math.PI*t),rebound=Math.sin(Math.PI*2*t)*load;
    const runWeight=running?1:exit?ease(.40,.78,u):0;
    const elapsed=seconds??t*(mode==='exit'?CART_INTERACTION_TIMING.exit:CART_INTERACTION_TIMING.enter);
    // Reuse the editable run, including its authored tempo and segment elasticity.
    const sample=(id:string)=>this.sample(id,elapsed);
    const runPose=runWeight?running?sample('player.run'):blendPoses(sample('player.run'),sample('player.idle'),ease(.86,1,u)):null;
    Object.assign(this.locomotion,{clipId:'player.run',seconds:elapsed,weight:runWeight});
    const profile=mode==='pull'||mode==='yanked'?CART_INTERACTION_ELASTICITY.pull:CART_INTERACTION_ELASTICITY.step;
    this.player.presentVehicleDriver(({applyDeformations})=>{
      this.reset();body.position.set(0,-this.height,0);body.rotation.set(0,0,0);
      if(runPose)this.binding.applyPose(runPose,{weight:runWeight,resetUnspecified:false});
      applyDeformations(Object.fromEntries(ELASTIC_LENGTH_CONTROLS.map(([key,part])=>{
        const interaction=1-profile[part]*rebound+(part===1||part===2?profile[part]*(key.includes(side<0?'.right.':'.left.')?5.5:3)*grip:0);
        return [key,THREE.MathUtils.lerp(interaction,runPose?.scalars[key]??1,runWeight)];
      })));
      const torso=this.rig.jointsById.get('torsoRoot')!.node,head=this.rig.jointsById.get('head')!.node;
      torso.rotation.x+=(mode==='pull'?.22*load-.5*ease(.5,.8,t)*(1-ease(.85,1,t)):.28*load)*(1-runWeight);
      torso.rotation.z+=(mode==='yanked'?side*.38*load:0)*(1-runWeight);
      head.rotateX(-.12*load*(1-runWeight));head.rotateY(-side*.3*load*(1-runWeight));head.rotateZ((mode==='yanked'?-side*.2*load:0)*(1-runWeight));
    });
    cart.socket.getWorldPosition(this.seat);this.stance.copy(foot);
    if(mode==='pull')this.stance.lerpVectors(from,foot,ease(0,.26,t));
    this.stance.y+=this.standingHeight;
    this.root.position.lerpVectors(this.seat,this.stance,travel);this.root.position.y-=.16*load*(1-runWeight);
    if(mode==='pull'){
      const lean=.45*Math.sin(Math.PI*ease(.12,.8,t));
      this.root.position.x-=Math.cos(yaw)*side*lean;this.root.position.z+=Math.sin(yaw)*side*lean;
    }
    this.orientation.setFromAxisAngle(UP,running?runYaw:yaw+Math.PI);
    cart.socket.getWorldQuaternion(this.seatOrientation).multiply(new THREE.Quaternion().setFromAxisAngle(UP,Math.PI));
    this.root.quaternion.copy(this.seatOrientation).slerp(this.orientation,travel);this.root.rotateY(turn*(1-runWeight));
    if(exit)this.root.quaternion.slerp(new THREE.Quaternion().setFromAxisAngle(UP,yaw+(mode==='exit'?side:-side)*Math.PI/2),runWeight);
    this.groundPosition.copy(this.root.position);this.groundPosition.y-=this.standingHeight;
    this.root.updateWorldMatrix(true,true);
    // A complete run owns its feet and hands; contact IK must not replace its gait.
    if(runWeight>=1){this.contacts.feet.fill(0);this.contacts.hands.fill(0);return;}
    for(let i=0;i<2;i++){
      const name=i?'Right':'Left',sign=i?1:-1,leading=(side<0?i===0:i===1),lag=leading?0:.13;
      const leg=this.rig.jointsById.get(`hip${name}`)!.node,knee=this.rig.jointsById.get(`knee${name}`)!.node,ankle=this.rig.jointsById.get(`ankle${name}`)!.node;
      const legJoints=[leg,knee,ankle];legJoints.forEach((joint,j)=>this.limbPose[j].copy(joint.quaternion));
      leg.rotation.x=-1.2;knee.rotation.x=1.3;
      this.target.set(-.33+sign*.13,.64,-.21);cart.body.localToWorld(this.target);
      this.free.copy(this.footOffsets[i]).setY(0).applyAxisAngle(UP,running?runYaw:yaw+Math.PI+(mode==='pull'?side*Math.PI*.5:mode==='enter'?side*Math.PI*.5:0)).add(foot);this.free.y=foot.y+.12;
      let step=exit?ease(.15+lag,.70+lag,u):mode==='yanked'?ease(.34+lag,.94+lag,t):1;
      if(mode==='pull'){
        this.free.add(this.point.copy(from).sub(foot).multiplyScalar(1-ease(0,.26,t)));
        this.free.y+=Math.sin(Math.PI*ease(0,.26,t))*.12*(leading?1:.65);
      }
      this.target.lerp(this.free,step);if(exit)this.target.y+=Math.sin(Math.PI*step)*.38;
      if(mode==='yanked')this.target.y+=Math.sin(Math.PI*step)*.28;
      this.pole.set(sign*.3,-.1,.8);this.root.localToWorld(this.pole);
      for(let n=0;n<4;n++)if(solveTwoBoneIk({root:leg,mid:knee,end:ankle,target:this.target,pole:this.pole,accountForParentScale:true,tolerance:.005}).reached)break;
      this.contacts.feet[i]=ankle.getWorldPosition(this.point).distanceTo(this.target);
      this.ankleOrientation.copy(ankle.parent!.getWorldQuaternion(this.seatOrientation)).invert().multiply(this.orientation);ankle.quaternion.copy(this.ankleOrientation);
      legJoints.forEach((joint,j)=>joint.quaternion.slerp(this.limbPose[j],runWeight));
      const shoulder=this.rig.jointsById.get(`shoulder${name}`)!.node,elbow=this.rig.jointsById.get(`elbow${name}`)!.node,wrist=this.rig.jointsById.get(`wrist${name}`)!.node;
      const grip=body.getObjectByName(`socket-grip-${name.toLowerCase()}`)??wrist;
      const armJoints=[shoulder,elbow,wrist];armJoints.forEach((joint,j)=>this.limbPose[j+3].copy(joint.quaternion));
      this.free.set(sign*.34,.28,.22);this.root.localToWorld(this.free);
      if(mode==='pull'&&victim){
        const left=victim.rig.jointsById.get('shoulderLeft')!.node,right=victim.rig.jointsById.get('shoulderRight')!.node;
        left.getWorldPosition(this.target);right.getWorldPosition(this.point);
        const near=this.target.distanceToSquared(this.root.position)<this.point.distanceToSquared(this.root.position)?'Left':'Right';
        victim.rig.jointsById.get(`shoulder${near}`)!.node.getWorldPosition(this.target);
        victim.rig.jointsById.get(`elbow${near}`)!.node.getWorldPosition(this.point);
        this.target.lerp(this.point,.35-i*.20);
        this.target.lerp(this.free,1-ease(.08,.30,t)*(1-ease(.84,1,t)));
      }else{
        this.target.set(sign*.18,0,0);cart.steering.localToWorld(this.target);
        this.point.set(side*.83,1.30,.33+sign*.15);cart.body.localToWorld(this.point);
        this.target.lerp(this.point,ease(.03,.28,u));this.target.lerp(this.free,ease(.45,.88,u));
        if(mode==='yanked'){this.target.set(sign*.18,0,0);cart.steering.localToWorld(this.target);this.free.y+=.6*load;this.target.lerp(this.free,ease(.12,.45,t));}
      }
      this.pole.set(sign*.9,.1,.05);this.root.localToWorld(this.pole);
      for(let n=0;n<4;n++)if(solveTwoBoneIk({root:shoulder,mid:elbow,end:wrist,effector:grip,target:this.target,pole:this.pole,accountForParentScale:true,tolerance:.008}).reached)break;
      this.contacts.hands[i]=grip.getWorldPosition(this.point).distanceTo(this.target);
      armJoints.forEach((joint,j)=>joint.quaternion.slerp(this.limbPose[j+3],runWeight));
    }
    body.updateWorldMatrix(true,true);
  }
  dispose(){
    if(this.disposed)return;this.disposed=true;this.player.restoreRenderPose();this.player.presentVehicleDriver(()=>this.reset());
    const body=this.player.vehicleVisualRoot;this.parent.add(body);body.position.copy(this.savedPosition);body.quaternion.copy(this.savedRotation);
    if(this.board)this.board.visible=this.boardVisible;this.root.removeFromParent();this.player.resetRenderInterpolation();
  }
}
