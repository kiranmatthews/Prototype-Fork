import * as THREE from "three";

interface TransformTrack {
  object: THREE.Object3D;
  previousPosition: THREE.Vector3;
  currentPosition: THREE.Vector3;
  previousQuaternion: THREE.Quaternion;
  currentQuaternion: THREE.Quaternion;
  previousScale: THREE.Vector3;
  currentScale: THREE.Vector3;
  visible: boolean;
  active: boolean;
}

/**
 * Keeps rendering separate from the fixed-step simulation.
 *
 * Simulation writes ordinary Object3D transforms, then `capture()` advances a
 * pair of authoritative snapshots. Render frames may temporarily interpolate
 * those objects; `restore()` puts the latest fixed pose back before simulation
 * runs again, so render cadence can never leak into gameplay or procedural
 * animation state.
 */
export class RenderInterpolator {
  private readonly tracks = new Map<THREE.Object3D, TransformTrack>();
  private readonly seen = new Set<THREE.Object3D>();
  private snapPending = true;
  private ready = false;
  private presentationApplied = false;

  get hasPose(): boolean {
    return this.ready;
  }

  /** Discard history at a semantic teleport/pause boundary. */
  snap(): void {
    // A DOM/input callback can request a respawn between RAFs. Fail safe even
    // if an interpolated presentation pose is still installed.
    this.restore();
    this.tracks.clear();
    this.seen.clear();
    this.snapPending = true;
    this.ready = false;
  }

  /** Hold the current fixed pose as both endpoints without discarding tracks. */
  collapse(): void {
    this.restore();
    if (!this.ready) return;
    for (const track of this.tracks.values()) {
      track.previousPosition.copy(track.currentPosition);
      track.previousQuaternion.copy(track.currentQuaternion);
      track.previousScale.copy(track.currentScale);
      track.active = false;
    }
    this.snapPending = false;
  }

  /** Restore the last fixed-step pose before any simulation code executes. */
  restore(): void {
    if (!this.ready || !this.presentationApplied) return;
    for (const track of this.tracks.values()) {
      if (!track.active) continue;
      track.object.position.copy(track.currentPosition);
      track.object.quaternion.copy(track.currentQuaternion);
      track.object.scale.copy(track.currentScale);
    }
    this.presentationApplied = false;
  }

  /** Advance fixed-step history from the transforms simulation just authored. */
  capture(objects: Iterable<THREE.Object3D>): void {
    this.seen.clear();
    const snap = this.snapPending || !this.ready;
    for (const object of objects) {
      if (this.seen.has(object)) continue;
      this.seen.add(object);
      let track = this.tracks.get(object);
      if (!track) {
        track = {
          object,
          previousPosition: object.position.clone(),
          currentPosition: object.position.clone(),
          previousQuaternion: object.quaternion.clone(),
          currentQuaternion: object.quaternion.clone(),
          previousScale: object.scale.clone(),
          currentScale: object.scale.clone(),
          visible: object.visible,
          active: false,
        };
        this.tracks.set(object, track);
        continue;
      }
      if (snap) {
        track.previousPosition.copy(object.position);
        track.currentPosition.copy(object.position);
        track.previousQuaternion.copy(object.quaternion);
        track.currentQuaternion.copy(object.quaternion);
        track.previousScale.copy(object.scale);
        track.currentScale.copy(object.scale);
        track.visible = object.visible;
        track.active = false;
        continue;
      }
      // Visibility is intentionally discrete. Collapse transform history on a
      // hide/show edge so a reused pooled object cannot reappear at the stale
      // place it occupied before it was hidden.
      if (track.visible !== object.visible) {
        track.previousPosition.copy(object.position);
        track.currentPosition.copy(object.position);
        track.previousQuaternion.copy(object.quaternion);
        track.currentQuaternion.copy(object.quaternion);
        track.previousScale.copy(object.scale);
        track.currentScale.copy(object.scale);
        track.visible = object.visible;
        track.active = false;
        continue;
      }
      track.previousPosition.copy(track.currentPosition);
      track.previousQuaternion.copy(track.currentQuaternion);
      track.previousScale.copy(track.currentScale);
      track.currentPosition.copy(object.position);
      track.currentQuaternion.copy(object.quaternion);
      track.currentScale.copy(object.scale);
      track.active =
        track.previousPosition.distanceToSquared(track.currentPosition) > 1e-12 ||
        1 - Math.abs(track.previousQuaternion.dot(track.currentQuaternion)) > 1e-10 ||
        track.previousScale.distanceToSquared(track.currentScale) > 1e-12;
    }
    for (const object of this.tracks.keys()) {
      if (!this.seen.has(object)) this.tracks.delete(object);
    }
    this.snapPending = false;
    this.ready = true;
  }

  /** Render one-step-behind interpolation at accumulator fraction 0..1. */
  apply(alpha: number): void {
    if (!this.ready) return;
    const t = THREE.MathUtils.clamp(alpha, 0, 1);
    for (const track of this.tracks.values()) {
      if (!track.active) continue;
      track.object.position.lerpVectors(
        track.previousPosition,
        track.currentPosition,
        t,
      );
      track.object.quaternion.slerpQuaternions(
        track.previousQuaternion,
        track.currentQuaternion,
        t,
      );
      track.object.scale.lerpVectors(track.previousScale, track.currentScale, t);
    }
    this.presentationApplied = true;
  }
}
