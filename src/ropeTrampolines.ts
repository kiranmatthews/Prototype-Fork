import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CarlisleMarineNet, marineFrameHeight, type MarineNetLayout } from './carlisleMarineNet';
import { trampolineSurfacePresentations } from './trampolineSurface';
import type { CustomLevelData } from './level';

/**
 * THE ROPE TRAMPOLINE: what every `trampoline` is unless its course gives it a
 * housing of its own (Carlisle's marine net, the Spaghetti springs, the tribal
 * nets of the waterfalls, which are this same net on a frame the course builds).
 *
 * A knotted brown rope net, lashed inside a slim timber frame with a post at
 * each corner, standing where the plain pad stood and exactly as big. Only the
 * look changes: the pad's own box is still the floor, the wall and the spring,
 * and the whole of its top still throws a body that lands on it. The net gives
 * under a walker's weight and rings when it throws somebody, as the others do,
 * but it goes down no further than whatever lies under it, so a net laid on a
 * solid floor stays on that floor.
 */

/** The frame's timber, as a share of the pad's shorter side, and its limits in metres. */
const BEAM = { share: 0.055, min: 0.16, max: 0.6 };
/** The gap the lashings cross, between the frame and the net's bound edge, in beams. */
const LASH_GAP = 0.35;
/** How far the frame stands proud of the net. Low: a walker crosses it. */
const PROUD = 0.035;
const TIMBER_DARK = 0x3a2616;
const ROPE = 0x8a6a44;

/** The frame's timber for a pad of this size. */
export const ropeTrampolineBeam = (w: number, d: number): number =>
  THREE.MathUtils.clamp(Math.min(w, d) * BEAM.share, BEAM.min, BEAM.max);

/** The rope opening of a pad of this size, in its own metres: [x0, x1, z0, z1]. */
export function ropeTrampolineOpening(w: number, d: number): [number, number, number, number] {
  const inset = ropeTrampolineBeam(w, d) * (1 + LASH_GAP);
  return [-w / 2 + inset, w / 2 - inset, -d / 2 + inset, d / 2 - inset];
}

function layoutFor(w: number, d: number): MarineNetLayout {
  const beam = ropeTrampolineBeam(w, d);
  // The lashings are tied at the frame's inner edge: two to a side, a quarter of the way in from each end.
  const ex = (w / 2 - beam) / w, ez = (d / 2 - beam) / d;
  return {
    key: 'framed',
    bounds: ropeTrampolineOpening(w, d),
    eyes: [[-ex, .87, -.25], [-ex, .87, .25], [ex, .87, -.25], [ex, .87, .25], [-.25, .87, -ez], [.25, .87, -ez], [-.25, .87, ez], [.25, .87, ez]],
    corners: [w / 2 - beam * 0.5, d / 2 - beam * 0.5],
  };
}

/** A box with its faces' texture laid by the metre, so that long and short timbers carry the same grain. */
function timber(sx: number, sy: number, sz: number, x: number, y: number, z: number, grainAlong: 'x' | 'y' | 'z'): THREE.BufferGeometry {
  const box = new THREE.BoxGeometry(sx, sy, sz);
  const position = box.attributes.position, normal = box.attributes.normal, uv = box.attributes.uv as THREE.BufferAttribute;
  const TILE = 1.6; // metres of timber to one tile of the texture
  const grain = grainAlong === 'x' ? 0 : grainAlong === 'y' ? 1 : 2;
  for (let i = 0; i < position.count; i++) {
    const p = [position.getX(i), position.getY(i), position.getZ(i)];
    const n = [Math.abs(normal.getX(i)), Math.abs(normal.getY(i)), Math.abs(normal.getZ(i))];
    const face = n[0] > .5 ? 0 : n[1] > .5 ? 1 : 2;
    if (face === grain) { // an end face: the grain has no length to run here
      const [a, b] = [0, 1, 2].filter(axis => axis !== grain);
      uv.setXY(i, p[a] / TILE, p[b] / TILE);
    } else uv.setXY(i, p[3 - grain - face] / (TILE * .5), p[grain] / TILE); // (the wood's boards run up the texture)
  }
  box.translate(x, y, z);
  return box;
}

interface Entry {
  mesh: THREE.Mesh;
  material: THREE.Material | THREE.Material[];
  mount: THREE.Group;
  net: CarlisleMarineNet;
  impact: number;
  thick: number;
  well: THREE.Mesh;
  measured: boolean;
}

class RopeTrampolines {
  readonly diagnostics = { nets: 0 };
  private readonly dark = new THREE.MeshBasicMaterial({ color: 0x120b07 });
  private readonly rope = new THREE.MeshLambertMaterial({ color: ROPE });
  private readonly inner = new THREE.MeshLambertMaterial({ color: TIMBER_DARK });
  private readonly entries: Entry[] = [];
  private readonly probe = new THREE.Raycaster();

  constructor(data: CustomLevelData, private readonly ground: THREE.Object3D[], private readonly timberMaterial: THREE.Material) {
    for (const object of ground) {
      const pad = object as THREE.Mesh;
      if (!pad.isMesh || pad.userData.trampolineBounce === undefined || trampolineSurfacePresentations.has(pad)) continue;
      const c = data.components[pad.userData.editorIdx];
      if (!c || c.t !== 'trampoline') continue;
      const [w, authored, d] = c.s ?? [5, 0.45, 5];
      const thick = Math.max(0.08, authored), top = thick / 2;
      const mount = new THREE.Group();
      mount.name = 'Rope trampoline';
      mount.userData.visualOnly = true;
      pad.add(mount);
      const net = new CarlisleMarineNet(w, d, marineFrameHeight(w, d), 'tribal', layoutFor(w, d));
      net.group.position.y = top + 0.02;
      mount.add(net.group);
      const well = this.frame(mount, w, thick, d);
      this.entries.push({ mesh: pad, material: pad.material, mount, net, impact: pad.userData.trampolineVisualImpact?.id ?? 0, thick, well, measured: false });
      // The pad is not drawn, but it keeps a material that is its own in everything else: its colour and
      // its texture kind are what a level editor reads back off it.
      const unseen = (Array.isArray(pad.material) ? pad.material[0] : pad.material).clone();
      unseen.colorWrite = false; unseen.depthWrite = false;
      pad.material = unseen;
      trampolineSurfacePresentations.set(pad, net);
      pad.userData.ropeNet = net.diagnostics;
      this.diagnostics.nets++;
    }
  }

  /** The timber round the net, and the dark of the well under it. Returns the well's bottom. */
  private frame(mount: THREE.Group, w: number, thick: number, d: number): THREE.Mesh {
    const beam = ropeTrampolineBeam(w, d), top = thick / 2 + PROUD, deep = Math.max(0.12, Math.min(beam, thick + PROUD));
    const post = beam * 1.3, cap = Math.min(0.14, beam * 0.5);
    const wood: THREE.BufferGeometry[] = [], ropes: THREE.BufferGeometry[] = [], shade: THREE.BufferGeometry[] = [];
    // Four rails, inside the pad's own edge, between the posts.
    for (const side of [-1, 1]) {
      wood.push(timber(beam, deep, d - post * 2, side * (w / 2 - beam / 2), top - deep / 2, 0, 'z'));
      wood.push(timber(w - post * 2, deep, beam, 0, top - deep / 2, side * (d / 2 - beam / 2), 'x'));
    }
    // A post at each corner, from the pad's foot to a little over the rails, lashed to them with three turns of rope.
    const tall = thick + PROUD + cap;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const x = sx * (w / 2 - post / 2), z = sz * (d / 2 - post / 2);
      wood.push(timber(post, tall, post, x, top + cap - tall / 2, z, 'y'));
      const turn = Math.max(0.035, beam * 0.16);
      for (let i = 0; i < 3; i++) {
        const band = new THREE.CylinderGeometry(post * 0.74 + turn * 0.4, post * 0.74 + turn * 0.4, turn, 4, 1, true);
        band.rotateY(Math.PI / 4);
        band.translate(x, top - turn * 0.9 - i * turn * 1.15, z);
        ropes.push(band);
      }
    }
    // Under the rails the pad is a wall, so it is boarded: the net is not a roof that can be walked under.
    const skirt = thick + PROUD - deep;
    if (skirt > 0.05) for (const side of [-1, 1]) {
      shade.push(timber(0.07, skirt, d - post * 2, side * (w / 2 - 0.035 - beam * 0.2), top - deep - skirt / 2, 0, 'z'));
      shade.push(timber(w - post * 2, skirt, 0.07, 0, top - deep - skirt / 2, side * (d / 2 - 0.035 - beam * 0.2), 'x'));
    }
    const add = (pieces: THREE.BufferGeometry[], material: THREE.Material, name: string): void => {
      if (!pieces.length) return;
      // (the cylinder bands are indexed and so are the boxes; one of each kind per mesh)
      const mesh = new THREE.Mesh(mergeGeometries(pieces), material);
      pieces.forEach(piece => piece.dispose());
      mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true;
      mount.add(mesh);
    };
    add(wood, this.timberMaterial, 'Rope trampoline: timber frame and posts');
    add(shade, this.inner, 'Rope trampoline: boarded sides');
    add(ropes, this.rope, 'Rope trampoline: corner lashings');
    const well = new THREE.Mesh(new THREE.PlaneGeometry(w - beam * 0.6, d - beam * 0.6), this.dark);
    well.rotation.x = -Math.PI / 2;
    well.position.y = -thick / 2 + 0.02;
    well.name = 'Rope trampoline: the dark under the net';
    mount.add(well);
    return well;
  }

  /**
   * What lies under the net, measured once the whole course is built: the nearest floor under five points of
   * the pad's top. The net goes down no further than that, less a little, and no further than the pad is deep;
   * and where a floor of the course lies inside the pad, that floor is the bottom of the well, not ours.
   */
  private measure(entry: Entry): void {
    entry.measured = true;
    const { mesh, thick, net, well } = entry;
    mesh.updateWorldMatrix(true, false);
    const others = this.ground.filter(object => object !== mesh);
    const [x0, x1, z0, z1] = net.bounds, from = new THREE.Vector3(), down = new THREE.Vector3(0, -1, 0);
    let clear = Infinity;
    for (const [fx, fz] of [[.5, .5], [.2, .2], [.8, .2], [.2, .8], [.8, .8]]) {
      mesh.localToWorld(from.set(x0 + (x1 - x0) * fx, thick / 2, z0 + (z1 - z0) * fz));
      this.probe.set(from.clone().add(new THREE.Vector3(0, 0.01, 0)), down);
      this.probe.far = thick + 3;
      const hit = this.probe.intersectObjects(others, false)[0];
      if (hit) clear = Math.min(clear, hit.distance - 0.01);
    }
    well.visible = clear > thick + 0.03;
    net.setFloor(Math.max(0, Math.min(clear, thick) - 0.05));
    mesh.userData.ropeNetClearance = Number.isFinite(clear) ? clear : null;
  }

  update(dt: number): void {
    for (const entry of this.entries) {
      if (!entry.measured) this.measure(entry);
      const impact = entry.mesh.userData.trampolineVisualImpact;
      if (impact && impact.id !== entry.impact) { entry.impact = impact.id; entry.net.impact(impact.x, impact.z, impact.speed); }
      entry.net.update(dt);
    }
  }

  dispose(): void {
    for (const { mesh, material, mount, net } of this.entries) {
      trampolineSurfacePresentations.delete(mesh);
      delete mesh.userData.ropeNet; delete mesh.userData.ropeNetClearance;
      net.dispose();
      (mesh.material as THREE.Material).dispose();
      mesh.material = material;
      mount.traverse(object => { const m = object as THREE.Mesh; if (m.isMesh && !m.geometry.userData.shared) m.geometry.dispose(); });
      mount.removeFromParent();
    }
    this.entries.length = 0;
    this.dark.dispose(); this.rope.dispose(); this.inner.dispose(); this.timberMaterial.dispose();
  }
}

/** Dress every trampoline of the course that nothing else has dressed. `timber` makes the frame's material. */
export function createRopeTrampolines(data: CustomLevelData, ground: THREE.Object3D[], timber: () => THREE.Material): RopeTrampolines | null {
  const plain = ground.some(object => object.userData.trampolineBounce !== undefined && !trampolineSurfacePresentations.has(object)
    && data.components[object.userData.editorIdx]?.t === 'trampoline');
  return plain ? new RopeTrampolines(data, ground, timber()) : null;
}
