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
  readonly totalLength: number;
  readonly object: THREE.Group;
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
    const sample = rail.closest(pos);
    if (!best || sample.distance < best.sample.distance) {
      best = { rail, sample };
    }
  }
  return best;
}
