// A proper parametric HALFPIPE — a channel with a quarter-pipe transition on
// each side and a flat bottom between them. The ride physics treat it as a
// smooth 1-D rail across the cross-section: the player tracks an arc-length
// position `u` (0 = centre of the flat, ±uLip = the coping). Everything —
// world position, surface angle, launch, re-attach — is derived analytically
// from `u`, so there are no seams and gravity is a clean scalar `-g·sinθ`.
//
// The channel runs along a LENGTH axis (l0..l1) and the transitions climb along
// the CROSS axis, centred at `cross`. `axis` picks which world axis is length:
//   axis 'z' → length along Z, cross along X (the classic orientation)
//   axis 'x' → length along X, cross along Z (rotated 90°)
//
//   cross-section (cross up the page):
//        lip ___                     ___ lip   y = yBottom + radius
//           |   \                   /   |
//           |    \ (arc, radius R) /    |
//        ___|_____\_______________/_____|___   y = yBottom  (flat bottom)
//         -lipX  -F   cross   F   lipX          (offsets from `cross`)
//   |u| in [0,F]      → flat bottom (θ = 0)
//   |u| in [F,uLip]   → quarter-circle wall (θ ramps 0 → 90°)

import * as THREE from 'three';

export class Halfpipe {
  readonly l0: number; // entry end (length axis)
  readonly l1: number; // far end (length axis)
  readonly yBottom: number;
  readonly flatHalf: number; // F
  readonly radius: number; // R
  readonly cross: number; // cross-axis centre
  readonly axis: 'z' | 'x';
  readonly lipX: number; // F + R (cross half-extent to the coping)
  readonly lipY: number; // yBottom + R (coping height)
  readonly uWall: number; // R·π/2 (arc length of one transition)
  readonly uLip: number; // F + uWall (centre → coping)
  readonly object: THREE.Group;
  readonly walls: THREE.Mesh[] = []; // the two transition ribbons — pushed into groundMeshes so they're SOLID

  constructor(
    l0: number,
    l1: number,
    yBottom: number,
    flatHalf: number,
    radius: number,
    mat: THREE.Material,
    cross = 0,
    axis: 'z' | 'x' = 'z',
  ) {
    this.l0 = l0;
    this.l1 = l1;
    this.yBottom = yBottom;
    this.flatHalf = flatHalf;
    this.radius = radius;
    this.cross = cross;
    this.axis = axis;
    this.lipX = flatHalf + radius;
    this.lipY = yBottom + radius;
    this.uWall = (radius * Math.PI) / 2;
    this.uLip = flatHalf + this.uWall;
    this.object = this.build(mat);
  }

  // Cross-axis offset from the pipe centre at arc-position u (signed).
  private crossOffset(u: number): number {
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

  // Invert a cross-axis WORLD coordinate to the nearest arc-position u.
  crossToU(c: number): number {
    const d = c - this.cross;
    const ad = Math.abs(d);
    if (ad <= this.flatHalf) return d;
    if (ad >= this.lipX) return Math.sign(d) * this.uLip;
    const phi = Math.asin((ad - this.flatHalf) / this.radius);
    return Math.sign(d) * (this.flatHalf + this.radius * phi);
  }

  // World hit point → arc-position u (picks whichever axis is the cross axis).
  pointToU(x: number, z: number): number {
    return this.axis === 'z' ? this.crossToU(x) : this.crossToU(z);
  }

  // NEAREST point on the cross-section curve to a (crossWorld, y) sample — the
  // exact parametric attach the ride physics glue to. Uses RADIAL projection on
  // the wall arcs (a vertical projection degenerates on the near-vertical
  // coping stretch) and vertical projection on the flat. `pen` is the signed
  // penetration INTO the wall material (positive = below/inside the curve —
  // tunnelled; negative = open air above it). Returns null when the sample is
  // over the coping (above lip height on the wall side) — that's air over the
  // lip, not wall.
  project(crossWorld: number, y: number): { u: number; cross: number; y: number; pen: number } | null {
    const c = crossWorld - this.cross;
    const ac = Math.abs(c);
    if (ac <= this.flatHalf) {
      return { u: c, cross: crossWorld, y: this.yBottom, pen: this.yBottom - y };
    }
    if (ac > this.lipX + 0.05) return null; // beyond the coping line: behind the wall, not on it
    const s = Math.sign(c);
    // Wall arc: quarter circle centred at (±flatHalf, yBottom + R), radius R.
    const vx = ac - this.flatHalf; // >= 0 toward the wall
    const vy = y - (this.yBottom + this.radius);
    if (vy > 0) return null; // above coping height: over the lip
    const d = Math.hypot(vx, vy);
    if (d < 1e-6) return null; // dead on the arc centre: no unique projection
    const phi = Math.atan2(vx, -vy); // 0 at the arc's bottom, π/2 at the coping
    const nx = vx / d;
    const ny = vy / d;
    return {
      u: s * (this.flatHalf + this.radius * phi),
      cross: this.cross + s * (this.flatHalf + this.radius * nx),
      y: this.yBottom + this.radius + this.radius * ny,
      pen: d - this.radius, // outside the circle = inside the wall wedge
    };
  }

  /**
   * Is a feet sample on the concave/open side of this transition?
   *
   * The rendered ribbon is DoubleSide, but the physics surface is not: below
   * the curve or behind a coping is the shell's invalid back side. Air above
   * coping height remains valid so a real drop-in can cross the lip.
   */
  isRideSide(crossWorld: number, y: number, skin = 0.08): boolean {
    if (y > this.lipY) return true;
    if (Math.abs(crossWorld - this.cross) > this.lipX + 0.05) return false;
    const projected = this.project(crossWorld, y);
    return projected !== null && projected.pen <= Math.max(0, skin);
  }

  /** A true concave-side → shell crossing, suitable for analytic catch. */
  rideSideCrossing(
    previousCross: number,
    previousY: number,
    currentCross: number,
    currentY: number,
    skin = 0.08,
  ): { u: number; cross: number; y: number; pen: number } | null {
    if (!this.isRideSide(previousCross, previousY, skin)) return null;
    const current = this.project(currentCross, currentY);
    if (
      current === null ||
      current.pen <= 0 ||
      current.pen > this.radius * 0.8
    )
      return null;
    return current;
  }

  // Cross-axis world coordinate of a position (the coordinate project() wants).
  crossCoord(x: number, z: number): number {
    return this.axis === 'z' ? x : z;
  }

  // Along-axis world coordinate; within [min(l0,l1), max(l0,l1)] = on the pipe.
  alongCoord(x: number, z: number): number {
    return this.axis === 'z' ? z : x;
  }

  // Inside the pipe footprint (with a little slack at the ends)?
  contains(x: number, z: number): boolean {
    const lo = Math.min(this.l0, this.l1) - 0.5;
    const hi = Math.max(this.l0, this.l1) + 0.5;
    if (this.axis === 'z') {
      return z >= lo && z <= hi && Math.abs(x - this.cross) <= this.lipX + 0.5;
    }
    return x >= lo && x <= hi && Math.abs(z - this.cross) <= this.lipX + 0.5;
  }

  // Cross-section outward+up surface normal (unit) at u.
  normalAt(u: number, out: THREE.Vector3): THREE.Vector3 {
    const th = this.theta(u);
    const cn = -Math.sign(u) * Math.sin(th); // cross-axis component, inward toward the trough
    const up = Math.cos(th);
    // normal points up (+Y) at the bottom and inward+up on the walls
    return this.axis === 'z'
      ? out.set(cn, up, 0).normalize()
      : out.set(0, up, cn).normalize();
  }

  // World position at arc-position u along the length coordinate l.
  private worldPos(u: number, l: number, out: THREE.Vector3): THREE.Vector3 {
    const c = this.cross + this.crossOffset(u);
    const y = this.surfaceY(u);
    return this.axis === 'z' ? out.set(c, y, l) : out.set(l, y, c);
  }

  private build(mat: THREE.Material): THREE.Group {
    const group = new THREE.Group();
    // Ride BOTH faces of the thin wall ribbons: from inside the pipe (the ride
    // side) and from over the coping (dropping in). DoubleSide so winding never
    // matters. Clone so we don't flip the shared ramp material elsewhere.
    const wallMat = mat.clone();
    wallMat.side = THREE.DoubleSide;
    const tmp = new THREE.Vector3();
    // Two smooth wall ribbons (the flat bottom is a separate floor slab). Each
    // is the quarter-circle sampled finely from the flat edge to the coping.
    for (const sign of [1, -1]) {
      const seg = 22; // arc samples per wall — plenty smooth
      const verts: number[] = [];
      const uvs: number[] = [];
      const cols = seg + 1;
      for (const l of [this.l0, this.l1]) {
        for (let i = 0; i <= seg; i++) {
          const u = sign * (this.flatHalf + (this.uWall * i) / seg);
          this.worldPos(u, l, tmp);
          verts.push(tmp.x, tmp.y, tmp.z);
          uvs.push(i / seg, (l - this.l1) / (this.l0 - this.l1));
        }
      }
      const idx: number[] = [];
      for (let i = 0; i < cols - 1; i++) {
        const a = i,
          bb = i + 1,
          c = cols + i,
          d = cols + i + 1;
        idx.push(a, c, bb, bb, c, d); // winding irrelevant — DoubleSide
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
