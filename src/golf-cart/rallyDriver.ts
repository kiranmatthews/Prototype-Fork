import * as THREE from 'three';
import type { Player } from '../player';
import type { PlayerAnimationRig } from '../animation/bridge';
import { solveTwoBoneIk } from '../animation/ik';
import { CART_DRIVER_ELASTICITY } from './driver';
import type { CartDriver, DriverMotion, GolfCartModel } from './model';

const reset=(rig:PlayerAnimationRig)=>{for(const j of rig.joints){j.node.position.fromArray(j.rest.position);j.node.quaternion.fromArray(j.rest.quaternion);j.node.scale.fromArray(j.rest.scale);}};
/** Borrow the live racer, including Bone Man's original surfaces and hands.
 * Only the kart grows: inverse mount scale keeps seated and on-foot sizes equal. */
export class RallyDriver implements CartDriver {
  readonly root=new THREE.Group();
  readonly contacts={hands:[0,0],feet:[0,0]};
  private parent:THREE.Object3D;
  private position:THREE.Vector3;private rotation:THREE.Quaternion;
  private board:THREE.Object3D|undefined;private boardVisible=true;
  private disposed=false;
  private lastMotion:number[]=[];
  private target=new THREE.Vector3();private pole=new THREE.Vector3();private sample=new THREE.Vector3();
  private readonly rig:PlayerAnimationRig;
  constructor(readonly player:Player,private cart:GolfCartModel,scale:number){
    player.restoreRenderPose();this.rig=player.animationRig;
    this.parent=player.vehicleVisualRoot.parent!;this.position=player.vehicleVisualRoot.position.clone();this.rotation=player.vehicleVisualRoot.quaternion.clone();
    this.root.name='Full-size race driver';this.root.scale.setScalar(1/scale);this.root.rotation.y=Math.PI;
    this.root.add(player.vehicleVisualRoot);
    this.board=player.vehicleVisualRoot.getObjectByName('skateboard-scale-compensation');
    if(this.board){this.boardVisible=this.board.visible;this.board.visible=false;}
    player.resetRenderInterpolation();
  }
  update(m:DriverMotion){
    if(this.disposed)return;
    const key=[m.time,m.speed,m.steer,m.roll,m.pitch,m.impact];
    if(key.every((v,i)=>v===this.lastMotion[i]))return;this.lastMotion=key;
    const body=this.player.vehicleVisualRoot;
    this.player.presentVehicleDriver(({rig,applyDeformations})=>{
      reset(rig);body.position.set(0,0,0);body.rotation.set(0,0,0);
      const bounce=Math.sin(m.time*9)*Math.min(1,Math.abs(m.speed)/8)*CART_DRIVER_ELASTICITY.ride[0];
      applyDeformations({'deform.torso.length':1+bounce-Math.min(1,m.impact)*CART_DRIVER_ELASTICITY.hit[0]*.8});
      const spine=rig.jointsById.get('torsoRoot')!.node;
      spine.rotation.x=.08-m.pitch*.35;spine.rotation.z=m.roll*.35;
      rig.jointsById.get('head')!.node.rotation.set(-m.pitch*.2,-m.steer*.12,-m.roll*.2);
    });
    // Seat at the real hip after the character's persistent proportions apply.
    const hips=this.rig.jointsById.get('hips')!.node;
    body.position.y=-hips.position.y*body.scale.y;
    this.root.updateWorldMatrix(true,true);
    for(let i=0;i<2;i++){
      const side=i?'Right':'Left',sign=i?1:-1;
      const hip=this.rig.jointsById.get(`hip${side}`)!.node,knee=this.rig.jointsById.get(`knee${side}`)!.node,ankle=this.rig.jointsById.get(`ankle${side}`)!.node;
      hip.rotation.x=-1.3;knee.rotation.x=1.3;ankle.rotation.set(0,0,0);
      this.target.set(-.33+sign*.13,.64,-.21);this.cart.body.localToWorld(this.target);
      this.pole.set(-.33+sign*.22,1.05,-.65);this.cart.body.localToWorld(this.pole);
      for(let n=0;n<5;n++)if(solveTwoBoneIk({root:hip,mid:knee,end:ankle,target:this.target,pole:this.pole,accountForParentScale:true,tolerance:.003}).reached)break;
      this.contacts.feet[i]=ankle.getWorldPosition(this.sample).distanceTo(this.target);
      // Keep the shoes flat in the cart's frame, without changing limb lengths.
      const q=this.root.getWorldQuaternion(new THREE.Quaternion()),parentQ=ankle.parent!.getWorldQuaternion(new THREE.Quaternion());ankle.quaternion.copy(parentQ.invert().multiply(q));
      const shoulder=this.rig.jointsById.get(`shoulder${side}`)!.node,elbow=this.rig.jointsById.get(`elbow${side}`)!.node,wrist=this.rig.jointsById.get(`wrist${side}`)!.node;
      const grip=body.getObjectByName(`socket-grip-${side.toLowerCase()}`)??wrist;
      this.target.set(sign*.18,0,0);this.cart.steering.localToWorld(this.target);
      this.pole.set(-.33+sign*.8,1.02,.08);this.cart.body.localToWorld(this.pole);
      for(let n=0;n<5;n++)if(solveTwoBoneIk({root:shoulder,mid:elbow,end:wrist,effector:grip,target:this.target,pole:this.pole,accountForParentScale:true,tolerance:.003}).reached)break;
      this.contacts.hands[i]=grip.getWorldPosition(this.sample).distanceTo(this.target);
    }
    body.updateWorldMatrix(true,true);
  }
  dispose(){
    if(this.disposed)return;this.disposed=true;
    this.player.restoreRenderPose();
    this.player.presentVehicleDriver(({rig})=>reset(rig));
    this.parent.add(this.player.vehicleVisualRoot);this.player.vehicleVisualRoot.position.copy(this.position);this.player.vehicleVisualRoot.quaternion.copy(this.rotation);
    if(this.board)this.board.visible=this.boardVisible;
    this.player.resetRenderInterpolation();this.root.removeFromParent();
  }
}
