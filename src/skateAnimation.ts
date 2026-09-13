import * as THREE from 'three';
import { solveTwoBoneIk } from './animation/ik';
import { GRAB_CONTACTS, GRIND_CONTACTS, LIP_CONTACTS, skateContactBounce, sampleDeckTrick, sampleMcTwist, type DeckTrickKind, type GrabTrickKind, type GrindStyle, type LipStyle } from './skateTricks';
import { DEFAULT_SKATEBOARD_SETTINGS, type SkateboardSettingsValue } from './skateboard/settings';
import { evaluateSkateboardSurfaceHeight } from './skateboard/model';
import type { Rail } from './rails';
import { SkateBodySpring } from './skateBodyMotion';

const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const clamp = THREE.MathUtils.clamp;
const smooth = (t: number) => THREE.MathUtils.smoothstep(t, 0, 1);
type Limb = { root: THREE.Object3D; mid: THREE.Object3D; end: THREE.Object3D; socket: THREE.Object3D };

export interface SkatePoseInput {
  dt: number; time: number; active: boolean; grounded: boolean; stance: number;
  yaw: number; deckYaw: number; speed: number; charge: number; balance: number;
  verticalVelocity?: number; launchVelocity?: number; mount?: number;
  manual: number; grab: GrabTrickKind; grabWeight: number;
  grind: GrindStyle | null; rail: Rail | null; railT: number; railDir: number;
  crossDir: number; approachSide: number; crookedSide: number;
  darkslide: boolean; ollie: boolean; flip: DeckTrickKind | null;
  flipProgress: number; specialFlip: boolean; lip: LipStyle | null;
  wallWeight: number; wallNormal: THREE.Vector3; wallForward: THREE.Vector3;
}

/** Final contact layer for the procedural skater. Physics never reads it.
 * Board transforms live in an un-stretched frame; endpoints use measured rig
 * lengths. This keeps the same contacts after character/board lab edits. */
export class SkateAnimation {
  readonly boardMount = new THREE.Group();
  private feet: [Limb, Limb] | null;
  private hands: [Limb, Limb] | null;
  private hips: THREE.Object3D | undefined;
  private spine: THREE.Object3D | undefined;
  private spineBefore: THREE.Quaternion | null = null;
  private key = '';
  private age = 0;
  private airAge = 0;
  private wasGrounded = true;
  private bounceAge = 1;
  private pitch = 0;
  private grindYaw = 0;
  private supportZ = 0;
  private supportY = 0;
  private lastActive = false;
  private darkWeight = 0;
  private locomotionWeight = 0;
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
  }

  reset(): void { this.key = ''; this.lastActive = false; this.age = this.airAge = this.darkWeight = this.locomotionWeight = 0; this.bounceAge = 1; this.wasGrounded = true; this.bodySpring.reset(); }

  /** Restore the legacy sibling frame before it authors its fallback pose. */
  prepare(): void {
    if (this.spine && this.spineBefore) this.spine.quaternion.copy(this.spineBefore);
    this.spineBefore = null;
    this.boardMount.scale.setScalar(1);
    this.board.scale.set(1 / 1.18, 1 / 1.36, 1 / 1.18);
  }

  private worldRotation(node: THREE.Object3D, rotation: THREE.Quaternion): void {
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
    pole: THREE.Vector3, weight = 1): number {
    // The socket is offset from the ankle/wrist. Restore its orientation after
    // each two-bone solve, then remeasure the offset (also handles scaled rigs).
    const desired = limb.end.getWorldQuaternion(new THREE.Quaternion()).slerp(rotation, weight);
    const endpoint = new THREE.Vector3(), socket = new THREE.Vector3();
    const goal = limb.socket.getWorldPosition(new THREE.Vector3()).lerp(target, weight);
    const wristTarget = new THREE.Vector3();
    for (let i = 0; i < 2; i++) {
      this.worldRotation(limb.end, desired);
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
    for (let i = 0; i < 64; i++) {
      this.worldRotation(limb.end, desired);
      if (limb.socket.getWorldPosition(socket).distanceTo(goal) < .001) break;
      for (const joint of [limb.mid, limb.root]) {
        joint.parent!.updateWorldMatrix(true, false);
        from.copy(limb.socket.getWorldPosition(socket)); joint.parent!.worldToLocal(from); from.sub(joint.position).normalize();
        to.copy(goal); joint.parent!.worldToLocal(to); to.sub(joint.position).normalize();
        joint.quaternion.premultiply(new THREE.Quaternion().setFromUnitVectors(from, to));
        this.worldRotation(limb.end, desired);
      }
    }
    this.worldRotation(limb.end, desired);
    return limb.socket.getWorldPosition(socket).distanceTo(target);
  }

  apply(p: SkatePoseInput): boolean {
    if (!p.active || !this.feet || !this.hands || !this.hips) { this.lastActive = false; this.darkWeight = 0; return false; }
    this.darkWeight = clamp(this.darkWeight + (p.darkslide ? 1 : -1) * p.dt / .22, 0, 1);
    const dark = smooth(this.darkWeight), darkPop = Math.sin(Math.PI * dark);
    const s = (this.board.userData.settings ?? DEFAULT_SKATEBOARD_SETTINGS) as SkateboardSettingsValue;
    const scale = s.overallScale, grip = s.boardToGroundDistance * scale;
    const surface = (x: number, z: number) => (s.boardToGroundDistance + evaluateSkateboardSurfaceHeight(s, x / scale, z / scale)) * scale;
    const frontZ = s.frontTruckLocalZ * scale, rearZ = s.rearTruckLocalZ * scale;
    const front = p.stance > 0 ? 0 : 1, back = 1 - front;
    const key = p.wallWeight > .01 ? 'wallride' : p.grind ? `${p.grind}:${p.darkslide}` : p.lip ? `lip:${p.lip}` : p.manual ? `manual:${p.manual}`
      : p.grabWeight > .01 ? `grab:${p.grab}` : p.grounded ? 'ride' : 'air';
    if (key !== this.key || !this.lastActive) {
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
    const mcTwist = p.specialFlip ? sampleMcTwist(p.flipProgress) : null;
    const grabKind = mcTwist ? 'mute' : p.grab;
    const grab = GRAB_CONTACTS[grabKind];
    const gw = clamp(mcTwist ? mcTwist.grab : p.grabWeight, 0, 1);
    const flipPose = p.flip ? sampleDeckTrick(p.flip, mcTwist ? mcTwist.deckProgress : p.flipProgress) : null;
    const locomotionTarget = (key === 'ride' || key === 'air') && !p.flip && gw < .01 ? 1 : 0;
    if (!this.lastActive) { this.locomotionWeight = locomotionTarget; this.bodySpring.reset(p.charge); }
    else this.locomotionWeight += (locomotionTarget-this.locomotionWeight)*(1-Math.exp(-16*p.dt));
    const bodyFlex = this.bodySpring.step(p.dt, {
      grounded:p.grounded, charge:p.charge,
      verticalVelocity:p.verticalVelocity??0, launchVelocity:p.launchVelocity??0,
      contactBounce:p.grounded?bounce:0, mount:clamp(p.mount??0,0,1),
    });

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
      // Rail visuals use a 0.09 m tube, including the ordinary coping rails.
      this.support.copy(p.rail.pointAt(p.railT)).addScaledVector(this.up, .09);
      const d = GRIND_CONTACTS[p.grind];
      pitch = d.pitch;
      yaw = d.yaw * (p.grind === 'smith' || p.grind === 'feeble' ? p.approachSide
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
      this.support.addScaledVector(this.up, .09);
      const d = LIP_CONTACTS[p.lip];
      yaw = d.yaw; pitch = d.pitch + clamp(p.balance * .06, -.06, .06);
      pivotZ = p.lip === 'nose' ? s.deckNoseLength * scale * .94 : p.lip === 'tail' ? -s.deckTailLength * scale * .94 : 0;
      pivotY = p.lip === 'axle' ? (s.wheelRadius - s.truckHangerRadius) * scale : surface(0, pivotZ) - s.deckThickness * scale;
    } else if (p.ollie && !p.grounded && !p.flip && gw < .01) {
      // Tail pop, front-foot slide, level catch. Build the pop over 50 ms
      // instead of dropping the pelvis on a stepped board angle at
      // release; the body can extend as the nose comes up. No physics impulse.
      pitch = -.30 * smooth(this.airAge / .05) * (1 - smooth((this.airAge - .05) / .20));
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
      .multiply(this.q.setFromAxisAngle(X, this.pitch + grab.pitch * gw))
      .multiply(this.q.setFromAxisAngle(Z, roll + Math.PI * dark + grab.roll * p.stance * gw));
    // The support point is geometric, not the rig origin. Rocking the deck
    // cannot bury one truck or lift the one the named grind is loading.
    this.temp.set(0, this.supportY, this.supportZ).applyQuaternion(this.boardQ);
    this.boardP.copy(this.support).sub(this.temp);
    if (!p.grind && !p.manual && !p.lip) this.boardP.copy(this.support);
    this.boardP.addScaledVector(this.up, .30 * gw + .18 * darkPop);
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

    // Cancel the body's nonuniform cartoon proportions BEFORE board rotation.
    this.boardMount.scale.copy(this.body.scale).set(1 / this.body.scale.x, 1 / this.body.scale.y, 1 / this.body.scale.z);
    this.board.scale.setScalar(1);
    this.putBoard();

    const parity = Math.cos(p.deckYaw) >= 0 ? 1 : -1;
    // A relaxed, narrower stance for ride/load/ollie only. Authored trick
    // contacts keep their established wider positions; blend at the handoff.
    const footSpan = Math.min((frontZ - rearZ) * .40, p.wallWeight > .01 ? .34 : .50) * (1-.25*this.locomotionWeight);
    const footYaw = p.stance * parity * Math.PI / 2;
    const catchQ = this.boardQ.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Z, -Math.PI * dark));
    const footQ = catchQ.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Y, footYaw));
    const footTargets = [new THREE.Vector3(), new THREE.Vector3()];
    for (const i of [front, back]) {
      let z = (i === front ? 1 : -1) * footSpan * parity;
      const supportKind = p.grind ? GRIND_CONTACTS[p.grind].support : null;
      if (supportKind === 'front-truck' || p.manual < 0) z = z > 0 ? frontZ : -.10 * scale;
      if (supportKind === 'rear-truck' || p.manual > 0) z = z < 0 ? rearZ : .10 * scale;
      // On a Darkslide the feet stand on the exposed underside near the ends,
      // outside the trucks, while griptape (not wheels) touches the rail.
      footTargets[i].set(0, surface(0, z) + .006, z).applyQuaternion(catchQ).add(this.boardP);
      if (dark > 0) {
        const underside = this.board.localToWorld(new THREE.Vector3(0, (s.boardToGroundDistance - s.deckThickness) * scale,
          Math.sign(z) * Math.max(footSpan, Math.abs(frontZ) + .13)));
        footTargets[i].lerp(underside, dark).addScaledVector(this.up, .22 * darkPop);
      }
    }
    // Pelvis follows the weighted truck while both feet retain their own
    // contact. The bounce is absorbed by knees, never by the rail/deck.
    const pelvis = footTargets[0].clone().add(footTargets[1]).multiplyScalar(.5);
    const load = p.grind ? pivotZ * .24 : p.manual ? pivotZ * .22 : 0;
    pelvis.addScaledVector(Z.clone().applyQuaternion(this.boardQ), load);
    // Idle, load and ordinary board flight share a single proportion-aware
    // spring. Only actual tricks retain their separate contact/tuck poses.
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
        this.worldRotation(leg.end, footQ);
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
    const trickHeight = THREE.MathUtils.lerp(.46 - .29 * gw, .10, dark) - .065 * p.charge - .11 * bounce + breathe;
    const restingBreath = Math.sin(p.time*5.6)*.005*(.35+.65*Math.min(1,Math.abs(p.speed)/5));
    const height = THREE.MathUtils.lerp(trickHeight, locomotionHeight+restingBreath, this.locomotionWeight);
    pelvis.addScaledVector(this.up, height);
    pelvis.addScaledVector(Y, .14 * p.wallWeight);
    if (gw > .01 && (grabKind === 'method' || grabKind === 'japan'))
      pelvis.addScaledVector(this.right, p.stance * .12 * gw);
    if (flipPose) {
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
    this.hips.getWorldPosition(this.temp);
    const delta = pelvis.clone().sub(this.temp);
    const localZero = this.body.worldToLocal(this.temp.copy(pelvis));
    const oldLocal = this.body.worldToLocal(pelvis.clone().sub(delta));
    this.rider.position.add(localZero.sub(oldLocal));
    this.body.updateWorldMatrix(true, true);
    let footError = 0;
    for (let i = 0; i < 2; i++) {
      const pole = this.feet[i].root.getWorldPosition(new THREE.Vector3())
        .addScaledVector(this.right, p.stance * .65).addScaledVector(this.forward, i === front ? .12 : -.12);
      footError = Math.max(footError, this.solve(this.feet[i], footTargets[i], footQ, pole));
    }

    let handError = 0;
    if (gw > .001) {
      const hand = this.hands[grab.hand === 'leading' ? front : back];
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
      const pole = hand.root.getWorldPosition(new THREE.Vector3()).addScaledVector(this.right,
        (grab.edge === 'heel' ? -1 : 1) * p.stance * .7).addScaledVector(this.forward, grab.hand === 'leading' ? .3 : -.45);
      // Fold the chest toward the board so the short cartoon arm can reach
      // without stretching bones or pulling the feet off the deck.
      const shoulder = hand.root.getWorldPosition(new THREE.Vector3());
      const reach = shoulder.distanceTo(hand.mid.getWorldPosition(new THREE.Vector3())) +
        hand.mid.getWorldPosition(new THREE.Vector3()).distanceTo(hand.end.getWorldPosition(new THREE.Vector3())) + .12;
      const distance = shoulder.distanceTo(target);
      if (distance > reach && this.spine) {
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
      handError = this.solve(hand, target, handQ, pole, smooth(gw));
      if (handError > .005 && gw > .95 && this.spine) {
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
      this.board.userData.skateGrab = { kind: grabKind, hand: hand.socket.name, target: target.toArray(), error: handError };
    } else delete this.board.userData.skateGrab;
    if (flipPose) {
      const turn = new THREE.Quaternion();
      if (p.flip === 'imposs') {
        // A full, slightly tilted vertical wrap about the actual trailing
        // foot. The board material point under that foot remains the pivot.
        const pivot = new THREE.Vector3(0, surface(0, -footSpan * parity), -footSpan * parity);
        const pivotWorld = this.board.localToWorld(pivot.clone());
        turn.setFromAxisAngle(new THREE.Vector3(1, 0, .30 * p.stance).normalize(), -flipPose.pitch * parity);
        this.boardQ.multiply(turn);
        this.boardP.copy(pivotWorld).sub(pivot.applyQuaternion(this.boardQ));
        this.board.userData.skateWrapPivot = pivotWorld.toArray();
      } else {
        // Shove about the stable up axis, then flick about the board's length.
        // Mirroring the stance reverses the toe/heel flick, not the label.
        this.boardQ.multiply(turn.setFromAxisAngle(Y, flipPose.yaw * p.stance))
          .multiply(turn.setFromAxisAngle(X, flipPose.pitch * parity))
          .multiply(turn.setFromAxisAngle(Z, -flipPose.roll * p.stance * parity));
        this.boardP.addScaledVector(this.up, -flipPose.deckDrop);
        delete this.board.userData.skateWrapPivot;
      }
      this.putBoard();
    } else delete this.board.userData.skateWrapPivot;
    this.board.userData.skateContact = { support: p.wallWeight > .01 ? 'wall-wheels' : p.darkslide ? 'griptape' : p.grind ? GRIND_CONTACTS[p.grind].support
      : p.manual ? p.manual > 0 ? 'rear-wheels' : 'front-wheels' : p.lip ? LIP_CONTACTS[p.lip].support : 'wheels',
      local: [0, this.supportY, this.supportZ], world: this.support.toArray(), footError, handError, bounce,
      bodyFlex, bodyHeight:height, footSpan, locomotionWeight:this.locomotionWeight };
    return true;
  }
}
