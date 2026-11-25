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
//
// A wall may carry a STRAIGHT VERTICAL section above its curve (`lipRise`): the
// arc ends vertical and the face goes on straight up to the coping. It is the
// same one line, only longer: |u| past the arc is metres of vertical, θ stays
// 90°, and the lip (`lipYOf`, `uLipOf`) is at the top of it.
//
// The two walls need not match. A `HalfpipeShape` gives each side its own
// radius — so its own coping height and arc length — or none at all (an OPEN
// side: the flat simply ends and the path rolls out), and a deck behind each
// coping. Everything that depends on the wall therefore asks by side
// (`radiusOf`, `lipXOf`, `lipYOf`, `uLipOf`); the plain `radius`/`lipX`/`lipY`/
// `uLip` scalars describe the taller wall and are exact for the classic pipe.

import * as THREE from 'three';

/**
 * Optional per-wall shape. The classic pipe is two equal walls and nothing
 * else; a pipe VIEWED ACROSS ITS SECTION (a side-scrolling stretch) wants
 * more: a low wall to drop in from and a tall one to pump for, a wall left
 * off altogether so the flat rolls out onto the path, and a deck behind each
 * coping to arrive on. Sides are `[-cross, +cross]`.
 */
export interface HalfpipeShape {
  /** Transition radius of each wall; 0 leaves that side OPEN (no wall, no lip). */
  wallRadius?: readonly [number, number];
  /** Depth of the flat deck behind each coping; 0 = a bare lip. */
  deck?: readonly [number, number];
  /** Straight vertical face above each wall's curve, up to its coping; 0 = the curve ends at the lip. */
  lipRise?: readonly [number, number];
  /**
   * Viewed across the section: the ride is locked to the cross axis, a decked
   * coping drops a walker in on the board, holding out over a lip carries the
   * air across it, and the open ends show a filled profile to the camera.
   */
  sideOn?: boolean;
  /** Floor the filled profile and deck backs reach down to (default: yBottom). */
  baseY?: number;
}

export class Halfpipe {
  readonly l0: number; // entry end (length axis)
  readonly l1: number; // far end (length axis)
  readonly yBottom: number;
  readonly flatHalf: number; // F
  // The five scalars below describe the TALLER wall. They are exact for the
  // classic symmetric pipe and remain the coarse bounds of a shaped one; any
  // code that cares WHICH wall it is on asks the per-side accessors instead.
  readonly radius: number; // R
  readonly cross: number; // cross-axis centre
  readonly axis: 'z' | 'x';
  readonly lipX: number; // F + R (cross half-extent to the coping)
  readonly lipY: number; // yBottom + R (coping height)
  readonly uWall: number; // R·π/2 (arc length of one transition)
  readonly uLip: number; // F + uWall (centre → coping)
  readonly sideOn: boolean;
  readonly baseY: number;
  readonly object: THREE.Group;
  readonly walls: THREE.Mesh[] = []; // transitions and flat floor; registered as one analytic surface
  readonly decks: THREE.Mesh[] = []; // walk surfaces behind the copings (ordinary ground, not transition)
  private readonly wallR: readonly [number, number];
  private readonly wallLift: readonly [number, number];
  private readonly deckDepth: readonly [number, number];

  constructor(
    l0: number,
    l1: number,
    yBottom: number,
    flatHalf: number,
    radius: number,
    mat: THREE.Material,
    cross = 0,
    axis: 'z' | 'x' = 'z',
    shape: HalfpipeShape = {},
  ) {
    this.l0 = l0;
    this.l1 = l1;
    this.yBottom = yBottom;
    this.flatHalf = flatHalf;
    this.wallR = [
      Math.max(0, shape.wallRadius?.[0] ?? radius),
      Math.max(0, shape.wallRadius?.[1] ?? radius),
    ];
    this.deckDepth = [
      this.wallR[0] > 0 ? Math.max(0, shape.deck?.[0] ?? 0) : 0,
      this.wallR[1] > 0 ? Math.max(0, shape.deck?.[1] ?? 0) : 0,
    ];
    this.wallLift = [
      this.wallR[0] > 0 ? Math.max(0, shape.lipRise?.[0] ?? 0) : 0,
      this.wallR[1] > 0 ? Math.max(0, shape.lipRise?.[1] ?? 0) : 0,
    ];
    this.radius = shape.wallRadius ? Math.max(this.wallR[0], this.wallR[1]) : radius;
    this.cross = cross;
    this.axis = axis;
    this.lipX = flatHalf + this.radius;
    this.lipY = yBottom + Math.max(this.radius, this.wallR[0] + this.wallLift[0], this.wallR[1] + this.wallLift[1]);
    this.uWall = (this.radius * Math.PI) / 2;
    this.uLip = flatHalf + Math.max(this.uWall,
      (this.wallR[0] * Math.PI) / 2 + this.wallLift[0], (this.wallR[1] * Math.PI) / 2 + this.wallLift[1]);
    this.sideOn = shape.sideOn === true;
    this.baseY = Math.min(yBottom, shape.baseY ?? yBottom);
    this.object = this.build(mat);
  }

  // ---- per-wall measures. `side` is any number whose SIGN names the wall
  // (a signed arc position, a cross offset, or a plain ±1); 0 reads as +. ----
  /** Transition radius of that wall; 0 = the side is open. */
  radiusOf(side: number): number {
    return this.wallR[side < 0 ? 0 : 1];
  }
  /** Is there no wall on that side (the flat simply ends)? */
  isOpen(side: number): boolean {
    return this.radiusOf(side) <= 0;
  }
  /** Cross half-extent from the centre to that coping (the flat's edge when open). */
  lipXOf(side: number): number {
    return this.flatHalf + this.radiusOf(side);
  }
  /** Straight vertical face above that wall's curve; 0 = the curve ends at the lip. */
  lipRiseOf(side: number): number {
    return this.wallLift[side < 0 ? 0 : 1];
  }
  /** Height at which that wall's curve ends (and any straight section begins). */
  arcTopYOf(side: number): number {
    return this.yBottom + this.radiusOf(side);
  }
  /** Coping height of that wall (the floor when open). */
  lipYOf(side: number): number {
    return this.yBottom + this.radiusOf(side) + this.lipRiseOf(side);
  }
  /** Arc length from the centre of the flat to that coping. */
  uLipOf(side: number): number {
    return this.flatHalf + (this.radiusOf(side) * Math.PI) / 2 + this.lipRiseOf(side);
  }
  /** Depth of the deck behind that coping. */
  deckOf(side: number): number {
    return this.deckDepth[side < 0 ? 0 : 1];
  }

  // Cross-axis offset from the pipe centre at arc-position u (signed).
  crossOffset(u: number): number {
    const au = Math.abs(u);
    if (au <= this.flatHalf) return u;
    const r = this.radiusOf(u);
    if (r <= 0) return Math.sign(u) * this.flatHalf;
    const phi = Math.min((au - this.flatHalf) / r, Math.PI / 2);
    return Math.sign(u) * (this.flatHalf + r * Math.sin(phi));
  }

  // World Y at arc-position u.
  surfaceY(u: number): number {
    const au = Math.abs(u);
    if (au <= this.flatHalf) return this.yBottom;
    const r = this.radiusOf(u);
    if (r <= 0) return this.yBottom;
    const arc = (r * Math.PI) / 2;
    // past the curve: the straight face, a metre of height per metre of it
    if (au - this.flatHalf >= arc) return this.yBottom + r + Math.min(au - this.flatHalf - arc, this.lipRiseOf(u));
    const phi = (au - this.flatHalf) / r;
    return this.yBottom + r * (1 - Math.cos(phi));
  }

  // Surface angle from horizontal (0 at the bottom, π/2 at a vertical coping).
  theta(u: number): number {
    const au = Math.abs(u);
    if (au <= this.flatHalf) return 0;
    const r = this.radiusOf(u);
    if (r <= 0) return 0;
    return Math.min((au - this.flatHalf) / r, Math.PI / 2);
  }

  // dy/du = sign(u)·sin(θ): scalar gravity along the curve is a = -g·(dy/du).
  slopeGrad(u: number): number {
    return Math.sign(u) * Math.sin(this.theta(u));
  }

  // Invert a cross-axis WORLD coordinate to the nearest arc-position u. The
  // straight face above a curve is one cross coordinate for its whole height:
  // there the height `y` says how far up it (without one, its foot).
  crossToU(c: number, y?: number): number {
    const d = c - this.cross;
    const ad = Math.abs(d);
    if (ad <= this.flatHalf) return d;
    const r = this.radiusOf(d);
    if (r <= 0) return Math.sign(d) * this.flatHalf;
    if (ad >= this.flatHalf + r) {
      const up = y === undefined ? 0 : Math.min(Math.max(0, y - (this.yBottom + r)), this.lipRiseOf(d));
      return Math.sign(d) * (this.flatHalf + (r * Math.PI) / 2 + up);
    }
    const phi = Math.asin((ad - this.flatHalf) / r);
    return Math.sign(d) * (this.flatHalf + r * phi);
  }

  // World hit point → arc-position u (picks whichever axis is the cross axis).
  pointToU(x: number, z: number, y?: number): number {
    return this.axis === 'z' ? this.crossToU(x, y) : this.crossToU(z, y);
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
    const s = Math.sign(c);
    const r = this.radiusOf(s);
    if (r <= 0) return null; // open side: past the flat's edge the pipe has no surface at all
    if (ac > this.flatHalf + r + 0.05) return null; // beyond the coping line: behind the wall, not on it
    // Wall arc: quarter circle centred at (±flatHalf, yBottom + R), radius R.
    const vx = ac - this.flatHalf; // >= 0 toward the wall
    const vy = y - (this.yBottom + r);
    if (vy > 0) {
      // The straight face above the curve: its nearest point is level with the sample.
      if (vy > this.lipRiseOf(s)) return null; // above coping height: over the lip
      return {
        u: s * (this.flatHalf + (r * Math.PI) / 2 + vy),
        cross: this.cross + s * (this.flatHalf + r),
        y,
        pen: vx - r, // past the face = inside the wall
      };
    }
    const d = Math.hypot(vx, vy);
    if (d < 1e-6) return null; // dead on the arc centre: no unique projection
    const phi = Math.atan2(vx, -vy); // 0 at the arc's bottom, π/2 at the coping
    const nx = vx / d;
    const ny = vy / d;
    return {
      u: s * (this.flatHalf + r * phi),
      cross: this.cross + s * (this.flatHalf + r * nx),
      y: this.yBottom + r + r * ny,
      pen: d - r, // outside the circle = inside the wall wedge
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
    const side = crossWorld - this.cross;
    if (y > this.lipYOf(side)) return true;
    if (Math.abs(side) > this.lipXOf(side) + 0.05) return false;
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
    let current = this.project(currentCross, currentY);
    if (current === null) {
      // THROUGH THE WALL IN ONE STEP. A fast body moves further in a step than
      // the 5 cm behind the coping line that still counts as the wall, and a
      // straight face is metres of exactly that. A body that was in front of
      // the wall, under its lip, and is now behind it went through the face:
      // it is met where it crossed. (One that came over the top of the lip and
      // is coming down behind the wall did not, and is left alone.)
      const side = currentCross - this.cross < 0 ? -1 : 1, r = this.radiusOf(side), plane = this.flatHalf + r;
      const before = (previousCross - this.cross) * side, now = (currentCross - this.cross) * side;
      if (r <= 0 || previousY > this.lipYOf(side) || before > plane + 0.05 || now <= plane) return null;
      const t = before >= plane ? 0 : (plane - before) / (now - before);
      const y = previousY + (currentY - previousY) * t;
      if (y > this.lipYOf(side)) return null; // over the lip after all
      current = this.project(this.cross + side * plane, y);
      if (current === null) return null;
      return { ...current, pen: Math.max(current.pen, now - plane) };
    }
    if (current.pen <= 0) return null;
    // "Deeply buried" is measured against the wall actually crossed; the flat
    // keeps the pipe's nominal radius, exactly as a symmetric pipe always did.
    const reach = Math.abs(current.u) <= this.flatHalf ? this.radius : this.radiusOf(current.u);
    if (current.pen > reach * 0.8) return null;
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
    // Two smooth wall ribbons. Each
    // is the quarter-circle sampled finely from the flat edge to the coping.
    for (const sign of [1, -1]) {
      const wallArc = (this.radiusOf(sign) * Math.PI) / 2;
      if (wallArc <= 0) continue; // an open side has no wall to draw or ride
      const seg = 22; // arc samples per wall — plenty smooth
      const lift = this.lipRiseOf(sign), wallRun = wallArc + lift;
      const verts: number[] = [];
      const uvs: number[] = [];
      const cols = seg + 1 + (lift > 0 ? 1 : 0);
      for (const l of [this.l0, this.l1]) {
        for (let i = 0; i <= seg; i++) {
          const u = sign * (this.flatHalf + (wallArc * i) / seg);
          this.worldPos(u, l, tmp);
          verts.push(tmp.x, tmp.y, tmp.z);
          uvs.push((wallArc * i) / seg / wallRun, (l - this.l1) / (this.l0 - this.l1));
        }
        if (lift > 0) {
          // the straight face: one more row, at the coping
          this.worldPos(sign * (this.flatHalf + wallRun), l, tmp);
          verts.push(tmp.x, tmp.y, tmp.z);
          uvs.push(1, (l - this.l1) / (this.l0 - this.l1));
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
    // The analytic collider already supports the trough, so its visible floor
    // must belong to the same component too. A source-owned halfpipe must not
    // depend on a separately authored slab to avoid skating over an open hole.
    if (this.flatHalf > 0) {
      const width = this.axis === 'z' ? this.flatHalf * 2 : Math.abs(this.l1 - this.l0);
      const depth = this.axis === 'z' ? Math.abs(this.l1 - this.l0) : this.flatHalf * 2;
      const geometry = new THREE.PlaneGeometry(width, depth);
      geometry.rotateX(-Math.PI / 2);
      const floor = new THREE.Mesh(geometry, wallMat);
      floor.position.set(this.axis === 'z' ? this.cross : (this.l0 + this.l1) / 2,
        this.yBottom, this.axis === 'z' ? (this.l0 + this.l1) / 2 : this.cross);
      floor.name = 'halfpipe floor';
      floor.receiveShadow = true;
      floor.userData.halfpipe = this;
      group.add(floor);
      this.walls.push(floor);
    }
    this.buildDecks(group, wallMat);
    if (this.sideOn) this.buildProfile(group, wallMat);
    return group;
  }

  /** A point in the pipe's own (cross offset, height, length) frame, in world space. */
  private framePoint(crossOffset: number, y: number, l: number, out: THREE.Vector3): THREE.Vector3 {
    const c = this.cross + crossOffset;
    return this.axis === 'z' ? out.set(c, y, l) : out.set(l, y, c);
  }

  // DECKS: the stretch of floor behind a coping. Ordinary ground — a walker
  // stands on it and it is never transition — but it belongs to the pipe, so
  // it carries no side collider of its own: a rider climbing the last metre of
  // the wall leans into the space behind the lip, and a solid deck edge there
  // would pin him to the face (or hand him a ledge to grab mid-climb).
  private buildDecks(group: THREE.Group, mat: THREE.Material): void {
    const tmp = new THREE.Vector3();
    const length = Math.abs(this.l1 - this.l0);
    for (const side of [-1, 1] as const) {
      const depth = this.deckOf(side);
      if (depth <= 0) continue;
      const geometry = new THREE.PlaneGeometry(
        this.axis === 'z' ? depth : length,
        this.axis === 'z' ? length : depth,
      );
      geometry.rotateX(-Math.PI / 2);
      const deck = new THREE.Mesh(geometry, mat);
      deck.position.copy(this.framePoint(
        side * (this.lipXOf(side) + depth / 2), this.lipYOf(side), (this.l0 + this.l1) / 2, tmp));
      deck.name = 'pipe deck';
      deck.receiveShadow = true;
      deck.userData.pipeDeck = { pipe: this, side };
      group.add(deck);
      this.decks.push(deck);
    }
  }

  // FILLED PROFILE (side-on pipes): the ribbons are paper-thin, which reads as
  // nothing at all when the camera looks straight down the pipe's length. Close
  // both open ends with the ramp's real section — everything between the ride
  // curve and the floor it stands on — and wall in the back of each deck, so
  // the pipe shows a solid cutaway to a side camera. Visual only.
  private buildProfile(group: THREE.Group, mat: THREE.Material): void {
    const bodyMat = (mat as THREE.MeshLambertMaterial).clone();
    bodyMat.map = null;
    bodyMat.color = new THREE.Color((mat as THREE.MeshLambertMaterial).color ?? 0xaab4ba).multiplyScalar(0.62);
    bodyMat.side = THREE.DoubleSide;
    const tmp = new THREE.Vector3();
    const verts: number[] = [];
    const push = (crossOffset: number, y: number, l: number): void => {
      this.framePoint(crossOffset, y, l, tmp);
      verts.push(tmp.x, tmp.y, tmp.z);
    };
    const tri = (a: [number, number, number], b: [number, number, number], c: [number, number, number]): void => {
      push(...a); push(...b); push(...c);
    };
    const quad = (a: [number, number, number], b: [number, number, number],
      c: [number, number, number], d: [number, number, number]): void => {
      tri(a, b, c); tri(a, c, d);
    };
    const base = this.baseY - 0.02;
    const seg = 22;
    for (const side of [-1, 1] as const) {
      const r = this.radiusOf(side);
      if (r <= 0) continue;
      const back = side * (this.lipXOf(side) + this.deckOf(side));
      const top = this.lipYOf(side);
      for (const l of [this.l0, this.l1]) {
        // the section between the curve and the vertical line behind the lip
        for (let i = 0; i < seg; i++) {
          const a = (i / seg) * (Math.PI / 2);
          const b = ((i + 1) / seg) * (Math.PI / 2);
          const ax = side * (this.flatHalf + r * Math.sin(a)), ay = this.yBottom + r * (1 - Math.cos(a));
          const bx = side * (this.flatHalf + r * Math.sin(b)), by = this.yBottom + r * (1 - Math.cos(b));
          quad([ax, ay, l], [bx, by, l], [bx, base, l], [ax, base, l]);
        }
        // ...and the block under the deck
        if (this.deckOf(side) > 0)
          quad([side * this.lipXOf(side), top, l], [back, top, l], [back, base, l], [side * this.lipXOf(side), base, l]);
      }
      // the back of the ramp, from the deck's far edge to the floor
      quad([back, top, this.l0], [back, top, this.l1], [back, base, this.l1], [back, base, this.l0]);
    }
    // the slab under the flat, when the pipe stands proud of its base
    if (this.flatHalf > 0 && this.yBottom - base > 0.05)
      for (const l of [this.l0, this.l1])
        quad([-this.flatHalf, this.yBottom, l], [this.flatHalf, this.yBottom, l],
          [this.flatHalf, base, l], [-this.flatHalf, base, l]);
    if (!verts.length) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geometry.computeVertexNormals();
    const body = new THREE.Mesh(geometry, bodyMat);
    body.name = 'pipe profile';
    body.receiveShadow = true;
    group.add(body);
  }
}
