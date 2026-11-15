import * as THREE from 'three';
import { drawnRopePoint, flexibleRopePoint, type FlexibleRopeState } from '../ropeGeometry';
import { ELASTIC_LENGTH_CONTROLS, characterElasticityAmplitudes } from './elasticity';
import { solveTwoBoneIk } from './ik';

/**
 * How a body hangs from a swing rope.
 *
 * Gameplay owns the grip: a point on the rope, and a rider position straight below it. This layer owns everything
 * the eye sees between those two. The torso is stood up out of the clip's lean and hung ALONG the rope by the
 * shoulders, with the rope in front of the chest, the belly and the face instead of through them; the body is a
 * second pendulum under the hands that trails the swing and rests against the rope rather than passing it; the hands
 * hold the rope in their palms and walk it hand over hand; the shoes pinch it from either side; a catch carries the
 * flight's own speed into the hang, swings the legs on through and is taken up by the arms; a leap lets go in order
 * (feet, hands, body), and the rope it has left gives way round the body rather than passing through it. It moves
 * the visible body and the drawn rope only: the rider position, the grip, the rope that can be caught and the leap
 * are untouched.
 *
 * Every spring here is finite: each has a rest state it reaches, so a hang always settles.
 */
export const ROPE_BODY = Object.freeze({
  /** Pendulum of the body under the hands: natural frequency (rad/s) and damping ratio. Under-damped: it overshoots. */
  swingFrequency: 8.2, swingDamping: .4,
  /** Seconds of lag: the feet trail the grip's sideways travel by this much of its velocity. */
  trail: .03,
  /** The chest meets the rope in front of it and comes off again with this much of its speed. */
  ropeBounce: .35,
  /** Bounce through the arms along the body: frequency (rad/s), damping ratio, and how far a full charge pulls up. */
  bobFrequency: 15, bobDamping: .34, chargePullUp: .16,
  /** The rope's own thickness (metres from its centre; the braided rope the levels draw), and how far in front of the
   * hip-to-shoulder line it runs: clear of the chest, the belly and the face. */
  ropeRadius: .105, ropeClearance: .37,
  /** The shoulders hang this fraction of an arm's length below the grip: arms long, with a little give left in them. */
  shoulderDrop: .6,
  /** The head looks up the rope by this much (radians), and sits about this far up the body from the hips (metres). */
  headBack: .2, headReach: .95,
  /** Hand window on the rope, metres below the grip: a reach lands at `handHigh`, a pull ends at `handLow`; and how
   * far off the rope a reaching hand's palm comes. */
  handHigh: -.04, handLow: .45, handRestUpper: 0, handRestLower: .17, handReachSeconds: .15, handLift: .11,
  /** A gripping hand: the rope lies across the palm this far along the hand from the wrist and this far off it, the
   * thumb up the rope, with the hand turned in toward the other by `handTurn` (radians). */
  palmAlong: .12, palmOff: .125, handTurn: .87,
  /** Rope travelled in one full cycle of the climbing legs. */
  climbStride: .9,
  /** Each new hold tugs the body along the rope by this much speed (m/s) and turns and tips the torso toward it. */
  climbTug: .55, climbTwist: .16, climbRoll: .07,
  /** Feet clamp the rope this fraction of a leg's length below the hips; the climb scissors them by `footScissor`. */
  footReach: .74, footScissor: .13, chargeTuck: .3,
  /** A clamping shoe: its half-width, how far behind the rope's centre its ankle sits, and (radians) toes pointed
   * down the rope, toes out, soles turned in. */
  shoeHalfWidth: .072, footBack: .06, footPoint: .4, footOut: .2, footRoll: .3,
  /** Catch: seconds for the hands and the legs to come under this layer, then for the feet to find the rope; the
   * body's take-up (rad/s); the most of the flight's speed (m/s) and of its turning (rad/s) it carries in; and how
   * far past their length the arms may reach for the rope. */
  catchHands: .1, catchLegs: .16, catchClampDelay: .12, catchClamp: .3, absorbFrequency: 18, catchCarry: 10, catchSpin: 9, catchArmStretch: .55,
  /** Legs with no rope under them to grip hang free from the hips, a pendulum of their own that trails the body and
   * swings on past it: frequency (rad/s), damping ratio; and the swing a catch throws them into, radians per second
   * for each metre per second of flight, and the most of it. Hanging, they are this fraction of their length, and
   * trail the grip's sideways travel by `legTrail` seconds of it. */
  legSwingFrequency: 6.6, legSwingDamping: .3, legSwingKick: .5, legSwingMax: 5, legHang: .92, legTrail: .055,
  /** Leap: seconds for the legs, the hands and the body to leave the rope. */
  releaseLegs: .12, releaseHands: .13, releaseBody: .34,
  /** The room the body takes up, as the drawn rope sees it: half its depth and half its width (metres, the rope's
   * own thickness included). A rope that would pass through that is pushed round its side, and swings back after
   * (rad/s, damping ratio) for up to `shoveSeconds` after a leap. */
  bodyDepth: .36, bodyWidth: .53, shoveFrequency: 9, shoveDamping: .5, shoveSeconds: 1.6,
});

export interface RopeBodyBones {
  body: THREE.Object3D;
  armL: THREE.Object3D; elbowL: THREE.Object3D; wristL: THREE.Object3D;
  armR: THREE.Object3D; elbowR: THREE.Object3D; wristR: THREE.Object3D;
  legL?: THREE.Object3D | null; kneeL?: THREE.Object3D | null; ankleL?: THREE.Object3D | null;
  legR?: THREE.Object3D | null; kneeR?: THREE.Object3D | null; ankleR?: THREE.Object3D | null;
  head?: THREE.Object3D | null;
}
export interface RopeBodyFrame {
  dt: number;
  /** The rope being held, or (for a moment after a leap) the one just left. */
  rope: FlexibleRopeState | null;
  attached: boolean;
  /** Off the ground: only then does a rope the body has just let go of give way to it. */
  airborne: boolean;
  /** Grip distance down the rope from its anchor, and that point in the world. */
  ropeD: number; grip: THREE.Vector3;
  /** 0..1 of a held leap. */
  charge: number;
}
export interface RopeBodyResult { leftGripError: number; rightGripError: number; rootOffsetY: number; active: boolean; }

const DOWN = new THREE.Vector3(0, -1, 0), UP = new THREE.Vector3(0, 1, 0);
const smooth = (t: number): number => { const u = Math.min(1, Math.max(0, t)); return u * u * (3 - 2 * u); };
const smoother = (t: number): number => { const u = Math.min(1, Math.max(0, t)); return u * u * u * (u * (u * 6 - 15) + 10); };
const v0 = new THREE.Vector3(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), v4 = new THREE.Vector3();
const hips = new THREE.Vector3(), shoulders = new THREE.Vector3(), origin = new THREE.Vector3(), placed = new THREE.Vector3(), torso = new THREE.Vector3();
const axisNow = new THREE.Vector3(), ropeAxis = new THREE.Vector3(), forward = new THREE.Vector3(), side = new THREE.Vector3(), gripVel = new THREE.Vector3();
const ropeUp = new THREE.Vector3(), ropeForward = new THREE.Vector3(), ropeSide = new THREE.Vector3(), contact = new THREE.Vector3();
const q0 = new THREE.Quaternion(), q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), q3 = new THREE.Quaternion(), turn = new THREE.Quaternion(), tilt = new THREE.Quaternion();
const IDENTITY = new THREE.Quaternion(), spun = new THREE.Quaternion(), basis = new THREE.Matrix4();
const targetL = new THREE.Vector3(), targetR = new THREE.Vector3(), turnL = new THREE.Quaternion(), turnR = new THREE.Quaternion(), pole = new THREE.Vector3();
const keepA = new THREE.Quaternion(), keepB = new THREE.Quaternion(), keepC = new THREE.Quaternion();
const ax = new THREE.Vector3(), ay = new THREE.Vector3(), az = new THREE.Vector3();
const shoulderA = new THREE.Vector3(), shoulderB = new THREE.Vector3();

/** The torso as a frame: across the shoulders, up the spine from the hips, and ahead. */
function torsoFrame(hipsAt: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3, out: THREE.Quaternion): THREE.Quaternion {
  ay.copy(a).add(b).multiplyScalar(.5).sub(hipsAt); if (ay.lengthSq() < 1e-10) ay.copy(UP); ay.normalize();
  ax.subVectors(b, a).addScaledVector(ay, -ax.subVectors(b, a).dot(ay)); if (ax.lengthSq() < 1e-10) ax.set(ay.y, -ay.x, 0); ax.normalize();
  az.crossVectors(ax, ay);
  return out.setFromRotationMatrix(basis.makeBasis(ax, ay, az));
}
/** A turn as an axis scaled by its angle, the short way round; and back. */
function turnVector(q: THREE.Quaternion, out: THREE.Vector3): THREE.Vector3 {
  const sine = Math.hypot(q.x, q.y, q.z); if (sine < 1e-9) return out.set(0, 0, 0);
  const sign = q.w < 0 ? -1 : 1;
  return out.set(q.x, q.y, q.z).multiplyScalar(sign * 2 * Math.atan2(sine, q.w * sign) / sine);
}
function turnFromVector(r: THREE.Vector3, out: THREE.Quaternion): THREE.Quaternion {
  const angle = r.length();
  return angle < 1e-9 ? out.identity() : out.setFromAxisAngle(az.copy(r).divideScalar(angle), angle);
}

interface Hand { d: number; from: number; to: number; t: number; }

export class RopeSwingBody {
  /** Down the body, in the world; and its rate of change. */
  readonly axis = new THREE.Vector3(0, -1, 0);
  private readonly axisVel = new THREE.Vector3();
  private bob = 0; private bobVel = 0;
  /** What is left of the pose the catch came from: where its hips were and how its torso was turned, both with the
   * speed they had, both running out. */
  private readonly absorb = new THREE.Vector3(); private readonly absorbVel = new THREE.Vector3();
  private readonly spin = new THREE.Vector3(); private readonly spinVel = new THREE.Vector3(); private absorbing = false;
  /** The torso as drawn over the last two frames: its hips and its frame. */
  private readonly lastHips = new THREE.Vector3(); private readonly prevHips = new THREE.Vector3();
  private readonly lastFrame = new THREE.Quaternion(); private readonly prevFrame = new THREE.Quaternion();
  private history = 0; private lastDt = 1 / 60;
  private readonly lastGrip = new THREE.Vector3(); private haveLastGrip = false;
  private readonly catchVelocity = new THREE.Vector3(); private readonly ropeVelocity = new THREE.Vector3();
  private attachedAge = -1; private releaseAge = -1; private pendingCatch = false;
  /** Where the hang holds the hips relative to the clip's own, and the turn that stands the clip's torso up. */
  private readonly hipOffset = new THREE.Vector3(); private readonly stand = new THREE.Quaternion(); private legWeightAtRelease = 0;
  /** How far the drawn rope is pushed aside (metres along the body's side), its rate, and which side it is going. */
  private shove = 0; private shoveVel = 0; private shoveSide = 0; private shoved: FlexibleRopeState | null = null;
  /** Caught again while still holding the rope aside: it stays aside until the body has come round behind it. */
  private shoveHeld = false;
  /** Left and right hand: planted rope coordinate, or a reach in progress (t in 0..1). */
  private readonly hands: [Hand, Hand] = [{ d: 0, from: 0, to: 0, t: 1 }, { d: 0, from: 0, to: 0, t: 1 }];
  private lastRopeD = 0; private stride = 0; private climbing = 0; private wasClimbing = 0;
  private twist = 0; private twistVel = 0; private scramble = 0;
  /** Down the free-hanging legs, in the world; and its rate of change. */
  private readonly legAxis = new THREE.Vector3(0, -1, 0); private readonly legAxisVel = new THREE.Vector3();
  private swingLoad = 0; private rootOffsetY = 0; private armStretch = 0; private coil = 0;

  reset(): void {
    this.axis.set(0, -1, 0); this.axisVel.set(0, 0, 0); this.bob = this.bobVel = 0;
    this.absorb.set(0, 0, 0); this.absorbVel.set(0, 0, 0); this.spin.set(0, 0, 0); this.spinVel.set(0, 0, 0); this.absorbing = false;
    this.history = 0; this.haveLastGrip = false; this.attachedAge = this.releaseAge = -1; this.pendingCatch = false;
    this.hipOffset.set(0, 0, 0); this.stand.identity(); this.legWeightAtRelease = 0; this.clearShove();
    this.stride = this.climbing = this.wasClimbing = this.twist = this.twistVel = this.scramble = 0;
    this.legAxis.set(0, -1, 0); this.legAxisVel.set(0, 0, 0);
    this.swingLoad = 0; this.rootOffsetY = 0; this.armStretch = 0; this.coil = 0; this.grip[0] = this.grip[1] = 0;
  }

  /**
   * The hands have just closed on the rope. `velocity` is the flight that brought the rider there and `ropeVelocity`
   * the rope's own at the grip (m/s, world).
   */
  catch(ropeD: number, velocity: THREE.Vector3, ropeVelocity?: THREE.Vector3): void {
    this.attachedAge = 0; this.releaseAge = -1; this.pendingCatch = true; this.haveLastGrip = false; this.lastRopeD = ropeD;
    this.stride = this.climbing = this.wasClimbing = 0; this.twist = this.twistVel = 0; this.scramble = 0; this.holds = 0;
    this.shoveHeld = Math.abs(this.shove) > .03;
    if (ropeVelocity) this.ropeVelocity.copy(ropeVelocity); else this.ropeVelocity.set(0, 0, 0);
    this.catchVelocity.copy(velocity).sub(this.ropeVelocity);
    this.catchVelocity.clampLength(0, ROPE_BODY.catchCarry);
    // Arrive upright, and carry the flight into the hang: the body swings on under the hands, then comes back.
    this.axis.set(0, -1, 0);
    const planar = Math.hypot(this.catchVelocity.x, this.catchVelocity.z), kick = Math.min(3.4, planar * .3);
    if (planar > 1e-3) this.axisVel.set(this.catchVelocity.x / planar * kick, 0, this.catchVelocity.z / planar * kick); else this.axisVel.set(0, 0, 0);
    // The weight comes onto the arms: they give, then spring back.
    this.bob = 0; this.bobVel = Math.min(1.7, .5 + planar * .08 + Math.max(0, -velocity.y) * .08);
    // ...and the legs swing on through under them.
    const swing = Math.min(ROPE_BODY.legSwingMax, planar * ROPE_BODY.legSwingKick);
    this.legAxis.set(0, -1, 0);
    if (planar > 1e-3) this.legAxisVel.set(this.catchVelocity.x / planar * swing, 0, this.catchVelocity.z / planar * swing); else this.legAxisVel.set(0, 0, 0);
    this.hands[0] = { d: ropeD + ROPE_BODY.handRestUpper, from: 0, to: 0, t: 1 };
    this.hands[1] = { d: ropeD + ROPE_BODY.handRestLower, from: 0, to: 0, t: 1 };
  }

  /** The hands have just let go. */
  release(charge: number): void {
    if (this.attachedAge < 0) return;
    this.legWeightAtRelease = smooth(this.attachedAge / ROPE_BODY.catchLegs);
    this.attachedAge = -1; this.releaseAge = 0; this.climbing = this.wasClimbing = 0;
    // Push off: the body springs up through the arms as they open.
    this.bobVel -= .8 + .8 * Math.min(1, Math.max(0, charge));
  }

  /** How closed each hand is on the rope, 0..1 (the hand on the body's -X side, then its +X side): open in a reach. */
  readonly grip: [number, number] = [0, 0];
  /** New holds taken on the rope since the catch: how far the hands have walked it. */
  holds = 0;
  /** How far the drawn rope is being held aside by the body, metres. */
  get ropeShove(): number { return Math.abs(this.shove); }

  /** Segment stretch for this frame: arms give under a catch and at the bottom of the arc, the torso with them. */
  deformations(): Record<string, number> | null {
    const weight = this.bodyWeight();
    if (weight <= .001) return null;
    const profile = characterElasticityAmplitudes('rope-catch'), drop = Math.max(-1, Math.min(1.6, this.bob / .1));
    const values: Record<string, number> = {};
    for (const [target, part] of ELASTIC_LENGTH_CONTROLS) {
      const arm = target.startsWith('deform.arm.'), leg = target.startsWith('deform.leg.');
      // Hanging lower lengthens the arms and the torso; springing up shortens them. Legs keep to the swing's load.
      // A held leap coils the whole body short, ready to spring. And arms that are still short of the rope they
      // have caught reach long for it.
      values[target] = (1 + weight * profile[part] * ((leg ? this.swingLoad : arm ? drop : .6 * drop + .5 * this.swingLoad) - 1.2 * this.coil)) * (arm ? 1 + this.armStretch : 1);
    }
    return values;
  }

  private clearShove(): void {
    if (this.shoved?.shove) this.shoved.shove.set(0, 0, 0);
    this.shoved = null; this.shove = this.shoveVel = this.shoveSide = 0; this.shoveHeld = false;
  }

  private bodyWeight(): number {
    if (this.attachedAge >= 0) return 1;
    if (this.releaseAge >= 0) return 1 - smoother(this.releaseAge / ROPE_BODY.releaseBody);
    return 0;
  }

  /** Pose the body on the rope. Call after the clip has posed the skeleton, every frame, attached or not. */
  apply(bones: RopeBodyBones, f: RopeBodyFrame): RopeBodyResult {
    const dt = Math.min(.05, Math.max(0, f.dt)), B = ROPE_BODY, body = bones.body, parent = body.parent;
    const attached = f.attached && !!f.rope && this.attachedAge >= 0;
    if (attached) this.attachedAge += dt; else if (this.releaseAge >= 0) this.releaseAge += dt;
    const bodyW = this.bodyWeight();
    const handW = attached ? smooth(this.attachedAge / B.catchHands) : this.releaseAge >= 0 ? 1 - smooth(this.releaseAge / B.releaseHands) : 0;
    const legW = attached ? smooth(this.attachedAge / B.catchLegs)
      : this.releaseAge >= 0 ? this.legWeightAtRelease * (1 - smooth(this.releaseAge / B.releaseLegs)) : 0;
    const passing = !attached && f.airborne && this.releaseAge >= 0 && this.releaseAge < B.shoveSeconds;
    const settling = this.absorbing || Math.abs(this.shove) > 2e-3 || Math.abs(this.shoveVel) > 2e-2;
    if (!parent || !f.rope || (!attached && bodyW <= 1e-4 && handW <= 0 && legW <= 0 && !passing && !settling)) {
      if (!attached) this.releaseAge = -1;
      this.clearShove(); this.absorbing = false; this.armStretch = 0; this.grip[0] = this.grip[1] = 0;
      this.haveLastGrip = false; this.remember(bones, dt);
      return { leftGripError: 0, rightGripError: 0, rootOffsetY: 0, active: false };
    }
    const rope = f.rope, grip = f.grip;
    if (this.shoved !== rope) { this.clearShove(); this.shoved = rope; }

    // The rope's own direction at the hands (down it), from the curve the eye sees.
    flexibleRopePoint(rope, Math.max(0, f.ropeD - .35), v0); flexibleRopePoint(rope, Math.min(rope.len, f.ropeD + .35), v1);
    ropeAxis.subVectors(v1, v0); if (ropeAxis.lengthSq() < 1e-10) ropeAxis.copy(DOWN); else ropeAxis.normalize();
    if (attached && this.haveLastGrip && dt > 1e-5) gripVel.subVectors(grip, this.lastGrip).divideScalar(dt); else gripVel.set(0, 0, 0);
    this.lastGrip.copy(grip); this.haveLastGrip = attached;

    // The clip's own pose, measured before anything moves: where it faces, its hips and shoulders, how its torso leans.
    body.updateWorldMatrix(true, true);
    body.getWorldQuaternion(q0); parent.getWorldQuaternion(q1); body.getWorldPosition(origin);
    forward.set(0, 0, 1).applyQuaternion(q0); forward.y = 0; if (forward.lengthSq() < 1e-8) forward.set(0, 0, -1); forward.normalize();
    side.set(forward.z, 0, -forward.x);
    bones.armL.getWorldPosition(v0); bones.elbowL.getWorldPosition(v1); bones.wristL.getWorldPosition(v2);
    const reachL = v0.distanceTo(v1) + v1.distanceTo(v2); shoulderA.copy(v0);
    bones.armR.getWorldPosition(v0); bones.elbowR.getWorldPosition(v1); bones.wristR.getWorldPosition(v2);
    const reachR = v0.distanceTo(v1) + v1.distanceTo(v2), reach = Math.min(reachL, reachR); shoulderB.copy(v0);
    shoulders.addVectors(shoulderA, shoulderB).multiplyScalar(.5);
    if (bones.legL && bones.legR) { bones.legL.getWorldPosition(hips); bones.legR.getWorldPosition(v0); hips.add(v0).multiplyScalar(.5); }
    else hips.copy(shoulders).addScaledVector(DOWN, .8);
    torso.subVectors(shoulders, hips);
    // Stand the torso up: whatever the clip has it doing (leaning back in the hang, swaying in the climb, half way
    // round a flip as a catch blends in), its hips-to-shoulders frame is turned square to the body: shoulders level
    // and across, spine upright. A whole frame, so there is never a choice of which way round to turn it.
    if (attached) this.stand.setFromRotationMatrix(basis.makeBasis(side, UP, forward)).multiply(torsoFrame(hips, shoulderA, shoulderB, q2).invert());
    // Where the rope bars the way: straight ahead of the chest, square to the rope.
    contact.copy(forward).addScaledVector(ropeAxis, -forward.dot(ropeAxis)); if (contact.lengthSq() < 1e-8) contact.copy(forward); contact.normalize();

    // The body is a pendulum under the hands. It makes for the rope's line, less a little for the way it is travelling
    // (the feet trail), and being under-damped it swings past and comes back; but the rope is in front of its chest,
    // so it can swing back from the rope and not through it.
    v2.copy(gripVel).addScaledVector(ropeAxis, -gripVel.dot(ropeAxis));
    v3.copy(attached ? ropeAxis : DOWN).addScaledVector(v2, attached ? -B.trail : 0).normalize();
    const steps = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / steps, w = B.swingFrequency;
    const twistTarget = attached && this.climbing !== 0 ? THREE.MathUtils.clamp((this.handOffset(1, f.ropeD) - this.handOffset(0, f.ropeD)) / .5, -1, 1) : 0;
    for (let i = 0; i < steps; i++) {
      v4.subVectors(v3, this.axis).multiplyScalar(w * w).addScaledVector(this.axisVel, -2 * B.swingDamping * w);
      this.axisVel.addScaledVector(v4, h); this.axis.addScaledVector(this.axisVel, h).normalize();
      this.axisVel.addScaledVector(this.axis, -this.axisVel.dot(this.axis));
      if (attached) {
        const into = v4.subVectors(this.axis, ropeAxis).dot(contact);
        if (into > 0) {
          this.axis.addScaledVector(contact, -into).normalize();
          const speed = this.axisVel.dot(contact); if (speed > 0) this.axisVel.addScaledVector(contact, -speed * (1 + B.ropeBounce));
        }
      }
      const bw = B.bobFrequency, bobTarget = attached ? -B.chargePullUp * smooth(f.charge) : 0;
      this.bobVel += (bw * bw * (bobTarget - this.bob) - 2 * B.bobDamping * bw * this.bobVel) * h; this.bob += this.bobVel * h;
      const aw = B.absorbFrequency;
      v4.copy(this.absorb).multiplyScalar(-aw * aw).addScaledVector(this.absorbVel, -2 * aw);
      this.absorbVel.addScaledVector(v4, h); this.absorb.addScaledVector(this.absorbVel, h);
      v4.copy(this.spin).multiplyScalar(-aw * aw).addScaledVector(this.spinVel, -2 * aw);
      this.spinVel.addScaledVector(v4, h); this.spin.addScaledVector(this.spinVel, h);
      const lw = B.legSwingFrequency;
      v4.copy(this.axis).addScaledVector(v2, attached ? -B.legTrail : 0).normalize().sub(this.legAxis).multiplyScalar(lw * lw).addScaledVector(this.legAxisVel, -2 * B.legSwingDamping * lw);
      this.legAxisVel.addScaledVector(v4, h); this.legAxis.addScaledVector(this.legAxisVel, h).normalize();
      this.legAxisVel.addScaledVector(this.legAxis, -this.legAxisVel.dot(this.legAxis));
      this.twistVel += (196 * (twistTarget - this.twist) - 28 * this.twistVel) * h; this.twist += this.twistVel * h;
    }
    this.coil += ((attached ? smooth(f.charge) : 0) - this.coil) * Math.min(1, 14 * dt);
    // How much the legs are scrambling: eased in and out with the climb, so the feet never step as it starts or stops.
    this.scramble += ((attached && this.climbing !== 0 ? 1 : 0) - this.scramble) * Math.min(1, 9 * dt);
    // Load along the body: heaviest through the bottom of the arc, lightest at its ends. Eased, so it never steps.
    const load = Math.min(1, v2.lengthSq() / 30) - .35 * Math.min(1, Math.acos(Math.min(1, Math.max(-1, -ropeAxis.y))) / .85);
    this.swingLoad += (load * (attached ? 1 : 0) - this.swingLoad) * Math.min(1, 6 * dt);

    // Where the body goes. Its torso is stood up, turned and tipped toward the reaching hand, laid onto the body's own
    // line, and hung by the shoulders below the grip with the rope in front of it; everything turns about the hips.
    axisNow.copy(DOWN).lerp(this.axis, bodyW).normalize();
    tilt.setFromUnitVectors(DOWN, axisNow);
    turn.copy(IDENTITY).slerp(this.stand, bodyW);
    turn.premultiply(q2.setFromAxisAngle(forward, -B.climbRoll * this.twist * bodyW)).premultiply(q2.setFromAxisAngle(UP, B.climbTwist * this.twist * bodyW)).premultiply(tilt);
    forward.applyQuaternion(tilt); side.applyQuaternion(tilt);
    // The rope's own frame at the hands and feet: up it, square to it ahead of the body, and across.
    ropeUp.copy(ropeAxis).negate();
    ropeForward.copy(forward).addScaledVector(ropeUp, -forward.dot(ropeUp)); if (ropeForward.lengthSq() < 1e-8) ropeForward.copy(forward); ropeForward.normalize();
    ropeSide.crossVectors(ropeUp, ropeForward).normalize();
    const bob = this.bob * Math.max(bodyW, handW);
    if (attached) {
      placed.copy(grip).addScaledVector(axisNow, reach * B.shoulderDrop + bob).addScaledVector(forward, -B.ropeClearance);
      placed.sub(v0.copy(torso).applyQuaternion(turn));        // the hips, with the shoulders where they belong
    } else placed.copy(hips).addScaledVector(this.hipOffset, bodyW).addScaledVector(axisNow, bob * bodyW);
    // The reach of the arms is a limit, not a wish: a body bouncing lower than they can hold is held up by them.
    if (attached) this.walkHands(f, dt);
    this.handTarget(rope, f.ropeD, 0, -1, targetL, turnL); this.handTarget(rope, f.ropeD, 1, 1, targetR, turnR);
    if (attached) {
      // How far along its own line the body may sit with both wrists still in reach: each arm allows a span of it.
      let low = -Infinity, high = Infinity;
      for (const [arm, target, length] of [[bones.armL, targetL, reachL], [bones.armR, targetR, reachR]] as const) {
        arm.getWorldPosition(v1).sub(hips).applyQuaternion(turn).add(placed).sub(target);
        const along = v1.dot(axisNow), room = along * along - v1.lengthSq() + (length * .985) ** 2, half = Math.sqrt(Math.max(0, room));
        low = Math.max(low, -along - half); high = Math.min(high, -along + half);
      }
      placed.addScaledVector(axisNow, low <= high ? Math.min(high, Math.max(low, 0)) : (low + high) / 2);
      this.hipOffset.subVectors(placed, hips);
    }

    // A catch starts from the torso as it was drawn the frame before, hips and turn and the speed of both, and all
    // of that runs out into the hang: nothing about the body steps when the hands close.
    const caught = this.pendingCatch && this.history >= 1 && this.lastHips.distanceTo(placed) < 3.5;
    if (this.pendingCatch) {
      this.pendingCatch = false; this.absorbing = caught;
      this.absorb.set(0, 0, 0); this.absorbVel.set(0, 0, 0); this.spin.set(0, 0, 0); this.spinVel.set(0, 0, 0);
      if (caught) {
        torsoFrame(hips, shoulderA, shoulderB, q3).premultiply(turn).invert();           // (undoing) the torso the hang would draw
        if (this.history >= 2) {
          // Carried on one frame from where it was, at the speed it had: the catch is not a frame's pause either.
          turnVector(q2.copy(this.lastFrame).multiply(keepA.copy(this.prevFrame).invert()), this.spinVel).divideScalar(this.lastDt).clampLength(0, B.catchSpin);
          turnVector(turnFromVector(v1.copy(this.spinVel).multiplyScalar(dt), q2).multiply(this.lastFrame).multiply(q3), this.spin);
        } else turnVector(q2.copy(this.lastFrame).multiply(q3), this.spin);
      }
    } else if (this.absorbing && this.absorb.lengthSq() < 1e-6 && this.spin.lengthSq() < 4e-6 && this.absorbVel.lengthSq() < 1e-4 && this.spinVel.lengthSq() < 1e-3) {
      this.absorbing = false; this.absorb.set(0, 0, 0); this.absorbVel.set(0, 0, 0); this.spin.set(0, 0, 0); this.spinVel.set(0, 0, 0);
    }
    spun.identity();
    if (this.absorbing) {
      turnFromVector(this.spin, q2); spun.copy(q2);
      // While the torso is still coming upright from in front, the hips hang back by as much as the head is ahead
      // of them: the head comes up behind the rope, not through it.
      const ahead = v1.copy(axisNow).negate().applyQuaternion(q2).dot(forward);
      if (ahead > 0) placed.addScaledVector(forward, -ahead * B.headReach);
      if (caught) {
        if (this.history >= 2) {
          v1.subVectors(this.lastHips, this.prevHips).divideScalar(this.lastDt).clampLength(0, 30);
          this.absorb.copy(this.lastHips).addScaledVector(v1, dt).sub(placed);
          this.absorbVel.copy(v1).sub(this.ropeVelocity).clampLength(0, B.catchCarry);
        } else { this.absorb.subVectors(this.lastHips, placed); this.absorbVel.copy(this.catchVelocity); }
      }
      placed.add(this.absorb); turn.premultiply(q2);
      // The limbs are aimed from the torso as it is drawn, still coming round, not from where it will settle.
      forward.applyQuaternion(q2); side.applyQuaternion(q2); axisNow.applyQuaternion(q2);
    }
    // The body's origin follows its hips.
    v0.subVectors(origin, hips).applyQuaternion(turn).add(placed);
    q2.copy(turn).multiply(q0);
    this.rootOffsetY = v0.y - origin.y;
    if (!this.absorbing) this.shoveHeld = false;
    this.giveWay(rope, placed, (!attached && passing) || this.shoveHeld, steps, h);
    body.quaternion.copy(q1.invert().multiply(q2)); body.position.copy(parent.worldToLocal(v0));
    body.updateWorldMatrix(true, true);

    // The head looks up the rope, clear of the hands in front of the face.
    if (bones.head && bodyW > 0) { bones.head.rotateOnWorldAxis(side, -B.headBack * bodyW); bones.head.updateWorldMatrix(false, true); }

    // Hands: each holds the rope in its palm, planted, walking it hand over hand as the grip travels.
    let leftGripError = 0, rightGripError = 0, short = 0;
    if (handW > 0) {
      // (How far short of the rope the arms are, as a fraction of their length: next frame they stretch by it.)
      if (attached) short = Math.max(bones.armL.getWorldPosition(v0).distanceTo(targetL) / reachL, bones.armR.getWorldPosition(v0).distanceTo(targetR) / reachR) * (1 + this.armStretch) - 1;
      leftGripError = this.reach(bones.armL, bones.elbowL, bones.wristL, targetL, turnL, -1, handW);
      rightGripError = this.reach(bones.armR, bones.elbowR, bones.wristR, targetR, turnR, 1, handW);
    }
    this.armStretch = Math.min(B.catchArmStretch, Math.max(0, short)) * handW;
    for (const index of [0, 1] as const) { const t = this.hands[index].t; this.grip[index] = handW * (t < 1 ? 1 - .45 * Math.sin(Math.PI * t) : 1); }

    // Feet. Where there is rope below the hips each shoe clamps it from its own side, scissoring with the climb and
    // tucking up for a leap. Where there is none (hands at the rope's end, where most catches are made) the legs hang
    // free and swing as a pendulum of their own. A catch always begins with them free and swinging on through.
    if (legW > 0 && bones.legL && bones.kneeL && bones.ankleL && bones.legR && bones.kneeR && bones.ankleR) {
      const settled = attached ? smooth((this.attachedAge - B.catchClampDelay) / B.catchClamp) : 1, tuck = smooth(f.charge);
      const cp = Math.cos(B.footPoint), sp = Math.sin(B.footPoint);
      // Down the free legs as drawn: their own pendulum, brought round with the torso while a catch runs out, and
      // drawn up toward the chest by a charge.
      v3.copy(this.legAxis).applyQuaternion(spun).addScaledVector(forward, .1 + .9 * tuck).normalize();
      for (const [leg, knee, ankle, sign] of [[bones.legL, bones.kneeL, bones.ankleL, -1], [bones.legR, bones.kneeR, bones.ankleR, 1]] as const) {
        leg.getWorldPosition(v0); knee.getWorldPosition(v1); ankle.getWorldPosition(v2);
        const length = v0.distanceTo(v1) + v1.distanceTo(v2), hip = v4.subVectors(v0, grip).dot(ropeAxis);
        const scissor = B.footScissor * this.scramble * Math.sin(this.stride * Math.PI * 2 + (sign > 0 ? Math.PI : 0));
        const s = hip + length * B.footReach + scissor - B.chargeTuck * tuck + sign * .04;
        // How much rope there is to clamp: all of it down to a hand's breadth above the knot, none below the knot.
        const clamp = settled * smooth((rope.len - .1 - (f.ropeD + s)) / .7 + 1);
        // The shoe's own frame on the rope: toes down it and out, sole turned in toward it.
        az.copy(ropeForward).multiplyScalar(cp).addScaledVector(ropeAxis, sp);                 // toes
        ay.copy(ropeUp).multiplyScalar(cp).addScaledVector(ropeForward, sp);                   // up out of the shoe
        az.applyAxisAngle(ay, sign * B.footOut); ay.applyAxisAngle(az, -sign * B.footRoll);
        ax.crossVectors(ay, az).normalize();
        drawnRopePoint(rope, Math.min(rope.len, Math.max(.2, f.ropeD + s)), v4);
        v4.addScaledVector(ropeSide, sign * (B.ropeRadius + B.shoeHalfWidth + .045)).addScaledVector(az, -B.footBack);
        if (clamp < 1) {
          // Free: the foot hangs from the hip, out to its own side, one leg a little longer than the other.
          v1.copy(v3).multiplyScalar(length * (B.legHang - .3 * tuck - (sign > 0 ? .13 : 0))).add(v0).addScaledVector(side, sign * .1).addScaledVector(forward, sign * .05);
          v4.lerpVectors(v1, v4, clamp);
          // ...and comes round to the rope on an arc about the hip, never folding up through it.
          const near = v1.subVectors(v4, v0).length(); if (near < length * .62 && near > 1e-4) v4.copy(v0).addScaledVector(v1, length * .62 / near);
        }
        // Knees out past the rope and wide of it, so the thighs go round it; ahead of the body when hanging free.
        pole.copy(v0).addScaledVector(forward, .7).addScaledVector(side, sign * (.25 + .5 * clamp)).addScaledVector(ropeAxis, .15 * clamp);
        keepC.copy(ankle.quaternion);
        this.solve(leg, knee, ankle, v4, pole, legW, 4);
        knee.updateWorldMatrix(true, false);
        q3.setFromRotationMatrix(basis.makeBasis(ax, ay, az));
        ankle.quaternion.copy(keepC).slerp(q2.copy(knee.getWorldQuaternion(keepA)).invert().multiply(q3), legW * clamp);
      }
    }
    body.updateWorldMatrix(true, true);
    this.remember(bones, dt);
    return { leftGripError, rightGripError, rootOffsetY: this.rootOffsetY, active: true };
  }

  /** Keep the torso as it has just been drawn, for a catch to start from. */
  private remember(bones: RopeBodyBones, dt: number): void {
    this.prevHips.copy(this.lastHips); this.prevFrame.copy(this.lastFrame);
    bones.armL.getWorldPosition(v0); bones.armR.getWorldPosition(v1);
    if (bones.legL && bones.legR) { bones.legL.getWorldPosition(this.lastHips); bones.legR.getWorldPosition(v2); this.lastHips.add(v2).multiplyScalar(.5); }
    else this.lastHips.addVectors(v0, v1).multiplyScalar(.5).addScaledVector(DOWN, .8);
    torsoFrame(this.lastHips, v0, v1, this.lastFrame);
    this.history = Math.min(2, this.history + 1); if (dt > 1e-5) this.lastDt = dt;
  }

  /** A hand's place relative to the grip (metres down the rope), mid-reach included. */
  private handOffset(index: 0 | 1, ropeD: number): number {
    const hand = this.hands[index];
    return hand.t >= 1 ? hand.d - ropeD : hand.from + (hand.to - hand.from) * smoother(hand.t);
  }
  /**
   * Where a hand's wrist goes, and how the hand is turned, to hold the rope: the rope lies across the palm, the
   * thumb up it, the hand turned in from its own side so the two palms take the rope between them.
   */
  private handTarget(rope: FlexibleRopeState, ropeD: number, index: 0 | 1, sign: number, out: THREE.Vector3, turned: THREE.Quaternion): void {
    const B = ROPE_BODY, hand = this.hands[index], c = Math.cos(B.handTurn), s = Math.sin(B.handTurn);
    drawnRopePoint(rope, Math.min(rope.len, Math.max(.05, ropeD + this.handOffset(index, ropeD))), out);
    // Along the hand from the wrist (forward and inward), and out of its palm (inward and back).
    v1.copy(ropeForward).multiplyScalar(c).addScaledVector(ropeSide, -sign * s);
    v2.copy(ropeSide).multiplyScalar(-sign * c).addScaledVector(ropeForward, -s);
    out.addScaledVector(v1, -B.palmAlong).addScaledVector(v2, -B.palmOff);
    // A reaching hand's palm comes off the rope, the way it faces, and back on.
    if (hand.t < 1) { const lift = B.handLift * Math.sin(Math.PI * hand.t); out.addScaledVector(v2, -lift).addScaledVector(v1, -.3 * lift); }
    // (The hand's own axes: fingers run down its -Y, the thumb points along its +Z, the palm faces across its X.)
    ay.copy(v1).negate(); az.copy(ropeUp); ax.crossVectors(ay, az).normalize();
    turned.setFromRotationMatrix(basis.makeBasis(ax, ay, az));
  }
  /**
   * Planted hands stay where they are on the rope; one at a time, the hand at the end of its pull reaches on past the
   * other. When the climb stops they hold where they are. A hand the grip is carrying out of the arms' reach slides
   * rather than lets the arm part from it.
   */
  private walkHands(f: RopeBodyFrame, dt: number): void {
    const B = ROPE_BODY, [a, b] = this.hands, moved = this.lastRopeD - f.ropeD, rate = dt > 1e-5 ? -moved / dt : 0;
    this.lastRopeD = f.ropeD;
    this.climbing = rate < -.05 ? 1 : rate > .05 ? -1 : 0;
    this.stride = (this.stride + moved / B.climbStride + 1) % 1;
    for (const hand of this.hands) {
      if (hand.t < 1) {
        hand.t = Math.min(1, hand.t + dt / B.handReachSeconds);
        if (hand.t >= 1) {
          hand.d = f.ropeD + hand.to; this.holds++;
          // Each new hold tugs the body: up the rope on the way up, a little drop onto it on the way down.
          if (this.climbing > 0) this.bobVel -= B.climbTug; else if (this.climbing < 0) this.bobVel += B.climbTug * .6;
        }
      } else hand.d = Math.min(f.ropeD + B.handLow + .12, Math.max(f.ropeD + B.handHigh - .05, hand.d));
    }
    const setOff = this.climbing !== 0 && this.climbing !== this.wasClimbing;
    if (a.t < 1 || b.t < 1) return;
    this.wasClimbing = this.climbing;
    const sa = a.d - f.ropeD, sb = b.d - f.ropeD;
    const start = (hand: Hand, from: number, to: number) => { hand.from = from; hand.to = to; hand.t = 0; };
    if (this.climbing > 0) {
      // The grip is rising past the planted hands: the lower one lets go and reaches as high as the arm will go. It
      // goes at once as the climb sets off, so the other is never carried out of reach waiting for it.
      const low = sa > sb ? a : b, s = Math.max(sa, sb);
      if (s > B.handLow || (setOff && s > B.handHigh + .12)) start(low, s, B.handHigh);
    } else if (this.climbing < 0) {
      // ...and on the way down the upper one lets go and takes a new hold below the other.
      const high = sa < sb ? a : b, s = Math.min(sa, sb);
      if (s < B.handHigh + .04 || (setOff && s < B.handLow - .2)) start(high, s, B.handLow);
    }
  }
  /**
   * The drawn rope gives way to the body. Wherever, between the feet and the top of the head, the rope would lie
   * inside the room the body takes up, it is pushed round the body's side to that room's edge: at once while the
   * body is passing through it, and it swings back on a spring after. `hipsAt` is where the body's hips are drawn.
   */
  private giveWay(rope: FlexibleRopeState, hipsAt: THREE.Vector3, watch: boolean, steps: number, h: number): void {
    const B = ROPE_BODY;
    let need = 0, top = rope.len;
    if (watch) {
      for (let d = .2; d <= rope.len + 1e-6; d += .2) {
        flexibleRopePoint(rope, Math.min(rope.len, d), v2).sub(hipsAt);
        const height = -v2.dot(axisNow); if (height < -.95 || height > 1.4) continue;
        const depth = v2.dot(forward) / B.bodyDepth; if (Math.abs(depth) >= 1) continue;
        const lateral = v2.dot(side), edge = B.bodyWidth * Math.pow(1 - depth * depth, .6);
        if (Math.abs(lateral) >= edge) continue;                                // beside the body already
        if (this.shoveSide === 0) this.shoveSide = lateral < -.04 ? -1 : 1;     // round the side it is already on
        const push = this.shoveSide > 0 ? edge - lateral : -edge - lateral;
        if (Math.abs(push) > Math.abs(need)) need = push;
        top = Math.min(top, d);
      }
    }
    if (need !== 0 && Math.abs(need) >= Math.abs(this.shove)) {
      // In the way: the rope is where the body has put it, and leaves it with a little of the speed it was pushed at.
      this.shoveVel = THREE.MathUtils.clamp(h > 0 ? (need - this.shove) / (h * steps) : 0, -2.5, 2.5); this.shove = need; rope.shoveD = top;
    } else {
      const sw = B.shoveFrequency;
      for (let i = 0; i < steps; i++) { this.shoveVel += (sw * sw * (need - this.shove) - 2 * B.shoveDamping * sw * this.shoveVel) * h; this.shove += this.shoveVel * h; }
      if (need === 0 && Math.abs(this.shove) < 2e-3 && Math.abs(this.shoveVel) < 2e-2) { this.shove = this.shoveVel = 0; this.shoveSide = 0; }
    }
    // Into the rope's own frame: along its swing, up, and across.
    const c = Math.cos(rope.yaw), s = Math.sin(rope.yaw), x = side.x * this.shove, y = side.y * this.shove, z = side.z * this.shove;
    (rope.shove ??= new THREE.Vector3()).set(x * c - z * s, y, x * s + z * c);
    rope.shoveD ??= rope.len;
  }
  private reach(arm: THREE.Object3D, elbow: THREE.Object3D, wrist: THREE.Object3D, target: THREE.Vector3, turned: THREE.Quaternion, sign: number, weight: number): number {
    arm.getWorldPosition(v0);
    // Elbows out to the side and down: a body hanging behind a rope, not hugging it.
    pole.copy(v0).addScaledVector(side, sign * .45).addScaledVector(forward, .08).addScaledVector(axisNow, .3);
    keepC.copy(wrist.quaternion);
    this.solve(arm, elbow, wrist, target, pole, weight, 6);
    elbow.updateWorldMatrix(true, false);
    wrist.quaternion.copy(keepC).slerp(q2.copy(elbow.getWorldQuaternion(keepA)).invert().multiply(turned), weight);
    wrist.updateWorldMatrix(false, true);
    return weight >= 1 ? wrist.getWorldPosition(v1).distanceTo(target) : 0;
  }
  private solve(root: THREE.Object3D, mid: THREE.Object3D, end: THREE.Object3D, target: THREE.Vector3, poleAt: THREE.Vector3, weight: number, passes: number): void {
    keepA.copy(root.quaternion); keepB.copy(mid.quaternion);
    for (let i = 0; i < passes; i++) solveTwoBoneIk({ root, mid, end, target, pole: poleAt, accountForParentScale: true, tolerance: .002 } as Parameters<typeof solveTwoBoneIk>[0]);
    if (weight < 1) { root.quaternion.copy(keepA.slerp(root.quaternion, weight)); mid.quaternion.copy(keepB.slerp(mid.quaternion, weight)); }
  }
}
