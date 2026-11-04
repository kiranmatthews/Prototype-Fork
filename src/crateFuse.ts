import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CONST } from './tuning';

export interface CrateFuse {
  root: THREE.Group;
  tip: THREE.Group;
  sparks: THREE.LineSegments;
  fraction: { value: number };
  lit: { value: number };
  clock: { value: number };
  bend: { value: number };
  velocity: number;
}
let braidGeometry: THREE.BufferGeometry | undefined;
let glowMap: THREE.CanvasTexture | undefined;
function point(t: number, target = new THREE.Vector3()): THREE.Vector3 {
  return target.set(.34 * t * t, .468 + .68 * t - .30 * t * t, .055 * Math.sin(t * Math.PI));
}
function braid(): THREE.BufferGeometry {
  if (braidGeometry) return braidGeometry;
  const pieces: THREE.BufferGeometry[] = [];
  for (let strand = 0; strand < 3; strand++) {
    class Fibre extends THREE.Curve<THREE.Vector3> {
      constructor() { super(); }
      getPoint(t: number, target = new THREE.Vector3()): THREE.Vector3 {
        point(t, target); const a = t * Math.PI * 10 + strand * Math.PI * 2 / 3;
        const tx = .68 * t, ty = .68 - .60 * t, length = Math.hypot(tx, ty);
        target.x += Math.cos(a) * .021 * ty / length;
        target.y -= Math.cos(a) * .021 * tx / length;
        target.z += Math.sin(a) * .021; return target;
      }
    }
    const g = new THREE.TubeGeometry(new Fibre(), 48, .0175, 6, false);
    const along = new Float32Array(g.getAttribute('position').count);
    for (let i = 0; i < along.length; i++) along[i] = g.getAttribute('uv').getX(i);
    g.setAttribute('fuseAlong', new THREE.Float32BufferAttribute(along, 1)); pieces.push(g);
  }
  braidGeometry = mergeGeometries(pieces)!; pieces.forEach(p => p.dispose()); braidGeometry.userData.shared = true;
  return braidGeometry;
}
function glow(): THREE.CanvasTexture {
  if (glowMap) return glowMap;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const c = canvas.getContext('2d')!, g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, '#fffde7'); g.addColorStop(.18, '#ffe29c'); g.addColorStop(.48, '#ff9f2677'); g.addColorStop(1, '#ff520000');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  glowMap = new THREE.CanvasTexture(canvas); glowMap.colorSpace = THREE.SRGBColorSpace; glowMap.userData.shared = true; return glowMap;
}
export function createCrateFuse(): CrateFuse {
  const root = new THREE.Group(); root.name = 'Chunky braided TNT fuse with flexible follow-through';
  const fraction = { value: 1 }, lit = { value: 0 }, clock = { value: 0 }, bend = { value: 0 };
  const rope = new THREE.MeshStandardMaterial({ color: 0xd6a452, roughness: .86 });
  rope.userData.levelDepthFade = false;
  rope.onBeforeCompile = shader => {
    shader.uniforms.fuseFraction = fraction; shader.uniforms.fuseLit = lit; shader.uniforms.fuseClock = clock; shader.uniforms.fuseBend = bend;
    shader.vertexShader = `attribute float fuseAlong; varying float vFuseAlong; uniform float fuseClock; uniform float fuseBend; uniform float fuseLit;\n${shader.vertexShader}`.replace('#include <begin_vertex>', `#include <begin_vertex>
      vFuseAlong = fuseAlong;
      float weight = fuseAlong * fuseAlong;
      transformed.x += weight * (.018 * sin(fuseClock * 2.2 - fuseAlong * 2.0) + fuseBend * .13 + fuseLit * .004 * sin(fuseClock * 29.0 - fuseAlong * 5.0));
      transformed.z += weight * .016 * sin(fuseClock * 1.8 - fuseAlong * 2.6);
    `);
    shader.fragmentShader = `uniform float fuseFraction; uniform float fuseLit; varying float vFuseAlong;\n${shader.fragmentShader}`.replace('#include <color_fragment>', `#include <color_fragment>
      if (vFuseAlong > fuseFraction) discard;
      float scorch = (1.0 - smoothstep(0.0, .085, fuseFraction - vFuseAlong)) * fuseLit;
      diffuseColor.rgb *= .9 + .1 * sin(vFuseAlong * 360.0);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.025, .009, .003), scorch);
    `);
  };
  rope.customProgramCacheKey = () => 'chunky-tnt-braid-v3';
  const mesh = new THREE.Mesh(braid(), rope); root.add(mesh);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(.047, .011, 6, 16), new THREE.MeshStandardMaterial({ color: 0x6b3e20, roughness: .8 }));
  collar.rotation.x = Math.PI / 2; collar.position.y = .465; root.add(collar);
  const tip = new THREE.Group(), ember = new THREE.Mesh(new THREE.IcosahedronGeometry(.041, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.1, .12), toneMapped: false }));
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: 0xffbe45, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }));
  halo.scale.setScalar(.24); tip.add(ember, halo); tip.visible = false; root.add(tip);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(10 * 6), 3).setUsage(THREE.DynamicDrawUsage));
  const sparks = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xffd66a, transparent: true, opacity: .9, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
  sparks.visible = false; sparks.frustumCulled = false; root.add(sparks);
  return { root, tip, sparks, fraction, lit, clock, bend, velocity: 0 };
}
export function kickCrateFuse(fuse: CrateFuse, strength: number): void { fuse.velocity += strength * 3.5; }
export function updateCrateFuse(fuse: CrateFuse, remaining: number | undefined, time: number, dt: number): void {
  const active = remaining !== undefined && remaining > 0;
  fuse.fraction.value = remaining === undefined ? 1 : THREE.MathUtils.clamp(remaining / CONST.tntFuse, 0, 1);
  fuse.lit.value = active ? 1 : 0; fuse.clock.value = time; fuse.tip.visible = fuse.sparks.visible = active;
  const step = Math.min(.04, Math.max(0, dt));
  fuse.velocity += (-fuse.bend.value * 64 - fuse.velocity * 7) * step;
  fuse.bend.value += fuse.velocity * step;
  if (!active) return;
  point(fuse.fraction.value, fuse.tip.position); fuse.tip.scale.setScalar(.86 + Math.sin(time * 67) * .12);
  const t = fuse.fraction.value, weight = t * t;
  fuse.tip.position.x += weight * (.018 * Math.sin(time * 2.2 - t * 2) + fuse.bend.value * .13 + fuse.lit.value * .004 * Math.sin(time * 29 - t * 5));
  fuse.tip.position.z += weight * .016 * Math.sin(time * 1.8 - t * 2.6);
  const p = fuse.sparks.geometry.getAttribute('position'), tip = fuse.tip.position;
  for (let i = 0; i < 10; i++) {
    const age = (time * 4 + i * .1) % 1, a = i * 2.39996, speed = .10 + (i % 3) * .028;
    const x = Math.cos(a) * speed, z = Math.sin(a) * speed, y = .14 + (i % 2) * .04;
    const tail = Math.max(0, age - .13);
    p.setXYZ(i * 2, tip.x + x * age, tip.y + y * age - .14 * age * age, tip.z + z * age);
    p.setXYZ(i * 2 + 1, tip.x + x * tail, tip.y + y * tail - .14 * tail * tail, tip.z + z * tail);
  }
  p.needsUpdate = true;
}
