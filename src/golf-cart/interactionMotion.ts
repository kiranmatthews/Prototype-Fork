import * as THREE from 'three';
import type { Player } from '../player';
import { characterElasticityAmplitudes, ELASTIC_LENGTH_CONTROLS } from '../animation/elasticity';
import { solveTwoBoneIk } from '../animation/ik';
import type { GolfCartModel } from './model';

export const CART_INTERACTION_TIMING={exit:.95,enter:1.0,steal:1.85,pull:.88};
export const CART_INTERACTION_ELASTICITY={walk:characterElasticityAmplitudes('walk'),step:characterElasticityAmplitudes('climb'),pull:characterElasticityAmplitudes('rope-release'),settle:characterElasticityAmplitudes('land')};
export type CartMotion='exit'|'enter'|'pull'|'yanked'|'walk';
const ease=(a:number,b:number,t:number)=>{const u=THREE.MathUtils.clamp((t-a)/(b-a),0,1);return u*u*(3-2*u);};
const UP=new THREE.Vector3(0,1,0);

/** Temporarily borrows the actual full-size racer. Feet and palms are solved
 * after independent segment deformation; the complete skeleton is never scaled. */
export class CartInteractionActor {
  readonly root=new THREE.Group();
  readonly groundPosition=new THREE.Vector3();
  readonly contacts={hands:[0,0],feet:[0,0]};
  private readonly rig;
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
  present(mode:CartMotion,t:number,cart:GolfCartModel,foot:THREE.Vector3,side:number,from=foot,victim?:CartInteractionActor){
    if(this.disposed)return;t=THREE.MathUtils.clamp(t,0,1);
    const body=this.player.vehicleVisualRoot,yaw=cart.root.rotation.y,walking=mode==='walk',walkYaw=Math.atan2(foot.x-from.x,foot.z-from.z),stride=Math.sin(t*Math.PI*8),exit=mode==='exit'||mode==='enter',u=mode==='enter'?1-t:t;
    const travel=exit?ease(.16,.85,u):mode==='yanked'?ease(.25,.94,t):1;
    const turn=exit?(mode==='enter'?side*Math.PI*.5*travel:-side*Math.PI*.5*Math.sin(Math.PI*travel)):mode==='pull'?side*Math.PI*.5:side*.85*Math.sin(Math.PI*travel);
    const grip=mode==='pull'?ease(.08,.30,t)*(1-ease(.84,1,t)):0;
    const load=Math.sin(Math.PI*t),rebound=Math.sin(Math.PI*2*t)*load;
    const profile=walking?CART_INTERACTION_ELASTICITY.walk:mode==='pull'||mode==='yanked'?CART_INTERACTION_ELASTICITY.pull:CART_INTERACTION_ELASTICITY.step;
    this.player.presentVehicleDriver(({applyDeformations})=>{
      this.reset();body.position.set(0,-this.height,0);body.rotation.set(0,0,0);
      applyDeformations(Object.fromEntries(ELASTIC_LENGTH_CONTROLS.map(([key,part])=>[key,1-profile[part]*rebound+(part===1||part===2?profile[part]*(key.includes(side<0?'.right.':'.left.')?5.5:3)*grip:0)])));
      const torso=this.rig.jointsById.get('torsoRoot')!.node,head=this.rig.jointsById.get('head')!.node;
      torso.rotation.x=walking?.08:mode==='pull'?.22*load-.5*ease(.5,.8,t)*(1-ease(.85,1,t)):.28*load;
      torso.rotation.z=mode==='yanked'?side*.38*load:0;head.rotation.set(-.12*load,-side*.3*load,mode==='yanked'?-side*.2*load:0);
    });
    cart.socket.getWorldPosition(this.seat);this.stance.copy(foot);
    if(mode==='pull')this.stance.lerpVectors(from,foot,ease(0,.26,t));
    this.stance.y+=this.standingHeight;
    this.root.position.lerpVectors(this.seat,this.stance,travel);this.root.position.y-=walking?.025*Math.abs(stride):.16*load;
    if(mode==='pull'){
      const lean=.45*Math.sin(Math.PI*ease(.12,.8,t));
      this.root.position.x-=Math.cos(yaw)*side*lean;this.root.position.z+=Math.sin(yaw)*side*lean;
    }
    this.orientation.setFromAxisAngle(UP,walking?walkYaw:yaw+Math.PI);
    cart.socket.getWorldQuaternion(this.seatOrientation).multiply(new THREE.Quaternion().setFromAxisAngle(UP,Math.PI));
    this.root.quaternion.copy(this.seatOrientation).slerp(this.orientation,travel);this.root.rotateY(turn);
    this.groundPosition.copy(this.root.position);this.groundPosition.y-=this.standingHeight;
    this.root.updateWorldMatrix(true,true);
    for(let i=0;i<2;i++){
      const name=i?'Right':'Left',sign=i?1:-1,leading=(side<0?i===0:i===1),lag=leading?0:.13;
      const leg=this.rig.jointsById.get(`hip${name}`)!.node,knee=this.rig.jointsById.get(`knee${name}`)!.node,ankle=this.rig.jointsById.get(`ankle${name}`)!.node;
      leg.rotation.x=-1.2;knee.rotation.x=1.3;
      this.target.set(-.33+sign*.13,.64,-.21);cart.body.localToWorld(this.target);
      this.free.copy(this.footOffsets[i]).setY(0).applyAxisAngle(UP,walking?walkYaw:yaw+Math.PI+(mode==='pull'?side*Math.PI*.5:mode==='enter'?side*Math.PI*.5:0)).add(foot);this.free.y=foot.y+.12;
      let step=exit?ease(.15+lag,.70+lag,u):mode==='yanked'?ease(.34+lag,.94+lag,t):1;
      if(walking){this.free.x+=Math.sin(walkYaw)*stride*sign*.22;this.free.z+=Math.cos(walkYaw)*stride*sign*.22;this.free.y+=Math.max(0,stride*sign)*.15;}
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
      const shoulder=this.rig.jointsById.get(`shoulder${name}`)!.node,elbow=this.rig.jointsById.get(`elbow${name}`)!.node,wrist=this.rig.jointsById.get(`wrist${name}`)!.node;
      const grip=body.getObjectByName(`socket-grip-${name.toLowerCase()}`)??wrist;
      this.free.set(sign*.34,.28,.22+(walking?-stride*sign*.16:0));this.root.localToWorld(this.free);
      if(walking)this.target.copy(this.free);
      else if(mode==='pull'&&victim){
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
    }
    body.updateWorldMatrix(true,true);
  }
  dispose(){
    if(this.disposed)return;this.disposed=true;this.player.restoreRenderPose();this.player.presentVehicleDriver(()=>this.reset());
    const body=this.player.vehicleVisualRoot;this.parent.add(body);body.position.copy(this.savedPosition);body.quaternion.copy(this.savedRotation);
    if(this.board)this.board.visible=this.boardVisible;this.root.removeFromParent();this.player.resetRenderInterpolation();
  }
}
