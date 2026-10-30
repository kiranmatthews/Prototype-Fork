import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { CustomComponent } from './level';

type P = [number, number, number];
type Palette = { navy: THREE.Material; frame: THREE.Material; orange: THREE.Material; metal: THREE.Material };
type Pieces = Map<THREE.Material, THREE.BufferGeometry[]>;
const up = new THREE.Vector3(0, 1, 0);

class TowLoop extends THREE.Curve<THREE.Vector3> {
  constructor(private readonly extent: number, private readonly radius: number) { super(); }
  getPoint(t: number, target = new THREE.Vector3()) {
    const span = this.extent * 2, halfTurn = Math.PI * this.radius;
    let along = t * (2 * span + 2 * halfTurn);
    if (along <= span) return target.set(-this.extent + along, this.radius, 0);
    along -= span;
    if (along <= halfTurn) {
      const angle = Math.PI / 2 - along / this.radius;
      return target.set(this.extent + Math.cos(angle) * this.radius, Math.sin(angle) * this.radius, 0);
    }
    along -= halfTurn;
    if (along <= span) return target.set(this.extent - along, -this.radius, 0);
    const angle = -Math.PI / 2 - (along - span) / this.radius;
    return target.set(-this.extent + Math.cos(angle) * this.radius, Math.sin(angle) * this.radius, 0);
  }
}

/** Working harbour machinery. The native deck is the sole motion/contact owner. */
export class CarlisleDeckMachinery {
  readonly diagnostics = { hydraulicLifts: 0, counterweightLifts: 0, winches: 0, triangles: 0, colliders: 0 };
  private readonly groups: THREE.Group[] = [];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly callbacks: THREE.Mesh[] = [];
  private serial = 0;
  constructor(private readonly palette: Palette) {}

  private group(name: string, parent: THREE.Object3D, p: P = [0, 0, 0], yaw = 0) {
    const group = new THREE.Group(); group.name = name; group.position.set(...p); group.rotation.y = yaw;
    group.userData.visualOnly = true; parent.add(group); this.groups.push(group); return group;
  }
  private piece(pieces: Pieces, geometry: THREE.BufferGeometry, p: P, material: THREE.Material, rotation?: THREE.Quaternion) {
    if (geometry.index) { const plain = geometry.toNonIndexed(); geometry.dispose(); geometry = plain; }
    if (rotation) geometry.applyQuaternion(rotation);
    geometry.translate(...p);
    const points = geometry.attributes.position, normals = geometry.attributes.normal, uv: number[] = [], colors: number[] = [];
    const offset = this.serial++ * .173, tone = .94 + .09 * ((this.serial * 7) % 13) / 12;
    for (let i = 0; i < points.count; i++) {
      const x = points.getX(i), y = points.getY(i), z = points.getZ(i);
      const nx = Math.abs(normals.getX(i)), ny = Math.abs(normals.getY(i)), nz = Math.abs(normals.getZ(i));
      uv.push((ny >= nx && ny >= nz ? x : nx > nz ? z : x) / 5 + offset, (ny >= nx && ny >= nz ? z : y) / 5 + offset * .37);
      colors.push(tone, tone, tone);
    }
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const batch = pieces.get(material) ?? []; batch.push(geometry); pieces.set(material, batch);
  }
  private box(pieces: Pieces, p: P, size: P, material: THREE.Material, bevel = .07) {
    this.piece(pieces, new RoundedBoxGeometry(...size, 1, Math.min(bevel, ...size.map(n => n * .2))), p, material);
  }
  private cylinder(pieces: Pieces, p: P, radius: number, height: number, material: THREE.Material, axis = up) {
    this.piece(pieces, new THREE.CylinderGeometry(radius, radius, height, 16), p, material,
      new THREE.Quaternion().setFromUnitVectors(up, axis));
  }
  private beam(pieces: Pieces, a: P, b: P, width: number, material: THREE.Material) {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), delta = to.clone().sub(from);
    this.piece(pieces, new RoundedBoxGeometry(width, delta.length(), width, 1, width * .12),
      from.add(to).multiplyScalar(.5).toArray() as P, material, new THREE.Quaternion().setFromUnitVectors(up, delta.normalize()));
  }
  private finish(group: THREE.Group, pieces: Pieces, name: string) {
    for (const [material, parts] of pieces) {
      const geometry = mergeGeometries(parts, false)!; parts.forEach(g => g.dispose());
      geometry.computeBoundingBox(); geometry.computeBoundingSphere(); this.geometries.push(geometry);
      const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.userData.visualOnly = true; group.add(mesh); this.diagnostics.triangles += geometry.attributes.position.count / 3;
    }
  }
  private bolts(pieces: Pieces, x: number, y: number, z: number, width: number, depth: number) {
    for (const dx of [-width, width]) for (const dz of [-depth, depth])
      this.cylinder(pieces, [x + dx, y, z + dz], .13, .11, this.palette.metal);
  }
  /** Recompute at render/shadow time from the interpolated native transform.
   * No second sine clock, one-tick lag, or changes to the platform matrix. */
  private follow(group: THREE.Group, update: () => void) {
    group.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return;
      const sync = () => { update(); group.updateWorldMatrix(true, true); };
      node.onBeforeRender = sync; node.onBeforeShadow = sync;
      // These few moving fittings have a bounded five-metre travel. The owning
      // scenery chunk still culls them; never cull from a stale previous pose.
      node.frustumCulled = false; this.callbacks.push(node);
    });
    update();
  }
  add(c: CustomComponent, deck: THREE.Mesh, parent: THREE.Group, sea: number) {
    if (!c.s || c.bounce !== undefined || c.spin || c.orbit) return false;
    const tide = /^Tide steps · /.test(c.nm ?? ''), counterweight = /^Counterweight \d/.test(c.nm ?? '');
    const winch = c.nm === 'Port winch' || c.nm === 'Starboard winch';
    if (!tide && !counterweight && !winch) return false;
    const yaw = THREE.MathUtils.degToRad(c.yaw ?? 0), base: P = [c.p[0], c.p[1] - c.s[1] / 2, c.p[2]];
    const fixed = this.group(`${c.nm} · fixed drive`, parent, base, yaw);
    fixed.userData.deckMachinery = { source: c.nm, kind: tide ? 'hydraulic' : counterweight ? 'counterweight' : 'winch', base, size: c.s, travel: c.amp ?? 0 };
    const riding = this.group(`${c.nm} · riding fittings`, deck);
    const fixedParts: Pieces = new Map(), ridingParts: Pieces = new Map();
    const [w, h, d] = c.s, amp = Math.abs(c.amp ?? 0), bottom = -h / 2, water = sea - base[1];
    const { navy, frame, orange, metal } = this.palette;
    if (tide) {
      const collar = bottom - amp - 1.2, footing = water - 1.6;
      for (const x of [-w * .32, w * .32]) for (const z of [-d * .3, d * .3]) {
        this.cylinder(fixedParts, [x, (footing + collar) / 2, z], .77, collar - footing, navy);
        this.cylinder(fixedParts, [x, collar - .22, z], .98, .44, orange);
        this.cylinder(fixedParts, [x, collar + .045, z], .64, .09, frame);
        this.box(fixedParts, [x, footing + .2, z], [2.8, .4, 2.8], frame);
        this.bolts(fixedParts, x, footing + .46, z, .98, .98);
        // Full constant-diameter rod slides into its barrel. Its top is rigidly
        // attached to the native deck, including render interpolation.
        const rod = amp * 2 + 2.2;
        this.cylinder(ridingParts, [x, bottom - .25 - rod / 2, z], .45, rod, metal);
        this.box(ridingParts, [x, bottom - .18, z], [2.2, .36, 2.2], orange);
        this.bolts(ridingParts, x, bottom - .06, z, .76, .76);
      }
      this.diagnostics.hydraulicLifts++;
    } else if (counterweight) {
      const top = amp + 3, footing = water - 2, weightRest = Math.min(-10, -amp - 6);
      for (const side of [-1, 1]) {
        const x = side * (w / 2 + 4), wheelRadius = .64;
        for (const dx of [-1.1, 1.1]) {
          this.box(fixedParts, [x + dx, (footing + top) / 2, 1.2], [.42, top - footing, .58], navy);
          this.box(fixedParts, [x + dx, footing + .2, 1.2], [2, .4, 2.2], frame);
        }
        for (let y = footing + 2; y < top - 1; y += 4.5) {
          this.beam(fixedParts, [x - 1.1, y, 1.2], [x + 1.1, Math.min(top - .5, y + 4.5), 1.2], .22, frame);
          this.box(fixedParts, [x, y, 1.2], [2.55, .24, .75], orange);
        }
        this.box(fixedParts, [x, top, .65], [3.1, .55, 2.1], navy);
        this.beam(ridingParts, [side * (w / 2 - .8), bottom - 1.25, 0], [x - wheelRadius, bottom - 1.25, 0], .5, frame);
        this.box(ridingParts, [side * (w / 2 - 1), bottom - .58, 0], [.7, 1.16, 1.4], orange);
        const wheel = this.group('Counterweight sheave', fixed, [x, top - .22, 0]);
        const wheelParts: Pieces = new Map();
        const axis = new THREE.Vector3(0, 0, 1);
        this.cylinder(wheelParts, [0, 0, 0], wheelRadius, .38, frame, axis);
        for (const z of [-.24, .24]) this.cylinder(wheelParts, [0, 0, z], .76, .12, orange, axis);
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 3)
          this.cylinder(wheelParts, [.44 * Math.cos(angle), .44 * Math.sin(angle), .32], .08, .06, metal, axis);
        this.finish(wheel, wheelParts, 'Grooved counterweight pulley');
        const weight = this.group('Travelling counterweight', fixed, [x + wheelRadius, weightRest, 0]);
        const weightParts: Pieces = new Map();
        for (let i = 0; i < 4; i++) this.box(weightParts, [0, i * .48 - .72, 0], [1.35, .42, .9], i % 2 ? frame : orange);
        for (const dx of [-.45, .45]) this.box(weightParts, [dx, 0, -.54], [.15, 2.2, .18], navy);
        this.finish(weight, weightParts, 'Cast ballast plates');
        const ropes = [0, 1].map(i => {
          const rope = this.group(i ? 'Counterweight fall cable' : 'Lift suspension cable', fixed, [x + (i ? 1 : -1) * wheelRadius, 0, 0]);
          const parts: Pieces = new Map(); this.cylinder(parts, [0, -.5, 0], .065, 1, metal); this.finish(rope, parts, 'Steel hoist cable'); return rope;
        });
        const sync = () => {
          const travel = deck.position.y - base[1];
          weight.position.y = weightRest - travel;
          wheel.rotation.z = -travel / wheelRadius;
          const ends = [bottom - 1.25 + travel, weight.position.y + 1.1];
          ropes.forEach((rope, i) => { rope.position.y = top - .22; rope.scale.y = top - .22 - ends[i]; });
        };
        for (const node of [weight, wheel, ...ropes]) this.follow(node, sync);
      }
      this.diagnostics.counterweightLifts++;
    } else {
      // Translation is along world X, not deck-local X. Each carriage gets its
      // own fixed track on precisely that axis, even on the curving coastline.
      fixed.rotation.y = 0;
      const q = new THREE.Quaternion().setFromAxisAngle(up, yaw);
      const railY = bottom - 2.15, axleY = bottom - 1.42, radius = .54, extent = amp + 2;
      for (const x of [-w * .31, w * .31]) for (const z of [-d * .31, d * .31]) {
        const at = new THREE.Vector3(x, 0, z).applyQuaternion(q);
        this.box(fixedParts, [at.x, railY, at.z], [extent * 2, .38, .55], frame);
        for (const end of [-extent, extent]) {
          this.box(fixedParts, [at.x + end, (railY + water - 2) / 2, at.z], [.8, railY - water + 2, .8], navy);
          this.box(fixedParts, [at.x + end, railY + .1, at.z], [.8, .7, 1.2], orange);
        }
        // Bogies have their own world-aligned orientation within the deck.
        const bogie = this.group('Winch travelling bogie', deck, [x, 0, z], -yaw);
        const parts: Pieces = new Map();
        this.box(parts, [0, bottom - .48, 0], [2.6, .7, 1.7], navy);
        this.box(parts, [0, bottom - .06, 0], [3.1, .12, 2.1], orange);
        for (const dx of [-.82, .82]) {
          const wheel = this.group('Winch bogie wheel', bogie, [dx, axleY, 0]);
          const wp: Pieces = new Map(), wheelAxis = new THREE.Vector3(0, 0, 1);
          this.cylinder(wp, [0, 0, 0], radius, .72, frame, wheelAxis);
          for (const dz of [-.43, .43]) this.cylinder(wp, [0, 0, dz], radius + .07, .14, orange, wheelAxis);
          this.cylinder(wp, [0, 0, .55], .16, .1, metal, wheelAxis);
          this.box(wp, [0, 0, .53], [.12, radius * 1.55, .08], metal, .015);
          this.finish(wheel, wp, 'Flanged travelling wheel');
          this.follow(wheel, () => { wheel.rotation.z = -(deck.position.x - base[0]) / radius; });
        }
        if (x < 0) {
          // The carriage grips the top run of a closed cable. Both ends wrap
          // around real sheaves; there are no unsupported cut cable tips.
          this.box(parts, [0, bottom - 1.15, -.85], [.32, 1.08, .3], frame);
          this.box(parts, [0, railY + .5, -.85], [.7, .18, .32], orange, .025);
          const r = .9, path = new TowLoop(extent, r);
          this.piece(fixedParts, new THREE.TubeGeometry(path, 160, .055, 6, true), [at.x, railY - .4, at.z - .85], metal);
          const drum = this.group('Winch cable drum', fixed, [at.x - extent, railY - .4, at.z - .85]);
          const dp: Pieces = new Map(), drumAxis = new THREE.Vector3(0, 0, 1);
          this.cylinder(dp, [0, 0, 0], .83, 1.4, frame, drumAxis);
          for (const dz of [-.8, .8]) this.cylinder(dp, [0, 0, dz], 1.03, .2, orange, drumAxis);
          for (let dz = -.6; dz <= .61; dz += .16)
            this.piece(dp, new THREE.TorusGeometry(.88, .052, 6, 24), [0, 0, dz], metal);
          this.cylinder(dp, [0, 0, 1.05], .23, .3, metal, drumAxis);
          this.box(dp, [0, 0, 1.22], [.18, 1.5, .12], navy, .02);
          this.finish(drum, dp, 'Wound steel tow drum');
          this.follow(drum, () => { drum.rotation.z = -(deck.position.x - base[0]) / .9; });
          for (const dz of [-1.03, 1.03])
            this.box(fixedParts, [at.x - extent, railY - 1.08, at.z - .85 + dz], [.75, 1.45, .35], navy);
          const returnWheel = this.group('Winch return sheave', fixed, [at.x + extent, railY - .4, at.z - .85]);
          const returnParts: Pieces = new Map();
          this.cylinder(returnParts, [0, 0, 0], .84, .3, frame, drumAxis);
          for (const dz of [-.22, .22]) this.cylinder(returnParts, [0, 0, dz], 1.02, .12, orange, drumAxis);
          this.cylinder(returnParts, [0, 0, .32], .18, .12, metal, drumAxis);
          this.finish(returnWheel, returnParts, 'Grooved tow return pulley');
          this.follow(returnWheel, () => { returnWheel.rotation.z = -(deck.position.x - base[0]) / r; });
          this.box(fixedParts, [at.x + extent, railY - .4, at.z - .35], [.55, .65, 1.15], navy);
        }
        this.finish(bogie, parts, 'Winch carriage');
      }
      // Bolted longitudinal sills stiffen the two sets of tracks below the deck.
      for (const x of [-w * .31, w * .31]) {
        const a = new THREE.Vector3(x, railY - .6, -d * .31).applyQuaternion(q), b = new THREE.Vector3(x, railY - .6, d * .31).applyQuaternion(q);
        this.beam(fixedParts, a.toArray() as P, b.toArray() as P, .55, navy);
      }
      this.diagnostics.winches++;
    }
    this.finish(fixed, fixedParts, 'Fixed marine drive structure');
    this.finish(riding, ridingParts, 'Deck-mounted drive fittings');
    return true;
  }
  dispose() {
    for (const mesh of this.callbacks) { mesh.onBeforeRender = () => {}; mesh.onBeforeShadow = () => {}; }
    this.callbacks.length = 0; this.groups.forEach(group => group.removeFromParent()); this.groups.length = 0;
    this.geometries.forEach(geometry => geometry.dispose()); this.geometries.length = 0;
    // Materials belong to CarlisleSteelDecks and share its texture lifetime.
  }
}
