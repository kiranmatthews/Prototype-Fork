// Grind rails are authored polylines. Grinding is NOT physics: once attached,
// the rail owns the player's position and moves it along the path by arc
// length at a constant authored grind speed.

import * as THREE from 'three';

export interface RailSample {
  t: number; // arc length along the rail
  point: THREE.Vector3;
  tangent: THREE.Vector3; // unit, pointing toward increasing t
  distance: number; // 3D distance from the queried position
}

export class Rail {
  readonly points: THREE.Vector3[];
  totalLength: number;
  readonly object: THREE.Group;
  // A rail that is not there right now. The sky-bridge ropes snap and fall,
  // and a fallen rope's Rail stays in level.rails with its nodes wherever the
  // plunge left them — a grindable line hanging in empty air where nothing is
  // drawn. Clearing this takes it out of every grind query until it restrings.
  grindable = true;
  private hasVisual = true;

  private segDirs: THREE.Vector3[] = [];
  private segLengths: number[] = [];
  private cumLengths: number[] = []; // arc length at the start of each segment

  constructor(points: THREE.Vector3[], visual = true) {
    if (points.length < 2) throw new Error('rail needs at least 2 points');
    this.points = points;
    this.hasVisual = visual;

    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const dir = points[i + 1].clone().sub(points[i]);
      const len = dir.length();
      this.cumLengths.push(total);
      this.segLengths.push(len);
      this.segDirs.push(dir.normalize());
      total += len;
    }
    this.totalLength = total;

    this.object = this.hasVisual ? this.buildVisual() : new THREE.Group();
  }

  // RE-BAKE after moving the nodes.
  //
  // Segment directions, lengths and arc offsets are computed once in the
  // constructor, which is why the only motion a live rail may normally make is
  // a rigid translation. A rope that SAGS is a stretch: its nodes drop but its
  // baked directions stay horizontal, so closest()/pointAt() keep returning
  // the taut line — a flat step per segment with a hard vertical pop at every
  // node, up to a third of a metre off the rope you can see. Anything that
  // deforms a rail non-rigidly must call this immediately afterwards so the
  // grind path is the line that is actually drawn. Arc length changes with the
  // shape, so a rider's grindT shifts slightly along the span; that is far
  // smaller than the staircase it replaces.
  rebake(): void {
    let total = 0;
    for (let i = 0; i < this.points.length - 1; i++) {
      const dir = this.points[i + 1].clone().sub(this.points[i]);
      const len = dir.length();
      this.cumLengths[i] = total;
      this.segLengths[i] = len;
      this.segDirs[i] = len > 1e-9 ? dir.divideScalar(len) : dir.set(1, 0, 0);
      total += len;
    }
    this.totalLength = total;
  }

  // Closest point on the polyline to `pos`, as arc length + tangent.
  closest(pos: THREE.Vector3): RailSample {
    let best: RailSample | null = null;
    const tmp = new THREE.Vector3();
    for (let i = 0; i < this.segLengths.length; i++) {
      const a = this.points[i];
      const dir = this.segDirs[i];
      const len = this.segLengths[i];
      tmp.copy(pos).sub(a);
      const along = THREE.MathUtils.clamp(tmp.dot(dir), 0, len);
      const point = a.clone().addScaledVector(dir, along);
      const distance = point.distanceTo(pos);
      if (!best || distance < best.distance) {
        best = { t: this.cumLengths[i] + along, point, tangent: dir.clone(), distance };
      }
    }
    return best!;
  }

  // Closest point on the polyline measured in the XZ plane only (ignoring
  // height), plus the rail's local tangent and the interpolated rail height
  // there. Used by the on-foot rail block / high-speed trip, which cares about
  // horizontal proximity to the rail line and tests vertical overlap
  // separately (a rail overhead or underfoot must not block you).
  closestXZ(pos: THREE.Vector3): { point: THREE.Vector3; tangent: THREE.Vector3; distXZ: number } {
    let best: { point: THREE.Vector3; tangent: THREE.Vector3; distXZ: number } | null = null;
    for (let i = 0; i < this.segLengths.length; i++) {
      const a = this.points[i];
      const dir = this.segDirs[i];
      const len = this.segLengths[i];
      // Project (pos - a) onto the segment's XZ SHADOW. dir is a 3D unit
      // vector, so (dir.x, dir.z) is NOT unit length on a sloped rail — it is
      // sqrt(1 - dir.y^2). Dotting against it raw (as this did) scales the
      // parameter down, dragging the returned point back toward the segment
      // start: distXZ came out too big and point.y too high, so on a steep
      // rail the on-foot block and the high-speed trip both under-triggered.
      // Divide by |xz|^2 for the true arc parameter; the clamp stays in 3D
      // arc units because addScaledVector below walks the 3D direction.
      const ox = pos.x - a.x;
      const oz = pos.z - a.z;
      const dxz2 = dir.x * dir.x + dir.z * dir.z;
      // A purely vertical segment has no XZ shadow: its whole length collapses
      // to one point in plan view, so clamp to the start rather than skipping
      // it (skipping could leave best null on an all-vertical rail, and both
      // callers dereference the result).
      const along =
        dxz2 < 1e-9
          ? 0
          : THREE.MathUtils.clamp((ox * dir.x + oz * dir.z) / dxz2, 0, len);
      const point = a.clone().addScaledVector(dir, along); // carries the rail's Y here
      const dxz = Math.hypot(pos.x - point.x, pos.z - point.z);
      if (!best || dxz < best.distXZ) best = { point, tangent: dir.clone(), distXZ: dxz };
    }
    return best!;
  }

  pointAt(t: number): THREE.Vector3 {
    const i = this.segmentIndexAt(t);
    const local = THREE.MathUtils.clamp(t - this.cumLengths[i], 0, this.segLengths[i]);
    return this.points[i].clone().addScaledVector(this.segDirs[i], local);
  }

  tangentAt(t: number): THREE.Vector3 {
    return this.segDirs[this.segmentIndexAt(t)].clone();
  }

  private segmentIndexAt(t: number): number {
    for (let i = this.segLengths.length - 1; i >= 0; i--) {
      if (t >= this.cumLengths[i]) return i;
    }
    return 0;
  }

  private buildVisual(): THREE.Group {
    const group = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: 0xc8d8e8, emissive: 0x223344 });
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < this.segLengths.length; i++) {
      const geo = new THREE.CylinderGeometry(0.09, 0.09, this.segLengths[i], 6);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(this.points[i]).addScaledVector(this.segDirs[i], this.segLengths[i] / 2);
      mesh.quaternion.setFromUnitVectors(up, this.segDirs[i]);
      group.add(mesh);
    }
    // Support posts under the first and last points.
    const postMat = new THREE.MeshLambertMaterial({ color: 0x55606d });
    for (const p of [this.points[0], this.points[this.points.length - 1]]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.2, 0.15), postMat);
      post.position.set(p.x, p.y - 0.6, p.z);
      group.add(post);
    }
    return group;
  }
}

// Nearest rail to a position across a set of rails.
export function nearestRail(rails: Rail[], pos: THREE.Vector3): { rail: Rail; sample: RailSample } | null {
  let best: { rail: Rail; sample: RailSample } | null = null;
  for (const rail of rails) {
    if (!rail.grindable) continue; // a snapped rope is not a rail right now
    const sample = rail.closest(pos);
    if (!best || sample.distance < best.sample.distance) {
      best = { rail, sample };
    }
  }
  return best;
}
