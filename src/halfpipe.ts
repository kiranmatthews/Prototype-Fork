// A proper parametric HALFPIPE — a channel running along Z with a quarter-pipe
// transition on each side (±X), a flat bottom between them. Unlike the faceted
// bank slabs, the ride physics treat this as a smooth 1-D rail across the
// cross-section: the player tracks an arc-length position `u` (0 = centre of the
// flat, ±uLip = the coping) and a speed `pipeV` along that curve. Everything —
// world position, surface angle, launch, re-attach — is derived analytically
// from `u`, so there are no seams and gravity is a clean scalar `-g·sinθ`.
//
//   cross-section (X up the page is +X):
//        lip ___                     ___ lip   y = yBottom + radius
//           |   \                   /   |
//           |    \ (arc, radius R) /    |
//        ___|_____\_______________/_____|___   y = yBottom  (flat bottom)
//          -lipX  -F      0      F   lipX
//   |u| in [0,F]      → flat bottom (θ = 0)
//   |u| in [F,uLip]   → quarter-circle wall (θ ramps 0 → 90°)

import * as THREE from 'three';

export class Halfpipe {
  readonly z0: number; // entry end (larger Z)
  readonly z1: number; // far end (smaller Z)
  readonly yBottom: number;
  readonly flatHalf: number; // F
  readonly radius: number; // R
  readonly lipX: number; // F + R
  readonly lipY: number; // yBottom + R (coping height)
  readonly uWall: number; // R·π/2 (arc length of one transition)
  readonly uLip: number; // F + uWall (centre → coping)
  readonly object: THREE.Group;
  readonly walls: THREE.Mesh[] = []; // the two transition ribbons — pushed into groundMeshes so they're SOLID

  constructor(
    z0: number,
    z1: number,
    yBottom: number,
    flatHalf: number,
    radius: number,
    mat: THREE.Material,
  ) {
    this.z0 = z0;
    this.z1 = z1;
    this.yBottom = yBottom;
    this.flatHalf = flatHalf;
    this.radius = radius;
    this.lipX = flatHalf + radius;
    this.lipY = yBottom + radius;
    this.uWall = (radius * Math.PI) / 2;
    this.uLip = flatHalf + this.uWall;
    this.object = this.build(mat);
  }

  // World X at arc-position u (signed, 0 = centre).
  surfaceX(u: number): number {
    const au = Math.abs(u);
    if (au <= this.flatHalf) return u;
    const phi = Math.min((au - this.flatHalf) / this.radius, Math.PI / 2);
    return Math.sign(u) * (this.flatHalf + this.radius * Math.sin(phi));
  }

  // World Y at arc-position u.
  surfaceY(u: number): number {
    const au = Math.abs(u);
    if (au <= this.flatHalf) return this.yBottom;
    const phi = Math.min((au - this.flatHalf) / this.radius, Math.PI / 2);
    return this.yBottom + this.radius * (1 - Math.cos(phi));
  }

  // Surface angle from horizontal (0 at the bottom, π/2 at a vertical coping).
  theta(u: number): number {
    const au = Math.abs(u);
    if (au <= this.flatHalf) return 0;
    return Math.min((au - this.flatHalf) / this.radius, Math.PI / 2);
  }

  // dy/du = sign(u)·sin(θ): scalar gravity along the curve is a = -g·(dy/du).
  slopeGrad(u: number): number {
    return Math.sign(u) * Math.sin(this.theta(u));
  }

  // Invert surfaceX: nearest arc-position for a world X.
  xToU(x: number): number {
    const ax = Math.abs(x);
    if (ax <= this.flatHalf) return x;
    if (ax >= this.lipX) return Math.sign(x) * this.uLip;
    const phi = Math.asin((ax - this.flatHalf) / this.radius);
    return Math.sign(x) * (this.flatHalf + this.radius * phi);
  }

  // Inside the pipe footprint (with a little Z slack at the ends)?
  contains(x: number, z: number): boolean {
    return z <= this.z0 + 0.5 && z >= this.z1 - 0.5 && Math.abs(x) <= this.lipX + 0.5;
  }

  // Cross-section outward+up surface normal (unit, X-Y) at u.
  normalAt(u: number, out: THREE.Vector3): THREE.Vector3 {
    const th = this.theta(u);
    // normal points up (+Y) at the bottom and inward+up on the walls
    return out.set(-Math.sign(u) * Math.sin(th), Math.cos(th), 0).normalize();
  }

  private build(mat: THREE.Material): THREE.Group {
    const group = new THREE.Group();
    // Ride BOTH faces of the thin wall ribbons: from inside the pipe (the ride
    // side) and from over the coping (dropping in). A single-sided ribbon
    // back-face culls into thin air from the riding side, so the wall looks
    // missing. Clone so we don't flip the shared ramp material elsewhere.
    const wallMat = mat.clone();
    wallMat.side = THREE.DoubleSide;
    // Two smooth wall ribbons (the flat bottom is a separate floor slab). Each
    // is the quarter-circle sampled finely from the flat edge to the coping.
    for (const sign of [1, -1]) {
      const seg = 22; // arc samples per wall — plenty smooth
      const verts: number[] = [];
      const uvs: number[] = [];
      const cols = seg + 1;
      for (const z of [this.z0, this.z1]) {
        for (let i = 0; i <= seg; i++) {
          const u = sign * (this.flatHalf + (this.uWall * i) / seg);
          verts.push(this.surfaceX(u), this.surfaceY(u), z);
          uvs.push(i / seg, (z - this.z1) / (this.z0 - this.z1));
        }
      }
      const idx: number[] = [];
      for (let i = 0; i < cols - 1; i++) {
        const a = i,
          bb = i + 1,
          c = cols + i,
          d = cols + i + 1;
        // wind so the ride face points inward/up (flip per side)
        if (sign > 0) idx.push(a, c, bb, bb, c, d);
        else idx.push(a, bb, c, bb, d, c);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.receiveShadow = true;
      mesh.name = 'halfpipe';
      // Tag the mesh with its Halfpipe so queryGround can substitute the exact
      // ANALYTIC surface normal (the raycast only returns faceted triangle
      // normals; the analytic one is perfectly smooth AND always oriented up).
      mesh.userData.halfpipe = this;
      group.add(mesh);
      this.walls.push(mesh);
    }
    return group;
  }
}
