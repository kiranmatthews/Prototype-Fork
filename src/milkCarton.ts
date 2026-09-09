import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** The body keeps the crate's original support volume. The gable is presentation only. */
export const CARTON_TOP_HEIGHT = 0.4;
export interface MilkCarton {
  body: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  top: THREE.Mesh;
  expansion: number;
  previousExpansion: number;
  lastExpansion: number;
  velocity: number;
  covered: boolean;
  pressTime: number;
  pressTarget: number;
  renderable: boolean;
}

let face: THREE.CanvasTexture | undefined;
/** Vector lettering keeps the print crisp and independent of font loading. */
export function milkCartonTexture(): THREE.CanvasTexture {
  if (face) return face;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f4ecd9'; ctx.fillRect(0, 0, 512, 512);
  // Subtle folded board edges, without the dark frame of the old timber boxes.
  ctx.fillStyle = '#e9dfc9'; ctx.fillRect(0, 503, 512, 9);
  ctx.fillStyle = '#fbf5e7'; ctx.fillRect(0, 0, 512, 5);
  ctx.fillStyle = '#db3023';
  const letters = [
    [[0,0],[.31,0],[.5,.22],[.69,0],[1,0],[1,1],[.68,1],[.68,.58],[.5,.77],[.32,.58],[.32,1],[0,1]],
    [[0,0],[1,0],[1,1],[0,1]],
    [[0,0],[.43,0],[.43,.72],[1,.72],[1,1],[0,1]],
    [[0,0],[.39,0],[.39,.39],[.71,0],[1,0],[.65,.49],[1,1],[.67,1],[.39,.62],[.39,1],[0,1]],
  ];
  const widths = [125, 43, 85, 115];
  let x = 48;
  letters.forEach((points, i) => {
    ctx.beginPath();
    points.forEach(([u,v], j) => j ? ctx.lineTo(x + u * widths[i], 183 + v * 161) : ctx.moveTo(x + u * widths[i], 183 + v * 161));
    ctx.closePath(); ctx.fill(); x += widths[i] + 12;
  });
  face = new THREE.CanvasTexture(canvas);
  face.colorSpace = THREE.SRGBColorSpace;
  face.anisotropy = 4;
  face.name = 'cream cardboard / red MILK print';
  face.userData.shared = true;
  return face;
}

/** Satin coated cardboard: dielectric highlights and restrained paper fibre variation. */
export class CardboardMaterial extends THREE.MeshStandardMaterial {
  constructor(printed = false) {
    super({ color: printed ? 0xffffff : 0xf4ecd9, map: printed ? milkCartonTexture() : null, roughness: 0.78, metalness: 0 });
    this.name = 'milk carton cardboard';
    this.onBeforeCompile = shader => {
      shader.vertexShader = 'varying vec3 vCardboardPosition;\n' + shader.vertexShader
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCardboardPosition = position;');
      shader.fragmentShader = /* glsl */ `
varying vec3 vCardboardPosition;
float paperGrain(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}
` + shader.fragmentShader
        .replace('#include <color_fragment>', /* glsl */ `
#include <color_fragment>
float fibre = paperGrain(floor(vCardboardPosition * vec3(370.0, 610.0, 370.0)));
// Fade the fine grain at game-camera distances to prevent shimmering.
float grainVisibility = 1.0 - smoothstep(0.001, 0.008, length(fwidth(vCardboardPosition)));
diffuseColor.rgb *= 1.0 + (fibre - 0.5) * 0.035 * grainVisibility;
`)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor + (fibre - 0.5) * 0.07 * grainVisibility, 0.0, 1.0);');
    };
  }
  customProgramCacheKey(): string { return 'milk-cardboard-v1'; }
}

const bodies = new Map<number, THREE.BufferGeometry>();
function bodyGeometry(size: number): THREE.BufferGeometry {
  let geometry = bodies.get(size);
  if (geometry) return geometry;
  geometry = new RoundedBoxGeometry(size, size, size, 2, size * 0.018);
  // One material permits existing time/boost face swaps. Lid and base sample
  // unprinted paper, while each of the four sides has an upright MILK label.
  const uv = geometry.getAttribute('uv');
  for (const group of geometry.groups) if (group.materialIndex === 2 || group.materialIndex === 3)
    for (let i = group.start; i < group.start + group.count; i++) uv.setXY(i, 0.08, 0.08);
  geometry.clearGroups();
  geometry.name = 'bevelled one-unit carton body';
  geometry.userData.shared = true;
  bodies.set(size, geometry);
  return geometry;
}

let gable: THREE.BufferGeometry | undefined;
function topGeometry(): THREE.BufferGeometry {
  if (gable) return gable;
  const vertices: number[] = [];
  const triangle = (a: number[], b: number[], c: number[]) => vertices.push(...a, ...b, ...c);
  const quad = (a: number[], b: number[], c: number[], d: number[]) => { triangle(a,b,c); triangle(a,c,d); };
  const w = .488, d = .488, r = .468, h = .30;
  // Sloping folded shoulders. A tiny gusset inset gives the end folds real
  // changing normals, instead of drawing a triangle onto a rectangular lid.
  quad([-w,0,d], [w,0,d], [r,h,.012], [-r,h,.012]);
  quad([w,0,-d], [-w,0,-d], [-r,h,-.012], [r,h,-.012]);
  for (const side of [-1,1]) {
    const a=[side*w,0,side*d], b=[side*w,0,-side*d], c=[side*r,h,0], fold=[side*.459,.095,0];
    triangle(a,b,fold); triangle(b,c,fold); triangle(c,a,fold);
  }
  quad([-w,0,-d], [w,0,-d], [w,0,d], [-w,0,d]);
  const roof = new THREE.BufferGeometry();
  roof.setAttribute('position', new THREE.Float32BufferAttribute(vertices,3));
  roof.computeVertexNormals();
  // The sealed crimp is a thin bevelled strip, attached to the ridge.
  const seam = new RoundedBoxGeometry(r*2, CARTON_TOP_HEIGHT-h+.012, .034, 1, .006);
  seam.translate(0, h+(CARTON_TOP_HEIGHT-h)/2-.006, 0);
  seam.deleteAttribute('uv'); seam.clearGroups();
  gable = mergeGeometries([roof,seam])!;
  roof.dispose(); seam.dispose();
  gable.name = 'folded gable / inset gussets / sealed crimp';
  gable.userData.shared = true;
  return gable;
}

export function createMilkCarton(size = 1): MilkCarton {
  const body = new THREE.Mesh(bodyGeometry(size), new CardboardMaterial(true));
  const top = new THREE.Mesh(topGeometry(), new CardboardMaterial());
  body.name = 'Milk carton'; top.name = 'Folding carton top';
  top.position.y = size * .493;
  top.scale.setScalar(size);
  top.userData.cartonSize = size;
  body.castShadow = top.castShadow = true;
  body.receiveShadow = top.receiveShadow = true;
  body.add(top);
  return { body, top, expansion: 1, previousExpansion: 1, lastExpansion: 1, velocity: 0, covered: false, pressTime: 0, pressTarget: 1, renderable: true };
}

export function setCartonExpansion(carton: MilkCarton, expansion: number): void {
  carton.expansion = expansion;
  carton.top.scale.y = (carton.top.userData.cartonSize as number) * Math.max(.001, expansion);
}

/** Constrain the visual fold to the descending sole, without moving its collider. */
export function pressMilkCarton(carton: MilkCarton, clearance = 0): void {
  const target = THREE.MathUtils.clamp(clearance / ((carton.top.userData.cartonSize as number) * CARTON_TOP_HEIGHT), 0, 1);
  carton.pressTarget = carton.pressTime > 0 ? Math.min(carton.pressTarget, target) : target;
  carton.pressTime = .12;
  // Weight owns the entire downstroke. Do not add an autonomous crush tween
  // or carry spring velocity into contact: a paused foot means a paused fold.
  carton.velocity = 0;
  setCartonExpansion(carton, Math.min(carton.expansion, target));
}

export function updateMilkCarton(carton: MilkCarton, dt: number, alive = true, pending = false): void {
  if (dt > 0) carton.previousExpansion = carton.lastExpansion;
  carton.pressTime = Math.max(0, carton.pressTime - dt);
  const target = !alive || carton.covered || pending ? 0 : carton.pressTime > 0 ? carton.pressTarget : 1;
  // Bounded substeps make the soft return stable during slow frames and at
  // 30/60/120 Hz. Covered tops stay fully within their cube immediately.
  if (carton.covered || pending) {
    carton.velocity = 0; setCartonExpansion(carton, 0);
  } else {
    let remaining = Math.min(dt, .1);
    while (remaining > 0) {
      const step = Math.min(remaining, 1/120); remaining -= step;
      carton.velocity += ((target-carton.expansion)*190 - carton.velocity*23) * step;
      setCartonExpansion(carton, THREE.MathUtils.clamp(carton.expansion + carton.velocity*step, 0, 1.015));
    }
  }
  carton.renderable = !pending && !carton.covered;
  carton.top.visible = carton.renderable && carton.expansion > .005;
  if (dt > 0) carton.lastExpansion = carton.expansion;
}

/** Use the same fixed-step interpolation as the character's feet. */
export function renderMilkCarton(carton: MilkCarton, alpha: number): void {
  const expansion = THREE.MathUtils.lerp(carton.previousExpansion, carton.expansion, alpha);
  carton.top.scale.y = (carton.top.userData.cartonSize as number) * Math.max(.001, expansion);
  carton.top.visible = carton.renderable && expansion > .005;
}
