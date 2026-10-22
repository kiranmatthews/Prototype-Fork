import * as THREE from 'three';
import { frameBlend } from './skateParkPhysics';

export interface SkateCameraSubject {
  position: Readonly<THREE.Vector3>;
  heading: Readonly<THREE.Vector3>;
  up: Readonly<THREE.Vector3>;
  vertAir: boolean;
  vertNormal: Readonly<THREE.Vector3>;
  verticalSpeed: number;
  speed: number;
  grounded: boolean;
  bailing: boolean;
}

/** Main-game framing for flat park travel. Vert keeps its calibrated profile. */
export interface SkateGroundFraming {
  camDist:number;
  camHeight:number;
  camPitch:number;
  camFov:number;
}

// Reference medium-camera proportions, scaled for this taller character.
// Preserve the reference's vertical framing on a widescreen viewport.
export const SKATE_CAMERA = Object.freeze({
  behind: 12 * 0.3048 * 1.25,
  above: 4.3 * 0.3048 * 1.25,
  tilt: 0.18,
  verticalFov: THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(72) / 2) * 3 / 4)),
});

// The centre samples enforce clearance. Padded samples anticipate a roof
// edge so the shot can lower smoothly before the camera passes beneath it.
const CEILING_PROBES: readonly (readonly [number, number])[] = [
  [0,0],[.25,0],[.5,0],[.75,0],[1,0],
  [0,-1.5],[.5,-1.5],[1,-1.5],[0,1.5],[.5,1.5],[1,1.5],[-.5,0],[1.5,0],
];

/** A three-dimensional chase frame: transition normal is screen-up, and
 * vert air looks down the wall. Tricks do not rotate the camera. */
export class SkateChaseCamera {
  readonly forward = new THREE.Vector3(0, 0, -1);
  readonly aim = new THREE.Vector3();
  readonly desiredEye = new THREE.Vector3();
  private readonly pivot = new THREE.Vector3();
  private readonly orientation = new THREE.Quaternion();
  private readonly targetOrientation = new THREE.Quaternion();
  private readonly basis = new THREE.Matrix4();
  private readonly right = new THREE.Vector3();
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly back = new THREE.Vector3();
  private readonly direction = new THREE.Vector3();
  private readonly ray = new THREE.Raycaster();
  private wasGrounded = true;
  private landingBlendTime = 0;
  private groundBlend = 0;
  private readonly flatForward = new THREE.Vector3();
  private readonly flatEye = new THREE.Vector3();
  private readonly flatAim = new THREE.Vector3();
  private readonly worldUp = new THREE.Vector3(0,1,0);
  private readonly ceilingProbe = new THREE.Vector3();
  private readonly ceilingSweepDirection = new THREE.Vector3();
  private readonly contactNormal = new THREE.Vector3();
  private ceilingEyeDrop = 0;
  private ceilingAimDrop = 0;
  private openingActive = false;
  private openingBlend = 0;
  private readonly openingEye = new THREE.Vector3();
  private readonly openingAim = new THREE.Vector3();
  private readonly down = new THREE.Vector3(0,-1,0);
  /** Final presentation weight; never feeds steering or the vert frame. */
  groundFramingWeight = 0;

  update(camera: THREE.PerspectiveCamera, rider: SkateCameraSubject, dt: number,
    snap: boolean, surfaces: THREE.Object3D[], framing?: SkateGroundFraming): void {
    const step = Math.max(0, Math.min(dt, 0.1));
    const vert = rider.vertAir && !rider.grounded;
    if (rider.grounded && !this.wasGrounded) this.landingBlendTime = 10 / 60;
    this.wasGrounded = rider.grounded;
    this.landingBlendTime = Math.max(0, this.landingBlendTime - step);
    this.forward.copy(vert ? { x: 0, y: -1, z: 0 } : rider.heading).normalize();
    this.up.copy(vert ? rider.vertNormal : rider.grounded ? rider.up : { x: 0, y: 1, z: 0 });
    this.right.crossVectors(this.forward, this.up);
    if (this.right.lengthSq() < 1e-8) this.right.set(1, 0, 0).applyQuaternion(this.orientation);
    this.right.normalize();
    this.up.crossVectors(this.right, this.forward).normalize();
    // A modest downward lens tilt is applied in the surface frame.
    this.direction.copy(this.forward).multiplyScalar(Math.cos(SKATE_CAMERA.tilt))
      .addScaledVector(this.up, -Math.sin(SKATE_CAMERA.tilt));
    this.up.multiplyScalar(Math.cos(SKATE_CAMERA.tilt))
      .addScaledVector(this.forward, Math.sin(SKATE_CAMERA.tilt));
    this.back.copy(this.direction).negate();
    this.basis.makeBasis(this.right, this.up, this.back);
    this.targetOrientation.setFromRotationMatrix(this.basis);
    if (snap) {
      this.orientation.copy(this.targetOrientation);
      this.pivot.copy(rider.position);
    } else {
      if (!rider.bailing) this.orientation.slerp(this.targetOrientation,
        frameBlend(this.landingBlendTime > 0 ? 0.375 : 0.04, step));
      this.pivot.x += (rider.position.x - this.pivot.x) * frameBlend(vert ? 1 : 0.25, step);
      this.pivot.y += (rider.position.y - this.pivot.y) * frameBlend(vert ? 1 : 0.75, step);
      this.pivot.z += (rider.position.z - this.pivot.z) * frameBlend(vert ? 1 : 0.25, step);
    }
    this.back.set(0, 0, 1).applyQuaternion(this.orientation);
    this.up.set(0, 1, 0).applyQuaternion(this.orientation);
    this.aim.copy(rider.position).addScaledVector(rider.up, SKATE_CAMERA.above);
    this.desiredEye.copy(this.pivot).addScaledVector(this.back, SKATE_CAMERA.behind)
      .addScaledVector(rider.up, SKATE_CAMERA.above);
    // Keep the original orientation/pivot evolution intact. Only the final
    // presented shot changes on flats, so the established wall swing is
    // exactly recoverable before the lip instead of being re-tuned.
    this.groundFramingWeight = 0;
    if (framing) {
      const flatness = vert ? 0 : THREE.MathUtils.smoothstep(rider.up.y,
        Math.cos(35*Math.PI/180), Math.cos(5*Math.PI/180));
      this.groundBlend = snap ? flatness : this.groundBlend +
        (flatness-this.groundBlend)*frameBlend(.12,step);
      // The spatial envelope reaches exactly zero on steep transitions.
      // The eased state softens recovery back to the main shot on flat land.
      const blend = this.groundFramingWeight = this.groundBlend*flatness;
      if (blend > 0) {
        this.flatForward.set(-this.back.x,0,-this.back.z);
        if(this.flatForward.lengthSq()<1e-8)this.flatForward.set(rider.heading.x,0,rider.heading.z);
        this.flatForward.normalize();
        this.flatEye.copy(this.pivot).addScaledVector(this.flatForward,-framing.camDist);
        this.flatEye.y+=framing.camHeight;
        const run=Math.max(.1,Math.abs(framing.camDist));
        this.flatAim.copy(this.flatEye).addScaledVector(this.flatForward,run);
        this.flatAim.y-=run*Math.tan(THREE.MathUtils.degToRad(THREE.MathUtils.clamp(framing.camPitch,-85,85)));
        this.desiredEye.lerp(this.flatEye,blend);
        this.aim.lerp(this.flatAim,blend);
        this.up.lerp(this.worldUp,blend).normalize();
      }
      const fov=THREE.MathUtils.lerp(SKATE_CAMERA.verticalFov,framing.camFov,blend);
      if(camera.fov!==fov){camera.fov=fov;camera.updateProjectionMatrix();}
    } else this.groundBlend = 0;
    // A fall through a small roof opening needs a steeper view before the
    // ordinary collision arm meets the rim. Detect real air beneath a roof
    // on both sides of the hole; open ledges and ordinary jumps keep their
    // established shot. Hold the close overhead view until the landing.
    if(snap){this.openingActive=false;this.openingBlend=0;}
    if(rider.grounded||vert||!framing)this.openingActive=false;
    else if(!this.openingActive&&rider.verticalSpeed<-.1&&this.groundFramingWeight>.5){
      this.ceilingProbe.copy(rider.position);this.ceilingProbe.y+=.05;
      this.ray.set(this.ceilingProbe,this.down);this.ray.near=.1;this.ray.far=14;
      const floor=this.ray.intersectObjects(surfaces,false)[0];
      if(floor&&rider.position.y-floor.point.y>3){
        const ceilings:number[]=[];
        for(const along of [-framing.camDist,6]){
          this.ceilingProbe.copy(rider.position).addScaledVector(this.flatForward,along);
          this.ceilingProbe.y=floor.point.y+.4;
          this.ray.set(this.ceilingProbe,this.worldUp);this.ray.near=.05;this.ray.far=rider.position.y-floor.point.y+2;
          const roof=this.ray.intersectObjects(surfaces,false)[0];
          if(!roof?.face)continue;
          this.contactNormal.copy(roof.face.normal).transformDirection(roof.object.matrixWorld);
          if(this.contactNormal.y<-.5&&roof.point.y>floor.point.y+3&&roof.point.y>rider.position.y-1.6)ceilings.push(roof.point.y);
        }
        this.openingActive=ceilings.length===2&&Math.abs(ceilings[0]-ceilings[1])<1.5;
      }
    }
    this.openingBlend+=(Number(this.openingActive)-this.openingBlend)*frameBlend(this.openingActive ? .18 : .12,step);
    if(framing&&this.openingBlend>.001){
      this.openingEye.copy(this.pivot).addScaledVector(this.flatForward,-1.2);this.openingEye.y+=framing.camHeight;
      this.openingAim.copy(rider.position).addScaledVector(this.worldUp,1.6);
      this.desiredEye.lerp(this.openingEye,this.openingBlend);this.aim.lerp(this.openingAim,this.openingBlend);
      this.up.lerp(this.worldUp,this.openingBlend).normalize();
    }
    // Local collision correction: never rotate or displace the skater to
    // satisfy the lens. The smoothed frame naturally restores the full view.
    // A low roof needs a lower trailing shot, not an arm collapsed into the
    // rider's head. Sample the space beneath it before the usual wall clamp.
    // This changes only collision presentation; the calibrated vert frame
    // and unobstructed park camera remain untouched.
    let eyeDrop = 0, aimDrop = 0, hardEyeDrop = 0, hardAimDrop = 0;
    if (this.openingBlend < .01 && this.groundFramingWeight > .5 && this.desiredEye.y > this.aim.y) {
      const targetY = rider.position.y + SKATE_CAMERA.above;
      let ceilingY = Infinity, hardCeilingY = Infinity;
      // Thin doorway lintels can fall between the spaced vertical probes.
      // Sweep the anticipated camera span, then verify an actual underside
      // beneath each hit. Ordinary full-height walls still use the arm clamp.
      const sweepLength=Math.max(1,framing?.camDist??SKATE_CAMERA.behind);
      this.ceilingProbe.copy(rider.position).addScaledVector(this.flatForward,sweepLength*.5);
      this.ceilingProbe.y=this.desiredEye.y;
      this.ceilingSweepDirection.copy(this.flatForward).negate();
      this.ray.set(this.ceilingProbe,this.ceilingSweepDirection);this.ray.near=.05;this.ray.far=sweepLength*2;
      const edges=this.ray.intersectObjects(surfaces,false);
      for(const edge of edges){
        this.ceilingProbe.copy(edge.point).addScaledVector(this.ceilingSweepDirection,.08);this.ceilingProbe.y=targetY;
        this.ray.set(this.ceilingProbe,this.worldUp);this.ray.near=.05;this.ray.far=Math.max(.1,this.desiredEye.y-targetY+.5);
        const roof=this.ray.intersectObject(edge.object,false)[0];
        if(!roof?.face)continue;
        this.contactNormal.copy(roof.face.normal).transformDirection(roof.object.matrixWorld);
        if(this.contactNormal.y<-.5)ceilingY=Math.min(ceilingY,roof.point.y);
      }
      for (const [along, side] of CEILING_PROBES) {
        this.ceilingProbe.lerpVectors(rider.position, this.desiredEye, along);
        this.ceilingProbe.x += this.flatForward.z * side;
        this.ceilingProbe.z -= this.flatForward.x * side;
        this.ceilingProbe.y = targetY;
        this.ray.set(this.ceilingProbe, this.worldUp);
        this.ray.near = .05;
        this.ray.far = Math.max(.1, this.desiredEye.y - targetY + .5);
        const roof = this.ray.intersectObjects(surfaces, false)[0];
        if (!roof?.face) continue;
        this.contactNormal.copy(roof.face.normal).transformDirection(roof.object.matrixWorld);
        if (Math.abs(this.contactNormal.y) <= .5) continue;
        ceilingY = Math.min(ceilingY, roof.point.y);
        if (side === 0 && along >= 0 && along <= 1) hardCeilingY = Math.min(hardCeilingY, roof.point.y);
      }
      eyeDrop = Math.max(0, this.desiredEye.y - (ceilingY - .35));
      hardEyeDrop = Math.max(0, this.desiredEye.y - (hardCeilingY - .35));
      if (eyeDrop > 0) aimDrop = Math.max(0, this.aim.y - Math.min(targetY, ceilingY - .7));
      if (hardEyeDrop > 0) hardAimDrop = Math.max(0, this.aim.y - Math.min(targetY, hardCeilingY - .7));
    }
    if (snap) {
      this.ceilingEyeDrop = eyeDrop;
      this.ceilingAimDrop = aimDrop;
    } else {
      // A bank can cross the flat-framing threshold while the camera is
      // still lowered for a nearby roof or plank. Restore that clearance
      // gradually too; discarding it at the threshold creates a one-frame
      // vertical jump even though the rider never leaves the ground.
      const restore = frameBlend(.12, step);
      this.ceilingEyeDrop = Math.max(hardEyeDrop, this.ceilingEyeDrop + (eyeDrop - this.ceilingEyeDrop) * restore);
      this.ceilingAimDrop = Math.max(hardAimDrop, this.ceilingAimDrop + (aimDrop - this.ceilingAimDrop) * restore);
    }
    if (this.ceilingEyeDrop > 1e-6 || this.ceilingAimDrop > 1e-6) {
      this.desiredEye.y -= this.ceilingEyeDrop;
      this.aim.y -= this.ceilingAimDrop;
    }
    this.direction.subVectors(this.desiredEye, this.aim);
    const distance = this.direction.length();
    this.direction.divideScalar(Math.max(distance, 1e-6));
    this.ray.set(this.aim, this.direction);
    this.ray.near = .1;
    this.ray.far = distance + .2;
    const contact = this.ray.intersectObjects(surfaces, false)[0];
    camera.position.copy(this.desiredEye);
    if (contact) camera.position.copy(this.aim)
      .addScaledVector(this.direction, Math.max(0.35, contact.distance - 0.25));
    camera.up.copy(this.up);
    camera.lookAt(this.aim);
    // Only used by optional look controls; park steering never reads it.
    this.forward.set(-this.back.x, 0, -this.back.z);
    if (this.forward.lengthSq() < 1e-7) this.forward.set(rider.heading.x, 0, rider.heading.z);
    this.forward.normalize();
  }
}

/** Reuse the park's unmodified vert swing on an authored course surface.
 * Restoring before the course rig runs keeps its input heading independent. */
export class SkateChaseCameraOverlay {
  private readonly rig = new SkateChaseCamera();
  get aim():THREE.Vector3 { return this.rig.aim; }
  private readonly eye = new THREE.Vector3();
  private readonly up = new THREE.Vector3();
  private readonly rotation = new THREE.Quaternion();
  private fov = 49;
  private applied = false;
  private active = false;

  restore(camera:THREE.PerspectiveCamera):void {
    if(!this.applied)return;
    camera.position.copy(this.eye);camera.up.copy(this.up);camera.quaternion.copy(this.rotation);
    if(camera.fov!==this.fov){camera.fov=this.fov;camera.updateProjectionMatrix();}
    this.applied=false;
  }

  apply(camera:THREE.PerspectiveCamera,rider:SkateCameraSubject|null,dt:number,snap:boolean,
    surfaces:THREE.Object3D[],framing:SkateGroundFraming):void {
    if(!rider){this.active=false;return;}
    this.eye.copy(camera.position);this.up.copy(camera.up);this.rotation.copy(camera.quaternion);this.fov=camera.fov;
    this.rig.update(camera,rider,dt,snap||!this.active,surfaces,framing);
    this.applied=this.active=true;
  }
}
