import * as THREE from 'three';
import { LOOP_TURN, sampleLoop, type LoopShape } from './loopRide';

/**
 * THE BODY OF A PLANAR LOOP. Its riding ribbon is a surface with no thickness, and a planar loop is the one a
 * side-scrolling course carries: seen from the side that ribbon is edge-on, a hairline. This gives the ring
 * a body that reads from there: a shell outside the ribbon, a striped rim down each edge of it standing a
 * little proud of the riding surface (the stripes are what the eye follows round), and a frame of struts
 * behind it down to the ground it stands on.
 *
 * All of it hangs off the ribbon's own mesh, in the ribbon's frame (the ring stands in local YZ, its foot at
 * the origin, the ribbon's width along X), and none of it is solid: a planar loop is ridden by its centreline
 * alone, and a walker goes along the floor between its rims.
 */

const SEGMENTS = 96;
/** Stripes round the whole ring, on each rim. */
const STRIPES = 24;
const STRIPE_A = new THREE.Color('#e8432e');
const STRIPE_B = new THREE.Color('#f4ead2');
const SHELL = new THREE.Color('#2e3f52');
const FRAME = '#34465a';

export interface PlanarLoopLook {
  /** Shell thickness outside the ribbon, metres. */
  thickness: number;
  /** How far each rim stands in over the riding surface, metres. */
  kerb: number;
}

export function planarLoopLook(radius: number): PlanarLoopLook {
  return { thickness: THREE.MathUtils.clamp(radius * 0.075, 0.3, 0.6), kerb: 0.12 };
}

/** Hang the ring's body on a planar loop's ribbon. */
export function dressPlanarLoop(ribbon: THREE.Mesh, shape: LoopShape): THREE.Group {
  const { radius: r, width: w } = shape, { thickness: t, kerb } = planarLoopLook(r);
  const body = new THREE.Group();
  body.name = 'Planar loop: shell, rims and frame';
  const position: number[] = [], color: number[] = [], normal: number[] = [];
  /** A quad that faces `n`, whichever way round its corners were given. */
  const quad = (a: number[], b: number[], c: number[], d: number[], n: number[], tint: THREE.Color): void => {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const facing = (u[1] * v[2] - u[2] * v[1]) * n[0] + (u[2] * v[0] - u[0] * v[2]) * n[1] + (u[0] * v[1] - u[1] * v[0]) * n[2];
    for (const p of facing >= 0 ? [a, b, c, a, c, d] : [a, c, b, a, d, c]) {
      position.push(p[0], p[1], p[2]); normal.push(n[0], n[1], n[2]); color.push(tint.r, tint.g, tint.b);
    }
  };
  // A point of the ring at `angle`, `out` metres outside the riding surface (negative: inside it), `x` across.
  const at = (angle: number, out: number, x: number): number[] => {
    const s = sampleLoop(shape, angle);
    return [x, s.point[1] - s.normal[1] * out, s.point[2] - s.normal[2] * out];
  };
  for (let i = 0; i < SEGMENTS; i++) {
    const a0 = i / SEGMENTS * LOOP_TURN, a1 = (i + 1) / SEGMENTS * LOOP_TURN, mid = (a0 + a1) / 2;
    const n = sampleLoop(shape, mid).normal, outward = [0, -n[1], -n[2]];
    const stripe = Math.floor(i / (SEGMENTS / STRIPES)) % 2 ? STRIPE_A : STRIPE_B;
    // the shell's back, facing out of the ring
    quad(at(a0, t, -w / 2), at(a1, t, -w / 2), at(a1, t, w / 2), at(a0, t, w / 2), outward, SHELL);
    for (const side of [-1, 1]) {
      const x = side * w / 2, inner = side * (w / 2 - 0.08);
      // the rim: from a kerb's height inside the riding surface out to the shell's back
      quad(at(a0, -kerb, x), at(a1, -kerb, x), at(a1, t, x), at(a0, t, x), [side, 0, 0], stripe);
      // the kerb's top and its inner face, so the rim is a solid thing from inside the ring too
      quad(at(a0, -kerb, x), at(a1, -kerb, x), at(a1, -kerb, inner), at(a0, -kerb, inner), n, stripe);
      quad(at(a0, -kerb, inner), at(a1, -kerb, inner), at(a1, 0, inner), at(a0, 0, inner), [-side, 0, 0], stripe);
    }
  }
  const ring = new THREE.BufferGeometry();
  ring.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  ring.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  ring.setAttribute('color', new THREE.Float32BufferAttribute(color, 3));
  const shell = new THREE.Mesh(ring, new THREE.MeshLambertMaterial({ vertexColors: true }));
  shell.name = 'Planar loop: shell and striped rims';
  body.add(shell);

  // The frame, on the ribbon's -X side (behind it, for a course seen from its +X side: a loop at yaw -90 on a
  // line read from the south): two raking struts up to the ring's shoulders, a post at each of its flanks,
  // and a sole plate along the ground they stand on.
  const steel = new THREE.MeshLambertMaterial({ color: FRAME });
  const beam = new THREE.BoxGeometry(1, 1, 1);
  const x = -w / 2 - 0.22, section = THREE.MathUtils.clamp(r * 0.05, 0.2, 0.34);
  const strut = (y0: number, z0: number, y1: number, z1: number, across = section): void => {
    const length = Math.hypot(y1 - y0, z1 - z0);
    const mesh = new THREE.Mesh(beam, steel);
    mesh.scale.set(across, length, section);
    mesh.position.set(x, (y0 + y1) / 2, (z0 + z1) / 2);
    mesh.rotation.x = Math.atan2(z1 - z0, y1 - y0);
    body.add(mesh);
  };
  const reach = r + t;
  for (const side of [-1, 1]) {
    // (a shoulder: 40 degrees off the crown; a flank: the ring's widest point)
    strut(0, side * reach * 1.42, r + reach * Math.cos(0.7), side * reach * Math.sin(0.7));
    strut(0, side * (reach + section * 0.6), r, side * (reach + section * 0.6));
  }
  strut(section / 2, -reach * 1.5, section / 2, reach * 1.5);

  body.traverse(object => {
    object.userData.visualOnly = true; object.userData.solidSurface = 'none';
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; }
  });
  ribbon.add(body);
  return body;
}
