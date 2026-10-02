import * as THREE from 'three';

/** Read-only presentation frame. The player's course/input heading stays separate. */
export interface LoopCameraFrame {
  readonly normal: THREE.Vector3;
  readonly tangent: THREE.Vector3;
}
export interface LoopFallCameraFrame { readonly elapsed:number; readonly side:THREE.Vector3; readonly backward:THREE.Vector3; readonly normal:THREE.Vector3; readonly focus:THREE.Vector3 }
export interface LoopCameraFramingOptions { distance: number; height: number; pitch: number }

/** Normal close skating composition transported around the loop's ride plane.
 * Restore before stepping the ordinary rig, then apply after its input heading
 * is published. The overlay never changes the lens or feeds back into physics. */
export class LoopCameraFraming {
  private applied = false;
  private releaseWeight = 0;
  private followReleaseTime = 0;
  private readonly savedPosition = new THREE.Vector3();
  private readonly savedOrientation = new THREE.Quaternion();
  private readonly savedUp = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly normal = new THREE.Vector3();
  private readonly back = new THREE.Vector3();
  private readonly basis = new THREE.Matrix4();
  private readonly loopFrame = new THREE.Quaternion();
  private readonly baseFrame = new THREE.Quaternion();
  private readonly blendedFrame = new THREE.Quaternion();
  private readonly pitchRotation = new THREE.Quaternion();
  private readonly inverse = new THREE.Quaternion();
  private readonly offset = new THREE.Vector3();
  private readonly normalOffset = new THREE.Vector3();
  private readonly xAxis = new THREE.Vector3(1, 0, 0);
  private falling=false;
  private fallAge=0;
  private readonly fallStartOffset=new THREE.Vector3();
  private readonly presentedUp=new THREE.Vector3(0,1,0);
  private readonly fallStartUp=new THREE.Quaternion();
  private readonly fallUp=new THREE.Quaternion();
  private readonly fallTarget=new THREE.Vector3();
  private readonly fallOffset=new THREE.Vector3();

  get active(): boolean { return this.falling || this.releaseWeight > 0 || this.followReleaseTime > 0; }

  restore(camera: THREE.PerspectiveCamera): void {
    if (!this.applied) return;
    camera.position.copy(this.savedPosition);
    camera.quaternion.copy(this.savedOrientation);
    camera.up.copy(this.savedUp);
    this.applied = false;
  }

  apply(camera: THREE.PerspectiveCamera, frame: LoopCameraFrame | null | undefined,
    subject: THREE.Vector3, framing: LoopCameraFramingOptions, dt: number, snap = false, fall?:LoopFallCameraFrame|null): void {
    // A checkpoint/level change cannot inherit a previous inverted horizon.
    if (snap) {this.releaseWeight = this.followReleaseTime = 0;this.falling=false;}
    if(fall){
      if(!this.falling){
        this.fallAge=0;
        this.fallStartOffset.copy(this.offset).add(subject).sub(fall.focus);
        if(this.fallStartOffset.lengthSq()<1)this.fallStartOffset.subVectors(camera.position,fall.focus);
        this.fallStartUp.setFromUnitVectors(new THREE.Vector3(0,1,0),this.presentedUp);
      }
      this.falling=true;this.fallAge+=Math.max(0,dt);
      this.savedPosition.copy(camera.position);this.savedOrientation.copy(camera.quaternion);this.savedUp.copy(camera.up);this.applied=true;
      // Move outside the riding ribbon first, then settle the horizon. The
      // whole-body tumble reads against the track instead of through it.
      const inward=1-THREE.MathUtils.smoothstep(this.fallAge,.35,.95);
      this.fallOffset.copy(fall.side).multiplyScalar(8).addScaledVector(fall.backward,2).addScaledVector(fall.normal,4*inward);
      this.fallOffset.y+=4.3*(1-inward);
      this.offset.copy(this.fallStartOffset).lerp(this.fallOffset,THREE.MathUtils.smoothstep(this.fallAge,0,.28));
      camera.position.copy(fall.focus).add(this.offset);
      this.fallUp.copy(this.fallStartUp).slerp(new THREE.Quaternion(),THREE.MathUtils.smoothstep(this.fallAge,0,.45));
      camera.up.set(0,1,0).applyQuaternion(this.fallUp);
      this.fallTarget.copy(fall.focus);
      this.basis.lookAt(camera.position,this.fallTarget,camera.up);camera.quaternion.setFromRotationMatrix(this.basis);
      this.presentedUp.copy(camera.up);this.releaseWeight=0;this.followReleaseTime=.8;
      return;
    }
    this.falling=false;
    if (frame) {
      this.normal.copy(frame.normal).normalize();
      this.back.copy(frame.tangent).negate().normalize();
      this.right.crossVectors(this.normal, this.back).normalize();
      this.normal.crossVectors(this.back, this.right).normalize();
      this.basis.makeBasis(this.right, this.normal, this.back);
      this.loopFrame.setFromRotationMatrix(this.basis);
      this.releaseWeight = 1;
      this.followReleaseTime = .8;
    } else {
      // Match the rider's existing surface-alignment return to upright. A
      // delayed smoothstep horizon leaves the camera sideways after the body
      // has already righted itself during a failed-loop fall.
      this.releaseWeight *= Math.max(0, 1 - 12 * Math.max(0, dt));
      if (this.releaseWeight < .025) this.releaseWeight = 0;
      this.followReleaseTime = Math.max(0, this.followReleaseTime - Math.max(0, dt));
    }
    if (this.releaseWeight <= 0 && this.followReleaseTime <= 0) return;

    this.savedPosition.copy(camera.position);
    this.savedOrientation.copy(camera.quaternion);
    this.savedUp.copy(camera.up);
    this.applied = true;
    const pitch = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(framing.pitch, -85, 85));
    this.pitchRotation.setFromAxisAngle(this.xAxis, pitch);
    this.baseFrame.copy(camera.quaternion).multiply(this.pitchRotation);
    const weight = this.releaseWeight;
    this.blendedFrame.copy(this.baseFrame).slerp(this.loopFrame, weight);

    // Blend in local camera coordinates, then rotate the whole offset. A
    // world-space eye lerp from below an inverted rider to above them would
    // pass straight through their body halfway through the release.
    this.inverse.copy(this.baseFrame).invert();
    this.offset.subVectors(camera.position, subject).applyQuaternion(this.inverse);
    this.normalOffset.set(0, framing.height, framing.distance);
    // Give the ordinary ground-anchored rig time to catch a rising detached
    // rider. The horizon settles immediately with the body; translation keeps
    // the same close subject-relative offset briefly, then resumes its damping.
    const offsetWeight = frame ? 1 : THREE.MathUtils.smoothstep(this.followReleaseTime, 0, .3);
    this.offset.lerp(this.normalOffset, offsetWeight).applyQuaternion(this.blendedFrame);
    camera.position.copy(subject).add(this.offset);
    this.pitchRotation.setFromAxisAngle(this.xAxis, -pitch);
    camera.quaternion.copy(this.blendedFrame).multiply(this.pitchRotation);
    camera.up.set(0, 1, 0).applyQuaternion(this.blendedFrame);
    this.presentedUp.copy(camera.up);
  }
}
