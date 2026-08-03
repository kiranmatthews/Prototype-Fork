// The kangaroo tail: drawn in code, driven by a spring chain.
//
// WHY IT ISN'T THE MODEL'S TAIL ANY MORE. Every authored tail we were handed
// arrived rigged badly — Meshy weights it to Hips on one model and to a thigh
// bone on another — so the tail was being carved out of the mesh geometrically
// and re-skinned onto a bone chain fitted to the vertex cloud. That worked, but
// it inherited two problems it could never fix: the carve is a NON-INDEXED
// soup, so the surface only holds together while every duplicate of a shared
// vertex is weighted bit-identically, and the source brush is often 34
// triangles, which cannot bend smoothly however good the rig is. So the tail
// polygons are now discarded with the rest of the carve and this builds a new
// one.
//
// Three things make it hold up:
//
//  1. ONE INDEXED TUBE. Rings of shared vertices, so there is no such thing as
//     a seam that can open — the two triangles either side of an edge use the
//     SAME vertex, not two copies of it that have to agree. Skin weights are
//     computed per RING rather than per vertex, so even the duplicated UV-wrap
//     column is guaranteed identical. The tip closes in a fan and the base is
//     buried inside the pelvis and pinned 100% to the first bone, which is
//     rigid to the hips: the junction cannot gape because you cannot see it.
//
//  2. A SPRING CHAIN, NOT A POSE. The old tail was an authored formula —
//     lift and wag per joint, straight onto the bone rotations — so it moved
//     exactly with the body and never felt like weight on the end of a spine.
//     The joints are now particles simulated in WORLD space: they chase the
//     authored pose through a spring, fall under gravity, and are pulled along
//     by the hips through distance constraints. The lag, the whip when you
//     turn, the swing on a landing and the settle afterwards are all emergent.
//     The authored pose survives as the TARGET, so the art direction (flare on
//     a jump, tuck on all fours) still reads — it just arrives with follow
//     through.
//
//  3. IT COLLIDES WITH HER. A free chain behind a crouching character will
//     swing straight through the pelvis. Each particle is pushed out of a
//     handful of spheres tracking the hips, belly and both thighs, and each
//     joint is angle-limited against its parent so the chain cannot fold back
//     on itself and vanish inside the body.
import * as THREE from 'three';

/** What the animation system asks the tail to do; the sim gets there its own way. */
export interface TailPose {
  /** swing the whole tail up (+) or down (-) about the hips */
  lift: number;
  /** swing it left/right */
  wag: number;
  /** roll about its own axis, for the idle breath */
  roll: number;
}

/** A body part the tail must not pass through, in world space. */
export interface TailCollider {
  c: THREE.Vector3;
  r: number;
  /** First joint this applies to. The tail's root joints sit INSIDE her hips
   *  by design, so the hip sphere has to start further out — but they must
   *  still be pushed by everything else, or the base of the chain cannot
   *  yield and the first free segment absorbs every correction on its own. */
  from: number;
}

const BONES = 8;
const RINGS = 15; // stations along the tube (>= BONES + 1 for a smooth bend)
const SIDES = 9; // radial segments — PS1-chunky, matching the body's facets
const LENGTH = 0.58; // rest length in rig units — long enough to read as a
                     // kangaroo's counterweight, short enough not to trail
                     // behind her like a boa
/** How far the tube starts INSIDE the body, so the junction is never on screen. */
const BURY = 0.075;

// Rest shape: leaves the hips heading back and down, then flattens and lifts a
// little at the tip. A kangaroo's tail is a counterweight, not a rope — it
// carries itself.
const REST_ANGLE_BASE = -0.60; // radians below horizontal at the root
const REST_ANGLE_TIP = 0.12; // ...and above it at the tip

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _m = new THREE.Matrix4();

/** Rest direction at arc fraction u, in tail-root space (-Z is behind her). */
function restDir(u: number, out: THREE.Vector3): THREE.Vector3 {
  const s = u * u * (3 - 2 * u); // smoothstep: most of the bend near the base
  const a = REST_ANGLE_BASE + (REST_ANGLE_TIP - REST_ANGLE_BASE) * s;
  return out.set(0, Math.sin(a), -Math.cos(a));
}

/** Tube radius at arc fraction u. Thick at the hips, a point at the tip —
 *  and thinner than a thigh, so it reads as a tail rather than a fifth limb. */
function restRadius(u: number): number {
  return 0.072 * Math.pow(1 - u, 0.62) + 0.009;
}

export class Tail {
  /** Attach point. Parent this where the tail leaves the body. */
  readonly root = new THREE.Group();
  /** Root→tip bones. Exposed so callers can read the chain if they need to. */
  readonly bones: THREE.Bone[] = [];

  private geo: THREE.BufferGeometry | null = null;
  /** Rest joint positions in root space, root at index 0. */
  private rest: THREE.Vector3[] = [];
  /** Per-joint share of the authored lift/wag, decaying toward the tip. */
  private share: { lift: number[]; wag: number[] } = { lift: [], wag: [] };

  // --- simulation state, all in WORLD space -------------------------------
  private p: THREE.Vector3[] = []; // particle positions, one per joint + tip
  private vel: THREE.Vector3[] = [];
  private target: THREE.Vector3[] = []; // where the authored pose wants them
  private seeded = false;

  // Tuning. Stiffness is what separates a tail from a rope: high enough that
  // she carries it, low enough that it lags a beat behind a direction change.
  private stiff = 190;
  private damp = 9.5;
  private gravity = -3.4;
  private maxBend = 0.52; // radians between neighbouring segments

  /** Its own material, so the tint can change with the installed body. */
  private mat = new THREE.MeshLambertMaterial({
    color: 0xf39133, // the rig's own kangaroo orange, until a model says otherwise
    vertexColors: true, // the baked base->tip shading
    flatShading: true, // match the body's PS1 facets
  });

  constructor() {
    this.buildRest();
    this.buildBones();
    this.buildSkin(this.mat);
  }

  /** Rest polyline + the per-joint flex shares. */
  private buildRest(): void {
    // Walk the rest direction field to get the curve, then take BONES+1 joints
    // off it by arc length. Starting at -BURY puts the first joint inside the
    // body so the base ring is never visible.
    const FINE = 240;
    const fine: THREE.Vector3[] = [];
    const cur = new THREE.Vector3();
    restDir(0, _v);
    cur.copy(_v).multiplyScalar(-BURY);
    fine.push(cur.clone());
    for (let i = 0; i < FINE; i++) {
      restDir(i / (FINE - 1), _v);
      cur.addScaledVector(_v, LENGTH / FINE);
      fine.push(cur.clone());
    }
    // resample evenly by arc length
    const cum = [0];
    for (let i = 1; i < fine.length; i++) cum.push(cum[i - 1] + fine[i].distanceTo(fine[i - 1]));
    const total = cum[cum.length - 1];
    const at = (s: number): THREE.Vector3 => {
      let k = 1;
      while (k < cum.length - 1 && cum[k] < s) k++;
      const seg = cum[k] - cum[k - 1] || 1;
      return fine[k - 1].clone().lerp(fine[k], (s - cum[k - 1]) / seg);
    };
    this.rest = [];
    for (let i = 0; i <= BONES; i++) this.rest.push(at((i / BONES) * total));

    // Flex shares: an exponential decay toward the tip, normalised so the whole
    // tail bends by the same total amount whatever the joint count. This is the
    // curve the old hand-set shares (.5/.3/.2/.14/.1) were fitting.
    const curve = (k: number, scale: number): number[] => {
      const w: number[] = [];
      let sum = 0;
      for (let i = 0; i < BONES; i++) {
        const t = BONES > 1 ? i / (BONES - 1) : 0;
        const e = Math.exp(-k * t);
        w.push(e);
        sum += e;
      }
      return w.map((v) => (v / sum) * scale);
    };
    this.share = { lift: curve(1.6, 1.24), wag: curve(0.78, 1.26) };
  }

  /** The bone chain. Every rest rotation is identity and the curve lives in the
   *  offsets, which makes the bind matrix trivial and the per-frame solve a
   *  plain "rotate this rest direction onto that world direction". */
  private buildBones(): void {
    for (let i = 0; i < BONES; i++) {
      const bone = new THREE.Bone();
      bone.position.copy(this.rest[i]);
      if (i > 0) bone.position.sub(this.rest[i - 1]);
      (i === 0 ? this.root : this.bones[i - 1]).add(bone);
      this.bones.push(bone);
    }
  }

  /** The tube: RINGS x SIDES indexed, closed at the tip. */
  private buildSkin(material: THREE.Material): void {
    const pos: number[] = [];
    const nrm: number[] = [];
    const uv: number[] = [];
    const col: number[] = [];
    const si: number[] = [];
    const sw: number[] = [];
    const idx: number[] = [];

    // Arc length along the REST joints, so a ring's parameter maps straight
    // onto the bone chain.
    const cum = [0];
    for (let i = 1; i < this.rest.length; i++)
      cum.push(cum[i - 1] + this.rest[i].distanceTo(this.rest[i - 1]));
    const total = cum[cum.length - 1];
    /** Point + frame + bone parameter at arc fraction f of the JOINT polyline. */
    const station = (f: number) => {
      const s = f * total;
      let k = 1;
      while (k < cum.length - 1 && cum[k] < s) k++;
      const seg = cum[k] - cum[k - 1] || 1;
      const t = Math.min(1, Math.max(0, (s - cum[k - 1]) / seg));
      const centre = this.rest[k - 1].clone().lerp(this.rest[k], t);
      const tan = this.rest[k].clone().sub(this.rest[k - 1]).normalize();
      // The curve is planar in YZ, so +X is always a clean binormal — no
      // parallel-transport bookkeeping and no twist to accumulate.
      const bx = new THREE.Vector3(1, 0, 0);
      const by = new THREE.Vector3().crossVectors(tan, bx).normalize();
      return { centre, bx, by, u: k - 1 + t };
    };

    for (let r = 0; r < RINGS; r++) {
      const f = r / (RINGS - 1);
      const { centre, bx, by, u } = station(f);
      // Radius runs off the VISIBLE fraction: the buried part keeps the base
      // width so the collar stays fat inside the body.
      const vis = Math.max(0, (f * total - BURY) / (total - BURY));
      const rad = restRadius(vis);
      // Two-bone linear weights, computed from the RING — every vertex around
      // a ring therefore gets bit-identical weights, including the duplicated
      // seam column, so the tube cannot tear however it is posed.
      const k0 = u >= BONES - 1 ? BONES - 2 : Math.floor(u);
      // rings inside the body ride bone 0 outright, welding them to the hips
      const w1 = f * total <= BURY ? 0 : u >= BONES - 1 ? 1 : u - k0;
      // Shade down the length: a lit base into a dark tip, the way every
      // cartoon tail is drawn. Baked per vertex so it needs no texture and
      // cannot land on the wrong texels.
      const shade = 1 - 0.34 * Math.pow(Math.max(0, vis), 1.3);
      for (let s = 0; s <= SIDES; s++) {
        // s == SIDES duplicates s == 0 so the UV seam can wrap; identical
        // position and identical weights, so it moves as one vertex.
        const a = ((s % SIDES) / SIDES) * Math.PI * 2;
        // slightly taller than wide, the way a real tail is
        const ox = Math.cos(a) * rad;
        const oy = Math.sin(a) * rad * 1.12;
        _v.copy(centre).addScaledVector(bx, ox).addScaledVector(by, oy);
        pos.push(_v.x, _v.y, _v.z);
        _v2.set(0, 0, 0).addScaledVector(bx, Math.cos(a)).addScaledVector(by, Math.sin(a)).normalize();
        nrm.push(_v2.x, _v2.y, _v2.z);
        uv.push(s / SIDES, f);
        col.push(shade, shade, shade);
        si.push(k0, k0 + 1, 0, 0);
        sw.push(1 - w1, w1, 0, 0);
      }
    }
    // tip vertex: closes the tube so there is no open end to see into
    const tipStation = station(1);
    pos.push(tipStation.centre.x, tipStation.centre.y, tipStation.centre.z);
    const tipTan = this.rest[BONES].clone().sub(this.rest[BONES - 1]).normalize();
    nrm.push(tipTan.x, tipTan.y, tipTan.z);
    uv.push(0.5, 1);
    col.push(0.66, 0.66, 0.66);
    si.push(BONES - 1, BONES - 1, 0, 0);
    sw.push(1, 0, 0, 0);
    const tip = RINGS * (SIDES + 1);

    for (let r = 0; r + 1 < RINGS; r++)
      for (let s = 0; s < SIDES; s++) {
        const a = r * (SIDES + 1) + s;
        const b = a + 1;
        const c = a + (SIDES + 1);
        const d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    for (let s = 0; s < SIDES; s++) {
      const a = (RINGS - 1) * (SIDES + 1) + s;
      idx.push(a, tip, a + 1);
    }

    const geo = new THREE.BufferGeometry();
    geo.setIndex(idx);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    this.geo = geo;

    // Geometry and bone rests are both authored in root space, so the bind
    // matrix is the identity and each inverse is just the joint's offset.
    const inverses = this.rest
      .slice(0, BONES)
      .map((j) => new THREE.Matrix4().makeTranslation(-j.x, -j.y, -j.z));
    const mesh = new THREE.SkinnedMesh(geo, material);
    mesh.frustumCulled = false; // the bind-pose bounds do not cover a full swing
    mesh.castShadow = true;
    this.root.add(mesh);
    mesh.bind(new THREE.Skeleton(this.bones, inverses), new THREE.Matrix4());
  }

  /**
   * Recolour, for a character whose fur is not the rig's own orange.
   *
   * The tail deliberately does NOT read its colour off an installed model.
   * Two versions of this tried: mapping the tube's UVs into the model's own
   * tail island, then sampling a median texel from it. Both went wrong the
   * same way — the model's tail triangles are found geometrically ("behind
   * the hips, below the waist"), which catches a shoe and the hem of her
   * shorts along with the tail, and the tail came out wearing her clothes.
   * The rig's fur colour is this character's fur colour, so it is simply
   * right; a different character can call this.
   */
  setTint(color: THREE.ColorRepresentation): void {
    this.mat.color.set(color);
  }

  /** Drop the chain straight onto the authored pose — respawns, level loads. */
  reset(): void {
    this.seeded = false;
  }

  /**
   * One step. `pose` is what the animation wants; the sim chases it.
   * `bodies` are world-space spheres the tail must stay outside of.
   */
  update(dt: number, pose: TailPose, bodies: TailCollider[]): void {
    if (this.bones.length === 0 || !(dt > 0)) return;
    this.root.updateWorldMatrix(true, false);
    const rootM = this.root.matrixWorld;
    // A simulation never recovers from one bad number: a single non-finite
    // frame poisons every particle and the tail is gone for the rest of the
    // session. So refuse the frame instead — hold the last good state, and
    // re-seed from the pose once the input makes sense again. Cheap insurance
    // against anything upstream handing us a NaN (a degenerate matrix, a pose
    // term mid-transition, a rig being rebuilt under us).
    if (
      !Number.isFinite(pose.lift) ||
      !Number.isFinite(pose.wag) ||
      !Number.isFinite(pose.roll) ||
      !Number.isFinite(rootM.elements[12])
    ) {
      this.seeded = false;
      return;
    }

    // 1. TARGET: the rest curve bent by the authored pose, in world space.
    //    Each joint takes a share of the lift and wag and the rotations
    //    accumulate down the chain, so the tail forms one arc rather than
    //    hinging at a single joint.
    const n = BONES;
    if (this.target.length === 0)
      for (let i = 0; i <= n; i++) this.target.push(new THREE.Vector3());
    _q2.identity();
    this.target[0].setFromMatrixPosition(rootM);
    _v2.copy(this.rest[0]).applyMatrix4(rootM);
    this.target[0].copy(_v2);
    for (let i = 0; i < n; i++) {
      _q.setFromEuler(
        new THREE.Euler(pose.lift * this.share.lift[i], pose.wag * this.share.wag[i], i === 0 ? pose.roll : 0),
      );
      _q2.multiply(_q);
      _v.copy(this.rest[i + 1]).sub(this.rest[i]).applyQuaternion(_q2);
      this.target[i + 1].copy(this.target[i]).add(_v.applyMatrix4(_m.extractRotation(rootM)));
    }
    // Scale lives in rootM, so segment lengths taken from the transformed
    // target are automatically in the right world units — including under the
    // HEIGHT knob, which scales the whole rider.
    const scale = _v.setFromMatrixColumn(rootM, 0).length() || 1;

    // 2. seed / teleport guard. A respawn moves the hips across the level; a
    //    chain that tried to follow would stretch across the map for a frame.
    if (!this.seeded || this.p.length === 0) {
      this.p = this.target.map((t) => t.clone());
      this.vel = this.target.map(() => new THREE.Vector3());
      this.seeded = true;
    } else if (this.p[0].distanceToSquared(this.target[0]) > 4 * scale * scale) {
      for (let i = 0; i <= n; i++) {
        this.p[i].copy(this.target[i]);
        this.vel[i].set(0, 0, 0);
      }
    }

    // 3. integrate. The root joint is PINNED to the body; everything past it
    //    is free, so the hips drag the tail rather than carrying it.
    this.p[0].copy(this.target[0]);
    this.vel[0].set(0, 0, 0);
    const step = Math.min(dt, 1 / 30); // one big frame must not explode it
    const decay = Math.exp(-this.damp * step);
    for (let i = 1; i <= n; i++) {
      _v.copy(this.target[i]).sub(this.p[i]).multiplyScalar(this.stiff * step);
      _v.y += this.gravity * scale * step;
      this.vel[i].add(_v).multiplyScalar(decay);
      this.p[i].addScaledVector(this.vel[i], step);
    }

    // 4. constraints, relaxed: keep the segments their own length, keep the
    //    joints from folding, and keep the whole thing outside her body.
    //
    //    ORDER AND COUNT BOTH MATTER. These three pull against each other —
    //    shoving a joint out of her thigh lengthens the segment, and putting
    //    the segment back drags the joint into her thigh — so whichever runs
    //    LAST is the one that actually holds. Running length last let the tail
    //    sink 0.09 into her leg on a crouch, which is exactly the failure this
    //    is here to prevent, so collision goes last and length settles for
    //    whatever the relaxation converges on. Four passes is enough to make
    //    that residual invisible: each one only has to correct the last one's
    //    small overshoot.
    for (let pass = 0; pass < 4; pass++) {
      this.limitBend(n);
      this.holdLength(n);
      this.pushOut(n, bodies, scale);
    }

    // A constraint pass on a degenerate configuration could still produce a
    // non-finite point; catching it here keeps it out of the bones.
    for (let i = 0; i <= n; i++) {
      if (Number.isFinite(this.p[i].x) && Number.isFinite(this.p[i].y) && Number.isFinite(this.p[i].z))
        continue;
      this.seeded = false;
      return;
    }

    // 5. drive the bones: rotate each rest direction onto the direction the
    //    solved chain ended up pointing.
    _q2.setFromRotationMatrix(_m.extractRotation(rootM)); // parent world rotation
    for (let i = 0; i < n; i++) {
      _v.copy(this.p[i + 1]).sub(this.p[i]);
      if (_v.lengthSq() < 1e-10) continue;
      _v.normalize().applyQuaternion(_q.copy(_q2).invert()); // into the bone's parent space
      _v2.copy(this.rest[i + 1]).sub(this.rest[i]).normalize();
      this.bones[i].quaternion.setFromUnitVectors(_v2, _v);
      _q2.multiply(this.bones[i].quaternion);
    }
  }

  /** Segments back to their rest length, walking out from the pinned root. */
  private holdLength(n: number): void {
    for (let i = 1; i <= n; i++) {
      const want = this.target[i].distanceTo(this.target[i - 1]);
      _v.copy(this.p[i]).sub(this.p[i - 1]);
      const len = _v.length();
      if (len < 1e-9) {
        this.p[i].copy(this.p[i - 1]).addScaledVector(_v.set(0, 0, -1), want);
        continue;
      }
      this.p[i].copy(this.p[i - 1]).addScaledVector(_v, want / len);
    }
  }

  /** Cap the angle at each joint. Without this a fast turn folds the chain
   *  double and the far half ends up inside her. */
  private limitBend(n: number): void {
    for (let i = 2; i <= n; i++) {
      _v.copy(this.p[i - 1]).sub(this.p[i - 2]);
      _v2.copy(this.p[i]).sub(this.p[i - 1]);
      const la = _v.length();
      const lb = _v2.length();
      if (la < 1e-9 || lb < 1e-9) continue;
      _v.divideScalar(la);
      _v2.divideScalar(lb);
      const dot = Math.min(1, Math.max(-1, _v.dot(_v2)));
      const ang = Math.acos(dot);
      if (ang <= this.maxBend) continue;
      // rotate the child segment back toward the parent's direction
      _q.setFromUnitVectors(_v2, _v); // full correction...
      _q2.identity().slerp(_q, (ang - this.maxBend) / ang); // ...taken partly
      this.p[i].copy(this.p[i - 1]).addScaledVector(_v2.applyQuaternion(_q2), lb);
    }
  }

  /**
   * Shove every joint out of the body spheres — and carry the REST OF THE
   * TAIL with it.
   *
   * Moving the contact joint alone is what a naive push-out does, and it
   * hinges the tail at that one point: the joint slides around the thigh
   * while the tip stays put, and the chain folds double (measured at 2.4
   * radians, a hairpin). Translating everything downstream by the same vector
   * keeps every segment past the contact at its own length and its own angle,
   * so a collision DISPLACES the tail instead of bending it, and the length
   * and bend passes are left with almost nothing to correct.
   */
  private pushOut(n: number, bodies: TailCollider[], scale: number): void {
    if (bodies.length === 0) return;
    for (let i = 1; i <= n; i++) {
      const skin = restRadius(i / n) * scale * 0.85;
      for (const b of bodies) {
        if (i < b.from) continue; // this joint lives inside that part
        const need = b.r + skin;
        _v.copy(this.p[i]).sub(b.c);
        const d2 = _v.lengthSq();
        if (d2 >= need * need || d2 < 1e-12) continue;
        // the correction this joint needs...
        _v2.copy(b.c).addScaledVector(_v, need / Math.sqrt(d2)).sub(this.p[i]);
        // ...applied to it and every joint beyond it, capped so a pose that
        // buries the tail in a collider cannot fling it across the level
        const cap = 0.35 * scale;
        if (_v2.lengthSq() > cap * cap) _v2.setLength(cap);
        for (let k = i; k <= n; k++) this.p[k].add(_v2);
      }
    }
  }

  dispose(): void {
    this.geo?.dispose();
    this.root.removeFromParent();
  }
}
