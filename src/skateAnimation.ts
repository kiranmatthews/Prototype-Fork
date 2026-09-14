import * as THREE from 'three';
import { solveTwoBoneIk } from './animation/ik';
import { GRAB_CONTACTS, GRIND_CONTACTS, LIP_CONTACTS, skateContactBounce, sampleDeckTrick, sampleBackflip, sampleFootFlip, sampleImpossible, type DeckTrickKind, type GrabTrickKind, type GrindStyle, type LipStyle } from './skateTricks';
import { DEFAULT_SKATEBOARD_SETTINGS, type SkateboardSettingsValue } from './skateboard/settings';
import { evaluateSkateboardSurfaceHeight } from './skateboard/model';
import type { Rail } from './rails';
import { SkateBodySpring, skateOlliePitch, SKATE_UNDER_RAIL_DEPTH, SKATE_UNDER_RAIL_HEADROOM, sampleUnderRailMotion, sampleSkateRevert } from './skateBodyMotion';

const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const clamp = THREE.MathUtils.clamp;
const smooth = (t: number) => THREE.MathUtils.smoothstep(t, 0, 1);
type Limb = { root: THREE.Object3D; mid: THREE.Object3D; end: THREE.Object3D; socket: THREE.Object3D };

export interface SkatePoseInput {
  dt: number; time: number; active: boolean; grounded: boolean; stance: number;
  yaw: number; deckYaw: number; speed: number; charge: number; balance: number;
  verticalVelocity?: number; launchVelocity?: number; mount?: number;
  underWeight?: number;
  underReturning?: boolean;
  manual: number; grab: GrabTrickKind; grabWeight: number;
  grind: GrindStyle | null; rail: Rail | null; railT: number; railDir: number;
  crossDir: number; approachSide: number; crookedSide: number;
  darkslide: boolean; ollie: boolean; flip: DeckTrickKind | null;
  nineHundred?: boolean;
  revert?: ReturnType<typeof sampleSkateRevert> | null;
  revertSign?: number;
  flipProgress: number; specialFlip: boolean; lip: LipStyle | null;
  coping?: { center: THREE.Vector3; normal: THREE.Vector3 };
  wallWeight: number; wallNormal: THREE.Vector3; wallForward: THREE.Vector3;
}

/** Final contact layer for the procedural skater. Physics never reads it.
 * Board transforms live in an un-stretched frame; endpoints use measured rig
 * lengths. This keeps the same contacts after character/board lab edits. */
export class SkateAnimation {
  readonly boardMount: THREE.Group;
  private feet: [Limb, Limb] | null;
  private hands: [Limb, Limb] | null;
  private hips: THREE.Object3D | undefined;
  private spine: THREE.Object3D | undefined;
  private spineRest = new THREE.Quaternion();
  private waist: THREE.Object3D | undefined;
  private waistRest = new THREE.Quaternion();
  private waistBefore: THREE.Quaternion | null = null;
  private head: THREE.Object3D | undefined;
  private hangFrame = new THREE.Quaternion();
  private spineBefore: THREE.Quaternion | null = null;
  private key = '';
  private age = 0;
  private airAge = 0;
  private footFlipAir = false;
  private shoveDeckYaw:number|null = null;
  private deckCaught = false;
  private impossibleActive = false;
  private wasGrounded = true;
  private bounceAge = 1;
  private pitch = 0;
  private grindYaw = 0;
  private supportZ = 0;
  private supportY = 0;
  private lastActive = false;
  private lipEntryP = new THREE.Vector3();
  private lipEntryQ = new THREE.Quaternion();
  private coping: SkatePoseInput['coping'];
  private copingAge = 1;
  private darkWeight = 0;
  private darkExitOffset = new THREE.Vector3();
  private darkPop = 0;
  private locomotionWeight = 0;
  private manualWeight = 0;
  private manualBalance = 0;
  private bodySpring = new SkateBodySpring();
  private frame = new THREE.Quaternion();
  private boardQ = new THREE.Quaternion();
  private boardP = new THREE.Vector3();
  private up = new THREE.Vector3();
  private forward = new THREE.Vector3();
  private right = new THREE.Vector3();
  private support = new THREE.Vector3();
  private temp = new THREE.Vector3();
  private q = new THREE.Quaternion();
  private matrix = new THREE.Matrix4();

  constructor(private group: THREE.Group, private body: THREE.Group,
    private rider: THREE.Group, private board: THREE.Group) {
    this.boardMount = body.getObjectByName('skateboard-scale-compensation') as THREE.Group ?? new THREE.Group();
    this.boardMount.name = 'skateboard-scale-compensation';
    body.add(this.boardMount);
    this.boardMount.add(board);
    const limb = (side: string, arm: boolean): Limb | null => {
      const names = arm ? [`shoulder-${side}`, `elbow-${side}`, `wrist-${side}`, `socket-grip-${side}`]
        : [`hip-${side}`, `knee-${side}`, `ankle-${side}`, `socket-foot-${side}`];
      const nodes = names.map(name => rider.getObjectByName(name));
      return nodes.every(Boolean) ? { root: nodes[0]!, mid: nodes[1]!, end: nodes[2]!, socket: nodes[3]! } : null;
    };
    // Stance +1: anatomical right is the leading side in this rig.
    const lf = limb('right', false), rf = limb('left', false);
    const lh = limb('right', true), rh = limb('left', true);
    this.feet = lf && rf ? [lf, rf] : null;
    this.hands = lh && rh ? [lh, rh] : null;
    this.hips = rider.getObjectByName('hips');
    this.spine = rider.getObjectByName('spine');
    if(this.spine)this.spineRest.copy(this.spine.quaternion);
    this.waist = rider.getObjectByName('torso-root');
    if(this.waist)this.waistRest.copy(this.waist.quaternion);
    this.head = rider.getObjectByName('head');
  }

  reset(): void { this.impossibleActive=false; this.deckCaught=false; this.shoveDeckYaw=null; this.footFlipAir=false; this.key = ''; this.lastActive = false; this.coping=undefined;this.copingAge=1;this.age = this.airAge = this.darkWeight = this.darkPop = this.locomotionWeight = this.manualWeight = this.manualBalance = 0; this.darkExitOffset.set(0,0,0); this.bounceAge = 1; this.wasGrounded = true; this.bodySpring.reset(); }

  /** Restore the legacy sibling frame before it authors its fallback pose. */
  prepare(): void {
    if (this.spine && this.spineBefore) this.spine.quaternion.copy(this.spineBefore);
    if (this.waist && this.waistBefore) this.waist.quaternion.copy(this.waistBefore);
    this.spineBefore = null;
    this.waistBefore = null;
    this.boardMount.scale.setScalar(1);
    this.board.scale.set(1 / 1.18, 1 / 1.36, 1 / 1.18);
  }

  private worldRotation(node: THREE.Object3D, rotation: THREE.Quaternion, orientationFrame?:THREE.Object3D, surfaceAligned=false): void {
    if(surfaceAligned){
      // A plane normal transforms by the inverse transpose, not the world
      // quaternion. Preserve the sole plane through independently scaled legs.
      node.parent!.updateWorldMatrix(true,false);
      const parent=node.parent!.matrixWorld;
      const normal=Y.clone().applyQuaternion(rotation).applyMatrix3(new THREE.Matrix3().setFromMatrix4(parent).transpose()).normalize();
      const forward=Z.clone().applyQuaternion(rotation).transformDirection(new THREE.Matrix4().copy(parent).invert());
      const right=normal.clone().cross(forward).normalize();forward.crossVectors(right,normal).normalize();
      node.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,normal,forward));
      return;
    }
    if(orientationFrame){
      const desired=orientationFrame.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation);
      const chain=new THREE.Quaternion();
      for(let parent=node.parent;parent&&parent!==orientationFrame;parent=parent.parent)chain.premultiply(parent.quaternion);
      node.quaternion.copy(chain.invert()).multiply(desired).normalize();
      return;
    }
    node.parent!.getWorldQuaternion(this.q).invert();
    node.quaternion.copy(this.q).multiply(rotation).normalize();
  }

  private putBoard(): void {
    this.board.position.copy(this.boardP);
    this.board.parent!.worldToLocal(this.board.position);
    this.worldRotation(this.board, this.boardQ);
    this.board.updateWorldMatrix(true, true);
  }

  private solve(limb: Limb, target: THREE.Vector3, rotation: THREE.Quaternion,
    pole: THREE.Vector3, weight = 1, iterations = 64, orientationFrame?:THREE.Object3D, surfaceAligned=false): number {
    // The socket is offset from the ankle/wrist. Restore its orientation after
    // each two-bone solve, then remeasure the offset (also handles scaled rigs).
    const desired = limb.end.getWorldQuaternion(new THREE.Quaternion()).slerp(rotation, weight);
    const frameDesired=orientationFrame?orientationFrame.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(desired):null;
    const chainRotation=new THREE.Quaternion();
    const orient=()=>{
      if(surfaceAligned){this.worldRotation(limb.end,desired,undefined,true);return;}
      if(!orientationFrame||!frameDesired){this.worldRotation(limb.end,desired);return;}
      // Cancel joint rotations inside the character frame, before its
      // nonuniform scale. World quaternion decomposition loses this basis.
      chainRotation.identity();
      for(let parent=limb.end.parent;parent&&parent!==orientationFrame;parent=parent.parent)
        chainRotation.premultiply(parent.quaternion);
      limb.end.quaternion.copy(chainRotation.invert()).multiply(frameDesired).normalize();
    };
    const endpoint = new THREE.Vector3(), socket = new THREE.Vector3();
    const goal = limb.socket.getWorldPosition(new THREE.Vector3()).lerp(target, weight);
    const wristTarget = new THREE.Vector3();
    for (let i = 0; i < 2; i++) {
      orient();
      limb.end.updateWorldMatrix(true, true);
      limb.end.getWorldPosition(endpoint); limb.socket.getWorldPosition(socket);
      wristTarget.copy(goal).sub(socket).add(endpoint);
      solveTwoBoneIk({ root: limb.root, mid: limb.mid, end: limb.end, target: wristTarget,
        pole, tolerance: .001, accountForParentScale: true });
    }
    // Refine in each joint's parent coordinates: a world-space analytical
    // two-bone solve alone leaves centimetres of error under the stretched
    // cartoon torso. Local CCD respects those actual affine transforms.
    const from = new THREE.Vector3(), to = new THREE.Vector3();
    // Nearly straight legs converge more slowly than trick tucks. Allow the
    // shallow charge/takeoff pose to finish the same socket solve; most limbs
    // still exit at the 1 mm tolerance before reaching this bound.
    for (let i = 0; i < iterations; i++) {
      orient();
      if (limb.socket.getWorldPosition(socket).distanceTo(goal) < .001) break;
      for (const joint of [limb.mid, limb.root]) {
        joint.parent!.updateWorldMatrix(true, false);
        from.copy(limb.socket.getWorldPosition(socket)); joint.parent!.worldToLocal(from); from.sub(joint.position).normalize();
        to.copy(goal); joint.parent!.worldToLocal(to); to.sub(joint.position).normalize();
        joint.quaternion.premultiply(new THREE.Quaternion().setFromUnitVectors(from, to));
        orient();
      }
    }
    orient();
    return limb.socket.getWorldPosition(socket).distanceTo(target);
  }

  apply(p: SkatePoseInput): boolean {
    if (!p.active || !this.feet || !this.hands || !this.hips) { this.impossibleActive=false;this.deckCaught=false;this.shoveDeckYaw=null; this.lastActive = false; this.darkWeight = this.darkPop = this.manualWeight = this.manualBalance = 0; return false; }
    this.darkWeight = clamp(this.darkWeight + (p.darkslide ? 1 : -1) * p.dt / .22, 0, 1);
    const dark = smooth(this.darkWeight);
    this.darkPop = p.darkslide ? Math.sin(Math.PI*dark) : this.darkPop*Math.exp(-20*p.dt);
    const darkPop = this.darkPop;
    const underProgress=clamp(p.underWeight??0,0,1);
    const underMotion=sampleUnderRailMotion(underProgress,p.underReturning,!p.grind);
    const under=underMotion.bodyDrop;
    const s = (this.board.userData.settings ?? DEFAULT_SKATEBOARD_SETTINGS) as SkateboardSettingsValue;
    const scale = s.overallScale, grip = s.boardToGroundDistance * scale;
    const surface = (x: number, z: number) => (s.boardToGroundDistance + evaluateSkateboardSurfaceHeight(s, x / scale, z / scale)) * scale;
    const frontZ = s.frontTruckLocalZ * scale, rearZ = s.rearTruckLocalZ * scale;
    const front = p.stance > 0 ? 0 : 1, back = 1 - front;
    const key = p.wallWeight > .01 ? 'wallride' : p.grind ? `${p.grind}:${p.darkslide}` : p.lip ? `lip:${p.lip}` : p.manual ? `manual:${p.manual}`
      : p.grabWeight > .01 ? `grab:${p.grab}` : p.grounded ? 'ride' : 'air';
    if (key !== this.key || !this.lastActive) {
      if(p.lip && this.lastActive){this.lipEntryP.copy(this.boardP);this.lipEntryQ.copy(this.boardQ);}
      else if(p.lip){this.lipEntryP.copy(this.board.getWorldPosition(new THREE.Vector3()));this.lipEntryQ.copy(this.board.getWorldQuaternion(new THREE.Quaternion()));}
      this.age = 0; this.key = key;
      // Taking off is extension, not another ground-contact compression.
      if (key !== 'air') this.bounceAge = 0;
    }
    else this.age += p.dt;
    if (!p.grounded && this.wasGrounded) this.airAge = 0;
    else if (!p.grounded) this.airAge += p.dt;
    if (p.grounded && !this.wasGrounded) this.bounceAge = 0;
    this.bounceAge += p.dt; this.wasGrounded = p.grounded;
    const bounce = skateContactBounce(this.bounceAge);
    const breathe = Math.sin(p.time * 5.6) * .016 * Math.min(1, Math.abs(p.speed) / 5);
    const scoopFlip=p.flip==='varial'||p.flip==='varial-heel'||p.flip==='hardflip'||p.flip==='inward-heel';
    // Completing a shove swaps the material nose/tail. Preserve the same
    // world tilt across that yaw handoff instead of tipping through level.
    if(this.shoveDeckYaw!==null&&Math.cos(p.deckYaw-this.shoveDeckYaw)<0){this.pitch*=-1;this.deckCaught=true;}
    if(this.impossibleActive&&p.flip!=='imposs')this.deckCaught=true;
    this.impossibleActive=p.flip==='imposs';
    if(p.grounded||p.flip&&p.flip!=='shove'&&p.flip!=='imposs'&&!scoopFlip||p.grabWeight>.001||p.grind||p.lip||p.wallWeight>.001)this.deckCaught=false;
    this.shoveDeckYaw=p.flip==='shove'||scoopFlip?p.deckYaw:null;
    const backflip = p.specialFlip ? sampleBackflip(p.flipProgress) : null;
    const footFlip=(p.flip==='kick'||p.flip==='heel'||p.flip==='shove'||p.flip==='varial'||p.flip==='varial-heel'||p.flip==='hardflip'||p.flip==='inward-heel')&&!backflip?sampleFootFlip(p.flip,p.flipProgress):null;
    const impossible=p.flip==='imposs'?sampleImpossible(p.flipProgress):null;
    if(p.grounded)this.footFlipAir=false;
    if(footFlip||impossible)this.footFlipAir=true;
    let deckAlignment=backflip?.alignment??(footFlip||impossible?smooth(p.flipProgress/.16):this.deckCaught?1:0);
    const grabKind = backflip ? 'mute' : p.grab;
    const grab = GRAB_CONTACTS[grabKind];
    const gw = backflip ? backflip.grab : clamp(p.grabWeight, 0, 1);
    const indy=grabKind==='indy'&&gw>.001&&!p.nineHundred;
    const melon=grabKind==='melon'&&gw>.001&&!p.nineHundred;
    const nosegrab=grabKind==='nose'&&gw>.001&&!p.nineHundred;
    const tailgrab=grabKind==='tail'&&gw>.001&&!p.nineHundred;
    const endGrab=nosegrab||tailgrab,endDirection=nosegrab?1:-1;
    const method=grabKind==='method'&&gw>.001&&!p.nineHundred;
    const mute=grabKind==='mute'&&gw>.001&&!backflip&&!p.nineHundred;
    const japan=grabKind==='japan'&&gw>.001&&!p.nineHundred;
    const japanFold=smooth(gw);
    const japanFrame=this.group.getWorldQuaternion(new THREE.Quaternion()).multiply(new THREE.Quaternion().setFromAxisAngle(Y,p.yaw+p.stance*Math.PI/2));
    const japanToe=Z.clone().applyQuaternion(japanFrame);
    const stalefish=grabKind==='stalefish'&&gw>.001&&!p.nineHundred;
    // Load the knees first, then fold sideways into the trailing heel grab.
    const grabFold=stalefish?smooth((gw-.12)/.88):smooth(gw);
    const waistGrab=indy||melon||endGrab||method||mute||stalefish||japan;
    if(waistGrab)deckAlignment=smooth(gw);
    const footFrame=deckAlignment>.999?this.body:undefined;
    const flipPose = p.flip && !backflip ? sampleDeckTrick(p.flip, p.flipProgress) : null;
    const uprightGrind=!!p.grind && !p.darkslide && underProgress<.001;
    const locomotionTarget = waistGrab || uprightGrind || p.nineHundred || p.lip || backflip || footFlip || impossible || (key === 'ride' || key === 'air' || p.manual !== 0 || p.darkslide) && !p.flip && gw < .01 ? 1 : 0;
    if (!this.lastActive) { this.locomotionWeight = locomotionTarget; this.bodySpring.reset(p.charge); }
    else this.locomotionWeight += (locomotionTarget-this.locomotionWeight)*(1-Math.exp(-16*p.dt));
    this.manualWeight += ((p.manual ? 1 : 0)-this.manualWeight)*(1-Math.exp(-12*p.dt));
    if (!p.manual && this.manualWeight < .001) this.manualWeight = 0;
    this.manualBalance += (clamp(p.balance,-1,1)-this.manualBalance)*(1-Math.exp(-10*p.dt));
    const springFlex = this.bodySpring.step(p.dt, {
      grounded:p.grounded || uprightGrind || p.darkslide || !!p.nineHundred,
      charge:backflip?0:p.revert ? p.revert.knee : p.nineHundred||p.lip?0:uprightGrind?p.charge*.35:p.charge,
      verticalVelocity:p.verticalVelocity??0, launchVelocity:p.launchVelocity??0,
      contactBounce:p.grounded||uprightGrind?bounce:0, mount:clamp(p.mount??0,0,1),
      manual:p.manual !== 0 || !!p.lip || uprightGrind,
    });
    const bodyFlex=waistGrab?THREE.MathUtils.lerp(springFlex,method?1.10:stalefish?1.05:melon||mute?.95:endGrab?1.05:.65,stalefish?smooth(gw/.65):smooth(gw)):backflip?THREE.MathUtils.lerp(springFlex,.62,backflip.compression):impossible?THREE.MathUtils.lerp(springFlex,.65,impossible.wrap):p.revert?Math.min(1.24,springFlex+.10*p.revert.knee):springFlex;
    if(p.nineHundred && gw>0 && this.spine){
      this.spineBefore=this.spine.quaternion.clone();
      this.spine.rotation.x-=.50*smooth(gw);
    }

    this.group.getWorldQuaternion(this.frame);
    this.frame.multiply(this.q.setFromAxisAngle(Y, p.yaw));
    this.up.copy(Y).applyQuaternion(this.frame);
    this.forward.copy(Z).applyQuaternion(this.frame);
    this.right.copy(X).applyQuaternion(this.frame);
    this.group.getWorldPosition(this.support);
    let pitch = 0, yaw = 0, roll = 0, pivotY = 0, pivotZ = 0;
    if (p.grind && p.rail) {
      const tangent = p.rail.tangentAt(p.railT).multiplyScalar(p.railDir).normalize();
      this.right.crossVectors(Y, tangent).normalize();
      this.up.crossVectors(tangent, this.right).normalize();
      this.forward.copy(tangent);
      this.frame.setFromRotationMatrix(this.matrix.makeBasis(this.right, this.up, tangent));
      this.hangFrame.copy(this.frame);
      // Rail visuals use a 0.09 m tube, including the ordinary coping rails.
      this.support.copy(p.rail.pointAt(p.railT)).addScaledVector(this.up, .09);
      const d = GRIND_CONTACTS[p.grind];
      pitch = d.pitch;
      yaw = (p.darkslide ? Math.PI/2 : d.yaw) * (p.grind === 'smith' || p.grind === 'feeble' ? p.approachSide
        : p.grind === 'crook' ? p.crookedSide : -p.crossDir);
      if (p.grind === 'smith' || p.grind === 'feeble') yaw *= Math.cos(p.deckYaw) >= 0 ? 1 : -1;
      pivotZ = d.support === 'front-truck' ? frontZ : d.support === 'rear-truck' ? rearZ : 0;
      pivotY = (d.support === 'deck' ? s.boardToGroundDistance - s.deckThickness
        : s.wheelRadius - s.truckHangerRadius) * scale;
      if (dark > 0) pivotY = THREE.MathUtils.lerp(pivotY, grip, dark);
    } else if (p.manual) {
      // Balance never tips through flat into the other named manual.
      pitch = p.manual > 0 ? clamp(-.22 - p.balance * .12, -.38, -.07) : clamp(.22 - p.balance * .12, .07, .38);
      pivotZ = p.manual > 0 ? rearZ : frontZ;
    } else if (p.lip) {
      this.frame.setFromAxisAngle(Y, Math.PI + p.yaw);
      this.up.copy(Y);this.forward.copy(Z).applyQuaternion(this.frame);this.right.copy(X).applyQuaternion(this.frame);
      // Authored coping centre is 5 cm above the pipe's analytic lip.
      this.support.addScaledVector(this.up, .05 + .09);
      const d = LIP_CONTACTS[p.lip];
      yaw = d.yaw; pitch = d.pitch + clamp(p.balance * .06, -.06, .06);
      pivotZ = p.lip === 'nose' ? s.deckNoseLength * scale * .94 : p.lip === 'tail' ? -s.deckTailLength * scale * .94 : 0;
      pivotY = p.lip === 'axle' ? (s.wheelRadius - s.truckHangerRadius) * scale : surface(0, pivotZ) - s.deckThickness * scale;
    } else if (backflip) {
      pitch = backflip.nosePitch;
    } else if (impossible) {
      pitch=impossible.nosePitch*(Math.cos(p.deckYaw)<0?-1:1);
    } else if (footFlip) {
      pitch = footFlip.nosePitch*((p.flip==='shove'||scoopFlip)&&Math.cos(p.deckYaw)<0?-1:1);
    } else if (p.ollie && !p.grounded && !p.flip && !this.footFlipAir && gw < .01) {
      pitch = skateOlliePitch(this.airAge, p.verticalVelocity??0, p.launchVelocity??1);
    }
    const ease = 1 - Math.exp(-22 * p.dt);
    if (!this.lastActive) { this.pitch = pitch; this.grindYaw = yaw; this.supportZ = pivotZ; this.supportY = pivotY; }
    else {
      this.pitch += (pitch - this.pitch) * ease;
      this.grindYaw += (yaw - this.grindYaw) * ease;
      this.supportZ += (pivotZ - this.supportZ) * ease;
      this.supportY += (pivotY - this.supportY) * ease;
    }
    this.lastActive = true;
    this.boardQ.copy(this.frame).multiply(this.q.setFromAxisAngle(Y, p.deckYaw + this.grindYaw))
      .multiply(this.q.setFromAxisAngle(X, this.pitch + (backflip?0:japan?grab.pitch*japanFold:grab.pitch*gw)))
      .multiply(this.q.setFromAxisAngle(Z, roll + Math.PI * dark + (backflip?0:japan?grab.roll*p.stance*(Math.cos(p.deckYaw)<0?-1:1)*japanFold:grab.roll*p.stance*gw)));
    // The support point is geometric, not the rig origin. Rocking the deck
    // cannot bury one truck or lift the one the named grind is loading.
    this.temp.set(0, this.supportY, this.supportZ).applyQuaternion(this.boardQ);
    this.boardP.copy(this.support).sub(this.temp);
    if (!p.grind && !p.manual && !p.lip) this.boardP.copy(this.support).addScaledVector(this.darkExitOffset,dark);
    if(p.grind && p.darkslide)this.darkExitOffset.copy(this.boardP).sub(this.group.getWorldPosition(new THREE.Vector3()));
    // A real exit ollie already supplies lift; do not add a second flip pop.
    this.boardP.addScaledVector(this.up, (backflip?0:.30*gw) + .18 * darkPop);
    if(japan)this.boardP.addScaledVector(japanToe,-.45*japanFold).addScaledVector(this.up,.52*japanFold);
    if(footFlip){
      const centreY=surface(0,0)-s.deckThickness*scale*.5;
      this.boardP.addScaledVector(this.up,centreY).addScaledVector(Y.clone().applyQuaternion(this.boardQ),-centreY);
    }
    if (p.lip) {
      const enter=smooth(this.age/.18);
      this.boardQ.copy(this.lipEntryQ.clone().slerp(this.boardQ,enter));
      this.boardP.copy(this.lipEntryP.clone().lerp(this.boardP,enter)).addScaledVector(Y,.20*Math.sin(Math.PI*enter));
      const boardUp=Y.clone().applyQuaternion(this.boardQ);
      this.up.copy(Y).lerp(boardUp,1-enter).normalize();
      const tilt=new THREE.Quaternion().setFromUnitVectors(Y,this.up);
      this.worldRotation(this.rider,this.rider.getWorldQuaternion(new THREE.Quaternion()).premultiply(tilt));
    }
    if(p.coping){this.coping=p.coping;this.copingAge=0;}else this.copingAge+=p.dt;
    if(this.coping && this.copingAge<.8 && !p.grind){
      // Stay on the grip side of the coping through crest, catch and release.
      // Push along the deck normal: inward on the climbing board, upward on
      // the stall. The extra 15 mm protects interpolated review frames too.
      const {center,normal}=this.coping,radius=.105,push=Y.clone().applyQuaternion(this.boardQ);
      const nx=push.dot(normal),ny=push.y,n=Math.hypot(nx,ny);
      let lift=0;
      if(n>.2)for(let iz=0;iz<=64;iz++)for(let ix=0;ix<=8;ix++)for(const layer of [0,1]){
        const x=(ix/8*2-1)*s.deckHalfWidth*scale,z=(-s.deckTailLength+(s.deckTailLength+s.deckNoseLength)*iz/64)*scale;
        const point=new THREE.Vector3(x,surface(x,z)-layer*s.deckThickness*scale,z).applyQuaternion(this.boardQ).add(this.boardP).sub(center);
        const cross=point.dot(normal),across=(cross*ny-point.y*nx)/n,along=(cross*nx+point.y*ny)/n;
        if(Math.abs(across)<radius)lift=Math.max(lift,(Math.sqrt(radius*radius-across*across)-along)/n);
      }
      this.boardP.addScaledVector(push,lift);
    }
    if (p.wallWeight > .001) {
      const wallForward = p.wallForward.clone().addScaledVector(p.wallNormal, -p.wallForward.dot(p.wallNormal)).normalize();
      const wallRight = new THREE.Vector3().crossVectors(p.wallNormal, wallForward).normalize();
      const wallQ = new THREE.Quaternion().setFromRotationMatrix(this.matrix.makeBasis(wallRight, p.wallNormal, wallForward));
      this.boardQ.slerp(wallQ, p.wallWeight);
      this.boardP.lerp(this.support.clone().addScaledVector(p.wallNormal, -.55).addScaledVector(Y, .34), p.wallWeight);
      this.up.copy(Y).applyQuaternion(this.boardQ);
      this.forward.copy(Z).applyQuaternion(this.boardQ);
      this.right.copy(X).applyQuaternion(this.boardQ);
    }

    const hangAnchor = p.grind && p.rail ? p.rail.pointAt(p.railT)
      : this.group.getWorldPosition(new THREE.Vector3()).addScaledVector(Y,SKATE_UNDER_RAIL_DEPTH);
    if (underProgress > 0) {
      const hangQ = this.hangFrame.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Y,Math.PI/2));
      const hangUp = Y.clone().applyQuaternion(this.hangFrame);
      const hangBoard = hangAnchor.clone().addScaledVector(hangUp,.09)
        .sub(new THREE.Vector3(0,(s.boardToGroundDistance-s.deckThickness)*scale,0).applyQuaternion(hangQ));
      this.boardQ.slerp(hangQ,underMotion.boardTurn);this.boardP.lerp(hangBoard,underMotion.boardTurn);
      this.boardP.addScaledVector(Z.clone().applyQuaternion(this.hangFrame),underMotion.boardAdvance);
      if(p.grind&&!p.underReturning)this.boardP.addScaledVector(hangUp,.12*Math.sin(Math.PI*underMotion.boardTurn));
      // On release the board passes beside the head on its way to the feet.
      if (!p.grind) this.boardP.addScaledVector(X.clone().applyQuaternion(this.hangFrame),2.2*underMotion.boardSwing);
      this.worldRotation(this.rider,this.rider.getWorldQuaternion(new THREE.Quaternion()).slerp(this.hangFrame,underMotion.boardTurn));
    }

    // Cancel the body's nonuniform cartoon proportions BEFORE board rotation.
    this.boardMount.scale.copy(this.body.scale).set(1 / this.body.scale.x, 1 / this.body.scale.y, 1 / this.body.scale.z);
    this.board.scale.setScalar(1);
    this.putBoard();

    const parity = Math.cos(p.deckYaw) >= 0 ? 1 : -1;
    // A relaxed, narrower stance for ride/load/ollie only. Authored trick
    // contacts keep their established wider positions; blend at the handoff.
    const footSpan = Math.min((frontZ - rearZ) * .40, p.wallWeight > .01 ? .34 : .50) * (1-.25*this.locomotionWeight) * (p.lip ? .8 : 1);
    const footYaw = p.stance * parity * Math.PI / 2;
    const catchQ = this.boardQ.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Z, -Math.PI * dark));
    const footQ = catchQ.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Y, footYaw));
    if(waistGrab || uprightGrind || backflip || footFlip || impossible || this.deckCaught){
      // Japan keeps its torso frame independent of the board behind it.
      // Other supported grabs stand from the deck's plane. Folding the old whole-body
      // balance lean into these hips overextended one leg in Smith/Feeble.
      // Turn before the body's nonuniform proportion scale; a counter-turn
      // inside that scale shears the leg frame and can pull a sole loose.
      const alignment=waistGrab||backflip||footFlip||impossible||this.deckCaught?deckAlignment:1;
      this.worldRotation(this.body,this.body.getWorldQuaternion(new THREE.Quaternion()).slerp(japan?japanFrame:footQ,alignment));
      this.putBoard();
      if(!japan)this.up.lerp(Y.clone().applyQuaternion(catchQ),alignment).normalize();
      if(this.spine && uprightGrind){
        this.spineBefore=this.spine.quaternion.clone();
        const lean=new THREE.Quaternion().setFromAxisAngle(this.forward,.14*p.balance);
        this.worldRotation(this.spine,this.spine.getWorldQuaternion(new THREE.Quaternion()).premultiply(lean));
      }
    }
    const shove=(p.flip==='shove'||scoopFlip)&&footFlip&&flipPose;
    let shoveQ:THREE.Quaternion|null=null,shoveP:THREE.Vector3|null=null;
    if(shove){
      const centre=new THREE.Vector3(0,surface(0,0)-s.deckThickness*scale*.5,0);
      const centreWorld=centre.clone().applyQuaternion(this.boardQ).add(this.boardP);
      shoveQ=this.boardQ.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Y,flipPose!.yaw*p.stance))
        .multiply(new THREE.Quaternion().setFromAxisAngle(X,flipPose!.pitch*parity))
        .multiply(new THREE.Quaternion().setFromAxisAngle(Z,-flipPose!.roll*p.stance*parity));
      shoveP=centreWorld.sub(centre.applyQuaternion(shoveQ));
    }
    const soleRotations=[footQ.clone(),footQ.clone()];
    // Present the heel to the edge, then flatten the shoe before the catch.
    // Include that ankle orientation when measuring the leading leg's reach.
    if(footFlip){
      soleRotations[front].multiply(new THREE.Quaternion().setFromAxisAngle(X,-footFlip.heelLead));
      if(shoveQ)soleRotations[back].slerp(shoveQ.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Y,footYaw)),footFlip.rearContact);
      soleRotations[back].multiply(new THREE.Quaternion().setFromAxisAngle(X,footFlip.rearToe));
    }
    if(impossible)soleRotations[back].multiply(new THREE.Quaternion().setFromAxisAngle(Y,impossible.rearYaw))
      .multiply(new THREE.Quaternion().setFromAxisAngle(X,impossible.rearToe))
      .multiply(new THREE.Quaternion().setFromAxisAngle(Z,impossible.rearRoll));
    const footTargets = [new THREE.Vector3(), new THREE.Vector3()];
    for (const i of [front, back]) {
      let z = (i === front ? 1 : -1) * footSpan * parity;
      const supportKind = p.grind ? GRIND_CONTACTS[p.grind].support : null;
      if (supportKind === 'front-truck' || p.manual < 0) z = z > 0 ? frontZ : -.10 * scale;
      if (supportKind === 'rear-truck' || p.manual > 0) z = z < 0 ? rearZ : .10 * scale;
      // Darkslide feet stay between the trucks, straddling the rail on a
      // narrow, horizontal catch plane while the deck rolls underneath.
      if (dark > 0) z = THREE.MathUtils.lerp(z,Math.sign(z)*Math.min(.34*scale,frontZ*.60,-rearZ*.60),dark);
      footTargets[i].set(0, surface(0, z) + .006, z).applyQuaternion(catchQ).add(this.boardP);
      if (dark > 0) {
        const underside = new THREE.Vector3(0,-(s.boardToGroundDistance-s.deckThickness)*scale+.006,z)
          .applyQuaternion(catchQ).add(this.boardP);
        footTargets[i].lerp(underside, dark).addScaledVector(this.up, .22 * darkPop);
      }
    }
    if(footFlip){
      // Slide the leading shoe along the raised nose and off its edge before
      // retracting it. The trailing foot catches first; both travel DOWN to
      // the deck, whose centre never follows a foot or a leg deformation.
      const flickLocal=new THREE.Vector3((s.deckHalfWidth*scale+footFlip.sideReach)*p.stance*parity*footFlip.flickSign*footFlip.flick,0,footFlip.noseReach*parity*footFlip.flick);
      footTargets[front].add(flickLocal.applyQuaternion(catchQ)).addScaledVector(this.up,footFlip.frontLift);
      if(shoveQ&&shoveP){
        const tail=(parity>0?s.deckTailLength:s.deckNoseLength)*scale*.86;
        const scoopLocal=new THREE.Vector3(-(s.deckHalfWidth*scale+.12)*p.stance*parity*footFlip.scoopSign*footFlip.scoop,0,-(tail-footSpan)*parity*footFlip.scoop);
        footTargets[back].add(scoopLocal.applyQuaternion(catchQ)).addScaledVector(this.up,footFlip.backLift);
        const tailZ=-THREE.MathUtils.lerp(footSpan,tail,smooth(p.flipProgress/(scoopFlip?.09:.14)))*parity;
        const tailContact=new THREE.Vector3(0,surface(0,tailZ)+.008,tailZ).applyQuaternion(shoveQ).add(shoveP);
        footTargets[back].lerp(tailContact,footFlip.rearContact);
      }else footTargets[back].addScaledVector(this.up,footFlip.backLift);
    }
    if(impossible){
      footTargets[back].add(new THREE.Vector3(impossible.rearSide*p.stance*parity,0,impossible.rearBack*parity).applyQuaternion(catchQ)).addScaledVector(this.up,impossible.rearLift);
      footTargets[front].addScaledVector(this.up,impossible.frontLift)
        .add(new THREE.Vector3(impossible.frontOut*p.stance*parity,0,0).applyQuaternion(catchQ));
    }
    // Pelvis follows the weighted truck while both feet retain their own
    // contact. The bounce is absorbed by knees, never by the rail/deck.
    const pelvis = footTargets[0].clone().add(footTargets[1]).multiplyScalar(.5);
    const load = p.grind ? pivotZ * .24 : p.manual ? pivotZ * .22 : 0;
    pelvis.addScaledVector(Z.clone().applyQuaternion(this.boardQ), load);
    if(stalefish)pelvis.addScaledVector(Z.clone().applyQuaternion(footQ),-.40*grabFold);
    if(mute)pelvis.addScaledVector(Z.clone().applyQuaternion(footQ),-.24*smooth(gw));
    if(method)pelvis.addScaledVector(Z.clone().applyQuaternion(footQ),-.50*smooth(gw));
    if(melon)pelvis.addScaledVector(Z.clone().applyQuaternion(footQ),-.44*smooth(gw));
    if(endGrab)pelvis.addScaledVector(Z.clone().applyQuaternion(footQ),-.18*smooth(gw)).addScaledVector(Z.clone().applyQuaternion(this.boardQ),-.18*endDirection*smooth(gw));
    // Manuals balance at standing height too; the raised truck determines
    // the leg asymmetry instead of forcing both knees into the grab tuck.
    let locomotionHeight = .46;
    if (this.locomotionWeight > .001) {
      const scaleY = this.rider.getWorldScale(new THREE.Vector3()).y;
      const hipWorld = this.hips.getWorldPosition(new THREE.Vector3());
      locomotionHeight = Infinity;
      for (let i = 0; i < 2; i++) {
        const leg = this.feet[i];
        // Measure unbent lengths: folded world lengths under the non-uniform
        // cartoon scale underestimate the height of a standing-idle stance.
        const upper = leg.mid.position.length() * leg.root.scale.y * scaleY;
        const lower = leg.end.position.length() * leg.mid.scale.y * scaleY;
        this.worldRotation(leg.end, soleRotations[i],footFrame,waistGrab||!!footFlip||!!impossible||this.deckCaught);
        leg.end.updateWorldMatrix(true, true);
        const ankleOffset = leg.end.getWorldPosition(new THREE.Vector3())
          .sub(leg.socket.getWorldPosition(new THREE.Vector3()));
        const hipOffset = leg.root.getWorldPosition(new THREE.Vector3()).sub(hipWorld);
        const delta = footTargets[i].clone().add(ankleOffset).sub(pelvis).sub(hipOffset);
        const vertical = delta.dot(this.up);
        const horizontalSq = Math.max(0, delta.lengthSq() - vertical * vertical);
        // Leave some reach in reserve for the sideways stance and affine
        // parent scale; otherwise one knee locks while its sole floats.
        const reachSq = upper * upper + lower * lower + 2 * upper * lower * Math.cos(bodyFlex);
        locomotionHeight = Math.min(locomotionHeight, vertical + Math.sqrt(Math.max(0, reachSq - horizontalSq)));
      }
    }
    const trickHeight = .46 - .29 * gw - .065 * p.charge - .11 * bounce + breathe;
    const restingBreath = Math.sin(p.time*5.6)*.005*(.35+.65*Math.min(1,Math.abs(p.speed)/5));
    // Keep a little reach in reserve under the grind's nonuniform body lean.
    const reserve=waistGrab ? .025*smooth(gw) : uprightGrind ? .025 : backflip ? .025*Math.max(backflip.compression,backflip.rebound) : footFlip ? (scoopFlip?.085:.025)*footFlip.tuck : impossible ? .025*impossible.wrap : 0;
    const height = THREE.MathUtils.lerp(trickHeight, locomotionHeight+restingBreath-reserve, this.locomotionWeight);
    pelvis.addScaledVector(this.up, height);
    pelvis.addScaledVector(Y, .14 * p.wallWeight);
    if(japan){
      // The pelvis stays in front of the raised board; knees fold down into
      // the free space ahead of it instead of squashing onto the griptape.
      const tuck=footTargets[0].clone().add(footTargets[1]).multiplyScalar(.5).addScaledVector(japanToe,.50).addScaledVector(this.up,.05);
      pelvis.lerp(tuck,japanFold);
    }
    if (flipPose && !footFlip && !impossible) {
      for (let i = 0; i < 2; i++) {
        if (p.flip === 'imposs' && i === back) continue;
        const lift = p.flip === 'imposs' ? .38 * flipPose.tuck : flipPose.riderLift;
        footTargets[i].addScaledVector(this.up, lift);
        if (i === front && p.flip === 'imposs') footTargets[i].addScaledVector(this.right, .45 * p.stance * flipPose.tuck);
        else if (i === front && Math.abs(flipPose.roll) > 0)
          footTargets[i].addScaledVector(this.right, .15 * p.stance * flipPose.flick);
      }
      pelvis.addScaledVector(this.up, flipPose.riderLift * .7);
    }
    if (underProgress > 0 && this.head) {
      const headBox = new THREE.Box3().setFromObject(this.head);
      const headAboveHips = (headBox.isEmpty()?this.head.getWorldPosition(new THREE.Vector3()).y+.7:headBox.max.y)
        -this.hips.getWorldPosition(new THREE.Vector3()).y;
      const hangingPelvis=hangAnchor.clone();hangingPelvis.y-=headAboveHips+SKATE_UNDER_RAIL_HEADROOM;
      if(this.spine && underMotion.torsoDuck>0){
        this.spineBefore=this.spine.quaternion.clone();
        const tuck=new THREE.Quaternion().setFromAxisAngle(Z.clone().applyQuaternion(this.hangFrame),-1.20*underMotion.torsoDuck);
        this.worldRotation(this.spine,this.spine.getWorldQuaternion(new THREE.Quaternion()).premultiply(tuck));
      }
      // During release the rider falls independently while the deck returns
      // below the feet; the moving board must not pull the body upward.
      if(!p.grind)pelvis.copy(this.support).addScaledVector(Y,grip+height);
      pelvis.lerp(hangingPelvis,under);
      if(p.grind){pelvis.x=hangAnchor.x;pelvis.z=hangAnchor.z;}
      pelvis.addScaledVector(Y,underMotion.springY);
    }
    this.hips.getWorldPosition(this.temp);
    const delta = pelvis.clone().sub(this.temp);
    const localZero = this.body.worldToLocal(this.temp.copy(pelvis));
    const oldLocal = this.body.worldToLocal(pelvis.clone().sub(delta));
    this.rider.position.add(localZero.sub(oldLocal));
    this.body.updateWorldMatrix(true, true);
    let footError = 0;
    for (let i = 0; i < 2; i++) {
      const kneeForward=japan?japanToe:waistGrab||p.lip||uprightGrind||backflip||footFlip||impossible||this.deckCaught?Z.clone().applyQuaternion(footQ):this.right.clone().multiplyScalar(p.stance);
      const pole = this.feet[i].root.getWorldPosition(new THREE.Vector3())
        .addScaledVector(kneeForward, .65).addScaledVector(this.forward, i === front ? .12 : -.12);
      if(japan)pole.addScaledVector(this.up,-.70*japanFold);
      const footWeight=underProgress>0?underMotion.footContact:1;
      const airFeet=underProgress>0?underMotion.airFeet:0;
      const target=footTargets[i].clone();
      if(airFeet>0){
        // The jump keeps both shoes visibly above the deck before the legs
        // relax into the hang. Free FK must not drop them through the board.
        const tuck=pelvis.clone().addScaledVector(Y,-.36-.16*under)
          .addScaledVector(Z.clone().applyQuaternion(this.boardQ),(i===front?1:-1)*footSpan*.65);
        target.lerp(tuck,1-footWeight);
      }
      const solveWeight=Math.max(footWeight,airFeet);
      // Shortened Backflip legs need more refinement against the unchanged
      // shoe socket offset; the normal convergence tolerance still exits early.
      if(solveWeight>0){
        const soleQ=soleRotations[i];
        let error=this.solve(this.feet[i],target,soleQ,pole,solveWeight,waistGrab||backflip||footFlip||impossible||this.deckCaught?192:64,footFrame,waistGrab||!!footFlip||!!impossible||this.deckCaught);
        if((waistGrab||footFlip||impossible||this.deckCaught)&&(!scoopFlip||footFlip!.rearContact>.001||footFlip!.turn>.999)){
          // Keep both feet seated after the half-turn while the skater falls;
          // handing back to the old ankle solve at the catch caused a dip.
          // Fit the visible sole at the nose corner too. The contact socket
          // alone cannot account for the curved nose and enlarged footwear.
          const sole=this.feet[i].end.getObjectByName(`sole-${i===0?'right':'left'}`) as THREE.Mesh|undefined;
          if(sole){
            const surfaces=[sole];
            // When the toes lift, the rounded heel upper can touch the edge
            // before the outsole. Fit that visible shoe envelope as well.
            if(waistGrab||p.flip==='heel'||p.flip==='shove'||scoopFlip||impossible||this.deckCaught)for(const part of ['shoe','shoe-foxing']){
              const mesh=this.feet[i].end.getObjectByName(`${part}-${i===0?'right':'left'}`) as THREE.Mesh|undefined;
              if(mesh)surfaces.push(mesh);
            }
            const point=new THREE.Vector3();let clearance=0;
            for(const mesh of surfaces){
              mesh.updateWorldMatrix(true,false);
              const supportMatrix=shoveQ&&shoveP?new THREE.Matrix4().compose(shoveP,shoveQ,new THREE.Vector3(1,1,1)):this.board.matrixWorld;
              const toBoard=new THREE.Matrix4().copy(supportMatrix).invert().multiply(mesh.matrixWorld);
              for(let j=0;j<mesh.geometry.attributes.position.count;j++){
                point.fromBufferAttribute(mesh.geometry.attributes.position,j).applyMatrix4(toBoard);
                if(Math.abs(point.x)>s.deckHalfWidth*scale||point.z< -s.deckTailLength*scale||point.z>s.deckNoseLength*scale)continue;
                // Also protect interpolation between the rapid departure keys.
                clearance=Math.max(clearance,surface(point.x,point.z)+.003+.020*(footFlip?.departure??0)-point.y);
              }
            }
            if(clearance>0){target.addScaledVector(Y.clone().applyQuaternion(shoveQ??catchQ),clearance);error=this.solve(this.feet[i],target,soleQ,pole,1,192,footFrame,true);}
          }
        }
        footError=Math.max(footError,error);
      }
    }

    const inward=p.flip==='inward-heel';
    const balanceMotion=impossible??(scoopFlip?footFlip:null);
    if(balanceMotion&&balanceMotion.arms>0){
      if(this.spine){this.spineBefore??=this.spine.quaternion.clone();this.spine.rotation.y+=balanceMotion.counter*p.stance;}
      for(const i of [front,back]){
        const hand=this.hands[i],other=this.hands[1-i];
        const shoulder=hand.root.getWorldPosition(new THREE.Vector3());
        const outward=shoulder.clone().sub(other.root.getWorldPosition(new THREE.Vector3()));
        outward.addScaledVector(this.up,-outward.dot(this.up)).normalize();
        const toeDirection=Z.clone().applyQuaternion(footQ);
        const armHeight=inward?(i===front?.12:.52):(i===front?(scoopFlip?.38:.48):(scoopFlip?.10:.28));
        const armForward=inward?(i===front?.32:-.20):(i===front?.08:(scoopFlip?-.35:-.18));
        const direction=outward.addScaledVector(this.up,armHeight-(scoopFlip?.50:.65)*balanceMotion.armSweep)
          .addScaledVector(toeDirection,armForward+(scoopFlip?.50:.42)*balanceMotion.armSweep).normalize();
        const reach=shoulder.distanceTo(hand.mid.getWorldPosition(new THREE.Vector3()))+
          hand.mid.getWorldPosition(new THREE.Vector3()).distanceTo(hand.end.getWorldPosition(new THREE.Vector3()));
        const relative=hand.end.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(hand.socket.getWorldQuaternion(new THREE.Quaternion()));
        const along=(axis:THREE.Vector3)=>{
          const y=axis.clone().negate(),x=y.clone().cross(this.up);
          if(x.lengthSq()<1e-8)x.crossVectors(y,this.forward);x.normalize();
          return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,x.clone().cross(y).normalize())).multiply(relative.clone().invert());
        };
        const target=shoulder.clone().addScaledVector(direction,reach*(inward?(i===front?.91:1.02):scoopFlip?(i===front?1.00:.82+.15*balanceMotion.armSweep):1.04));
        const pole=shoulder.clone().addScaledVector(toeDirection,.25).addScaledVector(this.up,.2);
        this.solve(hand,target,along(direction),pole,balanceMotion.arms);
        const forearm=hand.end.getWorldPosition(new THREE.Vector3()).sub(hand.mid.getWorldPosition(new THREE.Vector3())).normalize();
        this.worldRotation(hand.end,hand.end.getWorldQuaternion(new THREE.Quaternion()).slerp(along(forearm),balanceMotion.arms));
      }
    }
    let handError = 0;
    if(p.revert && p.revert.reach>0){
      if(this.spine){this.spineBefore??=this.spine.quaternion.clone();this.spine.rotation.x+=.28*p.revert.knee-.06*p.revert.rebound;}
      const hand=this.hands[(p.revertSign??1)>0?1:0],other=this.hands[(p.revertSign??1)>0?0:1];
      const shoulder=hand.root.getWorldPosition(new THREE.Vector3());
      const outward=shoulder.clone().sub(other.root.getWorldPosition(new THREE.Vector3()));
      outward.addScaledVector(this.up,-outward.dot(this.up)).normalize().addScaledVector(this.up,-.95-.12*p.revert.rebound).normalize();
      const reach=shoulder.distanceTo(hand.mid.getWorldPosition(new THREE.Vector3()))+
        hand.mid.getWorldPosition(new THREE.Vector3()).distanceTo(hand.end.getWorldPosition(new THREE.Vector3()));
      const relative=hand.end.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(hand.socket.getWorldQuaternion(new THREE.Quaternion()));
      const wristAlong=(direction:THREE.Vector3)=>{
        // The glove's fingers extend along -Y; -Z is its palm normal.
        const handY=direction.clone().negate(),handX=handY.clone().cross(this.up);
        if(handX.lengthSq()<1e-8)handX.crossVectors(handY,this.forward);
        handX.normalize();
        const handZ=handX.clone().cross(handY).normalize();
        return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(handX,handY,handZ)).multiply(relative.clone().invert());
      };
      const handQ=wristAlong(outward);
      const target=shoulder.clone().addScaledVector(outward,reach+.13);
      // The elbow bends below the shoulder while the upper arm lengthens.
      const pole=shoulder.clone().addScaledVector(this.up,-.65).addScaledVector(outward,.25).addScaledVector(this.forward,.15);
      // Blend the entire solved chain, not just its hand target. A partly
      // weighted target still applies the full elbow pole, reversing the bend
      // on entry and snapping back to the riding elbow when reach hits zero.
      const joints=[hand.root,hand.mid,hand.end];
      const riding=joints.map(joint=>joint.quaternion.clone());
      this.solve(hand,target,handQ,pole,1);
      const forearm=hand.end.getWorldPosition(new THREE.Vector3()).sub(hand.mid.getWorldPosition(new THREE.Vector3())).normalize();
      this.worldRotation(hand.end,wristAlong(forearm));
      for(let i=0;i<joints.length;i++)joints[i].quaternion.slerpQuaternions(riding[i],joints[i].quaternion.clone(),p.revert.reach);
      this.board.userData.skateRevert={...p.revert,hand:hand.socket.name};
    }else delete this.board.userData.skateRevert;
    if (underProgress > 0) {
      const gripWeight=underMotion.handContact;
      const handTargets: number[][]=[];
      // The hanging torso faces along the rail: its anatomical left reaches
      // the nose truck and its right reaches the tail, without crossing arms.
      for(const [i,z] of [[1,frontZ],[0,rearZ]]) {
        const hand=this.hands[i];
        const target=this.board.localToWorld(new THREE.Vector3(0,s.wheelRadius*scale,z));
        const socketRelative=hand.end.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(hand.socket.getWorldQuaternion(new THREE.Quaternion()));
        const handX=X.clone().applyQuaternion(this.boardQ).multiplyScalar(z>0?-1:1);
        const handY=Y.clone().applyQuaternion(this.boardQ).negate();
        const handZ=handX.clone().cross(handY).normalize();
        const handQ=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(handX,handY,handZ)).multiply(socketRelative.invert());
        const pole=hand.root.getWorldPosition(new THREE.Vector3()).addScaledVector(Z.clone().applyQuaternion(this.boardQ),z>0?1:-1).addScaledVector(Y,-.4);
        if(gripWeight>0)handError=Math.max(handError,this.solve(hand,target,handQ,pole,gripWeight));
        handTargets.push(target.toArray());
      }
      this.board.userData.skateUnderRail={weight:underProgress,...underMotion,handError,targets:handTargets,rail:hangAnchor.toArray()};
    } else delete this.board.userData.skateUnderRail;
    if (this.manualWeight > .001 && !p.grind && !p.lip && gw < .001 && p.wallWeight < .001) {
      const sway = Math.sin(p.time*3.6), counter = Math.sin(p.time*3.6-.65);
      for (let i=0; i<2; i++) {
        const hand = this.hands[i], side = i===front ? 1 : -1, w = this.manualWeight;
        // One hand rises as the other lowers; shoulders anticipate the
        // needle, then elbows and wrists follow with a small delayed wobble.
        hand.root.rotation.z += w*(.20*sway-.28*this.manualBalance);
        hand.root.rotation.x += w*side*(.16*counter+.30*this.manualBalance);
        hand.mid.rotation.x += w*(.08+.10*Math.sin(p.time*3.6-side*.75));
        hand.end.rotation.x += w*side*.12*Math.sin(p.time*3.6-1.2);
      }
    }
    if (gw > .001) {
      if(waistGrab&&this.spine&&this.waist){
        this.spineBefore??=this.spine.quaternion.clone();
        this.waistBefore??=this.waist.quaternion.clone();
        const hinge=this.waistRest.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(japan?.30:stalefish?1.25:mute?1.40:method?1.50:endGrab?.30:melon?1.32:1.82,0,endGrab?(parity*endDirection<0?1.185:1.38)*p.stance*parity*endDirection:(japan?.50:stalefish?-.90:mute?.62:method?.72:melon?.65:-.58)*p.stance,'ZXY')));
        const spineFold=mute?this.spineRest.clone().multiply(new THREE.Quaternion().setFromAxisAngle(X,.22)):this.spineRest;
        this.spine.quaternion.slerp(spineFold,smooth(gw));
        this.waist.quaternion.slerp(hinge,grabFold);
      }
      const handIndex=endGrab?(parity*endDirection>0?front:back):grab.hand==='leading'?front:back;
      const hand = this.hands[handIndex];
      const toeSign = p.stance * parity;
      const x = grab.edge === 'toe' ? s.deckHalfWidth * scale * toeSign : grab.edge === 'heel' ? -s.deckHalfWidth * scale * toeSign : 0;
      const z = grab.edge === 'nose' ? s.deckNoseLength * scale * .96 : grab.edge === 'tail' ? -s.deckTailLength * scale * .96
        : (grab.hand === 'leading' ? .10 : -.10) * parity;
      const target = this.board.localToWorld(new THREE.Vector3(x, surface(x, z), z));
      // Palm faces inward at the selected rail/tip; fingers curl underneath.
      // A palm-down floor-plant basis points the fingers away from the deck
      // and forces the wrist below it. Resolve the
      // persistent glove mount too: left/right rest orientations differ.
      const socketQ = hand.socket.getWorldQuaternion(new THREE.Quaternion());
      const relative = hand.end.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(socketQ);
      const across = new THREE.Vector3(x || 0, 0, grab.edge === 'nose' || grab.edge === 'tail' ? Math.sign(z) : 0);
      if (across.lengthSq() < .001) across.set(toeSign, 0, 0);
      across.normalize().applyQuaternion(this.boardQ);
      const handY = Y.clone().applyQuaternion(this.boardQ);
      const handX = handY.clone().cross(across).normalize();
      const handQ = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(handX, handY, across)).multiply(relative.invert());
      const pole = method||stalefish||japan?hand.root.getWorldPosition(new THREE.Vector3()).addScaledVector(across,.60).addScaledVector(Z.clone().applyQuaternion(this.boardQ),(stalefish?-.30:.30)*parity).addScaledVector(handY,-.25)
        :hand.root.getWorldPosition(new THREE.Vector3()).addScaledVector(this.right,(grab.edge === 'heel' ? -1 : 1)*p.stance*.7).addScaledVector(this.forward,grab.hand === 'leading'?.3:-.45);
      // The waist fold and independent segment elasticity supply reach
      // while both feet retain their deck contacts.
      const shoulder = hand.root.getWorldPosition(new THREE.Vector3());
      const reach = shoulder.distanceTo(hand.mid.getWorldPosition(new THREE.Vector3())) +
        hand.mid.getWorldPosition(new THREE.Vector3()).distanceTo(hand.end.getWorldPosition(new THREE.Vector3())) + .12;
      const distance = shoulder.distanceTo(target);
      if (distance > reach && this.spine && !p.nineHundred && !waistGrab) {
        // The spine is a true joint; bend it toward this hand's contact.
        const chest = this.spine;
        this.spineBefore = chest.quaternion.clone();
        const from = chest.parent!.worldToLocal(shoulder.clone()).sub(chest.position).normalize();
        const to = chest.parent!.worldToLocal(target.clone().addScaledVector(this.up, .32)).sub(chest.position).normalize();
        const bend = new THREE.Quaternion().setFromUnitVectors(from, to);
        const angle = new THREE.Quaternion().angleTo(bend);
        const limited = new THREE.Quaternion().slerp(bend, Math.min(1, 1.40 / Math.max(.001, angle)) * gw);
        chest.quaternion.premultiply(limited);
      }
      handError = this.solve(hand, target, handQ, pole, waistGrab?smooth(gw/.95):smooth(gw),waistGrab?192:64,waistGrab?this.body:undefined,waistGrab);
      if(waistGrab&&gw>.95&&this.waist){
        // A small waist adjustment absorbs the changing segment elasticity;
        // it cannot collapse the legs or turn into the old deep spine fold.
        for(let attempt=0;attempt<3&&handError>.003;attempt++){
          const wristGoal=target.clone().sub(hand.socket.getWorldPosition(new THREE.Vector3())).add(hand.end.getWorldPosition(new THREE.Vector3()));
          const a=this.waist.parent!.worldToLocal(hand.root.getWorldPosition(new THREE.Vector3())).sub(this.waist.position).normalize();
          const b=this.waist.parent!.worldToLocal(wristGoal).sub(this.waist.position).normalize();
          const bend=new THREE.Quaternion().setFromUnitVectors(a,b),angle=new THREE.Quaternion().angleTo(bend);
          this.waist.quaternion.premultiply(new THREE.Quaternion().slerp(bend,Math.min(1,.025/Math.max(.001,angle))));
          handError=this.solve(hand,target,handQ,pole,1,192,this.body,true);
        }
      }
      if (handError > .005 && gw > .95 && this.spine && !p.nineHundred && !waistGrab) {
        // Deep heel-side/Japan tweaks can move the glove's wrist offset above
        // the grip. Fit the shoulder to that actual wrist target as well.
        for (let attempt = 0; attempt < 2 && handError > .005; attempt++) {
          const wristGoal = target.clone().sub(hand.socket.getWorldPosition(new THREE.Vector3()))
            .add(hand.end.getWorldPosition(new THREE.Vector3()));
          const chest = this.spine;
          this.spineBefore ??= chest.quaternion.clone();
          const a = chest.parent!.worldToLocal(hand.root.getWorldPosition(new THREE.Vector3())).sub(chest.position).normalize();
          const b = chest.parent!.worldToLocal(wristGoal.addScaledVector(this.up, .20)).sub(chest.position).normalize();
          chest.quaternion.premultiply(new THREE.Quaternion().setFromUnitVectors(a, b));
          handError = this.solve(hand, target, handQ, pole);
        }
      }
      if(melon||method||mute||stalefish||japan){
        const free=this.hands[stalefish?front:back],shoulder=free.root.getWorldPosition(new THREE.Vector3());
        const toe=japan?japanToe:Z.clone().applyQuaternion(footQ);
        const outward=shoulder.clone().sub(hand.root.getWorldPosition(new THREE.Vector3()));
        outward.addScaledVector(this.up,-outward.dot(this.up)).normalize();
        const direction=outward.addScaledVector(toe,japan?-.60:stalefish?-.65:mute?-.90:-.95).addScaledVector(this.up,japan?.22:stalefish?.50:mute?.12:method?-.35:.18).normalize();
        const length=shoulder.distanceTo(free.mid.getWorldPosition(new THREE.Vector3()))+free.mid.getWorldPosition(new THREE.Vector3()).distanceTo(free.end.getWorldPosition(new THREE.Vector3()));
        const mount=free.end.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(free.socket.getWorldQuaternion(new THREE.Quaternion()));
        const y=direction.clone().negate(),x=y.clone().cross(this.up).normalize();
        const rotation=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,x.clone().cross(y).normalize())).multiply(mount.invert());
        this.solve(free,shoulder.clone().addScaledVector(direction,length+.08),rotation,shoulder.clone().addScaledVector(toe,-.4).addScaledVector(this.up,.2),smooth(gw),128,this.body,true);
      }
      this.board.userData.skateGrab = { kind: grabKind, hand: hand.socket.name, target: target.toArray(), error: handError };
    } else delete this.board.userData.skateGrab;
    if (flipPose) {
      const turn = new THREE.Quaternion();
      if (impossible) {
        const rear=this.feet[back],side=back===0?'right':'left';
        const toe=this.rider.getObjectByName(`socket-toe-${side}`),heel=this.rider.getObjectByName(`socket-heel-${side}`);
        const axis=toe&&heel?toe.getWorldPosition(new THREE.Vector3()).sub(heel.getWorldPosition(new THREE.Vector3())).normalize()
          :Z.clone().transformDirection(rear.end.matrixWorld);
        this.boardQ.premultiply(turn.setFromAxisAngle(axis,-impossible.angle*p.stance));
        const normal=Y.clone().applyQuaternion(this.boardQ),samples:THREE.Vector3[]=[];
        let minimum=Infinity;
        for(const part of ['shoe','sole','shoe-foxing','shoe-tongue']){
          const mesh=rear.end.getObjectByName(`${part}-${side}`) as THREE.Mesh|undefined;
          if(!mesh)continue;mesh.updateWorldMatrix(true,false);
          for(let i=0;i<mesh.geometry.attributes.position.count;i++){
            const point=new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i).applyMatrix4(mesh.matrixWorld);
            samples.push(point);minimum=Math.min(minimum,point.dot(normal));
          }
        }
        // A smooth support point on the actual shoe moves from sole to edge
        // and instep. Project it onto the hull's supporting plane so the
        // rotating deck cannot cut through the foot between those contacts.
        if(!samples.length){const point=rear.socket.getWorldPosition(new THREE.Vector3());samples.push(point);minimum=point.dot(normal);}
        const supportPoint=new THREE.Vector3();let total=0;
        for(const point of samples){const weight=Math.exp(-85*(point.dot(normal)-minimum));supportPoint.addScaledVector(point,weight);total+=weight;}
        supportPoint.divideScalar(total);supportPoint.addScaledVector(normal,minimum-supportPoint.dot(normal)-.004);
        const pivotWorld=rear.socket.getWorldPosition(new THREE.Vector3()).addScaledVector(this.up,-.006)
          .lerp(supportPoint,impossible.wrap);
        const intrusion=pivotWorld.dot(normal)-minimum+.003;
        if(intrusion>0)pivotWorld.addScaledVector(normal,-intrusion);
        // Roll toward the toe cap while the grip faces down, keeping the
        // returning deck in front of the ankle rather than through the calf.
        const toeTangent=axis.clone().addScaledVector(normal,-axis.dot(normal)).normalize();
        const inverted=smooth(clamp((-normal.dot(this.up)-.25)/.60,0,1))*impossible.edge;
        const toeLimit=Math.max(...samples.map(point=>point.dot(axis)))-.045;
        const advance=Math.max(0,Math.min(.23*inverted,(toeLimit-pivotWorld.dot(axis))/Math.max(.1,toeTangent.dot(axis))));
        pivotWorld.addScaledVector(toeTangent,advance);
        const x=-s.deckHalfWidth*scale*.98*p.stance*parity*impossible.edge;
        const z=clamp((-footSpan+impossible.slide)*parity,-s.deckTailLength*scale*.86,s.deckNoseLength*scale*.86);
        const pivot=new THREE.Vector3(x,surface(x,z),z);
        this.boardP.copy(pivotWorld).sub(pivot.clone().applyQuaternion(this.boardQ));this.putBoard();
        const inverse=new THREE.Matrix4().copy(this.board.matrixWorld).invert();let closest=Infinity;
        for(const world of samples){
          const point=world.clone().applyMatrix4(inverse);
          if(Math.abs(point.x)>s.deckHalfWidth*scale||point.z< -s.deckTailLength*scale||point.z>s.deckNoseLength*scale)continue;
          closest=Math.min(closest,point.y-surface(point.x,point.z));
        }
        if(Number.isFinite(closest)){this.boardP.addScaledVector(normal,closest-.004);this.putBoard();}
        if(impossible.catchWeight>0){
          const target=this.board.localToWorld(new THREE.Vector3(0,surface(0,footSpan*parity)+.008,footSpan*parity));
          const pole=this.feet[front].root.getWorldPosition(new THREE.Vector3()).addScaledVector(Z.clone().applyQuaternion(footQ),.65);
          this.solve(this.feet[front],target,footQ,pole,impossible.catchWeight,192,footFrame,true);
          let frontClearance=0;
          for(const part of ['shoe','sole','shoe-foxing','shoe-tongue']){
            const mesh=this.feet[front].end.getObjectByName(`${part}-${front===0?'right':'left'}`) as THREE.Mesh|undefined;
            if(!mesh)continue;mesh.updateWorldMatrix(true,false);
            const toBoard=new THREE.Matrix4().copy(this.board.matrixWorld).invert().multiply(mesh.matrixWorld);
            for(let i=0;i<mesh.geometry.attributes.position.count;i++){
              const point=new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i).applyMatrix4(toBoard);
              if(Math.abs(point.x)>s.deckHalfWidth*scale||point.z< -s.deckTailLength*scale||point.z>s.deckNoseLength*scale)continue;
              frontClearance=Math.max(frontClearance,surface(point.x,point.z)+.004-point.y);
            }
          }
          if(frontClearance>0){
            const seated=this.feet[front].socket.getWorldPosition(new THREE.Vector3()).addScaledVector(normal,frontClearance);
            footError=Math.max(footError,this.solve(this.feet[front],seated,footQ,pole,1,192,footFrame,true));
          }
        }
        const contact=pivot.clone().applyQuaternion(this.boardQ).add(this.boardP);
        this.board.userData.skateWrapPivot=contact.toArray();
        this.board.userData.skateImpossible={...impossible,rearFoot:rear.socket.name,frontFoot:this.feet[front].socket.name,
          materialPoint:pivot.toArray(),contact:contact.toArray(),axis:axis.toArray()};
      } else {
        // Roll about the deck's own centre of mass. Rotating about the wheel
        // support origin made the deck rise toward the feet every revolution.
        const centre=new THREE.Vector3(0,surface(0,0)-s.deckThickness*scale*.5,0);
        const centreWorld=footFlip?centre.clone().applyQuaternion(this.boardQ).add(this.boardP):null;
        // Shove about the stable up axis, then flick about the board's length.
        // Mirroring the stance reverses the toe/heel flick, not the label.
        this.boardQ.multiply(turn.setFromAxisAngle(Y, flipPose.yaw * p.stance))
          .multiply(turn.setFromAxisAngle(X, flipPose.pitch * parity))
          .multiply(turn.setFromAxisAngle(Z, -flipPose.roll * p.stance * parity));
        if(centreWorld)this.boardP.copy(centreWorld).sub(centre.applyQuaternion(this.boardQ));
        else this.boardP.addScaledVector(this.up, -flipPose.deckDrop);
        delete this.board.userData.skateWrapPivot;
      }
      this.putBoard();
    } else delete this.board.userData.skateWrapPivot;
    if(!impossible)delete this.board.userData.skateImpossible;
    if(footFlip)this.board.userData.skateFootFlip={...footFlip,kind:p.flip,front:this.feet[front].socket.name,back:this.feet[back].socket.name};
    else delete this.board.userData.skateFootFlip;
    this.board.userData.skateContact = { support: under>.99 ? 'truck-grips' : p.wallWeight > .01 ? 'wall-wheels' : p.darkslide ? 'griptape' : p.grind ? GRIND_CONTACTS[p.grind].support
      : p.manual ? p.manual > 0 ? 'rear-wheels' : 'front-wheels' : p.lip ? LIP_CONTACTS[p.lip].support : 'wheels',
      local: [0, this.supportY, this.supportZ], world: this.support.toArray(), footError, handError, bounce,
      bodyFlex, bodyHeight:height, footSpan, locomotionWeight:this.locomotionWeight };
    return true;
  }
}
